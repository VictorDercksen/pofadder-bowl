# Pofadder Bowl 2026 · Handoff (2026-09-18, prop board generated in the app)

Follow-on to `handoff_2026-09-17_prop-board.md`. Infrastructure detail still lives in `handoff_2026-09-17.md`.

## State at handoff

| Item | Value |
|---|---|
| Branch | `claude/bingo-game-review-y6q9zh` (pushed; one commit ahead of `main`, not merged) |
| Production | Unaffected until merged. On merge the Supabase GitHub integration applies the migration below; check Database → Migrations lists `20260918000100_generate_props` |
| Schema | **One new migration**: `supabase/migrations/20260918000100_generate_props.sql` adds `upsert_props(p_event uuid, p_props jsonb)` (commissioner only). No table changes |
| Types | `src/lib/database.types.ts` hand-edited (`upsert_props` added). Regenerate after the push |
| Env | Unchanged |
| Tests | `npm run typecheck`, `npm run lint`, `npm test` (13 files, 71 tests) pass |

## What was asked

Victor asked whether the props are generated automatically. They were not: the ten props lived only in `supabase/seed.sql`, which nobody runs on merge. Asked to generate them.

## What was done

The board is now built inside the app from the event programme, so it exists on production without running the seed.

- `src/lib/prop-generator.ts` (pure, tested): `generateProps(event, challenges)` returns the ten drafts. Lines come from the data where possible: run distance line = `required_run_km + 0.25`; locals line = the count named in the "… locals …" challenge + 1.5; approved-challenges line = challenge count − 1.5; rand line = 3 × the amount named in the "R50 spent …" challenge (road numbers like R358 are ignored); the meal and speech titles are lifted from the matching challenges; arrival and return bus times come from the event. The rest are house lines (20 min late, 60.5 comments, 15.5 check-ins, 90 seconds). All lock at `departure_at`. Thin programmes fall back to the seed's numbers.
- `upsert_props` RPC validates and stores the JSON: commissioner only; refused once any prop of the event has locked or any pick exists (a live board is never rewritten under members); every over/under prop needs a numeric line; a `locks_at` in the past is refused; props not in the payload are deleted; re-supplied sequences are updated and their result cleared.
- `generatePropBoard` server action (`src/lib/actions/props.ts`) loads the challenges, generates, calls the RPC and revalidates.
- `PropGenerate` (`src/components/props/PropGenerate.tsx`) is the commissioner button. It appears on `/props` in the empty state ("Generate the board") and, while the board is unlocked and no member has picked, under "How it works" ("Regenerate from the programme").
- The seed still carries the same ten props for local resets; the generator and the seed agree for the production programme.

## What was verified

- Unit tests cover the parsers, derived lines, fallbacks, determinism and shape limits.
- **Migration on a real Postgres 16** in the sandbox (shimmed auth/storage): all 11 migrations and the seed apply. `upsert_props` exercised as member (refused), commissioner (3 props written, regenerate to 2 prunes and retitles), with a pick present (refused), after lock (refused), as anon (permission denied); missing line and past lock refused.
- Not verified: the button in a browser against a backend; `npm run test:integration` (no Docker here).

## Suggested checks on production (after the migration is applied)

1. As Victor open `/props`: the empty state shows "Generate the board". Press it; ten props appear with 14.25 km, 4.5 locals, 8.5 approved, 150 rand, 04:45 and 22:30 in the copy.
2. Sign in as a member (or use the member view), pick one side, then back as Victor: the regenerate button is gone and the action is refused if invoked.
3. `/demo/props` unchanged.

## Still open

1. Lines are the generator's defaults. To change one before the 23rd: edit `generateProps`, redeploy and regenerate (only while nobody has picked), or update the row in the Supabase SQL editor.
2. Carried forward: regenerate `database.types.ts`; invite Theo as commissioner; custom SMTP.
