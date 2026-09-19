# Pofadder Bowl 2026 · Handoff (2026-09-19, first-run tutorial tour)

Follow-on to `handoff_2026-09-17_nav-perf-sleeper-ui.md`. Infrastructure detail still lives in `handoff_2026-09-17.md`.

## State at handoff

| Item | Value |
|---|---|
| Branch | `claude/first-run-tutorial` (not merged, no PR opened) |
| Production | https://pofadder-bowl.vercel.app deploys from `main`; unaffected until merged |
| Schema | **One new migration**: `supabase/migrations/20260919000900_tutorial.sql` (adds `profiles.tutorial_completed_at timestamptz` and `profiles.tutorial_version smallint`, grants self-update on both). Run `npm run db:push` from the laptop. Before the push the app still works: the tour simply never auto-starts (see "How it works") |
| Types | `src/lib/database.types.ts` hand-edited for the two new profile columns. Regenerate from the local stack when convenient |
| Env | Unchanged |
| Tests | `npm run typecheck`, `npm run lint`, `npm test` (68 vitest, 10 new in `src/lib/tour.test.ts`) pass; `npx next build` passes |

## What was asked

A tutorial for the whole application that every user gets on first sign-in, that existing users also do at least once, scoped per role, with a button for admins to test it.

## What was built

A guided tour: a spotlight overlay with a step card that walks the member from screen to screen, navigating the real app as it goes. It auto-starts once per account (existing accounts included, because the new column starts null for everyone), can be replayed from League access, and admins can run any role's version from League admin.

### Steps per role (`src/lib/tour.ts`, `tourStepsFor(role, isParticipant)`)

| Block | Steps | Who |
|---|---|---|
| Welcome | welcome card, header (kit + Sleeper chip), programme menu | everyone |
| Commissioner | review queue, penalties/results/certificate | commissioner, admin |
| Admin | roster and invites, member view switch, the tour test panel | admin |
| Participant | My trip phone card, location sharing consent, proof locker, draft → submitted → approved | participant, plus any commissioner/admin who is the event participant (Victor) |
| League | scoreboard, last check-in, next drive and bus, sideline, map, bingo, predictions, press room, final whistle, League access, full time | everyone |

Member: 14 steps. Participant: 18. Commissioner: 16. Admin who is also participant: 23. The welcome and press copy change wording for the participant. Every step's `href` is checked by a unit test against `navFor(role)` so the tour never sends a role to a screen its menu does not offer.

### How it works and where it lives

- `src/components/tour/TutorialTour.tsx` (client). Mounted once in `src/app/(league)/layout.tsx`, so it survives the `router.push` navigations it triggers. Per step: push the step's route if not already there, then poll for the first visible `data-tour="…"` anchor (150 ms × 40, covers `loading.tsx` and streaming), scroll it into view only if it is off screen, and draw the spotlight (`box-shadow` cut-out with a gold ring). Re-measures on scroll and resize. Without an anchor the card is centred (or a bottom sheet on phones). Card placement is the pure `placeCard` (below → above → sheet; phones always sheet), anchored by the bottom edge where the real card height could otherwise overflow.
- Keyboard and a11y: `role="dialog"`, focus moves to the card on each step, Tab is trapped inside the card, → / Enter next, ← back, Esc skips. A full-viewport blocker stops taps on the page underneath; wheel scrolling still works so the member can look around.
- `src/lib/tour-store.ts` (client): the running tour as a tiny external store (`useSyncExternalStore`, null on the server so nothing hydrates differently), mirrored to `sessionStorage` (`pb-tour`) so a reload resumes at the same step. `pb-tour-seen` stops the first run from auto-starting again in the same browser session if the profile flag lags behind.
- Auto-start rule in the layout: `ctx.profile.tutorial_completed_at === null` (strict). `undefined` means the column is not migrated yet, so the tour stays quiet rather than looping forever. Finish or Skip both call `completeTutorial` (`src/lib/actions/tutorial.ts`: Zod, `getLeagueContextRaw`, updates the caller's own profile row under `profiles_update_self`, `revalidatePath("/", "layout")`) and then navigate to `homeFor(ctx)`.
- Replay: League access → "The tour" panel → `TourReplayButton` (`src/components/tour/TourButtons.tsx`) runs the account's own role again (persists only if the flag is still null) and returns to `/account`.
- Admin test: League admin (`/review/members`) → "First-run tour" panel → `TourTestPanel` with League member / Participant / Commissioner / Admin. Test runs set `persist: false`, so nothing is recorded, and return to `/review/members`. The Admin option includes the participant block when the admin is the event participant; the Commissioner option is Theo's view (no participant block).
- Anchors added (`data-tour`): `header-account`, `nav` (AppShell), `menu` (NavDrawer button), `member-view` (MemberViewToggle), `scoreboard`, `live-map`, `next-drive` (game centre), `sideline` (SidelineFeed), `map-panel`, `trip-phone`, `location-sharing`, `proof-list`, `proof-flow`, `review-queue`, `review-tools`, `admin-roster`, `tour-test`, `bingo-card`, `prediction-slip`, `press-room`, `certificate`, `account-panel`, `tour-replay`. `KitPanel` gained an optional `tour` prop for the ones on kit panels. Hidden anchors (sidebar and account block below 850 px, header toggle below 580 px, anything inside the closed drawer) are skipped, and the step falls back to the Menu button.
- CSS at the end of `globals.css` under "First-run tour" (`pb-tour*`, z-index 70 above the drawer's 61; reduced motion disables the transitions).
- `TOUR_VERSION` in `src/lib/tour.ts` is stored in `tutorial_version`. To make everyone take a rewritten tour again, bump it and change the layout's auto-start test to compare versions (currently completion alone is checked).

## Verified

- `npm run typecheck && npm run lint && npm test` green; `npx next build` green.
- Production server on port 3001 + headless Chromium via a temporary `/demo/preview-tmp` page (deleted) at 1280 and 390 px: welcome card centred, header step spotlights the account block (desktop) or the Menu button (phone), programme step spotlights the sidebar (desktop, card drops to the sheet because the target fills the height) or Menu (phone); Back, → and Tab trap work; reload resumes on the same step; no horizontal overflow; no console errors.
- Not verified (no backend in the sandbox): the navigating steps against live screens (anchor polling and spotlight per page), `completeTutorial` against Postgres, the auto-start on a real first sign-in, and the tour's behaviour while the sideline's `router.refresh()` fires (the layout keeps its client state, so it should be unaffected).

## Suggested checks on production (after merge and `db:push`)

1. Sign in as Victor: the tour starts on `/review` (23 steps). Let it run through to League access and Finish; it should land on `/review` and not start again. League access → "The tour" shows "Last taken …".
2. League admin → First-run tour → League member: 14 steps through game centre, map, bingo, predictions, press, recap, League access, back to `/review/members`. Nothing recorded.
3. Same on a phone: cards as bottom sheets, Menu button spotlighted on the header/programme steps, the spotlight follows when you scroll.
4. Switch to member view and replay from League access: the member version runs.
5. Sign in as a member who has already used the app: the tour starts once (column null), and never again after Finish or Skip.

## Still open

1. Whether "Skip the tour" should count as done. It does today (the flag is set either way) so nobody is nagged; flip it by passing `persist: false` on skip in `TutorialTour.finish` if a full run should be required.
2. A per-member "reset tour" for admins in Review → Members was not added; run `update profiles set tutorial_completed_at = null where id = …` if needed.
3. Carried forward: run `scripts/fetch-sleeper-bracket.ts` and commit the snapshot; custom SMTP before inviting the league; regenerate `database.types.ts` from the local stack.
