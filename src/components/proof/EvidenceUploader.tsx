"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, useTransition, type Ref } from "react";
import { useRouter } from "next/navigation";
import { IconButton } from "@/components/ui/IconButton";
import { RatingSelector } from "@/components/ui/RatingSelector";
import { toast } from "@/lib/toast-store";
import { createDraft, deleteDraftFile, submitDraft, updateCaption, updateRating } from "@/lib/actions/evidence";
import { formatBytes, validateFile } from "@/lib/evidence-rules";
import { clearDraft, loadDraft, saveDraft, uploadEvidence, type LocalDraft, type LocalDraftFile, type UploadHandle, type UploadStage } from "@/lib/uploads";
import { useOnline } from "@/lib/hooks";
import { newId } from "@/lib/ids";

export type ExistingFile = { id: string; original_name: string | null; kind: string; byte_size: number };
export type ExistingSubmission = { id: string; version: number; status: string; caption: string; rating: number | null; files: ExistingFile[] } | null;

type Props = {
  targetKind: "challenge" | "press";
  targetId: string;
  targetTitle: string;
  /** Latest submission for this target (any status). */
  current: ExistingSubmission;
  accept?: string;
  captureHint?: string;
  captionPlaceholder?: string;
  /** The play wants a score out of ten with the proof (the chicken and rib combo). */
  rated?: boolean;
  /** Label for the rating strip, e.g. the dish being rated. */
  ratingLabel?: string;
  /** Imperative handle so other components (press room recorder) can add a captured file. */
  ref?: Ref<EvidenceUploaderHandle>;
};

export type EvidenceUploaderHandle = { addFile: (file: File) => void };

type Row = { local: LocalDraftFile; progress: number; stage?: UploadStage; handle?: UploadHandle };

/**
 * Evidence locker: pick files, keep a local draft in IndexedDB, upload directly to
 * private storage with progress/retry/cancel, then submit for review.
 * Labels are explicit: draft (local) → uploaded (in storage) → submitted (in review).
 */
