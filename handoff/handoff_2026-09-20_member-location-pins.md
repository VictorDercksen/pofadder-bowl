# Pofadder Bowl 2026 · Handoff (2026-09-20, league member location pins)

Follow-on to `handoff_2026-09-20_upload-cap-direct-uploads.md` (state of `main`). Infrastructure detail still lives in `handoff_2026-09-17.md`; the automatic migration path is in `handoff_2026-09-19_supabase-integration-trigger.md`.

## State at handoff

| Item | Value |
|---|---|
| Branch | `claude/league-member-location-map-mfok52`, started from `origin/main` at `bc1c3a1`, fast-forwarded into `main` at Victor's request (no PR) |
| Production | https://pofadder-bowl.vercel.app deploys from `main`, so this is live once Vercel builds. The Supabase GitHub integration applies the migration on the push to `main`; confirm under Database → Migrations |
| Schema | **One new migration**: `supabase/migrations/20260920001600_member_locations.sql` (table `member_locations`, RPCs `share_member_location`, `clear_member_location`, `event_member_locations`, realtime publication). Additive and idempotent (re-running is a no-op). The Supabase GitHub integration applies it on the push to `main`; confirm under Database → Migrations. Until it is applied the app still works: the reader RPC fails, the loader returns an empty list, the map shows no member pins and the share button reports "Could not share your location" |
| Types | `src/lib/database.types.ts` hand-edited: `member_locations` table, the three functions. Regenerate from the local stack when convenient |
| Env | Unchanged |
| Tests | `npm run typecheck`, `npm run lint`, `npm test` (21 files, 149 vitest, 4 new in `member-locations.test.ts`, 1 new in `tour.test.ts`) pass; `npx next build` passes (re-run after the fullscreen follow-up) |

## What was asked

League members (not only the participant) should be able to share their current location on the check-in map as a styled pin, upserting it so everyone can see where everyone is. Only the participant's position is drawn as a route; members are pins only.

## How it works

### Data: `public.member_locations`

- One row per member per event, primary key `(event_id, user_id)`: `latitude`, `longitude`, `accuracy_m`, `place_label` (gazetteer label, computed once by `pb_place_label`), `captured_at` (device time), `updated_at`. No history, no soft delete: the row is replaced on every share and deleted on remove.
- RLS: `member_locations_select` for active event members (`pb_is_event_member`). No insert, update or delete policy and the table privileges for `authenticated` are `select` only, so the only write paths are the RPCs.
- `share_member_location(p_event, p_latitude, p_longitude, p_captured_at, p_accuracy_m)` (security definer): re-checks `pb_is_event_member`, refuses a `captured_at` more than 5 minutes ahead or 2 days behind (same window as `record_checkin`), labels the point and upserts. Any active member may share, the participant included; their pin is separate from the check-in route. No feed post: a pin is quieter than a check-in.
- `clear_member_location(p_event)` deletes the caller's row and returns whether one existed.
- `event_member_locations(p_event)` returns every pin of the event joined with `profiles` for `display_name` and `kit_team` (null until the member claims a kit), newest first, member-only.
- `member_locations` is in the `supabase_realtime` publication so `CheckinLive` refreshes the map when a pin moves.

### App

