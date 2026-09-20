# Pofadder Bowl 2026 · Handoff (2026-09-20, run route from the watch export, icon actions, roster logos)

Follow-on to `handoff_2026-09-20_settlements-place-labels.md` (state of `main`). Infrastructure detail still lives in `handoff_2026-09-17.md`; the automatic migration path is in `handoff_2026-09-19_supabase-integration-trigger.md`.

## State at handoff

| Item | Value |
|---|---|
| Branch | `claude/run-activity-route-ui-6rgmv9`, started from `main` at `ed99c7e` (no PR opened) |
| Production | https://pofadder-bowl.vercel.app deploys from `main`; unaffected until merged |
| Schema | **One new migration**: `supabase/migrations/20260920001200_run_distance_10km.sql` (data only, no columns). It updates the hosted event, itinerary, challenge and prop rows from 14 km to 10 km; the Supabase GitHub integration applies it on the push to `main`, confirm under Database → Migrations. The route feature itself needs no schema: the file is parsed from storage and the roster strip uses the existing `claimed_kits` RPC |
| Types | Unchanged |
| Env | Unchanged (`NEXT_PUBLIC_MAP_TILE_URL` drives the route map exactly as it drives the check-in map) |
| Tests | `npm run typecheck`, `npm run lint`, `npm test` (18 files, 115 vitest, 8 new in `gpx.test.ts`) pass; `npx next build` passes |

## What was asked

1. The run challenge: the commissioner (when approving) and the league should see the route from the uploaded GPX file.
2. Every button that is just underlined text with a link becomes an icon in the app's style.
3. Wherever a fixed set of team logos was shown (the header strip), show the logos of the teams claimed by members who have signed up; wherever a single logo was shown (the title row), show the viewer's own chosen team.

## What was done

### 1. The run route

- `src/lib/gpx.ts` (pure, tested): `parseTrack(text)` reads GPX (`<trkpt>`, falling back to `<rtept>`) and TCX (`<Trackpoint>` with a `<Position>`), skipping bad or null-island points, and returns the line (thinned to `MAX_TRACK_POINTS` = 1500, first and last point kept) plus `trackStats`: distance (haversine), elapsed time from the first to the last timestamp, pace, elevation gain with a 3 m hysteresis so GPS wobble is not a hill, start and finish instants. `isTrackFile` recognises `.gpx`/`.tcx` by name or media type. FIT is binary and is not drawn (the screens say so and ask for a GPX export alongside).
- `src/lib/run-track.ts` (server-only): `loadRunTrack(ctx, files)` downloads the first GPS file of a submission through the caller's own Supabase client (storage RLS decides who may read: members see submitted and approved versions, drafts stay with the participant and commissioners), parses it and keeps the result in a small per-instance cache keyed by file id and size. Files above 20 MB are skipped. `loadRunSubmission(ctx)` finds the run challenge (`proof_type` containing "export", sequence 2 in the seed) and the version the league should see: approved first, else the newest submitted, flagged or superseded one; never a draft.
- `src/components/map/TrackMap.tsx` (client, Leaflet): the line as recorded with a cream casing, a green start dot and an orange finish dot, fitted once per line. Nothing is road-routed or snapped; the map shows exactly what the file holds. `RunRoute.tsx` wraps it with `next/dynamic` (`ssr: false`), prints the four stats (distance, time, pace, climb) and the source line, and shows the static-fallback label when tiles are off. `RunTrackPanel.tsx` is the async server component (`RunTrack`) that does the download and parse; every page renders it under `Suspense` with `RunTrackSkeleton`, so a slow storage read never delays the screen.
- **Hydration hazard found on the way:** Node and Chromium disagree on `en-GB` date punctuation (`formatDay` gives "Thu 24 Sept" on the server and "Thu, 24 Sept" in the browser). A date formatted inside a client component therefore fails hydration (React error 418). `RunRoute` gets its start and finish labels pre-formatted from the server (`runRouteLabels` in `RunTrackPanel.tsx`). Keep `formatDay`/`formatDateTime` out of client-rendered text elsewhere too, or pass strings down.
- Screens:
  - `/review/[submissionId]` (commissioner): a "The route, from the watch export" panel above the evidence list for the run challenge or any submission with a GPS file. The replay checklist now asks whether the trace covers the full 10 km including the R358 leg.
  - `/map` (league): a "The run" panel under the check-in map with the status tag (APPROVED, IN REVIEW, FLAGGED, or NOT YET RUN with a note before any upload). Anchor `data-tour="run-route"`.
  - `/proof/[challengeId]` (participant): "Your route, as the league sees it" under the uploader for the run challenge, so Victor sees the line before submitting. The capture hint now says the GPX line is what gets approved.
  - `/recap`: "The run, as recorded" under the highlight reel once the run is approved.
