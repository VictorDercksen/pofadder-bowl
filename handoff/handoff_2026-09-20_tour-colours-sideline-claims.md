# Pofadder Bowl 2026 · Handoff (2026-09-20, tour: colours in the Menu, sideline preview card; one claim per team)

Follow-on to `handoff_2026-09-19_first-run-tour.md` (the tour itself) and `handoff_2026-09-19_road-routes.md` (state of `main`). Infrastructure detail still lives in `handoff_2026-09-17.md`.

## State at handoff

| Item | Value |
|---|---|
| Branch | `claude/tutorial-colors-team-claiming-gqvo4o`, started from `main` at `d9b1e20` (no PR opened) |
| Production | https://pofadder-bowl.vercel.app deploys from `main`; unaffected until merged |
| Schema | **One new migration**: `supabase/migrations/20260920000100_claim_locks.sql`. No new columns. It re-asserts the two partial unique indexes (`profiles_kit_team_unique`, `memberships_sleeper_unique`) with `if not exists` and redefines `claim_sleeper_identity` and `confirm_sleeper_link` with a per-team advisory lock and a holder name in the error. The Supabase GitHub integration applies it on the push to `main`; confirm under Database → Migrations. The app works unchanged before it is applied (the older RPC bodies already refuse a taken team) |
| Types | Unchanged (`database.types.ts` needs no edit: same function signatures) |
| Env | Unchanged |
| Tests | `npm run typecheck`, `npm run lint`, `npm test` (103 vitest, 5 new) pass; `npx next build` passes. `npm run test:integration` gained a "Sleeper teams" block; it was **not** run here (no local stack in the sandbox) |

## What was asked

1. In the tour, for every role: when the tour mentions "your colours", open the menu automatically and highlight the name and Sleeper section. When it mentions the sideline feed, show a dummy comment in the member's own team jersey.
2. Make sure each Sleeper team and each NFL team can be claimed by only one member at sign-on.

## What was done

### 1a. "Your colours" opens the Menu (phone) and spotlights name, kit and Sleeper team

- `TourStep` gained `menu?: boolean` (`src/lib/tour.ts`). The `header` ("YOUR COLOURS") and `nav` ("THE PROGRAMME") steps set it. Their targets are now, in order: `drawer-identity` → `header-account` → `menu` and `drawer-nav` → `nav` → `menu`. The first *visible* anchor wins, as before.
- `src/lib/drawer-events.ts` (pure): the `pb-drawer` window event and `setDrawerOpen(open, quiet)`. `NavDrawer` listens and sets its own open state. A tour-driven ("quiet") open moves no focus into the drawer, ignores Escape and Tab inside it, and does not hand focus back to the Menu button on close, so the tour card keeps the keyboard (→ ← Enter Esc still work). A redundant close never mutes the next real tap on Menu (the quiet flag is adopted only when the state actually changes).
- `TutorialTour` (`src/components/tour/TutorialTour.tsx`): one effect per step opens the drawer when the step has `menu` **and** the Menu button is visible (≤ 850 px), closes it otherwise, and closes it on unmount (Finish/Skip). On a desktop the drawer stays shut: the same name, kit and Sleeper block sits in the header (`header-account`) and the programme in the sidebar (`nav`), which the tour spotlights as before.
- Anchors added: `data-tour="drawer-identity"` on the `DrawerIdentity` block (name, kit badge with number, Sleeper team, role line) and `data-tour="drawer-nav"` on the drawer's programme list. The step copy now names all three (name, badge with number, Sleeper team).
- Result on a phone: step 2 slides the drawer open and rings the identity block at its top; step 3 keeps it open and rings the programme list; step 4 (game centre) closes it before navigating.

### 1b. The sideline step shows the member's own jersey

- `SidelineFeed` takes an optional `viewer` (`{ name, team, number }`, passed by `src/app/(league)/game-centre/page.tsx` from `ctx.profile`). It reads the running tour from the store and, only while the step is `sideline`, renders a preview `JerseyCard` above the posts: the viewer's franchise kit, nameplate and number, kind "Preview", time "Not posted", a disabled No sympathy button, under the kicker "YOUR CARD · PREVIEW ONLY · NOT POSTED". Anchor `data-tour="sideline-preview"`; the step targets it first, then the whole sideline.
- Nothing is written anywhere: no `activity_posts` row, no Realtime traffic. The card disappears the moment the tour moves on or ends. The admin test panel shows the admin's own kit (it is the viewer's card, whichever role's tour runs).
- `currentStepId(run)` in `src/lib/tour.ts` is the pure helper both sides use.
- CSS at the end of `globals.css` under "Tour preview card on the sideline".

