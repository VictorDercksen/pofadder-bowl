"use client";

import { Upload } from "tus-js-client";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { createClient } from "@/lib/supabase/client";
import { resumableEndpoint } from "@/lib/env";
import { RESUMABLE_THRESHOLD, TUS_CHUNK_SIZE } from "@/lib/evidence-rules";
import { attachFile, prepareUpload } from "@/lib/actions/evidence";

export type UploadProgress = { loaded: number; total: number };

export type UploadHandle = { abort: () => void; done: Promise<{ ok: true; fileId?: string; path: string } | { ok: false; message: string }> };

/**
 * Uploads a file directly from the browser into the private bucket:
 * signed single upload for small files, resumable TUS for larger ones.
 * The server action validates type/size/ownership first; storage RLS enforces the same.
 */
export function uploadEvidence(submissionId: string, file: File, onProgress: (p: UploadProgress) => void): UploadHandle {
  let abortFn = () => {};
  const done = (async () => {
    const prep = await prepareUpload({ submissionId, fileName: file.name, mimeType: file.type, byteSize: file.size });
    if (!prep.ok) return prep;
    const supabase = createClient();

    if (prep.mode === "signed" && file.size <= RESUMABLE_THRESHOLD) {
      const controller = new AbortController();
      abortFn = () => controller.abort();
      onProgress({ loaded: 0, total: file.size });
      const { error } = await supabase.storage.from("evidence").uploadToSignedUrl(prep.path, prep.token, file, { contentType: prep.mime, upsert: false });
      if (controller.signal.aborted) return { ok: false as const, message: "Upload cancelled." };
      if (error) return { ok: false as const, message: `Upload failed: ${error.message}` };
      onProgress({ loaded: file.size, total: file.size });
    } else {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return { ok: false as const, message: "Your session expired. Sign in again; the draft is kept on this device." };
      const result = await new Promise<{ ok: true } | { ok: false; message: string }>((resolve) => {
        const upload = new Upload(file, {
          endpoint: resumableEndpoint(),
          retryDelays: [0, 3000, 5000, 10000, 20000],
          headers: { authorization: `Bearer ${token}`, "x-upsert": "false" },
          uploadDataDuringCreation: true,
          removeFingerprintOnSuccess: true,
          chunkSize: TUS_CHUNK_SIZE,
          metadata: { bucketName: "evidence", objectName: prep.path, contentType: prep.mime, cacheControl: "3600" },
          onError: (err) => resolve({ ok: false, message: `Resumable upload failed: ${err.message}` }),
          onProgress: (loaded, total) => onProgress({ loaded, total }),
          onSuccess: () => resolve({ ok: true }),
        });
        abortFn = () => {
          upload.abort(true).catch(() => {});
          resolve({ ok: false, message: "Upload cancelled." });
        };
        upload.findPreviousUploads().then((previous) => {
          if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
          upload.start();
        });
      });
      if (!result.ok) return result;
    }

    const attached = await attachFile({ submissionId, path: prep.path, mimeType: file.type || prep.mime, byteSize: file.size, originalName: file.name });
    if (!attached.ok) return attached;
    return { ok: true as const, fileId: attached.fileId, path: prep.path };
  })();
  return { abort: () => abortFn(), done };
}

// ---------------------------------------------------------------------------
// Local drafts (IndexedDB): evidence is never silently discarded.
// ---------------------------------------------------------------------------
export type LocalDraftFile = { id: string; name: string; type: string; size: number; blob: Blob; status: "queued" | "uploaded" | "failed"; error?: string };
export type LocalDraft = { key: string; targetId: string; targetKind: "challenge" | "press"; submissionId?: string; caption: string; files: LocalDraftFile[]; updatedAt: number };

interface DraftDB extends DBSchema {
  drafts: { key: string; value: LocalDraft };
}

let dbPromise: Promise<IDBPDatabase<DraftDB>> | null = null;
function db() {
  if (!dbPromise) dbPromise = openDB<DraftDB>("pofadder-drafts", 1, { upgrade(d) { d.createObjectStore("drafts", { keyPath: "key" }); } });
  return dbPromise;
}

export async function loadDraft(key: string): Promise<LocalDraft | undefined> {
  try {
    return await (await db()).get("drafts", key);
  } catch {
    return undefined;
  }
}

export async function saveDraft(draft: LocalDraft): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await (await db()).put("drafts", { ...draft, updatedAt: Date.now() });
    return { ok: true };
  } catch (err) {
    const e = err as DOMException;
    if (e?.name === "QuotaExceededError") return { ok: false, message: "This device is out of storage space for offline drafts. Free some space or upload now." };
    return { ok: false, message: "Could not save the draft on this device (private browsing may block storage)." };
  }
}

export async function clearDraft(key: string): Promise<void> {
  try {
    await (await db()).delete("drafts", key);
  } catch {
    // ignore
  }
}

export async function listDrafts(): Promise<LocalDraft[]> {
  try {
    return await (await db()).getAll("drafts");
  } catch {
    return [];
  }
}
