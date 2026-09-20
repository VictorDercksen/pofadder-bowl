# Pofadder Bowl 2026 · Handoff (2026-09-20, tour: spotlight tracking, card placement, stuck screens)

Follow-on to `handoff_2026-09-20_tour-colours-sideline-claims.md` (drawer steps, sideline preview) and `handoff_2026-09-19_first-run-tour.md` (the tour itself). Infrastructure detail still lives in `handoff_2026-09-17.md`.

## State at handoff

| Item | Value |
|---|---|
| Branch | `claude/tutorial-improvements-bugs-et94w5`, started from `main` at `ed99c7e` (no PR opened) |
| Production | https://pofadder-bowl.vercel.app deploys from `main`; unaffected until merged |
| Schema | Unchanged (no migration) |
| Types | Unchanged |
| Env | Unchanged |
| Tests | `npm run typecheck`, `npm run lint`, `npm test` (113 vitest, 1 new + 4 rewritten in `src/lib/tour.test.ts`) pass; `npx next build` passes |

## What was asked

Improve the tour for each role: the spotlight sometimes "bugs out" when you move during the tour, the step card covers the thing it describes on mobile, and a full run-through for other problems.

## What was wrong and what changed

All in `src/components/tour/TutorialTour.tsx`, `src/lib/tour.ts` and the tour block of `src/app/globals.css`.

### 1. Spotlight drifting off the target ("bugs out when you move")

Three causes, all fixed:

- **CSS transitions on the ring and card** (`top/left/width/height .22s`). Every scroll re-measured the target and the ring then glided to it a fifth of a second later, so it visibly lagged behind and looked detached while the page moved. The ring and card no longer animate position; the ring fades in for 180 ms when it appears (`pb-tour-in`, off under reduced motion).
- **Stale element after a refresh.** The overlay kept the DOM node it found once; when a screen re-rendered (the sideline's `router.refresh()`, streamed panels), the node could be detached and `getBoundingClientRect` returned zeros: a tiny ring in the top-left corner. `measure` now re-finds the anchor when the node is no longer connected, and a `MutationObserver` (page changes only, the overlay's own style writes are ignored) plus `ResizeObserver`s on `document.body` and the target trigger a re-measure. `visualViewport` resize/scroll are followed too (phone URL bar).
- **Measuring mid-animation.** The drawer slides in over 220 ms and streamed content shifts the page; the old code re-measured once after 300 ms. There is now a 700 ms settle loop on `requestAnimationFrame` after the anchor is found, and it only sets state when the rect actually changed.

### 2. Card covering the target on phones

- The card was always a bottom sheet on phones and its height was a constant guess (250 px); the real card is 210–330 px depending on copy and width, so it regularly sat on the spotlighted panel.
- `placeCard` (pure, `src/lib/tour.ts`) now takes the **rendered** card height (a `ResizeObserver` on the card) and tries, in order: below the target, above it, beside it on wide screens (right, then left, aligned to the target's top and kept on screen), then a sheet at whichever edge hides less of the target. A target taller than the free zone keeps the bottom sheet so its head stays visible. Phones get the full-width card in every placement. New placement classes: `right`, `left`, `top`.
- `scrollOffset` (pure, new) decides how far to scroll when a step lands: the target goes into the free zone below the sticky header (`.pb-top`) and, on phones, above the sheet; a target that fits is centred there (on a desktop, the target and the card below it are centred together when both fit); a taller one gets its head at the top of the zone. Previously `scrollIntoView` put targets under the sticky header and did not know about the card at all.
- Anchors inside the drawer are scrolled within the drawer (`scrollIntoView` nearest) and never move the window, which is locked behind it.
- Phone card is more compact (`≤ 699 px`: tighter padding, 20 px title, 12.5 px body, 36 px buttons).

### 3. Run-through findings, fixed

- **Browser Back mid-tour** left the card on "Opening the screen…" forever (the navigation guard fired once per step). The tour now re-pushes its screen when the path moves away, at most twice per step so a screen that redirects cannot loop.
- **A screen that never opens** (redirect for a role that cannot see it, e.g. an admin who is not the participant running the Participant test tour) now says so after 6 s: "This screen did not open for your account. Next carries on with the tour." instead of a spinner with no way to tell.
- **"View as league member" step on a phone**: the toggle only exists in the header above 580 px and in the drawer footer, so on a phone the step highlighted the Menu button. It now opens the drawer (`menu: true`) and rings the toggle at the foot of the drawer; copy says where it sits.
- **Copy**: the colours step said the Menu "is open for you now", which was wrong on a desktop. Now "On a desktop it sits top right; on a phone, at the top of the Menu."

Not changed, on purpose: Skip still records completion (open question carried forward); Escape still skips.

## Verified

- `npm run typecheck && npm run lint && npm test` green; `npx next build` green.
- Headless Chromium against `next build && next start -p 3001` through a temporary harness (deleted before commit): the demo screens tagged with the real `data-tour` anchors, the step routes temporarily prefixed to the harness, driven by a Playwright script that walked every step and checked, per step: on the right screen, the ring within 2 px of the target, the target not under the header, whether the card overlaps the target, ring still on target after scrolling 120 px down and back, drawer open only on the Menu steps, browser Back recovered within 2.5 s, no horizontal overflow, no console errors.
  - Admin + participant (23 steps) at 390×844 and 1280×800; member (14 steps) at 390×780 and 360×640.
  - Zero ring-lag, off-screen, header, drawer, Back or console problems. The only remaining overlaps are targets taller than the free zone (programme list, phone card, prop board, certificate, and most panels at 360×640), where the sheet covers the tail (5–33 %) with the head visible, which is the designed fallback.
- Not verified (no backend in the sandbox): the real `(league)` screens (the harness used the demo markup with the same class structure), the sideline preview card while live posts stream in, a real redirecting screen for the "did not open" message, and the tour on a physical phone with a collapsing URL bar.

## Suggested checks on production (after merge)

1. Phone: League access → Replay the tour. On each step scroll up and down with a finger: the gold ring must stay glued to the panel, with no glide.
2. Same tour: on the game centre, location and account steps the card sits below or above the panel, never on it; on the prop board and final whistle the panel's head is visible and the card covers only its tail.
3. Admin on a phone: step "See what they see" opens the Menu and rings "View as league member" at its foot.
4. Mid-tour, press the browser Back button: the tour returns to its screen within a couple of seconds.
5. League admin → First-run tour → Participant, as an admin who is not the event participant: the My trip step shows "This screen did not open for your account" after a few seconds and Next carries on.
6. Desktop 1280 px: the card sits beside tall panels (phone card, proof locker, map) rather than as a sheet.

## Still open

1. Targets taller than a small phone's free zone still get their tail covered by the sheet. A "hide the card" affordance or shorter copy for the longest steps (sideline, location, member view) would remove the last overlaps.
2. Carried forward: whether Skip should count as done; a per-member "reset tour" for admins; regenerate `database.types.ts` from the local stack; run `scripts/fetch-sleeper-bracket.ts`; custom SMTP before inviting the league; the "Sleeper teams" integration block has not been run against Postgres.