export function EvidenceUploader({ targetKind, targetId, targetTitle, current, accept, captureHint, captionPlaceholder, rated = false, ratingLabel = "Rating out of ten", ref }: Props) {
  const router = useRouter();
  const draftKey = `${targetKind}:${targetId}`;
  const editable = !current || current.status === "draft" || current.status === "flagged";
  const [submissionId, setSubmissionId] = useState<string | undefined>(editable ? current?.id : undefined);
  const [caption, setCaption] = useState(editable ? (current?.caption ?? "") : "");
  const [rating, setRating] = useState<number | null>(editable ? (current?.rating ?? null) : null);
  const [rows, setRows] = useState<Row[]>([]);
  const online = useOnline();
  const [pending, startTransition] = useTransition();
  const [localSaved, setLocalSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const uploadingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Restore a local draft (files kept on this device). Merges with anything added meanwhile
  // and ignores a result that arrives after the effect was cleaned up.
  useEffect(() => {
    let ignore = false;
    loadDraft(draftKey).then((d) => {
      if (ignore || !d) return;
      if (!editable && d.files.every((f) => f.status === "uploaded")) return;
      setCaption((c) => c || d.caption);
      if (d.submissionId && editable) setSubmissionId((s) => s ?? d.submissionId);
      const restored = d.files.filter((f) => f.status !== "uploaded").map((f) => ({ local: f, progress: 0 }));
      setRows((prev) => [...prev, ...restored.filter((r) => !prev.some((p) => p.local.id === r.local.id))]);
      setLocalSaved(true);
    });
    return () => {
      ignore = true;
    };
  }, [draftKey, editable]);

  const persist = useCallback(
    async (nextRows: Row[], nextCaption: string, nextSubmissionId?: string) => {
      const draft: LocalDraft = { key: draftKey, targetId, targetKind, submissionId: nextSubmissionId, caption: nextCaption, files: nextRows.map((r) => r.local), updatedAt: Date.now() };
      const res = await saveDraft(draft);
      setLocalSaved(res.ok);
      if (!res.ok) toast(res.message, "warn");
      return res.ok;
    },
    [draftKey, targetId, targetKind],
  );

  async function ensureSubmission(): Promise<string | null> {
    if (submissionId) return submissionId;
    const res = await createDraft(targetKind === "challenge" ? { challengeId: targetId, caption } : { pressPromptId: targetId, caption });
    if (!res.ok || !res.submissionId) {
      toast(res.ok ? "Could not create a draft." : res.message, "error");
      return null;
    }
    setSubmissionId(res.submissionId);
    return res.submissionId;
  }

  function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    const next: Row[] = [];
    for (const file of Array.from(list)) {
      const v = validateFile(file.type, file.name, file.size);
      if (!v.ok) {
        toast(`${file.name}: ${v.reason}`, "error");
        continue;
      }
      next.push({ local: { id: newId(), name: file.name, type: file.type, size: file.size, blob: file, status: "queued", lastModified: file.lastModified }, progress: 0 });
    }
    if (next.length === 0) return;
    const all = [...rows, ...next];
    setRows(all);
    persist(all, caption, submissionId).then((ok) => ok && toast(`${next.length} file(s) added to the local draft. Nothing has been uploaded yet.`, "ok"));
    if (inputRef.current) inputRef.current.value = "";
  }

  useImperativeHandle(ref, () => ({ addFile: (file: File) => addFiles([file]) }));

  async function uploadAll() {
    if (!online) {
      toast("Offline. Files stay in the local draft and can be uploaded when you reconnect.", "warn");
      return;
    }
    // One upload loop at a time: a second click (or Retry) must not send the same bytes twice.
    if (uploadingRef.current) return;
    uploadingRef.current = true;
    setUploading(true);
    try {
      const sid = await ensureSubmission();
      if (!sid) return;
      const queue = rows.filter((r) => r.local.status !== "uploaded");
      if (queue.length === 0) return;
      const outcomes = new Map<string, { ok: boolean; message?: string }>();
      const applyOutcome = (r: Row): Row => {
        const o = outcomes.get(r.local.id);
        if (!o) return r;
        return { ...r, handle: undefined, progress: o.ok ? 1 : r.progress, local: { ...r.local, status: o.ok ? ("uploaded" as const) : ("failed" as const), error: o.ok ? undefined : o.message } };
      };
      for (const row of queue) {
        // The same name, type, size and lastModified give tus a stable fingerprint, so an interrupted large upload resumes.
        const file = new File([row.local.blob], row.local.name, { type: row.local.type, lastModified: row.local.lastModified ?? 0 });
        const handle = uploadEvidence(sid, file, (p) => setRows((prev) => prev.map((r) => (r.local.id === row.local.id ? { ...r, progress: p.total ? p.loaded / p.total : 0, stage: p.stage } : r))));
        setRows((prev) => prev.map((r) => (r.local.id === row.local.id ? { ...r, handle, local: { ...r.local, status: "queued", error: undefined } } : r)));
        const res = await handle.done;
        outcomes.set(row.local.id, { ok: res.ok, message: res.ok ? undefined : res.message });
        setRows((prev) => prev.map(applyOutcome));
        await persist(rows.map(applyOutcome).filter((r) => r.local.status !== "uploaded"), caption, sid);
        if (!res.ok) toast(res.message, "error");
      }
      router.refresh();
    } finally {
      uploadingRef.current = false;
      setUploading(false);
    }
  }

  function cancel(row: Row) {
    row.handle?.abort();
  }

  function removeLocal(row: Row) {
    const next = rows.filter((r) => r.local.id !== row.local.id);
    setRows(next);
    persist(next, caption, submissionId);
  }

  /** Writes the score to the server draft as soon as it is picked; before a draft exists it waits for the first save or submit. */
  function pickRating(n: number) {
    setRating(n);
    if (!submissionId) return;
    startTransition(async () => {
      const res = await updateRating({ submissionId, rating: n });
      if (!res.ok) toast(res.message, "error");
    });
  }

  function saveCaption() {
    startTransition(async () => {
      await persist(rows, caption, submissionId);
      if (submissionId) {
        const res = await updateCaption({ submissionId, caption });
        const rated = rating != null && rating !== current?.rating ? await updateRating({ submissionId, rating }) : { ok: true as const };
        const ok = res.ok && rated.ok;
        toast(ok ? "Draft saved." : (!res.ok ? res.message : rated.ok ? "" : rated.message) || "Could not save the draft.", ok ? "ok" : "error");
      } else toast("Draft saved on this device.", "ok");
    });
  }

  function submit() {
    if (!online) {
      toast("Offline. Save the draft and submit after reconnecting.", "warn");
      return;
    }
    const uploadedCount = (current?.files.length ?? 0) + rows.filter((r) => r.local.status === "uploaded").length;
    const queued = rows.some((r) => r.local.status !== "uploaded");
    if (queued) {
      toast("Upload the queued files first (or remove them) before submitting.", "warn");
      return;
    }
    if (!submissionId || uploadedCount === 0) {
      toast("Attach and upload at least one file before submitting.", "warn");
      return;
    }
    if (rated && rating == null) {
      toast("Rate it out of ten before submitting.", "warn");
      return;
    }
    startTransition(async () => {
      if (caption !== (current?.caption ?? "")) await updateCaption({ submissionId, caption });
      if (rated && rating != null && rating !== current?.rating) {
        const saved = await updateRating({ submissionId, rating });
        if (!saved.ok) {
          toast(saved.message, "error");
          return;
        }
      }
      const res = await submitDraft({ submissionId });
      toast(res.message ?? "", res.ok ? "ok" : "error");
      if (res.ok) {
        await clearDraft(draftKey);
        setRows([]);
        router.refresh();
      }
    });
  }

  function removeUploaded(fileId: string) {
    startTransition(async () => {
      const res = await deleteDraftFile({ fileId });
      toast(res.message ?? "", res.ok ? "ok" : "error");
      router.refresh();
    });
  }

  const statusLabel = !current ? "No proof yet" : current.status === "draft" ? `Draft v${current.version}` : current.status === "submitted" ? `Submitted v${current.version} · pending review` : current.status === "approved" ? `Approved v${current.version}` : current.status === "flagged" ? `Flagged v${current.version} · needs more proof` : `Superseded v${current.version}`;

  return (
    <div className="pb-panel">
      <div className="pb-panel-top">
        <h2>{targetTitle}</h2>
        <span className={`pb-tag ${current?.status === "flagged" || current?.status === "submitted" ? "orange" : ""}`}>{statusLabel.toUpperCase()}</span>
      </div>
      {current?.status === "approved" || current?.status === "submitted" ? (
        <p className="pb-small" style={{ marginTop: 9 }}>
          {current.status === "approved" ? "This proof is approved. Uploading replacement evidence creates a new version for review; the approved version is kept and only superseded by an explicit commissioner decision." : "This version is with the commissioner. You can start a new version if something is missing."}
        </p>
      ) : (
        <p className="pb-small" style={{ marginTop: 9 }}>{captureHint ?? "Every play needs evidence. Give it a caption."}</p>
      )}

      {editable ? (
        <>
          <div className="pb-drop">
            <h3>Bring receipts. Literally.</h3>
            <p>Photos, video, receipts and watch exports live here. Files stay on this device as a draft until you upload them. Clips up to 50 MB: keep them short or record at 1080p.</p>
            <div className="pb-actions" style={{ justifyContent: "center" }}>
              <label className="pb-secondary" style={{ cursor: "pointer" }}>
                Choose files
                <input ref={inputRef} type="file" multiple accept={accept} onChange={(e) => addFiles(e.target.files)} className="pb-sr-only" />
              </label>
              {rows.some((r) => r.local.status !== "uploaded") ? (
                <button className="pb-primary" type="button" onClick={uploadAll} disabled={!online || uploading}>
                  {uploading ? "Uploading…" : `Upload ${rows.filter((r) => r.local.status !== "uploaded").length} file(s)`}
                </button>
              ) : null}
            </div>
          </div>
          {rows.map((row) => (
            <div className="pb-file" key={row.local.id}>
              <span className="pb-avatar" aria-hidden="true">{row.local.type.startsWith("video") ? "▷" : row.local.type.startsWith("image") ? "◫" : "▤"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ overflowWrap: "anywhere" }}>{row.local.name}</b>
                <br />
                <span className="pb-small">
                  {formatBytes(row.local.size)} · {row.local.status === "uploaded" ? "Uploaded" : row.local.status === "failed" ? `Failed · ${row.local.error}` : row.handle ? (row.stage === "preparing" ? "Preparing the upload…" : row.stage === "saving" ? "Saving to the locker…" : `Uploading ${Math.round(row.progress * 100)}%`) : "Draft on this device"}
                </span>
                {row.handle ? (
                  <div className="pb-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(row.progress * 100)} aria-label={`Upload progress for ${row.local.name}`}>
                    <span style={{ width: `${Math.round(row.progress * 100)}%` }} />
                  </div>
                ) : null}
              </div>
              {row.handle ? (
                <IconButton icon="close" label={`Cancel the upload of ${row.local.name}`} small onClick={() => cancel(row)} />
              ) : row.local.status === "failed" ? (
                <div className="pb-file-actions">
                  <IconButton icon="retry" label={`Retry uploading ${row.local.name}`} tone="orange" small onClick={uploadAll} disabled={uploading} />
                  <IconButton icon="trash" label={`Remove ${row.local.name} from the draft`} small onClick={() => removeLocal(row)} />
                </div>
              ) : row.local.status !== "uploaded" ? (
                <IconButton icon="trash" label={`Remove ${row.local.name} from the draft`} small onClick={() => removeLocal(row)} />
              ) : null}
            </div>
          ))}
        </>
      ) : null}

      {current && current.files.length > 0 ? (
        <div style={{ marginTop: 12 }}>
          <div className="pb-kicker">UPLOADED · VERSION {current.version}</div>
          {current.files.map((f) => (
            <div className="pb-file" key={f.id}>
              <span className="pb-avatar" aria-hidden="true">{f.kind === "video" ? "▷" : f.kind === "photo" ? "◫" : "▤"}</span>
              <div style={{ flex: 1 }}>
                <b>{f.original_name ?? "file"}</b>
                <br />
                <span className="pb-small">{f.kind} · {formatBytes(f.byte_size)} · in private storage</span>
              </div>
              {current.status === "draft" || current.status === "flagged" ? (
                <IconButton icon="trash" label={`Remove ${f.original_name ?? "this file"} from the draft`} small onClick={() => removeUploaded(f.id)} disabled={pending} />
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {rated && editable ? (
        <div className="pb-field" data-tour="proof-rating">
          {ratingLabel}
          <RatingSelector value={rating} label={ratingLabel} onChange={pickRating} caption="your call" />
          <p className="pb-small" style={{ marginTop: 6 }}>Pick the score before you submit. It goes on the record with the clip and settles the league’s rating predictions.</p>
        </div>
      ) : null}
      {rated && !editable && current ? (
        <div className="pb-field" data-tour="proof-rating">
          {ratingLabel}
          <RatingSelector value={current.rating} label={ratingLabel} readOnly caption={`version ${current.version}`} />
        </div>
      ) : null}

      {editable ? (
        <>
          <label className="pb-field">
            Caption
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={2000} placeholder={captionPlaceholder ?? "What did you find out?"} />
          </label>
          <div className="pb-actions">
            <button className="pb-primary" type="button" onClick={submit} disabled={pending}>
              {current?.status === "flagged" ? "Resubmit proof" : "Submit for review"}
            </button>
            <button className="pb-secondary" type="button" onClick={saveCaption} disabled={pending}>Save draft</button>
          </div>
          <p className="pb-small" style={{ marginTop: 12 }}>
            {online ? "Connected · submitted proof goes to commissioner review." : "Offline · files and caption stay in the local draft until you reconnect."}
            {localSaved ? " Local draft saved on this device." : ""}
          </p>
        </>
      ) : (
        <div className="pb-actions">
          <button
            className="pb-secondary"
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await createDraft(targetKind === "challenge" ? { challengeId: targetId } : { pressPromptId: targetId });
                toast(res.ok ? `New version v${res.version} started.` : res.message, res.ok ? "ok" : "error");
                router.refresh();
              })
            }
          >
            Start a new version
          </button>
        </div>
      )}
    </div>
  );
}
