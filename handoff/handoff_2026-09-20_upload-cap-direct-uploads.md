# Pofadder Bowl 2026 · Handoff (2026-09-20, upload cap and direct uploads)

Follow-on to `handoff_2026-09-20_prediction-metrics.md`. Infrastructure detail still lives in `handoff_2026-09-17.md`.

## State at handoff

| Item | Value |
|---|---|
| Branch | `claude/proof-locker-rating-selectors-sau4ux`, merged into `main` at Victor's request (no PR) |
| Production | https://pofadder-bowl.vercel.app deploys from `main` |
| Schema | Unchanged |
| Env | Unchanged (`NEXT_PUBLIC_SUPABASE_RESUMABLE_URL` is set on Vercel to the direct storage host, as the 413 URL showed) |
| Tests | `npm run typecheck`, `npm run lint`, `npm test` (144 vitest) pass; `npx next build` passes |

## What was asked

On production a 72 MB `.mov` failed with `413 Maximum size exceeded` from `…storage.supabase.co/storage/v1/upload/resumable`, and smaller clips sat at "Uploading 0%". Fix what can be fixed from here; the Supabase plan stays Free.

## Diagnosis

- The 413 is Supabase's project-wide "Upload file size limit" (Storage → Settings), 50 MB and not raisable on the Free plan. The bucket (500 MB) and the app's own clip limit (500 MB) sat above it, so oversized clips were accepted at pick time and only failed at storage.
- Every clip over 6 MB went through the resumable TUS path, which `handoff_2026-09-17.md` records as never exercised in a browser; photos go through the single signed upload, which works. The TUS path had no stall detection and reported tus's raw message, so a request that never answered showed "Uploading 0%" forever.

## What was done (`src/lib/evidence-rules.ts`, `src/lib/uploads.ts`, `EvidenceUploader`)

- `STORAGE_MAX_BYTES = 50 MB` is the cap. Clips and audio are limited to it, so a 72 MB clip is refused at "Choose files" with "Clips up to 50 MB. This file is 72.0 MB. Trim it in Photos or record at 1080p / 30 fps…". Raise this constant together with the plan's setting.
- `RESUMABLE_THRESHOLD` now equals the cap: everything the plan can take goes as **one direct signed upload**, the path photos already use. TUS only carries files above the cap (none until the plan is raised) and gained the `apikey` header, an explicit `onShouldRetry`, a 60 s stall watchdog and status-based messages.
- The direct upload is an `XMLHttpRequest` PUT to the same URL and with the same headers supabase-js uses for `uploadToSignedUrl` (`apikey`, the session bearer, `x-upsert: false`, content type), so it has real progress events. It retries twice on a dropped connection, a stall (60 s without progress) or a 5xx, requesting a fresh signed URL and path each time; it never retries a 4xx.
- Storage answers are explained in plain words: 413 (over the cap), 401/403 (signed out or not the participant), 409 (name taken), 0 (connection dropped), 5xx.
- The file row shows the stage: "Preparing the upload…", "Uploading 37%", "Saving to the locker…", then Uploaded or Failed with the reason. The drop zone copy says "Clips up to 50 MB: keep them short or record at 1080p."

## Verified

- Unit tests (new: the 72 MB refusal with the hint; the threshold equals the cap), typecheck, lint, `next build`.
- The signed upload URL shape and headers were checked against `@supabase/storage-js` 2.x source (`/object/upload/sign/<bucket>/<path>?token=`, path joined raw, `x-upsert` header).
- Not verified (no backend in the sandbox): an actual clip upload from a phone, the retry loop against a real drop, and whether iOS Safari fires XHR upload progress for a File restored from IndexedDB.

## Suggested checks on production

1. Proof locker → #06 → Choose files → a clip over 50 MB: refused immediately with the trim hint, nothing uploads.
2. A clip between 6 and 50 MB: the row goes "Preparing the upload…" → "Uploading n%" with the bar moving → "Saving to the locker…" → "Uploaded", and it appears under UPLOADED · VERSION n.
3. Turn on flight mode mid-upload: within a minute the row shows the connection message and, after reconnecting, Retry resumes from the start of the file.
4. A photo still uploads as before.

## Still open

1. When the plan is upgraded: raise the Supabase "Upload file size limit", then `STORAGE_MAX_BYTES`; consider setting `RESUMABLE_THRESHOLD` back to 6 MB so big clips resume instead of restarting.
2. If a clip under 50 MB still fails, the reason is now printed on the row; the likely candidates are the storage RLS insert policy on `storage.objects` (only the participant on a draft or flagged submission) or the session bearer being stale.
3. Carried forward: regenerate `database.types.ts`; run the integration tests; drop the `upsert_prediction` shims later; the rating is not kept in the local IndexedDB draft; tour Skip semantics; per-member reset tour; Sleeper bracket script; custom SMTP.
