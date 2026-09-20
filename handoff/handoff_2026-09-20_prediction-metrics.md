# Pofadder Bowl 2026 · Handoff (2026-09-20, five new prediction calls)

Follow-on to `handoff_2026-09-20_rating-selector-predictions.md` (rating strip, complaints removed). Infrastructure detail still lives in `handoff_2026-09-17.md`.

## State at handoff

| Item | Value |
|---|---|
| Branch | `claude/proof-locker-rating-selectors-sau4ux` (no PR opened) |
| Production | https://pofadder-bowl.vercel.app deploys from `main`; unaffected until merged |
| Schema | New migration `supabase/migrations/20260920001400_prediction_metrics.sql` on top of `..._1300_rating_selector.sql` (additive, backward compatible) |
| Types | `src/lib/database.types.ts` hand-edited again; regenerate from the local stack when one is available |
| Env | Unchanged |
| Tests | `npm run typecheck`, `npm run lint`, `npm test` (143 vitest) pass; `npx next build` passes. Integration tests not run (no Docker daemon in the sandbox) |

## What was asked

Add the verifiable metrics from the previous handoff except rand on receipts and bus lateness: final score out of 100, the time the daylight sign photo lands, versions flagged by the commissioner, distance on the approved trace, and sunset speech length.

## What was done

### Schema (`20260920001400_prediction_metrics.sql`)

- `predictions` and `official_results` gain `final_score` (0–100), `sign_photo_minutes` (minute of the day in the event timezone, 0–1439), `flag_count` (0–99), `speech_seconds` (0–3600); `predictions` also gains `run_distance_km` (`official_results` already had it). All nullable so the three- and four-argument `upsert_prediction` overloads keep working during the parallel deploy.
- `prediction_rules` gains `final_score_points`, `sign_photo_points`, `flags_points`, `distance_points`, `speech_points` (default 5 each; seed sets 10/5/5/5/5/5/5).
- `prediction_awards.category` check now also allows `final_score`, `sign_photo`, `flags`, `distance`, `speech`.
- New eight-argument `upsert_prediction`; the three- and four-argument overloads are SQL shims that write null for the new calls. `resolve_predictions` builds a temp table of active members' slips and scores every call: closest for run, final score, sign time, distance and speech; exact for the rib rating and the flag count; a slip that is null in a category does not compete in it.

### Pure logic (`src/lib/predictions.ts`, tests)

- `METRICS` registry (key, column, mode, label, blurb) drives resolution, the rules card, the rules editor, the reveal rows and the results line. `PredictionValues` is the shared row shape of `predictions` and `official_results`.
- `SlipInput` is the form shape (clock parts); `validatePrediction` checks every call; `slipToValues` turns it into the row; `formatMetric` prints a value in its unit; `METRIC_SHORT` gives the reveal-row labels.
- `src/lib/time.ts`: `minuteOfDay(iso, tz)` and `minutesToClock(minutes)`, tested.

### Screens

- `PredictionSlip`: finish time, rating strip, final score, distance (two decimals), sign photo hour/minute (SAST), flag count, speech minutes/seconds. Fresh slip defaults: 1:35, 75, 10.25 km, 09:30, 1 flag, 1:30. `RulesEditor` has one points field per metric.
- `/predictions`: the reveal is now one row per member (points, badge, rib pill, then "Run 1:35:00 · Ribs 8 / 10 · Score 85 / 100 · Sign 09:40 · Flags 1 flag · Trace 10.31 km · Speech 1:45") instead of a nine-column table; official results print the same line.
- `ResultsForm` (`/review`): fields for the four new results plus the existing run time, distance and rating strip. Defaults come from the record (`ResultDefaults`): the approved rating, the current scoreboard (only once a play is approved), the first `submitted_at` of the daylight sign challenge (title matching "daylight", else sequence 3) as a minute of the day, and the count of flagged review decisions (a `head: true` count query). An empty field leaves that call unscored.
- `saveOfficialResults` takes and writes the four new values. Demo slip (`/demo/predictions`) and the tour's predictions step updated. `scripts/integration-test.ts` sends full slips, exercises both shims, and expects eight awards with a named winner per category.

## Verified

- `npm run typecheck && npm run lint && npm test`, `npx next build` green.
- Headless Chromium against `next build && next start -p 3001`: `/demo/predictions` at 1280×900 and 390×844, no horizontal overflow; the nested minute/second inputs are narrow on a phone but usable.
- Not verified (no backend): the migration against Postgres (temp table in a security-definer function, the constraint swap), PostgREST resolution among the three `upsert_prediction` overloads, the flagged-decisions count query through the embedded filter, and the prefilled defaults on `/review`.

## Suggested checks on production (after merge)

1. Supabase → Migrations: `20260920001400_prediction_metrics` applied; `prediction_rules` row has the five new points columns.
2. `/predictions` before lock: fill every field, save, reload: values kept. Enter a distance with three decimals: the warning appears and nothing saves.
3. Admin → rules: seven fields save and the "How the points work" card updates.
4. Commissioner → `/review` → Official results: the sign time is prefilled once #03 is submitted; flags prefilled from the audit trail; Save results, Resolve predictions: the feed post reports the award count and `/predictions` shows the per-member rows with points.
5. After reveal, a member who saved a slip before this deploy (if any) shows "—" for the new calls and cannot win them.

## Still open

1. Regenerate `database.types.ts`; run `npm run test:integration` (predictions block covers the shims, the eight-argument RPC and every award category).
2. Drop the three- and four-argument `upsert_prediction` shims and the complaint columns in a later migration once the old deploys are gone.
3. The reveal rows and the results line are text; a compact per-metric table could replace them if the league wants columns.
4. Carried forward: the rating is not kept in the local IndexedDB draft; whether Skip should count as tour completion; a per-member "reset tour"; `scripts/fetch-sleeper-bracket.ts`; custom SMTP before inviting the league; the "Sleeper teams" integration block has not been run against Postgres.
