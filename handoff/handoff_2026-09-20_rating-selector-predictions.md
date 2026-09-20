# Pofadder Bowl 2026 · Handoff (2026-09-20, rating selector and the prediction slip)

Follow-on to `handoff_2026-09-20_tour-fixes.md`. Infrastructure detail still lives in `handoff_2026-09-17.md`.

## State at handoff

| Item | Value |
|---|---|
| Branch | `claude/proof-locker-rating-selectors-sau4ux`, started from `origin/main` (no PR opened) |
| Production | https://pofadder-bowl.vercel.app deploys from `main`; unaffected until merged |
| Schema | New migration `supabase/migrations/20260920001300_rating_selector.sql` (additive, backward compatible; applied by the Supabase GitHub integration on merge to `main`) |
| Types | `src/lib/database.types.ts` hand-edited for the new columns and the `upsert_prediction` overloads; regenerate from the local stack when one is available |
| Env | Unchanged |
| Tests | `npm run typecheck`, `npm run lint`, `npm test` (137 vitest) pass; `npx next build` passes. Integration tests not run (no Docker daemon in the sandbox) |

## What was asked

1. The chicken and rib combo rating in the proof locker gets a styled rating selector that Victor sets when he submits the proof; members see the submitted score in the same selector, read-only.
2. Rethink predictions: keep the 10 km finish time and the rib rating (with the same selector), drop the complaint count, and list verifiable metrics that could replace it.

## What was done

### Rating strip (`src/components/ui/RatingSelector.tsx`, CSS block "Rating strip" at the end of `globals.css`)

- `RatingSelector`: ten cells, the pick in orange, everything below it in the green, the score in condensed numerals to the right with an optional caption ("your call", "Victor's verdict", "official"). Interactive mode is a `radiogroup` of buttons with roving tab stop and arrow, Home and End keys. `readOnly` renders a `role="img"` strip with the value in the accessible name. `tone="dark"` sits on the green `pb-clip` panel (gold cells, orange pick); `size="small"` is the compact strip for results. Under 480 px the interactive strip becomes two rows of five (real tap targets) and the score moves under it on one line.
- `RatingBadge`: the "8 / 10" pill for list rows and tables; "Unrated" when there is no score.

### Rated proof

