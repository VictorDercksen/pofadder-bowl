# Pofadder Bowl 2026 · Handoff (2026-09-20, alert snackbar for action feedback)

Follow-on to `handoff_2026-09-20_tour-colours-sideline-claims.md`. Infrastructure detail still lives in `handoff_2026-09-17.md`.

## State at handoff

| Item | Value |
|---|---|
| Branch | `claude/notification-snackbar-alerts-fqyfvw`, started from `main` at `ed99c7e`; `origin/main` (`e9df754`, the 10 km run and icon actions) merged back in before the branch was merged into `main` at the owner's request (no PR) |
| Production | https://pofadder-bowl.vercel.app deploys from `main`; this change is on `main` |
| Schema | Unchanged (no migration) |
| Types | Unchanged |
| Env | Unchanged |
| Tests | `npm run typecheck`, `npm run lint`, `npm test` (123 vitest after the merge, 10 new here) pass; `npx next build` passes on the merged tree. `npm run test:integration` not run (no local stack in the sandbox; nothing touched SQL or actions) |

## What was asked

Turn the inline action notices (the green-edged "Proof submitted for commissioner review." block under a form, and every other one of that kind) into an alert service: a dismissible snack at the bottom of the screen that disappears after a short delay. The style was then changed, at the owner's choice from four rendered options, to solid pastel pills in the button family.

## What was done

### The alert service

| Piece | Path | Notes |
|---|---|---|
| Pure rules | `src/lib/toasts.ts` | `Toast`, `ToastTone` (`ok`, `warn`, `error`), `toastDuration` (4 s / 6 s / 8 s by tone, stretched 35 ms per character past 60, capped at 12 s), `pushToast` (replaces a snack with identical text and tone, keeps at most `TOAST_LIMIT` = 3, oldest drop), `removeToast`. Unit tested in `toasts.test.ts` |
| Client store | `src/lib/toast-store.ts` | `toast(text, tone = "ok")`, `dismissToast(id)`, `clearToasts()`, `useToasts()`. Module-level state behind `useSyncExternalStore` (empty on the server), same shape as `tour-store.ts`. Empty or whitespace text is a no-op so `toast(res.message ?? "", …)` is safe. Snacks survive `router.refresh()` and `router.push()` because the store lives outside any page |
| Snackbar | `src/components/ui/Toaster.tsx` | Mounted once in the root layout (`src/app/layout.tsx`), so it covers the league, the demo, the gate pages (`/choose-team`, `/choose-sleeper`) and anything else. Fixed stack at the bottom (`.pb-toast-stack`, z-index 80, above the drawer and the tour), `role="status" aria-live="polite"`. Each snack has a × button (`aria-label="Dismiss"`) and its own timer; the timer pauses while the pointer or keyboard focus is on the snack and resumes with at least 1 s left |
| CSS | end of `src/app/globals.css` under "Alert snackbar" | Option C: mint `#cfe0cf` / apricot `#f6d5b5` / rose `#f0c4bc` fills, text, 1.5 px border and the buttons' hard 2 px bottom shadow in the tone colour, pill radius, 520 px max width, 16 px side gutter, slide-up animation off under `prefers-reduced-motion` |

### Call sites converted (every `Status` render is gone)

Each component dropped its local `note`/`msg` state and the `<Status>` line and now calls `toast(text, tone)` at the same spot with the same copy and tone:

- `review/CommissionerTools.tsx` (penalties, official results, certificate), `review/MemberAdmin.tsx` (invite, member rows, bulk), `review/ReviewForm.tsx` (its `note` state is the review textarea and stays)
- `account/AccountForms.tsx` (kit, Sleeper claim, password), `account/TeamPicker.tsx`, `sleeper/SleeperPicker.tsx`
- `proof/EvidenceUploader.tsx` (draft, files, captions, submit, new version, offline notes), `map/LocationSharing.tsx` (check-ins, consent, geolocation errors)
- `feed/SidelineFeed.tsx`, `props/PropBoard.tsx`, `predictions/PredictionSlip.tsx`, `recap/CertificateExport.tsx`
- Demo: `DemoStore` keeps `message` in its reducer and now also carries `tone` (reset to `ok` per action, `warn` on refusals) and a `seq` counter; `DemoProvider` fires `toast()` from an effect when `seq` changes, so the same message twice in a row still shows. `DemoStatus` and its ten `<DemoStatus />` renders in `DemoScreens.tsx` are removed.
- `Status` was deleted from `src/components/ui/TitleRow.tsx` (no callers left). The `.pb-status` CSS stays: server-rendered page notices still use it (login instructions and errors, `/props` and `/game-centre` load errors, the commissioner preview note on a proof page). Those are page state, not action feedback, and were left inline on purpose.

## Verified

- Merge with `origin/main`: two conflicts, both trivial (the `EvidenceUploader` import line, where main added `IconButton`, and two CSS sections appended at the end of `globals.css`). Main added no new inline `Status` usages.

- `npm run typecheck && npm run lint && npm test` green; `npx next build` green.
- Production server on port 3001 + headless Chromium on `/demo/proof` at 390 px and 1280 px: a refused submit shows an apricot warn snack, attach + submit add two mint ok snacks (three stacked, newest at the bottom, no horizontal overflow); × removes one; the rest clear themselves; a snack hovered for 5 s past its delay stays until the pointer leaves; no console errors.
- Not verified (no backend in the sandbox): the league screens themselves (proof locker, commissioner review, account, map). They use the identical `toast()` call in place of the identical `setNote` call, so the risk is copy placement, not behaviour.

## Suggested checks on production (after merge)

1. Phone, Proof locker: submit a version. A mint pill "Proof submitted for commissioner review." rises at the bottom, × dismisses it, or it clears after about 4 s. No green block under the form any more.
2. Commissioner review: approve or flag; League access: save the kit form twice in a row (second snack replaces the first rather than stacking).
3. Map, My trip: pause sharing then tap "Update location" → apricot warn snack. Turn on flight mode and post to the sideline → warn snack.
4. Keyboard: Tab to a snack's × before it clears; it stays while focused, Enter dismisses it.
5. Desktop: the stack is centred under the content, max 520 px wide.

## Still open

1. Snacks are text only. If an action ever needs an "Undo" or a link in the snack, extend `Toast` with an optional action and render it in `ToastSnack`.
2. The tour overlay (z-index 70) sits under the snackbar; a snack fired mid-tour will show over the spotlight. Nothing in the tour fires one today.
3. Carried forward: whether Skip should count the tour as done; a per-member "reset tour" for admins; regenerate `database.types.ts` from the local stack; run `scripts/fetch-sleeper-bracket.ts`; custom SMTP before inviting the league; the "Sleeper teams" integration block has still not run against Postgres.