### 2. One member per Sleeper team and per NFL kit

Already enforced before this change, now verified end to end and tightened:

| Layer | NFL kit | Sleeper team |
|---|---|---|
| Unique index | `profiles_kit_team_unique` (partial, `kit_team is not null`) | `memberships_sleeper_unique` on `(league_id, sleeper_user_id)` (partial) |
| RPC | `claim_kit`: advisory lock per team, refuses a team another profile wears, names the holder | `claim_sleeper_identity` and `confirm_sleeper_link` (admin): **now** advisory lock per league+team, refuse a team another membership holds, name the holder (`20260920000100_claim_locks.sql`) |
| Direct writes | `profiles.kit_team` is not in the column grant | `memberships` has no insert/update/delete grant at all |
| Sign-on gate | `getLeagueContext` → `/choose-team` until `kit_team` is set | `/choose-sleeper` once the league is imported and no `sleeper_user_id` is set |
| Picker UI | `TeamPicker` disables taken kits, shows the holder | `SleeperPicker` and the League access select disable taken teams, show the holder |

- The new migration only changes the race outcome: two members confirming the same Sleeper team in the same instant now both go through the lock, and the loser gets "That Sleeper team is already taken by <name>" (code `23505`, which `claimSleeperIdentity` already passes through) instead of the index's raw "duplicate key" text.
- `scripts/integration-test.ts` → "Sleeper teams": seeds two fixture managers, member confirms one, commissioner is refused the same one and gets the other, unknown manager refused, admin link to a taken team refused, direct `memberships` update blocked, outsider refused; cleans up after itself.

## Verified

- `npm run typecheck && npm run lint && npm test` green; `npx next build` green.
- Production server on port 3001 + headless Chromium through a temporary `/demo/preview-tmp` page (deleted), 390 px and 1280 px:
  - 390 px: colours step opens the drawer and the spotlight covers the identity block exactly; → moves to the programme step with the drawer still open and the spotlight on the list; ← ← back to welcome closes the drawer; Esc ends the tour; a real tap on Menu afterwards opens it with focus inside, and Esc closes it. Focus stayed in the tour card on every step.
  - 1280 px: drawer stays shut, spotlight on the header account block, then the sidebar.
  - Sideline preview at both widths: Chiefs kit, nameplate, number 15, "Preview" pill, no horizontal overflow, no console errors.
- Not verified (no backend in the sandbox): the preview card on the real `/game-centre` with live posts above and below it (only the empty-feed case was rendered); the drawer steps while the sideline's `router.refresh()` fires; the new migration and the integration block against Postgres.

## Suggested checks on production (after merge and the migration is applied)

1. Phone: League access → Replay the tour. Step 2 should slide the Menu open with a gold ring around your name, kit badge and Sleeper team; step 3 rings the programme list; step 4 closes it and opens the game centre.
2. Same tour, step "The sideline feed": your own jersey card at the top of the sideline, marked Preview · Not posted. Skip the tour: the card is gone and the feed shows no new post.
3. Desktop: same steps ring the header block and the sidebar; the drawer never opens.
4. League admin → First-run tour → League member on a phone: same behaviour, nothing recorded.
5. Two browsers, two members, League access → Sleeper team: confirm the same team at once. One succeeds, the other reads "already taken by <name>".
6. `npm run test:integration` on the laptop with the local stack: the "Sleeper teams" block passes.

## Still open

1. The tour's desktop behaviour for "your colours" is unchanged by design (header block, not the drawer). If the drawer should open on desktop too, drop the `phone` check in `TutorialTour`'s drawer effect.
2. Carried forward from the tour handoff: whether Skip should count as done; a per-member "reset tour" for admins; regenerate `database.types.ts` from the local stack; run `scripts/fetch-sleeper-bracket.ts`; custom SMTP before inviting the league.