- Schema: `challenges.rated boolean` (seed and migration set it for #06) and `evidence_submissions.rating smallint 1–10`. `submit_submission` refuses a rated play without a score ("rate it out of ten before submitting") and puts "· 8 / 10" into the feed post body.
- Action `updateRating` in `src/lib/actions/evidence.ts` (participant only, owner's draft or flagged version only, same shape as `updateCaption`). `submitDraft` maps the new RPC error to a friendly message.
- `EvidenceUploader` takes `rated` and `ratingLabel`. The strip sits above the caption; a pick is written to the server draft immediately when one exists, otherwise it is saved on Save draft or Submit. Submit is blocked client-side without a score. Once the version is submitted or approved the strip shows read-only with "version n". The score is not part of the IndexedDB local draft: if the participant picks a score before creating a draft and then reloads, they pick again.
- Challenge page (`/proof/[challengeId]`): the participant's uploader gets the strip and a capture hint; the league view shows the dark strip inside the clip block with "Victor's verdict"; the versions list carries a `RatingBadge` per version. The locker list (`/proof`) shows the badge on the rated row in both views. The commissioner's review page shows the dark strip and the replay checklist asks whether the score on camera matches it.
- Official results (`ResultsForm`): the meal rating input is now the strip, prefilled from the approved rated submission (`approvedRating` from `/review`), with a Clear link; the complaints input is gone and `saveOfficialResults` writes `complaint_count = null`.

### Prediction slip without complaints

- Migration: `predictions.complaint_count` is nullable, `prediction_rules.complaints_points` defaults to 0 and the production row is set to 0. New `upsert_prediction(p_event, p_run_seconds, p_meal_rating)`; the old four-argument overload stays as a SQL shim that ignores the count so the previous deploy keeps working during the parallel Vercel build. `resolve_predictions` awards only `run` and `meal`; the `prediction_awards.category` check still lists `complaints` (harmless, old rows are deleted on every resolve).
- `src/lib/predictions.ts` and its tests: `PredictionRules`, `Prediction`, `OfficialResult`, `Award`, `resolvePredictions` and `validatePrediction` no longer know about complaints; `mealRating` may be null and fails validation with "Pick a rib rating out of ten."
- `PredictionSlip` uses the strip (read-only once locked); `RulesEditor` has Run and Rib rating only. The predictions page table is Member / Run / Rib rating / Points; official results show the run time and the small official strip.
- Demo (`/demo/predictions`), tour copy for the predictions step, and `scripts/integration-test.ts` (three-argument RPC, a shim call with the old fourth argument, expected award count 3) updated.

## Verified

- `npm run typecheck && npm run lint && npm test` and `npx next build` green.
- Headless Chromium against `next build && next start -p 3001` with a temporary `/demo/rating-check` page (deleted): interactive, locked, small, badge and dark variants at 1280×900 and 390×844; arrow keys move the pick; no horizontal overflow; the real `/demo/predictions` slip at both widths.
- Not verified (no backend in the sandbox): the migration against Postgres, the `submit_submission` guard, the feed post text, the overload resolution of `upsert_prediction` through PostgREST, the prefilled official rating on `/review`, and any real `(league)` screen.

## Suggested checks on production (after merge)

1. Supabase → Database → Migrations: `20260920001300_rating_selector` applied; `challenges` row #06 has `rated = true`.
2. As Victor: Proof locker → #06 → upload a clip, pick a score, Submit. The feed post reads "Chicken and rib combo, rated out of ten · 8 / 10 · caption". Try Submit without a score: the warning appears and nothing is submitted.
3. As a member (View as league member): `/proof` shows the "8 / 10" pill on #06; opening it shows the dark strip in the clip block.
4. Commissioner → Under review → open #06: the strip shows the participant's score. After approval, the Official results strip on `/review` is prefilled with it; Save results, Resolve predictions: awards land for `run` and `meal` only.
5. `/predictions` before lock: save a slip through the strip, reload, the pick is kept. After reveal the table shows the rib rating pills.

## Options for verifiable prediction metrics (not built; decision pending)

Each is settled from something already recorded in the app. Props 1, 2, 5, 7, 8 and 9 on the prop board already cover distance, bus lateness, approvals, check-ins, speech length and receipts as over/unders, so the slip should prefer calls the board does not make.

| Metric | How it is verified | Scoring | Notes |
|---|---|---|---|
| Final punishment score out of 100 | Scoreboard at certificate time (`event_scores`) | Closest wins | Not on the prop board; recommended |
| Approved run distance (km, 2 dp) | `official_results.run_distance_km`, already entered by the commissioner | Closest wins | Column exists; prop 1 is the over/under on the same number |
| Time the daylight welcome-sign photo (#03) lands | `submitted_at` of the first submitted version | Closest wins | Automatic, no commissioner input; recommended |
| Versions flagged by the commissioner across the trip | Count of `review_decisions` with `flagged` | Exact match | Not on the board; makes the flag button interesting |
| Bus arrival lateness at KLK Garage (minutes) | Arrival check-in or night-sign photo timestamp | Closest wins | Prop 2 already covers it |
| Sunset speech length (seconds) | Duration of the approved N14 clip | Closest wins | Prop 8 already covers it |
| Rand on receipts | Sum of receipt proof | Closest wins | Prop 9 already covers it |
| Average pace (min/km) | `run_seconds / run_distance_km` | Closest wins | Derived from two calls already on the slip; weak |

Adding one means: a column on `predictions` and `official_results`, a new `prediction_awards.category`, a branch in `resolve_predictions` and `resolvePredictions`, a field on the slip and on `ResultsForm`, and a points column on `prediction_rules`.

## Still open

1. Decide which metrics replace the complaint count (table above) and build them.
2. Regenerate `database.types.ts` from the local stack; run `npm run test:integration` (it covers the new `upsert_prediction` shim and the award count).
3. Drop the four-argument `upsert_prediction` shim in a later migration once the deploy that sends `p_complaint_count` is gone; `predictions.complaint_count`, `official_results.complaint_count` and `prediction_rules.complaints_points` can go at the same time.
4. The score is not kept in the local IndexedDB draft (only files and caption are).
5. Carried forward: whether Skip should count as tour completion; a per-member "reset tour"; `scripts/fetch-sleeper-bracket.ts`; custom SMTP before inviting the league; the "Sleeper teams" integration block has not been run against Postgres.
