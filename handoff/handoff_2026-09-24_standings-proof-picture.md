# Final league standings proof accepts a picture

## State at handoff

Branch `claude/league-standings-proof-picture-cv8i8r`, from `main`. Not merged, not deployed. One new migration (`supabase/migrations/20260924000100_standings_proof_photo.sql`, data only). No schema or env changes.

## Asked and done

Challenge #08 "Final league standings read aloud in the Hotel bar" should accept a picture as well as a clip.

- **Proof type.** `proof_type` changes from `clip` to `clip or photo` in the migration (hosted rows), `supabase/seed.sql` (fresh databases) and `src/data/league-programme.json`. Points (15), sequence and existing submissions are unchanged. The migration is guarded on the old value, so it is idempotent.
- **Picker.** The file picker's `accept` list now comes from `acceptForProofType` in `src/lib/evidence-rules.ts` (pure, unit tested). A proof type naming both "photo" and "clip" gets `image/*,video/*`. Every other type gets the same list as before. Previously "photo" was checked first, so "clip or photo" would have limited the picker to images.
- **Server.** No change needed: `validateFile` already accepts photos and clips for every challenge. The `accept` list is only a hint for the device.
- **Copy.** Proof screens, My trip and the review checklist print `proof_type` as is, so they now read "clip or photo".

## Verified

`npm run typecheck`, `npm run lint`, `npm test` (24 files, 170 tests) pass.

## Not verified

Not run against a database or in a browser. `npm run test:integration` needs the local stack (no Docker in the sandbox).

## Suggested checks on production after the merge

1. `select sequence, title, proof_type from challenges where sequence = 8;` shows `clip or photo`.
2. As the participant, open Proof → #08: the picker offers both photos and videos. Submit a photo; it previews in the gallery and reaches Review.

## Open

- The migration only changes the event with slug `pofadder-bowl-2026`, matching the earlier challenge migration.
