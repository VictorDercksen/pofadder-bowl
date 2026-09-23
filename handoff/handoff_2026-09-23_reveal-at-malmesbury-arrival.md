# Predictions reveal and resolve, and props settle, at the Malmesbury arrival

## State at handoff

Branch `claude/predictions-visibility-trip-arrival-nuhnje`, from `main` (`1f3ddc4`). Not merged, not deployed. One new migration, `supabase/migrations/20260923000200_reveal_at_home_arrival.sql`, applies on merge to `main` through the Supabase GitHub integration and must also reach the league project when `production` is fast-forwarded. No env changes, no type regeneration needed (no columns changed).

**Time-critical (predictions only).** `main` and `production` already carry the Pofadder-arrival lock (`664f7fc`), so production's `prediction_reveal_at` is Thu 24 Sept 04:45 SAST. The migration only moves a reveal that has not passed yet. The prop gate has no such deadline: it reads `home_arrival_at` directly. It must be applied to the league project before 04:45 SAST on the 24th, or the slips reveal at 04:45 and the migration leaves them visible. Fallback after that (service role, no JWT, so the instants trigger allows it):

```sql
update public.events set prediction_reveal_at = home_arrival_at where slug = 'pofadder-bowl-2026';
```

## Asked and done

Other members' predictions should only be visible, and the slips only resolved, after Victor is back in Malmesbury: the "Arrive Malmesbury" stop on My trip, which is `events.home_arrival_at` (Fri 25 Sept 07:35 SAST). Before this the reveal sat at the lock (the Pofadder arrival, 04:45 on the 24th) and the predictions page said "Other members’ answers are hidden until Thu 24 Sept · 04:45 SAST".

- **Migration.** Sets `prediction_reveal_at = home_arrival_at` where the reveal has not passed and the arrival is later. Redefines `resolve_predictions` with one extra check after the commissioner check: it raises `predictions resolve once the bus is back in Malmesbury` (42501) while `now() < prediction_reveal_at`. Everything else in the function is unchanged (copied from `20260920001400_prediction_metrics.sql`). `lock <= reveal` still holds because the Malmesbury arrival is after every earlier lock.
- **Why gate the resolve in SQL.** Resolving writes `prediction_awards` (readable by every member) and posts "Predictions resolved" to the feed, which would leak who called what before the reveal. RLS on `predictions` and the `predictions_revealed` view already key off `prediction_reveal_at`, so visibility needed no policy change.
- **Seed.** `prediction_reveal_at` is `2026-09-25T07:35:00+02:00`. The event upsert does not overwrite lock/reveal on conflict, which is why the migration exists.
- **Pure helper.** `isRevealed(revealAtIso, now)` in `src/lib/predictions.ts` next to `isLocked`; fails closed (unparseable reads as hidden). Used by the predictions page, the review page and the resolve action.
- **Predictions page.** Copy reads "Other members’ answers stay hidden until the bus is back in Malmesbury (Fri 25 Sept · 07:35 SAST). The slips are resolved after that." The instant comes from the database. The points card mentions the Malmesbury arrival too.
- **Review → results.** `ResultsForm` takes `revealAt` and `revealed`. The "Resolve predictions" button is disabled before the reveal with an inline note; official results can still be entered early. `resolvePredictions` (server action) refuses before the reveal with a friendly message and maps the RPC error to the same wording.
- **Copy.** Tour step for the predictions screen and the RPC line in `README.md`.
- **Tests.** Two unit tests for `isRevealed`. The integration test resets the reveal to the seeded instant and asserts that `resolve_predictions` is refused before the reveal.

### Prop board (second commit on the branch)

The prop board should also only be settled once the bus is back in Malmesbury.

- **Migration (same file).** Redefines `settle_prop` with one extra check after the existing lock check: it raises `props settle once the bus is back in Malmesbury` (42501) while `now() < events.home_arrival_at`. Copied from `20260917001000_prop_board.sql`, otherwise unchanged. Picks are already visible from the lock (unchanged); the gate holds results, the standings and the "Prop settled" feed posts.
- **Pure helper.** `isSettlementOpen(homeArrivalAtIso, now)` in `src/lib/props.ts`, fails closed. Two unit tests.
- **Props page and board.** `PropBoard` takes `settleOpen` and `settleAtLabel`. Before the arrival a commissioner sees "Settles once the bus is back in Malmesbury (Fri 25 Sept · 07:35 SAST)" on each locked, unsettled prop instead of the settle buttons. The locked-board line under the board names the instant.
- **Review → Props to settle.** The queue is empty before the arrival and the panel reads "Props settle once the bus is back in Malmesbury (…)".
- **Action.** `settleProp` refuses before the arrival with the instant, and maps the RPC error to the same wording.
- **Copy.** Tour (review tools, prop board), demo prop board line, README.
- **Integration test.** Asserts that a locked prop cannot be settled while `home_arrival_at` is in the future, then moves the whole timetable into the past (the four instants are chained by check constraints) to settle, and restores it afterwards.

## How it works

| Instant | Column | Production value | What it gates |
|---|---|---|---|
| Lock | `events.prediction_lock_at` | Thu 24 Sept 04:45 SAST | `upsert_prediction`, slip editing, rules editor |
| Reveal | `events.prediction_reveal_at` | Fri 25 Sept 07:35 SAST (after this migration) | `predictions` RLS, `predictions_revealed`, `resolve_predictions`, the "league's calls" list |
| Prop settlement | `events.home_arrival_at` | Fri 25 Sept 07:35 SAST | `settle_prop`, the settle buttons, the review queue |

## Verified

`npm run typecheck`, `npm run lint`, `npm test` (24 files, 168 tests) pass.

## Not verified

`npm run test:integration` (no Docker in the cloud sandbox). The migration was not executed against a database here.

## Suggested checks on production after the merge

1. `select prediction_lock_at, prediction_reveal_at from events;` shows `2026-09-24 02:45 UTC` and `2026-09-25 05:35 UTC`.
2. `/predictions` as a member reads "stay hidden until the bus is back in Malmesbury (Fri 25 Sept · 07:35 SAST)".
3. `/review` as commissioner: "Resolve predictions" is disabled with the Malmesbury note until Friday 07:35.
4. After 07:35 on the 25th: the league's calls list appears on `/predictions`, and the resolve button works once results are saved.
5. `/props` as commissioner: no settle buttons before 07:35 on the 25th (a note per prop instead); `/review` shows an empty settle queue with the Malmesbury note. After 07:35 the buttons and the queue appear.

## Open

- If the migration lands after 04:45 SAST on the 24th, run the fallback update above. Re-hiding slips that were briefly visible is a judgement call left to the admin, which is why the migration does not do it.
- "Arrive Malmesbury" is a scheduled instant, not a check-in. If the bus is late the slips still reveal and the props still open at 07:35; moving `home_arrival_at` later is a service-role update (it also moves the prop gate; the reveal needs its own update) (signed-in admins are frozen out only once the reveal has passed).
