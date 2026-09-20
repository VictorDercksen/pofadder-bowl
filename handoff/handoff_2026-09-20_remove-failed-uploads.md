# Pofadder Bowl 2026 · Handoff (2026-09-20, remove failed files from the upload queue)

Follow-on to `handoff_2026-09-20_upload-cap-direct-uploads.md`, which holds the upload diagnosis and the production checks.

## State at handoff

| Item | Value |
|---|---|
| Branch | `claude/proof-locker-rating-selectors-sau4ux`, merged into `main` at Victor's request (no PR) |
| Schema / Env | Unchanged |
| Tests | `npm run typecheck`, `npm run lint`, `npm test` (144 vitest) pass |

## What was asked and done

A failed file in the locker queue (for example the 72 MB clip refused by the new cap) only offered Retry, so it could not be dropped and kept counting towards "Upload n file(s)". `EvidenceUploader` now shows Retry and Remove side by side on a failed row (`pb-file-actions`, end of `globals.css`); Remove takes the file out of the local IndexedDB draft like a queued file's trash button does.

## Verified / not verified

Typecheck, lint and unit tests. Not rendered in a browser (a one-line JSX change in the existing row layout).

## Suggested check on production

Proof locker → a failed row → the bin icon removes it and the Upload button count drops; Retry still works on the other failed rows.

## Still open

Unchanged from the previous handoff.