- `src/lib/member-locations.ts` (pure, tested): `memberPins(rows, timeLabel, now)` turns the RPC rows into map pins (`kind: "member"`, kit code, name, `stale` after 6 h, dropped after 3 days), `isMemberPinStale`, `memberInitials` for members without a kit. The time label is passed in from the server so no date is formatted in the browser (see the hydration note in `handoff_2026-09-20_run-route-icons-roster-logos.md`).
- `src/lib/checkins.ts`: `loadMemberLocations(ctx)` (the RPC, empty on error) and `ownMemberLocation(ctx, rows)`.
- `src/lib/actions/checkins.ts`: `shareMemberLocation` (Zod, `getLeagueContext`, the RPC, revalidates `/map` and `/game-centre`, returns the place label) and `clearMemberLocation`. The role check lives in SQL; every active member may call both.
- `MapPin` (`CheckinMap.tsx`) gained the `member` kind with `team`, `name` and `stale`. `LiveMap.tsx` draws it as a Leaflet `divIcon`: a 32 px badge in the member's kit colour with the team logo (`public/nfl`), or initials on league green when no kit is claimed, a small tail, faded when stale, z-index between the current check-in and history dots. Member pins are part of the render key (so a moved pin redraws) but **not** of the fit key: the viewport still follows the participant's route only, so a member in Cape Town does not zoom the map out to the whole country and a member's update does not yank a viewer who zoomed in. With no route yet the initial fit frames venues and members once, at mount.
- `src/components/map/MemberLocationShare.tsx` (client): the "Your pin" panel on `/map` for everyone who is not the participant (the participant keeps `LocationSharing`; an elevated account in member view sees the member panel). "Share my location" / "Update my pin" requests a fresh GPS fix (`maximumAge: 0`) and calls the action; "Remove my pin" clears it. Same geolocation error copy as the participant's panel. Pressing the button is the consent; nothing runs in the background.
- `/map`: member pins on the map, a "Where the league is" panel (kit badge, place, day and time SAST, age, accuracy, stale, "you") under the share panel, the source line under the map counts the member pins, and the check-in history keeps its place. `/game-centre`: member pins on the map panel (read-only; the share panel is on `/map`).
- `CheckinLive` subscribes to `member_locations` as well as `checkins` on the same channel; the visible-tab poll is unchanged.
- CSS at the end of `globals.css` under "Member location pins" (`pb-member-pin*`, `pb-member-row`).

## Follow-up in the same session: fullscreen map

- Asked: fullscreen the map with everything on.
- `LiveMap` now wraps the Leaflet canvas (`pb-live-map-canvas`) in the `pb-live-map` box and keeps a `full` state. The expand button (top right, `pb-map-tools`) adds the `full` class, which makes the box a fixed full-viewport overlay at `z-index: 65` (above the drawer, below the tour and toasts). No element Fullscreen API: iOS Safari lacks it, and a fixed overlay behaves the same everywhere. While fullscreen: Leaflet is told the new size (`invalidateSize`), scroll-wheel zoom is enabled (off otherwise so the page stays scrollable), body scroll is locked, Escape or the collapse button leaves, and a legend (latest check-in, route, earlier check-ins, venues, member pins) sits bottom left.
- The fit key carries `all` or `route`: entering fullscreen fits the route line, the check-ins, the venues **and** the member pins; leaving refits to the route as before. A "Fit everything" button (map-pin icon) re-frames after panning. `Icons.tsx` gained `expand` and `collapse`.
- Both check-in maps get it (`/map` and the game-centre panel) since they share the component; the static fallback has no fullscreen.
- Verified in headless Chromium at 1280×800 and 390×780 through the temporary preview page: the overlay covers the viewport, every member pin (one placed in Johannesburg) is inside the frame after entering, tools and legend render, Escape restores the page and body overflow, no console errors.

## Follow-up in the same session: tutorial steps

- Three steps in `leagueBlock` (`src/lib/tour.ts`) right after the "map" step, on `/map`: `your-pin` (non-participants only; spotlights the "Your pin" panel, `data-tour="member-location"`), `league-pins` (everyone; the "Where the league is" panel, wording differs for the participant) and `map-fullscreen` (everyone; the tools cluster on the live map, new `data-tour="map-fullscreen"` in `LiveMap`). The static-tile fallback has no fullscreen button, so that step shows a centred card there.
- `TOUR_VERSION` stays 1: the layout auto-starts the tour only while `tutorial_completed_at` is null, so members who already finished it are not replayed; they can replay from League access. Bumping the version would also need the comparison in `(league)/layout.tsx`.
- Tests in `tour.test.ts` cover order, hrefs, targets and the role scoping of the three steps (149 vitest).

## Follow-up in the same session: the latest check-in as a badge pin

