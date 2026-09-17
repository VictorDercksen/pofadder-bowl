# Pofadder Bowl 2026 · Handoff (2026-09-17, session 2: member view and map route)

Follow-on to `handoff_2026-09-17.md`, which still holds the infrastructure detail (Supabase project, Vercel, auth, roles, cloud-session setup). This document covers what changed in this session, how it works, how it was verified, and what is still open.

## State at handoff

| Item | Value |
|---|---|
| Branch | `claude/league-view-map-checkins-567r8u`, merged into `main` (fast-forward) |
| Production | https://pofadder-bowl.vercel.app deploys from `main` automatically |
| Schema | Unchanged. No new migrations, no `db:push` needed |
| Env | No new variables. `NEXT_PUBLIC_MAP_TILE_URL` now defaults to public OSM tiles when empty; `static` restores the labelled preview |
| Tests | `npm run typecheck`, `npm run lint`, `npm test` (34 vitest, 7 new) all pass |

## What was asked and what was done

### 1. Is the participant’s screen different from the league’s?

Yes, and it was already so. Victor is admin, commissioner and participant at once; the effective role resolves to `admin`. His menu carries **My trip** (score, next challenge, draft / in-review / flagged counts, quarter-by-quarter game plan), **Proof locker**, **Commissioner** and **League admin**. Members only get Game centre, Check-in map, Punishment Bingo, Predictions, Press room, Final whistle and League access.

What was misleading: the header badge said only `ADMIN`. It now lists every hat: `ADMIN · PARTICIPANT` (`describeRole` in `src/lib/roles.ts`). `src/lib/roles.test.ts` locks the menu differences per role.

Not changed: the admin’s home route is still `/review` (`homeFor`). If Victor wants to land on My trip during the event, change the order in `homeFor` so `isParticipant` wins over admin.

### 2. Member view toggle

- **Where**: “View as league member” next to the role badge in the header (desktop) and in the mobile drawer footer. While active, an orange banner on every page says `LEAGUE MEMBER VIEW` with an “Exit member view” link. Hidden from the header badge below 580 px (the drawer carries it there).
- **How**: `src/lib/actions/view.ts` (`setMemberView`) sets or clears the `pb-member-view` cookie (HttpOnly, SameSite=Lax, 12 h). `getLeagueContextRaw` reads it and passes it to `resolveAccess` (`src/lib/roles.ts`). While set, `role` is `member` and `isAdmin`, `isCommissioner`, `isParticipant` are all `false`, so every page and server action behaves as it would for a member. `canViewAsMember` and `viewingAsMember` are on the context for the UI.
- **Safety**: the cookie only ever removes capabilities. A plain member with the cookie is unaffected. RLS and RPCs still enforce the real role, so nothing gained or lost at the database level.
- **Behaviour on switch**: the toggle keeps the current path. Entering member view from My trip, Proof locker or Commissioner lands on `/game-centre` because those pages redirect members themselves.
- Components: `src/components/shell/MemberViewToggle.tsx` (client form, submits pathname), `src/app/(league)/layout.tsx` (badge, drawer, banner), CSS at the end of `src/app/globals.css` (`pb-role-badge`, `pb-view-toggle`, `pb-member-banner`, `.pb-demo.on`).
- The menu list moved to `src/components/shell/nav.ts` (pure, testable); `AppShell` re-exports `navFor` and `ShellRole` so nothing else changed.

### 3. Map and check-ins

The check-in flow was reviewed end to end and was already sound: browser geolocation → `recordCheckin` server action (zod, re-checks participant) → `record_checkin` RPC (participant, sharing consent, captured_at window, de-dup by client id) → feed post → Realtime publication. Changes made:

- **Route line**: `checkinPath` (`src/lib/checkin-path.ts`, tested) orders check-ins oldest → newest. `LiveMap` draws a cream casing plus an orange polyline through them, one marker per check-in (latest highlighted), grey markers for verified itinerary venues. Used on `/map` (all loaded check-ins, up to 50) and `/game-centre` (line plus latest marker).
- **Viewport**: fits to the route when there are two or more check-ins (max zoom 14), otherwise centres on the latest. Fitting happens only when the plotted set changes, so a zoomed-in member is not reset by the poll.
- **Bug fixed**: `LiveMap` was passed a fresh `fallbackCenter` array each render, which re-ran the mount effect and destroyed / rebuilt the Leaflet map on every server refresh. It now takes two numbers.
- **Live refresh for spectators**: `src/components/map/CheckinLive.tsx` on `/map` subscribes to `checkins` changes for the event and calls `router.refresh()`, with a 45 s visible-tab poll as fallback (same pattern as `SidelineFeed`).
- **Tiles**: `resolveTileUrl` in `src/lib/env.ts` defaults to `https://tile.openstreetmap.org/{z}/{x}/{y}.png` with OSM attribution when the variable is empty; `static` or `none` shows the labelled regional preview. Production already used OSM, so nothing changes there; previews and fresh checkouts now get a live map without configuration.
- **Robustness**: `LocationSharing` wraps the check-in request in try / catch / finally so a dropped connection mid-request no longer leaves the button stuck on “Getting GPS fix…”.

## Verification done

- `npm run typecheck && npm run lint && npm test` green.
- `npx next build` then `next start`; a temporary page (removed before commit) rendered `CheckinMap` with five sample check-ins and both toggle states in headless Chromium. Confirmed in the DOM: two polylines (casing + route), six markers, OSM attribution, correct source caption, toggle labels. Screenshot matched.
- Not verified in this session (no backend credentials, openstreetmap.org blocked by the sandbox proxy): the toggle against a live Supabase session, real tile loading, Realtime refresh on `/map` in a second browser. All are conventional and the code paths mirror existing ones; a quick pass on the Vercel deployment is worthwhile.

## Suggested checks on production

1. Sign in as Victor: header shows `ADMIN · PARTICIPANT`; menu has My trip and Proof locker.
2. Click “View as league member”: banner appears, menu shrinks to the member screens, `/my-trip` redirects to `/game-centre`. “Exit member view” restores everything.
3. On a phone with sharing enabled, press “Update location” twice from two spots: `/map` shows both points joined by the orange line and the history count; a second browser on `/map` picks up the new point within a few seconds without reload.

## Still open (from the first handoff)

1. Invite Theo (TheoLotter) as commissioner, not admin.
2. Custom SMTP (Resend / Postmark) before inviting the remaining managers.
3. Optional keyed tile provider if OSM usage ever becomes heavy (a dozen viewers is fine).
4. Unexercised in a browser: TUS uploads over 6 MB, IndexedDB drafts, MediaRecorder press answers, certificate PNG export, Web Share.
