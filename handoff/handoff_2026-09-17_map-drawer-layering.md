# Pofadder Bowl 2026 · Handoff (2026-09-17, map under the mobile drawer; spectator panel removed)

Follow-on to `handoff_2026-09-17_member-view-and-map.md`. Infrastructure detail still lives in `handoff_2026-09-17.md`.

## State at handoff

| Item | Value |
|---|---|
| Branch | `claude/menu-bug-map-check-view-6eybx6` |
| Production | https://pofadder-bowl.vercel.app deploys from `main`; this branch is not merged |
| Schema | Unchanged. No migrations, no `db:push` |
| Env | Unchanged |
| Tests | `npm run typecheck`, `npm run lint`, `npm test` (34 vitest) pass |

## What was asked

1. On a phone, opening the menu drawer while the check-in map is on screen (both `/map` and `/game-centre`) showed the map painting on top of the drawer. Reported from member view; the role is irrelevant.
2. Remove the "Spectator view" panel from `/map` completely.

## What was done

### 1. Map painted above the drawer

**Cause.** Leaflet's stylesheet gives its panes `z-index` 400 to 700 and its controls 800 to 1000. The map wrapper `.pb-live-map` was `position:relative` with no `z-index`, so it created no stacking context and those values competed directly with the page: the drawer backdrop (60), the drawer (61) and the sticky header (50) all lost. The static preview wrapper `.pb-map` had the same shape.

**Fix.** `src/app/globals.css`: `.pb-live-map` and `.pb-map` now carry `isolation:isolate;z-index:0`. Every Leaflet layer is contained inside the map's own stacking context, so the drawer, backdrop and sticky header paint above it. Nothing inside the map changes order. Both screens use the same `CheckinMap` component, so one rule fixes both.

### 2. Spectator view panel

`src/app/(league)/map/page.tsx`: the panel ("Spectator view · Only the participant's device shares positions…") shown to non-participants in the right column is gone. Members now see the check-in history panel at the top of that column. The participant still gets `LocationSharing`, with the history panel spaced below it as before.

## Verification

- `npm run typecheck && npm run lint && npm test` green.
- Browser: `npx next build && npx next start -p 3001`, a temporary page under `src/app/demo/` (deleted before commit) rendering `CheckinMap` with five check-ins inside the demo shell, headless Chromium at 390 × 844 with the drawer open. `document.elementFromPoint` over the zoom control returned the drawer link after the fix; with the old rule injected at runtime it returned `leaflet-control-zoom-out`, and the screenshot showed markers, route, zoom buttons and attribution bleeding through the drawer, matching the reported screenshot. Tiles do not load in the sandbox (openstreetmap.org is blocked), which is why only the overlay layers showed in the reproduction.
- Not verified: the `/map` page itself against a live Supabase session (no credentials in the sandbox). The change there is a removed JSX block and a conditional inline style only.

## Suggested checks on production

1. On a phone, open `/map` and `/game-centre`, tap Menu: the drawer must fully cover the map, including the zoom buttons and the attribution strip. Scroll so the map sits under the sticky header: the header must stay on top.
2. In member view on `/map`, the right column starts with "Check-in history"; no "Spectator view" panel.
3. As the participant on `/map`, the location-sharing panel still sits above the history panel with its gap.

## Still open (carried forward)

1. Invite Theo (TheoLotter) as commissioner, not admin.
2. Custom SMTP (Resend / Postmark) before inviting the remaining managers.
3. Optional keyed tile provider if OSM usage ever becomes heavy.
4. Unexercised in a browser: TUS uploads over 6 MB, IndexedDB drafts, MediaRecorder press answers, certificate PNG export, Web Share.
