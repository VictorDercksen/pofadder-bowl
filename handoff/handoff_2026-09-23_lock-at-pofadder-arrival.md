# Prop board and predictions lock at the Pofadder arrival

## State at handoff

Branch `claude/prop-board-predictions-bus-arrival-rbdkzl`, from `main`. Not merged, not deployed. One new migration, `supabase/migrations/20260923000100_lock_at_pofadder_arrival.sql`, applies on merge to `main` through the Supabase GitHub integration and must also reach the league project when `production` is fast-forwarded. No env changes.

## Asked and done

Close the prop board and the prediction slip when the bus arrives in Pofadder (`events.away_arrival_at`, Thu 24 Sept 04:45 SAST) instead of at departure (Wed 23 Sept 19:15).

- **Migration.** Sets `prediction_lock_at` to `away_arrival_at` and moves `prediction_reveal_at` along (never earlier than it was), and sets `props.locks_at` to `away_arrival_at` for unsettled props. Guarded: only rows whose lock still equals `departure_at` and has not passed yet. If it applies after 19:15 on the 23rd, nothing moves, because reopening a locked board would expose picks that are already visible.
- **Seed.** Event lock and reveal and all ten prop locks are 04:45 on the 24th. The event upsert does not overwrite lock/reveal on conflict, which is why the migration exists.
- **Generator.** `generateProps` stamps `locks_at` with `away_arrival_at`, so a regenerated board locks at arrival.
- **Copy.** "until departure" / "lock at departure" became "until the bus reaches Pofadder" on the predictions and props pages, slip, action messages, tour and demo screens. Lock times shown in the UI come from the database.
- **Tests.** Unit tests follow the new instant; the integration test resets the lock to 04:45.

## Verified

`npm run typecheck`, `npm run lint`, `npm test` (24 files, 164 tests) pass.

## Not verified

`npm run test:integration` (no Docker in the cloud sandbox). The migration was not executed against a database here.

## Suggested checks on production after the merge

1. `select prediction_lock_at, prediction_reveal_at from events;` shows 2026-09-24 02:45 UTC for both.
2. `select sequence, locks_at from props order by sequence;` shows 02:45 UTC on the 24th for all ten.
3. `/props` and `/predictions` read "LOCKS AT 04:45".

## Open

- Merge to `main` and promote to `production` before 19:15 on 23 Sept, or the guard leaves the locks at departure. After that, only a manual update (service role) can move them, and picks already revealed would stay visible.
- Prop #02 (minutes late at KLK Garage) now locks at the scheduled arrival while the bus is on the road; members can watch the live map before picking. Accepted as part of the request.