- Asked: the participant's latest location should show a pin like the members' pins.
- `LiveMap` now draws the `current` pin with the same `badgeIcon` as members (kit colours, team logo or initials) plus the route's orange halo and an orange tail edge (`.pb-member-pin.current`), so it still reads as the head of the route. Earlier check-ins stay small green dots; venues grey.
- `participantProfile(ctx)` in `src/lib/checkins.ts` returns name and `kit_team` (null until a franchise is claimed → initials); `participantName` wraps it. `/map` and `/game-centre` pass `team` and `name` on the current pin.
- Legend, map source line and the tour's map step now describe "the badge with the orange halo" instead of "the orange pin".
- Verified in headless Chromium through the temporary preview page: the current pin renders with the logo and halo at the route tip, members' badges and history dots unchanged, no console errors; typecheck, lint, 149 tests and `next build` pass.

## Follow-up in the same session: no paragraph under the live map

- Asked: remove the source paragraph under the check-in map.
- The `pb-map-source` line under the live map is gone from `CheckinMap`. The GeoNames credit (CC BY 4.0 requires it) moved into Leaflet's attribution control on the map, appended to the tile credit, so both licence lines stay visible with nothing underneath. The static-fallback preview keeps its own source line (it has no Leaflet control), and the run-route panel's source line is untouched. README updated.

## Verified

- SQL on a bare PostgreSQL 16 cluster in the sandbox with shimmed `auth`/`storage` schemas: all twenty earlier migrations plus `seed.sql`, then the new migration twice (second run a no-op). As a member: share labels "10 km N of Malmesbury", a second share moves the same row to "In Pofadder" (still one row), the reader returns name and kit, direct insert/update/delete on the table are refused (`permission denied`), a 3-day-old `captured_at` is refused, clear returns true then false. As the participant: sharing works alongside check-ins. As an outsider: share refused, reader and table empty. `anon` is denied the reader. The table is in the publication.
- `npm run typecheck && npm run lint && npm test` green; `npx next build` green.
- Production server on port 3001 + headless Chromium through a temporary `/preview-tmp` page (deleted before commit) at 390 px and 1280 px: kit-badge pins for KC, PHI and CIN with logos, an initials pin for a member without a kit, the stale pin faded, the route line and check-in dots unchanged underneath, the "Your pin" panel and the "Where the league is" rows. Tile requests are blocked in the sandbox so the map background is grey.
- Not verified (no backend in the sandbox): the RPCs on hosted Supabase, the realtime refresh when a pin moves, the share flow on a phone (permission prompt, fix, toast), and `scripts/integration-test.ts` (a new block covers share, upsert, reader with kit, outsider refusal, direct-write refusal and clear; run it with the local stack).

## Suggested checks on production (after the migration is applied)

1. Database → Migrations shows `20260920001600_member_locations`; `select * from public.event_member_locations('<event id>')` as a member returns rows once someone has shared.
2. As a plain member on `/map`: "Your pin" says not on the map; press "Share my location", allow location; toast names the place; a kit-badge pin appears; the panel reads "On the map at …"; "Where the league is" lists you with "· you".
3. Press "Update my pin" from another spot: still one row, pin moved. "Remove my pin" takes it off the map and the list.
4. From a second account, watch `/map` while the first shares: the pin appears without a reload (realtime), or within 45 s (poll).
5. As Victor (participant) the right column still shows Location controls, and member pins draw over the route without changing the viewport. In member view the "Your pin" panel appears instead.
6. `/game-centre` map panel shows the member pins next to the current check-in.

## Still open

1. Members' pins do not drive the normal viewport, so a member far from the route is off screen until the viewer opens fullscreen (which frames everything) or zooms out.
2. Pins older than 3 days are hidden from the map but stay in the list; nothing expires rows. A `delete … where captured_at < now() - interval '7 days'` from a cron or on the next migration would tidy the table after the event.
3. Regenerate `database.types.ts` from the local stack; run the integration tests.
4. Carried forward: raise `STORAGE_MAX_BYTES` with the plan; drop the `upsert_prediction` shims later; tour Skip semantics; per-member reset tour; Sleeper bracket script; custom SMTP.
