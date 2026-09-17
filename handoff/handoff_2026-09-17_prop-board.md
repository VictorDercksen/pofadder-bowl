# Pofadder Bowl 2026 · Handoff (2026-09-17, prop board replaces bingo)

Follow-on to `handoff_2026-09-17_bingo-review-faab.md`. Infrastructure detail still lives in `handoff_2026-09-17.md`.

## State at handoff

| Item | Value |
|---|---|
| Branch | `claude/bingo-game-review-y6q9zh`, merged into `main` with `origin/main` merged in first (stylesheet conflict resolved; bracket rules from main kept, prop rules appended) |
| Production | Deploys from `main`. The Supabase GitHub integration applies `supabase/migrations/` on merge; **check Database → Migrations lists `20260917001000_prop_board`**, otherwise run the manual `Supabase migrations` workflow (see `handoff_2026-09-17_supabase-migrate-workflow.md`). Until the migration lands, `/props` shows the "could not load" notice; nothing else is affected |
| Schema | **One new migration**: `supabase/migrations/20260917001000_prop_board.sql`. Drops every bingo table, type and RPC; renames the `post_kind` enum value `bingo` to `prop`; adds `props`, `prop_picks`, three enums, three RPCs; rewrites `issue_certificate` (summary key `prop_winners` replaces `bingo_winners`). `seed.sql` now seeds ten props instead of 25 bingo squares |
| Types | `src/lib/database.types.ts` hand-edited to match (no local Supabase in the sandbox). Regenerate after `db:push` to be safe |
| Env | Unchanged |
| Tests | `npm run typecheck`, `npm run lint`, `npm test` (11 files, 60 tests) and `npx next build` pass |

## What was asked

Remove Punishment Bingo and implement the over/under prop board proposed in the bingo review (see the previous handoff for why bingo could not work as designed: it needed 10 to 16 commissioner-confirmed incidents, half the squares were only visible to Victor, and Victor was the only confirmer).

## How the prop board works

- **Ten props**, seeded before departure (`supabase/seed.sql`). Eight are over/under against a line (`kind = over_under`, `line`, `unit`), two are yes/no. Every prop carries its own `locks_at`; all ten lock at departure (23 Sept 19:15 SAST).
- **Members pick one side per prop** on `/props` until it locks, and can change it until then. Other members' picks are hidden by RLS until the prop locks, then everyone's picks show per side.
- **A commissioner settles each locked prop** from the record (`settle_prop`: over/under/yes/no or `void`). Settling posts to the Sideline feed (`kind = prop`, "Prop settled · #n title · Result · x of y picks correct"). Re-settling corrects a mistake and re-scores; a replay of the same result is a no-op.
- **Scoring** is one point per correct pick; void props score nothing. `prop_leaderboard` ranks active members by correct, then fewest wrong, then most picks, then name. Most correct shares 5 FAAB in Sleeper; nobody wins on zero.
- **Live updates**: `PropLive` subscribes to `props` (now in the `supabase_realtime` publication) and refreshes the page when a prop is settled, with a visible-tab poll as fallback.

Where it lives:

| Piece | Path |
|---|---|
| Page | `src/app/(league)/props/page.tsx` |
| Board and live refresh | `src/components/props/PropBoard.tsx`, `PropLive.tsx` |
| Pure helpers and tests | `src/lib/props.ts`, `src/lib/props.test.ts` |
| Server actions | `src/lib/actions/props.ts` (`savePropPick`, `settleProp`) |
| SQL | `supabase/migrations/20260917001000_prop_board.sql`, `supabase/seed.sql` |
| Demo | `/demo/props` (`DemoProps` in `DemoScreens.tsx`, picks in `DemoStore.tsx`, props from `league-programme.json`) |
| Styles | `pb-prop*` rules at the end of `globals.css` (bingo rules removed) |

Touched to remove bingo: nav (`06 Prop board`), game centre and my-trip links, review page ("Props to settle" panel), recap and certificate export (prop board winner row, `propWinners`), public recap, feed kind label, kit copy, README, CLAUDE.md, `scripts/screenshots.ts`, `scripts/integration-test.ts` (bingo tests replaced by two prop tests).

## What was verified

- `npm run typecheck && npm run lint && npm test` green; `npx next build` green (`/props` dynamic, `/demo/props` static).
- **Migration on a real Postgres 16** started in the sandbox with shimmed `auth`/`storage` schemas: all nine migrations applied in order, seed applied twice (idempotent), no `bingo*` relations left, `post_kind` reads `checkin,comment,submission,decision,prop,prediction,system`, `props` is in the realtime publication.
- **RPCs and RLS exercised as fixture users** (member, commissioner, participant, outsider, anon): direct insert into `prop_picks` refused; side must fit the kind; picks editable before lock; outsider sees no props and cannot pick; only own pick visible before lock, both visible after; settle refused before lock, by a member, and with a result of the wrong kind; settle, replay, void, leaderboard tallies, feed posts, re-settle re-scores, `issue_certificate` summary carries `prop_winners` and no `bingo_winners`; anon cannot execute the new functions.
- Not verified: `npm run test:integration` against the real local stack (no Docker here); Realtime delivery for `props`; the board in a browser against a backend.

## Suggested checks on production (after the migration is applied)

1. `/props` as a plain member: ten props, pick a side, change it, reload and it sticks; other members' picks are not in the page source before departure.
2. `/props` as Victor: no settle buttons before 19:15 on 23 Sept; after, Settle Over/Under/Void per prop. Settling posts to the feed and updates standings for an open member tab without a reload.
3. `/review` shows "Props to settle" with a count once the board has locked.
4. `/recap` shows "Prop board winner · 5 FAAB in Sleeper"; certificate PNG says "Prop board: …".
5. `/demo/props` renders and tapping a side selects it.

## Still open

1. Props are edited only through `seed.sql` (re-runnable upsert on `(event_id, sequence)`). No admin UI for adding or changing a prop; add one if the lines need tuning before the 23rd.
2. `issue_certificate` names winners by most correct at issue time; settle every prop before issuing.
3. Regenerate `database.types.ts` from the pushed schema and diff against the hand edit.
4. Carried forward: invite Theo as commissioner; custom SMTP before inviting the league.
