"use client";

import { Upload } from "tus-js-client";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { createClient } from "@/lib/supabase/client";
import { publicEnv, resumableEndpoint } from "@/lib/env";
import { RESUMABLE_THRESHOLD, STORAGE_MAX_BYTES, TUS_CHUNK_SIZE, MB } from "@/lib/evidence-rules";
import { attachFile, prepareUpload } from "@/lib/actions/evidence";

export type UploadStage = "preparing" | "uploading" | "saving";
export type UploadProgress = { loaded: number; total: number; stage: UploadStage };

export type UploadHandle = { abort: () => void; done: Promise<{ ok: true; fileId?: string; path: string } | { ok: false; message: string }> };

/** No progress event for this long means the request is stuck (a stalled radio, a blocked host); the attempt is abandoned and retried. */
const STALL_MS = 60_000;
/** Direct uploads retry on network drops and server errors; never on a 4xx, which will not change. */
const RETRY_DELAYS_MS = [2_000, 6_000];

type DirectResult = { ok: true } | { ok: false; status: number; message: string; retry: boolean };

/** Plain words for the storage host's answer. */
function explainStatus(status: number, text: string): string {
  if (status === 413) return `This file is bigger than the storage limit (${STORAGE_MAX_BYTES / MB} MB). Trim the clip or record at a lower resolution.`;
  if (status === 401 || status === 403) return "Storage refused the upload (signed out or not the participant). Reload the page and try again; the draft is kept on this device.";
  if (status === 409) return "A file with this name is already in the locker. Remove it there, or retry to upload under a new name.";
  if (status === 0) return "The connection dropped before storage answered. Check the signal and retry.";
  if (status >= 500) return `Storage had a problem (${status}). Retry in a moment.`;
  return `Storage answered ${status}${text ? `: ${text.slice(0, 160)}` : ""}.`;
}

/**
 * One PUT to the signed upload URL with real progress events (supabase-js uses fetch, which has
 * none). Resolves on any HTTP answer; rejects only on abort.
 */
function putSigned(file: File, path: string, token: string, bearer: string | null, mime: string, onProgress: (loaded: number) => void, signal: AbortSignal): Promise<DirectResult> {
  return new Promise((resolve) => {
    const base = publicEnv.supabaseUrl.replace(/\/$/, "");
    const url = `${base}/storage/v1/object/upload/sign/evidence/${path.split("/").map(encodeURIComponent).join("/")}?token=${encodeURIComponent(token)}`;
    const xhr = new XMLHttpRequest();
    let stall = 0;
    const armStall = () => {
      window.clearTimeout(stall);
      stall = window.setTimeout(() => xhr.abort(), STALL_MS);
    };
    const finish = (r: DirectResult) => {
      window.clearTimeout(stall);
      signal.removeEventListener("abort", onAbort);
      resolve(r);
    };
    const onAbort = () => xhr.abort();
    signal.addEventListener("abort", onAbort);
    xhr.open("PUT", url);
    // Same headers supabase-js sends for a signed upload: the publishable key, the session (when there is one) and no overwrite.
    xhr.setRequestHeader("apikey", publicEnv.supabasePublishableKey);
    if (bearer) xhr.setRequestHeader("authorization", `Bearer ${bearer}`);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("content-type", mime || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      armStall();
      onProgress(e.loaded);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) finish({ ok: true });
      else finish({ ok: false, status: xhr.status, message: explainStatus(xhr.status, xhr.responseText), retry: xhr.status >= 500 || xhr.status === 429 });
    };
    xhr.onerror = () => finish({ ok: false, status: 0, message: explainStatus(0, ""), retry: true });
    xhr.onabort = () => finish(signal.aborted ? { ok: false, status: 0, message: "Upload cancelled.", retry: false } : { ok: false, status: 0, message: `No progress for ${STALL_MS / 1000} s. The connection stalled; retrying.`, retry: true });
    armStall();
    xhr.send(file);
  });
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Uploads a file directly from the browser into the private bucket: one signed upload for
 * anything the plan can take (with retries on dropped connections), resumable TUS above that.
 * The server action validates type/size/ownership first; storage RLS enforces the same.
 */
