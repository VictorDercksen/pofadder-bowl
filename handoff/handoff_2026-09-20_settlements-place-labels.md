# Pofadder Bowl 2026 · Handoff (2026-09-20, settlements gazetteer and place labels)

Follow-on to `handoff_2026-09-17_nav-perf-sleeper-ui.md`. Infrastructure detail still lives in `handoff_2026-09-17.md`.

## State at handoff

| Item | Value |
|---|---|
| Branch | `claude/nav-perf-sleeper-ui-poq21b` (same branch as the previous handoff; not merged, no PR opened) |
| Production | https://pofadder-bowl.vercel.app deploys from `main`; unaffected until merged |
| Schema | **Three new migrations**, in order: `20260920000900_settlements.sql` (table, functions, `checkins.place_label`, new `record_checkin`), `20260920001000_settlements_data.sql` (generated, 1.1 MB, 12 613 rows), `20260920001100_settlements_backfill.sql` (labels existing check-ins and their feed posts). Run `npm run db:push` from the laptop after merge. Until it is pushed the app still works: `place_label` is simply absent and the screens print coordinates |
| Types | `src/lib/database.types.ts` hand-edited: `checkins.place_label`, the `settlements` table, `pb_place_label`, `pb_nearest_settlement`, `pb_distance_km`, `pb_bearing_deg`, `pb_compass`. `supabase gen types` needs Docker, which the sandbox lacks; regenerate from the local stack when convenient |
| Env | Unchanged |
| Tests | `npm run typecheck`, `npm run lint`, `npm test` (13 files, 62 vitest, 4 new) pass; `npx next build` passes |

## What was asked

Show check-in positions as "10 km N of Malmesbury" instead of latitude/longitude, importing a settlements table from a public database.

## How it works

### Data: `public.settlements` (GeoNames, CC BY 4.0)

- Source: the GeoNames gazetteer dump for South Africa (`https://download.geonames.org/export/dump/ZA.zip`), feature class P (populated places), minus sections of towns (`PPLX`), abandoned, destroyed and historical places. Province names come from `admin1CodesASCII.txt`. 12 613 rows: 954 towns, 45 villages, 11 614 hamlets.
- `scripts/build-settlements.ts` downloads the dump (or reads `--zip path`), unzips it without a dependency, filters, and writes the batched upsert migration `supabase/migrations/20260920001000_settlements_data.sql` (`on conflict (geonames_id) do update`, so re-running refreshes rows in place). Rebuild: `npx tsx scripts/build-settlements.ts`.
- Columns: `geonames_id` (PK), `name`, `ascii_name`, `province`, `feature_code`, `population`, `latitude`, `longitude`, `tier`. Tier 1 = administrative seat (`PPLA*`, `PPLC`) or population ≥ 1000; tier 2 = any other recorded population; tier 3 = no population recorded (most rural places, including real N7 stops like Kamieskroon, Nuwerus, Aggeneys; GeoNames has no population for them).
- RLS on, `settlements_select` for `authenticated`. No writes from the app.
- Licence: CC BY 4.0. Attribution "Place names © GeoNames (CC BY 4.0)" sits in the map source line (`CheckinMap`) and in the README.

### Lookup: `pb_nearest_settlement`, `pb_place_label`

- Plain SQL, no PostGIS: haversine distance (`pb_distance_km`), initial bearing (`pb_bearing_deg`), eight-point compass (`pb_compass`).
- `pb_nearest_settlement(lat, lng)` searches a box of about 160 km and orders by `distance / weight` with weights town 3, village 2, hamlet 1. A hamlet only wins when it is well under a third of the distance to the nearest town, so the N7 between Garies and Kamieskroon reads "18 km N of Garies", not the nearest farm. About 1 ms per call.
- `pb_place_label(lat, lng)` returns `In Pofadder` inside the town (radius 1.5 km, growing to 2.5 / 3.5 / 6 km for populations above 5 000 / 20 000 / 100 000) and otherwise `10 km N of Malmesbury` (whole kilometres, minimum 1). Null when nothing is within the box (open sea, another country).

### Check-ins

- `checkins.place_label text` (≤ 240 chars). `record_checkin` computes it once at insert and the feed post body becomes `10 km N of Malmesbury · accuracy 14 m` (was `Position shared · accuracy 14 m`). Replays of the same client id return the stored row unchanged.
- The backfill migration labels rows recorded before the gazetteer and rewrites their feed posts' `Position shared` prefix.
- `recordCheckin` (`src/lib/actions/checkins.ts`) returns `placeLabel`; `LocationSharing` shows "10 km N of Malmesbury · Check-in saved (±14 m)…".
- `src/lib/places.ts` (pure, tested): `placeLabel(row)` prints the stored label and falls back to four-decimal coordinates only when it is null; `formatCoordinates` never prints NaN.
- Screens: `/map` banner ("Victor · 10 km N of Malmesbury"), history rows (place instead of coordinates), pin popups; `/game-centre` banner ("10 km N of Malmesbury · 09:41 SAST"); `/my-trip` phone strip. No screen prints coordinates unless the label is missing.

## Verified

- SQL: a bare PostgreSQL 16 cluster in the sandbox with shimmed `auth`/`storage` schemas and roles; all eight existing migrations, `seed.sql`, then the three new migrations applied cleanly. Labels checked for 19 points along the route (Malmesbury, Piketberg pass, Clanwilliam, Vanrhynsdorp, Nuwerus, Garies–Kamieskroon, Springbok, Aggeneys, Pofadder, Pella, Cape Town, Stellenbosch, off Lamberts Bay, far Atlantic → null). `record_checkin` as a participant (JWT claim set, role `authenticated`) stored the label, posted it to the feed and returned the same row on replay; the backfill relabelled a pre-existing check-in and its post; `anon` is denied `pb_place_label`.
- `npm run typecheck && npm run lint && npm test` green; `npx next build` green.
- Not verified: the migrations on hosted Supabase (`db:push` of a 1.1 MB file; the SQL is plain inserts and should be fine), the integration test additions (`scripts/integration-test.ts` now asserts `In Pofadder`, the feed body, `10 km N of Malmesbury` via RPC and member read of `settlements`; needs the local stack), and the screens in a browser against a backend.

## Suggested checks on production (after merge and `db:push`)

1. `select count(*) from public.settlements` → 12 613; `select public.pb_place_label(-33.3708, 18.72714)` → `10 km N of Malmesbury`.
2. Existing check-ins show a place on `/map` and their feed cards no longer say "Position shared".
3. As Victor with sharing on, press "Update location": the status line and the feed card name the place; `/game-centre` banner reads "<place> · <time> SAST".
4. The map source line shows the GeoNames attribution.

## Still open

1. Regenerate `database.types.ts` from the local stack and confirm no diff beyond the hand edits.
2. GeoNames population data for the Northern Cape is sparse, so tier 3 covers real towns; if a label ever names an obscure hamlet over a known town, raise that town to tier 1 in `parseSettlements` (a name allow-list) and rebuild.
3. Carried forward: run `scripts/fetch-sleeper-bracket.ts` and commit the snapshot; custom SMTP; invite Theo as commissioner; self-review guard; `memberships.invited_email` visibility.
