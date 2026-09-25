# Certificate route map and final check-in confirmation

## State at handoff

Branch `claude/certificate-map-checkin-p7jj69`, from `main` (`42990e2`). Fast-forwarded into `main` and `production` on 25 Sept (the commit carrying this line). One new migration, `supabase/migrations/20260925000200_final_checkin.sql` (two nullable columns on `certificates`, one new RPC). It applies when the branch lands on `main` (Supabase GitHub integration) and must also reach the league project when `production` is fast-forwarded. No env changes. `src/lib/database.types.ts` edited by hand for the new columns and RPC (no local stack to regenerate).

## Asked and done

Add the final map view with the participant's icon to the generated certificate (map only), and give the participant somewhere to confirm the last check-in so the route is set before the image is generated.

- **Schema.** `certificates.final_checkin_id` (FK to `checkins`, `on delete set null`) and `certificates.final_checkin_confirmed_at`. Only the RPC writes them (certificates have no update grant).
- **`set_final_checkin(p_event, p_checkin)`** (security definer): participant or commissioner; the check-in must be the participant's, in the event, not removed; `p_checkin` null clears. Refused once the certificate is issued (`the certificate is issued; the route is set`).
- **Action.** `setFinalCheckin` in `src/lib/actions/checkins.ts` (Zod `z.uuid().nullable()`, role check, error mapping, revalidates `/map` and `/recap`). `resetTestingData` clears it after `reset_event_data`.
- **Control.** `FinalCheckin` (`src/components/recap/FinalCheckin.tsx`): shows the latest check-in, "Confirm as final check-in" → "Confirm: end the route here" / Cancel; once set, "ROUTE SET", a "Use the latest check-in instead" button when a newer check-in arrived, and "Clear". Locked once issued. Placed on `/map` (participant sidebar, under location sharing) and `/recap` (participant or commissioner, above the PNG buttons).
- **Route data.** `loadRouteCheckins` (`src/lib/checkins.ts`) loads the whole trail (oldest first, a few columns, 1000-row API cap). `certificateRoute` (`src/lib/certificate-map.ts`) cuts it at the confirmed check-in; without a confirmation (or if that check-in was removed) it uses the whole trail and the caption reads "PROVISIONAL · FINAL CHECK-IN NOT CONFIRMED".
- **Drawing.** `drawRouteMap` (`src/components/recap/routeMapCanvas.ts`) paints on canvas: map tiles from `NEXT_PUBLIC_MAP_TILE_URL` loaded with `crossOrigin="anonymous"` (a tile that fails CORS is skipped, so the canvas never taints), the route along roads (long legs ≥ 15 km through `/api/map-route`, the rest straight; path thinned to 1.5 km), a start dot (hidden when the finish is within 2 km of it) and the participant's kit badge with team logo on the final check-in. Projection and tile maths are pure in `src/lib/certificate-map.ts` with tests.
- **Certificate PNG.** `CertificateExport` now renders 1200 × 1800: caption and a 1040 × 540 map under the stats; everything below moved down 600 px. A small tile credit sits in the map corner (the OSM licence requires it on the image).
- **Recap preview.** `RouteMapPreview` draws the same map inside the on-screen certificate, so what is confirmed is what the PNG shows.

## Verified

`npm run typecheck`, `npm run lint`, `npm test` (26 files, 183 tests) pass. `next build` succeeds. Rendered in Chromium through a temporary demo page (removed): the PNG exports with the map, badge, caption and credit; with a local CORS tile stub the tiles draw and `toBlob` still succeeds; the `FinalCheckin` panel renders in its confirmed/newer state.

## Not verified

`npm run test:integration` (no Docker). The migration was not executed against a database. Real OpenStreetMap tiles (blocked in the sandbox): OSM serves `Access-Control-Allow-Origin: *`, but if a keyed provider without CORS is configured the map draws without tiles. Road routing on the certificate (the sandbox has no session for `/api/map-route`; legs fell back to straight lines).

## Suggested checks on production after the merge

1. `select final_checkin_id, final_checkin_confirmed_at from certificates;` both null.
2. `/map` as the participant: "Final check-in" panel under location sharing; confirm the latest check-in; tag reads ROUTE SET.
3. `/recap`: the on-screen certificate shows the route map with the kit badge and "FINAL · <place> · <time>"; the downloaded PNG shows the same.
4. After issuing the certificate the panel reads "The certificate is issued. The route is set." and the buttons are gone.

## Open

- Integration test coverage for `set_final_checkin` (role, foreign check-in, issued lock) not added.
- Fallback from SQL (service role): `update public.certificates set final_checkin_id = '<checkin id>', final_checkin_confirmed_at = now() where event_id = (select id from events where slug = 'pofadder-bowl-2026');`