export function uploadEvidence(submissionId: string, file: File, onProgress: (p: UploadProgress) => void): UploadHandle {
  const controller = new AbortController();
  let abortTus = () => {};
  const done = (async () => {
    onProgress({ loaded: 0, total: file.size, stage: "preparing" });
    let path = "";
    let mime = file.type;

    if (file.size <= RESUMABLE_THRESHOLD) {
      const { data: sessionData } = await createClient().auth.getSession();
      const bearer = sessionData.session?.access_token ?? null;
      let last: DirectResult = { ok: false, status: 0, message: "Upload did not start.", retry: false };
      for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
        if (controller.signal.aborted) return { ok: false as const, message: "Upload cancelled." };
        if (attempt > 0) await wait(RETRY_DELAYS_MS[attempt - 1]);
        // A fresh signed URL each attempt: the token is short-lived and the path must not collide with a half-written object.
        const prep = await prepareUpload({ submissionId, fileName: file.name, mimeType: file.type, byteSize: file.size });
        if (!prep.ok) return prep;
        if (prep.mode !== "signed") return { ok: false as const, message: "Storage did not issue an upload link. Retry." };
        path = prep.path;
        mime = prep.mime;
        onProgress({ loaded: 0, total: file.size, stage: "uploading" });
        last = await putSigned(file, prep.path, prep.token, bearer, prep.mime, (loaded) => onProgress({ loaded, total: file.size, stage: "uploading" }), controller.signal);
        if (last.ok || !last.retry) break;
      }
      if (!last.ok) return { ok: false as const, message: last.message };
    } else {
      const prep = await prepareUpload({ submissionId, fileName: file.name, mimeType: file.type, byteSize: file.size });
      if (!prep.ok) return prep;
      path = prep.path;
      mime = prep.mime;
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return { ok: false as const, message: "Your session expired. Sign in again; the draft is kept on this device." };
      const result = await new Promise<{ ok: true } | { ok: false; message: string }>((resolve) => {
        let stall = 0;
        const armStall = () => {
          window.clearTimeout(stall);
          stall = window.setTimeout(() => {
            upload.abort(true).catch(() => {});
            resolve({ ok: false, message: `No progress for ${STALL_MS / 1000} s. The connection stalled; retry the upload.` });
          }, STALL_MS);
        };
        const upload = new Upload(file, {
          endpoint: resumableEndpoint(),
          retryDelays: [0, 3000, 5000, 10000, 20000],
          headers: { authorization: `Bearer ${token}`, apikey: publicEnv.supabasePublishableKey, "x-upsert": "false" },
          uploadDataDuringCreation: true,
          removeFingerprintOnSuccess: true,
          chunkSize: TUS_CHUNK_SIZE,
          metadata: { bucketName: "evidence", objectName: prep.path, contentType: prep.mime, cacheControl: "3600" },
          onShouldRetry: (err) => {
            const status = err.originalResponse?.getStatus() ?? 0;
            return status === 0 || status >= 500 || status === 409 || status === 423 || status === 429;
          },
          onError: (err) => {
            window.clearTimeout(stall);
            const detailed = err as { originalResponse?: { getStatus(): number; getBody(): string } | null };
            const status = detailed.originalResponse?.getStatus() ?? 0;
            const text = detailed.originalResponse?.getBody() ?? "";
            resolve({ ok: false, message: status ? explainStatus(status, text) : `Resumable upload failed: ${err.message}` });
          },
          onProgress: (loaded, total) => {
            armStall();
            onProgress({ loaded, total, stage: "uploading" });
          },
          onSuccess: () => {
            window.clearTimeout(stall);
            resolve({ ok: true });
          },
        });
        abortTus = () => {
          window.clearTimeout(stall);
          upload.abort(true).catch(() => {});
          resolve({ ok: false, message: "Upload cancelled." });
        };
        onProgress({ loaded: 0, total: file.size, stage: "uploading" });
        armStall();
        upload.findPreviousUploads().then((previous) => {
          if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
          upload.start();
        });
      });
      if (!result.ok) return result;
    }

    onProgress({ loaded: file.size, total: file.size, stage: "saving" });
    const attached = await attachFile({ submissionId, path, mimeType: file.type || mime, byteSize: file.size, originalName: file.name });
    if (!attached.ok) return attached;
    return { ok: true as const, fileId: attached.fileId, path };
  })();
  return {
    abort: () => {
      controller.abort();
      abortTus();
    },
    done,
  };
}

// ---------------------------------------------------------------------------
// Local drafts (IndexedDB): evidence is never silently discarded.
// ---------------------------------------------------------------------------
export type LocalDraftFile = { id: string; name: string; type: string; size: number; blob: Blob; status: "queued" | "uploaded" | "failed"; error?: string; /** Kept so the resumable-upload fingerprint stays stable across retries. */ lastModified?: number };
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
