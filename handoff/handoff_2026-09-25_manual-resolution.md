# Prop board and predictions resolve on a commissioner button, not a clock

## State at handoff

Branch `claude/prop-board-manual-resolve-sbl59g`, from `main` (`2858a09`). Fast-forwarded into `main` and `production` at 07:15 SAST on 25 Sept (the commit carrying this line). One new migration, `supabase/migrations/20260925000100_manual_resolution.sql` (two nullable columns on `events`, one new RPC, one RLS policy replaced, `resolve_predictions` and `settle_prop` redefined). It applies on merge to `main` through the Supabase GitHub integration and must also reach the league project when `production` is fast-forwarded. No env changes. `src/lib/database.types.ts` was edited by hand for the new columns and RPC (no local stack to regenerate).

**Time-critical.** Written at 07:10 SAST on Fri 25 Sept. Until the migration is on the league project, the old gates still apply: at 07:35 SAST (`home_arrival_at` / `prediction_reveal_at`) the slips reveal and the settle buttons open. Once the migration applies, slips are hidden again (RLS) until the button is pressed, unless a prop was already settled or the slips were already resolved, in which case the migration marks resolution as open to stay consistent.

## Asked and done

Remove the timed resolution of the prop board and the predictions and add a commissioner button that resolves them; nothing should resolve until the button is pressed.

- **Schema.** `events.resolution_opened_at` and `events.resolution_opened_by` (null = closed). Not in the column grants, so only the RPC writes them.
- **`set_resolution_open(p_event, p_open)`** (commissioner, security definer). Opening: refused before `prediction_lock_at`, idempotent, sets the columns, pulls `prediction_reveal_at` forward to now if it is still ahead (so the `predictions_revealed` view, which also reads the reveal, shows the slips at once) and posts "Resolution open" to the feed (kind `system`). Closing: only while no prop is settled and the slips are not resolved; removes the feed post.
- **Gates.** `settle_prop` refuses with `props settle once a commissioner opens resolution` while the column is null (the per-prop lock check stays). `resolve_predictions` refuses with `predictions resolve once a commissioner opens resolution`. `predictions_select_own` RLS shows other members' slips only once the column is set (was `now() >= prediction_reveal_at`). `home_arrival_at` and `prediction_reveal_at` no longer gate anything; the prediction lock (`prediction_lock_at`, `props.locks_at`) is unchanged.
- **Review.** New panel "Resolve props and predictions" (`ResolutionControl` in `src/components/review/CommissionerTools.tsx`): button → "Confirm: resolve now" / Cancel. Disabled before the lock. Once open it shows when, plus "Close again" while nothing is settled or resolved. The "Props to settle" queue and the "Resolve predictions" button wait for it.
- **Actions.** `setResolutionOpen` in `src/lib/actions/review.ts`; `settleProp` and `resolvePredictions` check `ctx.event.resolution_opened_at` and map the RPC errors.
- **Screens.** Prop board (commissioner note per locked prop, locked-board line), predictions page (hidden-slip copy, points card), tour, demo line and README no longer mention the Malmesbury arrival for resolution.
- **Helper.** `isResolutionOpen` in `src/lib/resolution.ts` (fails closed) replaces `isSettlementOpen` and `isRevealed`, with unit tests.
- **Testing reset.** `resetTestingData` closes resolution after `reset_event_data`.
- **Integration test.** Asserts that the reveal instant passing reveals and resolves nothing, members cannot open, opening before the lock is refused, closing after resolving is refused, and settling is refused while closed.

## Verified

`npm run typecheck`, `npm run lint`, `npm test` (25 files, 168 tests) pass.

## Not verified

`npm run test:integration` (no Docker in the cloud sandbox). The migration was not executed against a database. The new panel was not rendered in a browser.

## Suggested checks on production after the merge

1. `select resolution_opened_at, prediction_reveal_at from events;` shows `resolution_opened_at` null.
2. `/predictions` as a member: "Other members’ answers stay hidden until the commissioner opens resolution."
3. `/review` as commissioner: "Resolve props and predictions" panel; the settle queue and "Resolve predictions" wait for it.
4. Press it, confirm: feed shows "Resolution open", `/props` shows settle buttons, `/predictions` shows the league's calls, "Resolve predictions" works once results are saved.

## Open

- If the Supabase GitHub integration does not apply the migration to the league project, run the `Supabase migrations` workflow with target `league`.
- Fallback to open from SQL (service role): `update public.events set resolution_opened_at = now() where slug = 'pofadder-bowl-2026';` (the view also needs `prediction_reveal_at <= now()`).
