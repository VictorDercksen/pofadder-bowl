# Pofadder Bowl 2026 · Handoff (2026-09-19, road routes on the check-in map)

Follow-on to `handoff_2026-09-19_supabase-integration-trigger.md` (production and migration state) and `handoff_2026-09-17_stress-test.md` (map and check-in detail). Infrastructure detail still lives in `handoff_2026-09-17.md`.

## State at handoff

| Item | Value |
|---|---|
| Branch | `claude/maps-route-connections-96dyp9`, merged into `main` on request (`origin/main` merged into the branch first, no conflicts; typecheck, lint, 98 unit tests and `next build` green on the merged tree) |
| Production | https://pofadder-bowl.vercel.app deploys from `main`, so this ships with the push. No files under `supabase/` changed, so the Supabase GitHub integration does not run |
| Schema | Unchanged. No migration, no type regeneration |
| Env | **One new optional server-only variable**: `MAP_ROUTING_URL`. Nothing to set on Vercel unless the default public OSRM router should be replaced or switched off |
| Tests | `npm run typecheck`, `npm run lint`, `npm test` (15 files, 98 vitest after the merge, 24 new here) pass |

## What was asked

The map connected check-ins with straight lines. Connect them with actual routes.

## What was done

The orange line on `/map` and the game-centre map now follows real roads. Each leg between two consecutive check-ins is routed through OSRM (Open Source Routing Machine, car profile) and the answers are stitched into one polyline. A leg that cannot be routed (router down, no road, a fix snapped further than 5 km from a road) stays a straight line, so the map never goes blank.

### Where it lives

| Piece | Path | Notes |
|---|---|---|
| Pure routing helpers | `src/lib/route-geometry.ts` (+ `.test.ts`) | Legs (`routeSegments`), cache keys, stitching with straight fallback (`stitchRoute`), OSRM URL and response parsing, query parsing. No React or server imports |
| Server proxy | `src/app/api/map-route/route.ts` | `GET /api/map-route?from=lat,lng&to=lat,lng`. Requires a verified signed-in user (the session proxy bounces anonymous callers first). Calls `{MAP_ROUTING_URL}/route/v1/driving/…?geometries=geojson` with an 8 s timeout and `next: { revalidate: 30 days }`, so each leg hits the router once for every viewer. Answers `{ coordinates: [[lat,lng],…] }` or `{ coordinates: null, reason }` |
| Browser store and hook | `src/components/map/useRoutedPath.ts` | Module-level cache of routed legs shared by every map on the page (`useSyncExternalStore`). Fetches missing legs with at most 4 in flight, retries transient failures (network, 429/5xx, `upstream_*`) up to 3 times with a growing delay, and returns `{ line, routeKey, settled }` |
| Map | `src/components/map/LiveMap.tsx` | Draws `route.line`; `routeKey` is part of the redraw key; the viewport is fitted once per plotted set and once more when the road geometry settles (the N7 bulges well west of the straight Malmesbury–Pofadder box). Caption in `CheckinMap.tsx` updated |
| Env | `src/lib/env.ts` (`mapRoutingUrl`, `resolveRoutingUrl`, `DEFAULT_MAP_ROUTING_URL`), `.env.example`, `README.md` | `MAP_ROUTING_URL` empty → `https://router.project-osrm.org`; `none`/`off`/`static` → straight lines; any other value is used as the OSRM base URL |

### Behaviour notes

- Legs shorter than 30 m are never routed (a run check-in a few paces from the last one would only snap to the same kerb). Legs over 1 500 km are refused by the handler.
- The routed line always starts and ends exactly on the check-ins; the router's snapped ends are appended to, not substituted for, the real fixes.
- Only the car profile is used. The public OSRM demo server serves no foot profile; the 14 km run is along roads anyway, so its check-ins still follow the road.
- The public demo router has no SLA. If it is slow or down the map shows straight legs, retries a couple of times, and the line upgrades in place when an answer arrives. Nothing blocks page render.
- Check-in coordinates leave the app only as the two endpoints of a leg in the router query, from the server (never the browser) and only for signed-in members' requests. The static-tiles mode (`NEXT_PUBLIC_MAP_TILE_URL=static`) is unaffected: no live map, no routing.

## Verification done

- `npm run typecheck && npm run lint && npm test` green.
- Handler exercised in a throwaway vitest with mocked auth (deleted before commit): 401 signed out, 400 bad coordinates, `routing_off` and `leg_out_of_range` without an upstream call, `upstream_503` / `upstream_unreachable` on failures, and a real Malmesbury → Pofadder leg through the live public router returning a few hundred points that pass west of 18.2° E (the N7 via Springbok).
- Browser: `next build && next start`, headless Chromium, a temporary `/demo/map-check` page (deleted) with four check-ins Malmesbury → Clanwilliam → Springbok → Pofadder and `/api/map-route` answered from OSRM by the test script (no backend in the sandbox, so the session proxy would have redirected the real handler). Three leg requests fired, the polyline redrew from 4 vertices to the routed geometry, no console errors, viewport refitted to the routed line.
- Not verified: the real handler behind the Supabase session proxy on Vercel (no credentials here), the Next data cache actually sharing legs across viewers in production, and `fra1` → OSRM latency.

## Suggested checks on production

1. Open `/map` with at least two check-ins more than 30 m apart: the orange line should follow the road within a second or two of the map appearing (it starts straight and upgrades).
2. Network tab: one `/api/map-route` request per leg on first view, none on the 45 s poll unless a new check-in arrived; a second viewer's requests should return quickly (cached upstream).
3. If the line ever stays straight for everyone, check the Vercel function log for `upstream_*` reasons; set `MAP_ROUTING_URL` to a self-hosted OSRM or `none` if the public router misbehaves during the event.

## Still open (carried forward)

1. Invite Theo (TheoLotter) as commissioner, not admin; then consider the self-review guard from the stress-test handoff.
2. Custom SMTP (Resend / Postmark) before inviting the remaining managers.
3. Optional keyed tile provider if OSM usage ever becomes heavy; the same applies to a self-hosted OSRM if the public demo router is unreliable on the day.
4. Unexercised in a browser against a backend: TUS uploads over 6 MB, IndexedDB drafts, MediaRecorder press answers, Web Share.
