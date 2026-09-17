# Pofadder Bowl 2026 · Handoff (2026-09-17, Toilet Bowl bracket redraw)

Follow-on to `handoff_2026-09-17_merge-main.md`. Infrastructure detail still lives in `handoff_2026-09-17.md`.

## State at handoff

| Item | Value |
|---|---|
| Branch | `claude/adoring-brahmagupta-b3zk4a` (not merged into `main`, no PR opened). `origin/main` at `1c4efb0` (drawer identity, sideline paging, `league_context` pushed) was merged **into** this branch afterwards; the only conflict was both sides appending to the end of `globals.css`, resolved by keeping both blocks (main's drawer and paging rules, then the bracket rules) |
| Production | https://pofadder-bowl.vercel.app deploys from `main`; unaffected until merged |
| Schema / env | Unchanged. Per `handoff_2026-09-17_sideline-paging.md` on main, `league_context` is now pushed to the hosted project |
| Data | `src/data/sleeper-losers-bracket.json` re-fetched: now also carries `playoffWeekStart` (15) and `matchups` (points per roster for weeks 15–17) |
| Tests | After the merge: `npm run typecheck`, `npm run lint`, `npm test` (12 files, 66 tests) and `npx next build` pass; the bracket was re-screenshotted on the merged tree at 1280 and 390 px with no change |

## What was asked

The game-centre losers bracket "doesn't look right" next to Sleeper's own rendering, and it should blend Sleeper's bracket with this app's design.

## What was wrong

1. **W/L was inverted.** In a Sleeper losers bracket the team that loses on points advances, so the API's `w` is the lower scorer. The view treated `w` as the scoreboard winner: PurdyGood (96.34) showed W against Brownnatron (144.50).
2. **No scores, no byes, no lines.** Sleeper shows points per matchup, the two top seeds' byes in the first column, and connector lines. The old view had none of these and the columns used `space-around`, so the semis floated at odd heights.
3. **Finals scrolled out of view.** Three fixed 236 px columns in a horizontal scroller; on anything narrower than ~800 px the Finals column was hidden behind a scrollbar (the first screenshot).
4. The SENTENCED pill replaced the result on Victor's rows, so his matches lost their W/L.

## What changed

- **`src/lib/bracket.ts`** (pure, tested): `parseWeekScores`, `buildBracket(rows, rosters, managers, sentencedUsername, { playoffWeekStart, scores })`. Each slot now has `points`, `result` (scoreboard, from points; without points inferred from the bracket flags, inverted) and `advanced` (Sleeper's flag). Rounds are `ROUND n` / `FINALS` with a `week`. The tree is split from `placement` games (3rd, 5th place). Byes are derived (teams that start in round 2 without a round 1 game) and interleaved with the round 1 matches the way Sleeper lists them. `regular` says whether every round halves the previous one so connectors can be drawn. Sentenced fallback is the bracket "winner" of the p = 1 game (the last-place game), no longer the loser of the highest-p game.
- **`src/lib/sleeper.ts`**: reads `settings.playoff_week_start` from the league and fetches `/matchups/{week}` for each bracket round in parallel (cached an hour like the rest); a failed week just shows no scores. The snapshot path uses the new JSON fields.
- **`scripts/fetch-sleeper-bracket.ts`**: also writes `playoffWeekStart` and slimmed `matchups` per playoff week. Re-run: `npx tsx scripts/fetch-sleeper-bracket.ts` (it ran from this session; Sleeper was reachable).
- **`src/components/sleeper/LosersBracket.tsx`**: `Tree` places round labels and cards on a CSS grid whose rows are the first-round slots; a card in round k spans 2^(k-1) rows, so the `::before` bracket on its left meets the centres of its two feeders and every card in an earlier round carries a right stub. Irregular shapes fall back to plain columns. Cards: `M3 MATCH 3` label, two rows with avatar, team name (two-line clamp), `@handle · record`, points and a W/L chip from the scoreboard. Bye cards are dashed with `BYE`. The final is `♛ LAST PLACE · Bound for Pofadder` with an orange frame. Sentenced rows keep an orange left border and tint plus a small `SENTENCED` tag (record dropped on those rows to make room). Placement games sit under the tree. The standings fallback uses the same row styling.
- **`src/app/globals.css`**: old `.pb-sl-rounds/.pb-sl-round/.pb-sl-match/.pb-sl-row/.pb-sl-result/.pb-sl-seed` rules removed; new block "Toilet Bowl bracket" at the end (`pb-tb-*`). The panel is a size container; under 840 px of panel width (`@container`) the tree stacks vertically with dashed dividers between rounds and no connectors, so nothing scrolls off-screen on phones or when the sidebar eats the width. Above that the three columns share the width.

## Verified

- Unit tests cover: scoreboard from points vs bracket flags, byes and their order, regular/irregular detection, placement split, weeks, the new sentenced fallback.
- `next build` + `next start` + headless Chromium through a temporary `/demo/preview-tmp` page (deleted before commit): the tree at 1280 px matches Sleeper's picture (Pierre05 bye, SB123456 144.50 W vs Blackburn22 96.34 L, Skin4TheWin bye, VictorDercksen 115.00 L vs chvisser98 151.30 W; Round 2 119.68/82.62 and 125.12/130.80; Finals 132.16/166.58; 3rd 102.74/96.40; 5th 118.68/173.04), connectors meet card centres; 1000 px (panel ~760) and 390 px stack cleanly; no page overflow; no console errors apart from Sleeper avatar images, which the sandbox cannot fetch (`sleepercdn.com` fails TLS through the proxy here; they load in production as before).
- Not verified: the live Sleeper path end to end inside Next (the API was reachable, and the same parsing runs on the snapshot, but no signed-in session exists in the sandbox).

## Suggested checks on production (after merge)

1. Game centre: the bracket shows Round 1 · Week 15, Round 2 · Week 16, Finals · Week 17 with the scores above and `from Sleeper` in the subtitle. If it reads `Sleeper snapshot`, the live fetch failed and the committed JSON is showing; both should look identical.
2. Resize the window or open it on a phone: below roughly 840 px of panel width the rounds stack; above, the tree with lines.
3. Sleeper avatars load in the rows and the header pill.

## Still open

1. Regenerate `database.types.ts` from the local stack now that `league_context` is pushed (carried forward).
2. If the Sleeper avatar CDN is ever unreachable the rows show a blank circle rather than initials (`next/image` has no error fallback without a client component). Cosmetic.
3. Carried forward: custom SMTP, lock Sleeper link after confirmation, invite Theo as commissioner, self-review guard, `memberships.invited_email` visibility.
