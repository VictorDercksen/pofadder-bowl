# Pofadder Bowl 2026 · Handoff (2026-09-20, rating save fix)

Follow-on to `handoff_2026-09-20_remove-failed-uploads.md`; the rating strip itself is described in `handoff_2026-09-20_rating-selector-predictions.md`.

## State at handoff

| Item | Value |
|---|---|
| Branch | `claude/proof-locker-rating-selectors-sau4ux`, merged into `main` at Victor's request (no PR) |
| Schema | New migration `supabase/migrations/20260920001500_rating_grant.sql` (a column grant; backward compatible) |
| Env | Unchanged |
| Tests | `npm run typecheck`, `npm run lint`, `npm test` (144 vitest) pass |

## What was asked

On production, picking a score on #06 showed "Could not save the rating." Also: save the score only with Save draft or Submit, not on every tap.

## Cause and fix

- `20260916000300_policies.sql` revokes update on `evidence_submissions` and grants it back for `caption` only, so the participant's `update ... set rating` was refused by Postgres even though the row-level policy allowed it. The new migration grants `update (caption, rating)`; the `submissions_update_own` policy still limits writes to the owner's draft or flagged row, and `submit_submission` still requires a score on a rated play.
- `EvidenceUploader` no longer calls `updateRating` on pick. The score is held in state and written by Save draft (with the caption) and by Submit (before `submit_submission`). Copy under the strip says so.

## Verified / not verified

Typecheck, lint, unit tests. The grant cannot be exercised without Postgres; the integration tests do not yet cover the rating write (still open).

## Suggested checks on production

1. Supabase → Migrations: `20260920001500_rating_grant` applied.
2. #06 as Victor: tap a score (no toast), Save draft → "Draft saved.", reload → the score is still selected. Submit → the feed post carries "· n / 10" and the league view shows the strip.
3. Submit without a score → "Rate it out of ten before submitting." and nothing is submitted.

## Still open

1. Add the rating write and the rated-submit guard to `scripts/integration-test.ts`.
2. Unchanged from earlier handoffs: regenerate `database.types.ts`; drop the `upsert_prediction` shims later; the rating is not kept in the local IndexedDB draft.
