# Decimal values in the rating picker

## State at handoff

Branch `claude/rating-picker-decimal-values-c0hk81`, from `main`. Not merged, not deployed. One new migration: `supabase/migrations/20260924000100_decimal_ratings.sql`. No env changes. `src/lib/database.types.ts` unchanged (numeric and smallint both map to `number`; the RPC argument names are the same).

## Asked and done

Ratings out of ten now take one decimal (1.0 to 10.0), set and shown through the same `RatingSelector`.

- **Picker** (`src/components/ui/RatingSelector.tsx`). The ten cells still pick the whole number (tap sets `n.0`). A second row of ten chips (`.0` to `.9`) sets the decimal; it is disabled until a whole number is picked and when the score is 10. Arrow keys, Home and End work in both rows. The decimal shows as a partial orange fill of the next cell (7.5 = cell 7 orange, cell 8 half filled), including in read-only, dark and small strips. The score reads "7.5" or "8" (no trailing ".0"). On phones (≤ 480 px) both rows wrap to five columns.
- **Pure helpers** (`src/lib/rating.ts`, tested in `rating.test.ts`): `isRating`, `formatRating`, `splitRating`, `composeRating`, `roundRating`.
- **Validation.** `updateRating` (proof), `saveOfficialResults` (commissioner) and `validatePrediction` (slip) accept one decimal via `isRating`. `formatMetric("meal")`, `RatingBadge`, the commissioner prefill note and the demo toast use `formatRating`.
- **Migration.** `evidence_submissions.rating`, `predictions.meal_rating` and `official_results.meal_rating` become `numeric(3,1)`; the 1..10 checks and the column grant carry over. `predictions_revealed` is dropped and recreated with the same columns (the view pinned the old type), select granted to `authenticated`. The three `upsert_prediction` overloads are recreated with `p_meal_rating numeric` (same argument names, grants as in `20260921000100`), and the 8-argument one refuses more than one decimal. `submit_submission` prints the score with `trim_scale` so the feed reads "7.5 / 10" and "8 / 10".
- **Scoring.** Exact match on the rib rating now compares decimals (7.5 only matches 7.5), in `resolve_predictions` and `resolvePredictions` alike; no code change needed there.

## Verified

- `npm run typecheck`, `npm run lint`, `npm test` (25 files, 171 tests) pass.
- All migrations applied in order to a scratch Postgres 16 with Supabase stubs (auth, storage, roles), plus `seed.sql`. As an active member: `upsert_prediction` stores 7.5, the 3-argument shim stores 8, 7.25 is refused ("one decimal at most"), 10.5 hits the check constraint, `predictions_revealed` returns `numeric(3,1)`.
- Browser check on `next build && next start` with a temporary page (deleted): desktop and 390 px layouts, click 9 then .2 then ArrowRight gives 9.3, clicking 10 disables the decimal row, empty strip has the decimal row disabled.

## Not verified

- `npm run test:integration` (no Docker for the local Supabase stack). The integration test uses whole-number ratings, which stay valid.
- The real Supabase PostgREST schema reload after dropping and recreating `upsert_prediction`.

## Suggested checks on production after the merge

1. Predictions slip: pick 7 then .5, save, reload: the strip shows 7.5.
2. Proof locker on the rated play: set 8.3, submit; the feed post reads "… · 8.3 / 10".
3. Review → Commissioner: official rating prefilled with a decimal, save, resolve: only exact 8.3 slips score.
4. `select column_name, data_type, numeric_scale from information_schema.columns where column_name in ('rating','meal_rating');` shows `numeric`, scale 1.

## Open

- Exact match gets harder with 91 possible ratings instead of 10. If that is too strict, switch the "meal" metric to closest in `METRICS` and `resolve_predictions`.
