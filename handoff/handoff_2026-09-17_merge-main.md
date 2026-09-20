# Pofadder Bowl 2026 · Handoff (2026-09-17, merge to main and Sleeper snapshot)

Follow-on to `handoff_2026-09-17_nav-perf-sleeper-ui.md`. Infrastructure detail still lives in `handoff_2026-09-17.md`.

## State at handoff

| Item | Value |
|---|---|
| Branch | `claude/merge-main-run-scripts-fcs788` (main + the nav-perf commit + this one), merged into `main` and pushed |
| Production | https://pofadder-bowl.vercel.app deploys from `main`, so this merge triggers a deploy |
| Schema | `supabase/migrations/20260917000800_league_context.sql` is now on `main` but **not yet pushed to the hosted project**. Run `npm run db:push` from the laptop. The app falls back to the per-table path until then |
| Types | `src/lib/database.types.ts` still hand-edited for `league_context`; regenerate from the local stack when convenient |
| Env | Unchanged |
| Tests | `npm run typecheck`, `npm run lint`, `npm test` (11 files, 58 tests) and `npx next build` pass on the merged tree |

## What was asked

Merge the nav-perf branch into `main` and run the necessary scripts.

## What was done

1. **Sleeper snapshot fetched.** `api.sleeper.app` was reachable from this session, so `npx tsx scripts/fetch-sleeper-bracket.ts` ran and wrote `src/data/sleeper-losers-bracket.json`: the 2024 season of "Show Us Your TD's" (league `1049438427567071232`, resolved by walking `previous_league_id` from the configured 2025 league), 7 bracket rows, 12 rosters, 13 users. Parsed through `buildBracket`: Round 1, Semis with a 5th-place game, Toilet Bowl final and 3rd-place game; sentenced resolves to "Chase-ing Mahomelessness" (@VictorDercksen). This closes open item 1 from the previous handoff.
2. **Verification** on the merged tree: typecheck, lint, unit tests and production build all green.
3. **Merged into `main`** with a merge commit and pushed.

## Scripts that could not run here

- `npm run db:push` (cloud rule: no `supabase db push`; also no backend credentials). The `league_context` RPC and the `claim_sleeper_identity` change wait on this.
- `npm run db:reset` / `npm run test:integration` / type regeneration: Docker is not available in the sandbox, so the local Supabase stack cannot start.

## Suggested checks on production (after deploy and `db:push`)

1. Game centre shows the 2024 Toilet Bowl from the live Sleeper API; if Sleeper is down it now shows the same bracket from the committed snapshot instead of the standings fallback.
2. The remaining checks from `handoff_2026-09-17_nav-perf-sleeper-ui.md` (loader, `/choose-sleeper` gate, password sign-in, hand-over links).

## Still open

1. `npm run db:push` from the laptop, then regenerate `database.types.ts` and confirm no diff beyond `league_context`.
2. Custom SMTP before inviting the league; the emailed 6-digit code needs the custom template.
3. Carried forward: lock the Sleeper link after confirmation if wanted, invite Theo as commissioner, self-review guard, `memberships.invited_email` visibility.
