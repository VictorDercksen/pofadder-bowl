# Return bus boarding proof accepts a picture

## State at handoff

Branch `claude/league-standings-proof-picture-cv8i8r`, on top of `e30ab11` (standings proof, already on `main` and `production`). One new migration (`supabase/migrations/20260924000200_return_bus_proof_photo.sql`, data only). No schema or env changes. Fast-forwarded into `main` and `production` at `50b8bc2`.

## Asked and done

Challenge #11 "Boarding the 22:30 bus, ticket and face in frame" should accept a picture as well as a clip, as #08 now does (see `handoff_2026-09-24_standings-proof-picture.md`).

- `proof_type` changes from `clip` to `clip or photo` in the migration (hosted rows, guarded on the old value), `supabase/seed.sql` and `src/data/league-programme.json`. Points (10), sequence and existing submissions are unchanged.
- No code change: `acceptForProofType` already gives `image/*,video/*` for "clip or photo", and the server accepts both.
- The certificate's "THE RETURN" slot still matches #11 by title (`src/lib/photo-slots.ts`), so it is unaffected.

## Verified

`npm run typecheck`, `npm run lint`, `npm test` pass.

## Not verified

Not run against a database or in a browser (no local stack in the sandbox).

## Suggested checks on production

1. `select sequence, proof_type from challenges where sequence in (8, 11);` shows `clip or photo` for both.
2. As the participant, open Proof → #11: the picker offers photos and videos.

## Open

- If the Supabase GitHub integration does not apply the migration to the league project, run the `Supabase migrations` workflow with target `league`.