- CSS at the end of `globals.css` under "Run route".

### 2. Icon actions

- `src/components/ui/Icons.tsx`: 23 line icons on a 24 px grid in the current colour (arrow, map pin, home, users, clipboard, sign out/in, eye, eye-off, trash, close, retry, check, mail, link, unlink, copy, camera, flag, user-check, layers, shield).
- `src/components/ui/IconButton.tsx`: `IconLink`, `IconButton` (round 36 px, `sm` 30 px; tones outline, solid, orange, gold for the dark drawer) with `aria-label`, a native `title` tooltip and visually hidden text, and `IconTab` (icon over a tiny caption, `aria-current` for the active tab) for the phone tab bar.
- Every `pb-text-action` link and button is converted; none remain in TSX:

| Where | Was | Now |
|---|---|---|
| Header, drawer footer (`(league)/layout.tsx`) | Sign out; View as league member / Exit member view | sign-out icon; eye / eye-off (`MemberViewToggle` now takes `tone`, no more `variant`) |
| Member-view banner | Exit member view | orange eye-off |
| Game centre map panel, demo game centre | Open map ↗ | map pin |
| Review queue | Members & invites ↗; Settle on the prop board ↗ | users; clipboard |
| Review submission | ← Back to the review queue; version links | back arrow in a `pb-icon-nav`; each version is a `pb-version-row` with a layers icon link |
| Members page | ← Back to review | back arrow |
| Proof challenge | ← Back to the locker · Main feed | back arrow; home |
| My trip phone tabs, demo phone tabs | My trip · Proof · Props · Main feed | flag, camera, clipboard, home tabs with captions |
| Demo layout | Real sign-in | sign-in icon (gold in the drawer) |
| Tour card | Skip the tour / Close | close icon (labels kept for screen readers) |
| Member admin rows | Save; Make event participant; Email a new link; Copy a link to hand over; Confirm link / Clear link | solid check; orange user-check; mail; copy; solid link / unlink |
| Evidence uploader | Cancel; Retry; Remove | close; orange retry; trash |

- Pill buttons (`pb-primary`, `pb-secondary`, `pb-play`) and prose links inside sentences (login, setup) were left as they are: they are not text-only links. The `.pb-text-action` CSS rules stay for now in case a branch still uses the class.

### 3. Logos

- `src/lib/roster.ts` (server-only, request-cached): `loadClaimedTeams(ctx)` calls the existing `claimed_kits` RPC (members only, security definer) and returns the distinct kit codes sorted by member name. The `(league)` layout passes them to `AppShell` as `teams`.
- `AppShell`: with `teams` the header strip shows those logos (each with the team name as alt and tooltip, `role="list"`) and the label reads "N FRANCHISES CLAIMED. ONE PUNISHMENT." (or "NO FRANCHISES CLAIMED YET." with the league shield). Without `teams` (the demo shell) the mockup's fixed strip and "32 FRANCHISES." stay.
- `TitleRow`: the default `team` is now `null` (league shield), never a stand-in franchise. Every private page passes `ctx.profile.kit_team`: game centre (was Giants), map (was Bills), recap (was 49ers), proof challenge (was Eagles), press room (was the participant's kit). The press-conference stage itself stays in the participant's colours: it is Victor's press conference, like the jersey cards are each author's kit.
- `TeamLogo` gained a `title` tooltip when not decorative.
- Left alone on purpose: the `/login` logo wall and the demo (public, prerendered, no roster to read) and the 32-team kit picker.

### 4. The run is 10 km, not 14 km (follow-up request)

- Every mention was changed: `src/data/league-programme.json` (`requiredRunKm`, the itinerary block, challenge #02 title, prop #01 line 10.25, the demo-only `runDistanceKm` 10.03), `supabase/seed.sql` (event `required_run_km`, itinerary, challenge, prop detail and line), `src/lib/prop-generator.ts` (fallback distance 10, so the generated prop line is 10.25), the tour copy, the prediction slip label, the location-sharing note, the certificate and recap lines ("Ten kilometres"), the demo screens, the review checklist, the map panel, `README.md`, `CLAUDE.md` and the tests (`prop-generator`, `props`, `gpx`). The teaser reads `requiredRunKm` from the programme JSON and follows.
- **Route description:** the Thursday itinerary read "R358 north 5 km, turn at 6.0 km on the watch, back to town, 2 km town loop" (6 + 6 + 2 = 14). It now reads "R358 north 3 km, turn at 4.0 km on the watch, back to town, 2 km town loop" (4 + 4 + 2 = 10). Those sub-distances are my arithmetic, not a supplied plan; confirm the turnaround point with Victor.
- **Hosted data:** `seed.sql` is only run on a fresh database, so `20260920001200_run_distance_10km.sql` updates production: `events.required_run_km` 14 → 10 for `pofadder-bowl-2026`, the itinerary item (quarter 2, sequence 3) title and description, challenge #02 title, and prop #01 detail and line 14.25 → 10.25. Every update is guarded on the old value so a re-run is a no-op, and the prop is left alone if it has locked or anyone has already picked a side (the commissioner can regenerate the board from the app in that case; `upsert_props` refuses once picks exist, so the prop would then keep 14.25 until settled as void or re-created).
- Older handoffs still say 14 km; they are historical records and were left as written.

## Verified

- `npm run typecheck && npm run lint && npm test` green (115 vitest; the distance edits changed expected values, not the count); `npx next build` green.
- The distance migration on a bare PostgreSQL 16 cluster in the sandbox with shimmed `auth`/`storage` schemas: all seventeen earlier migrations plus the new `seed.sql` applied cleanly; the rows were then rewound to production's 14 km values and the migration converted the event, itinerary item, challenge and prop; a second run changed nothing; with a pick inserted on prop #01 the prop kept 14.25 while the other three rows still converted.
- Production server on port 3001 + headless Chromium through a temporary `/preview-tmp` page (deleted before commit) at 390 px and 1280 px: roster strip with seven claimed logos and the count label, every icon button tone, the run panel with a synthetic 140-point GPX (line, start and finish dots, stats row 4-up on desktop and 2-up on the phone), the phone tab bar with the active tab in orange, version rows, the member banner with the orange eye-off, the drawer footer with gold icons. No horizontal overflow, no console errors (tile requests are blocked in the sandbox, so the map background is grey; the line and markers draw regardless).
- Not verified (no backend in the sandbox): the download and parse of a real watch export from storage under RLS as member, commissioner and participant; the Suspense streaming on `/map`, `/review/[id]`, `/proof/[id]` and `/recap` against a real submission; the roster strip against real `claimed_kits` rows; the sign-out and member-view forms behind the new icon buttons (they post the same forms and actions as before).

## Suggested checks on production (after merge)

1. Upload a real GPX from the watch on `/proof/<run challenge>`: the "Your route" panel draws it before submitting, with distance close to the watch's own figure.
2. Submit it; as commissioner open it from `/review`: the route panel sits above the evidence list; approve.
3. As a plain member open `/map`: "The run" panel shows APPROVED with the same line and numbers; `/recap` shows it under the highlight reel.
4. Header strip: one logo per member with a kit, count matching Review → Members; hover a logo for the team name.
5. Every title row shows your own kit; switch to the member view and back with the eye icon in the header (phone: in the Menu drawer footer).
6. Sign out from the header icon and from the drawer.
7. After the migration: Review → the run challenge reads "10 km run…", My trip → Thursday 06:30 reads "10 km run", the prop board's first line is 10.25 km (unless it had picks), and the teaser says "A 10 km run".

## Still open

1. FIT files: not drawn. If the watch only exports FIT, either add a FIT decoder (pure, ~2 KB of binary parsing) to `gpx.ts` or keep asking for a GPX export as the hint says.
2. The parsed track is cached per warm function instance only; if `/map` traffic ever matters, store the thinned line on `evidence_files` at attach time instead (a migration).
3. Tour: no step mentions the run panel yet (`data-tour="run-route"` and `review-route` anchors are in place).
4. Carried forward: regenerate `database.types.ts` from the local stack; run `scripts/fetch-sleeper-bracket.ts`; custom SMTP before inviting the league.
