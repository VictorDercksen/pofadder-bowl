# Pofadder Bowl 2026 · Handoff (2026-09-17, bingo review and FAAB prize copy)

Follow-on to `handoff_2026-09-17_stress-test.md`. Infrastructure detail still lives in `handoff_2026-09-17.md`.

## State at handoff

| Item | Value |
|---|---|
| Branch | `claude/bingo-game-review-y6q9zh` (not merged) |
| Production | Unaffected until merged |
| Schema | Unchanged |
| Env | Unchanged |
| Tests | `npm run typecheck`, `npm run lint`, `npm test` (11 files, 58 tests) pass |

## What was asked

A full review of Punishment Bingo (mechanics, how the league learns of incidents, whether 24 squares are enough) with alternatives if it cannot work, and a mention of a 5 FAAB Sleeper prize for the two side-quest winners. The review was delivered in the session, not here.

## What was done

Copy only. The prize is read as 5 FAAB for the bingo winner and 5 FAAB for the prediction winner.

- `src/app/(league)/bingo/page.tsx`: blurb now says the first confirmed line wins 5 FAAB; a "The stakes" panel under the incident booth explains it (shared if lines complete on the same incident).
- `src/app/(league)/predictions/page.tsx`: blurb and a "The stakes" panel for the top slip; "No cash stakes" moved into that panel.
- `src/app/(league)/recap/page.tsx`: the bingo winner row now names only the holder(s) of the earliest line (was everyone with any line), and both winner rows carry "5 FAAB in Sleeper".
- `src/components/demo/DemoScreens.tsx`: demo bingo and predictions copy mirror the above.

## Not done, decisions pending

- `issue_certificate` (SQL) still lists every member with a line as a bingo winner; needs a migration to match the recap page's first-line rule.
- Leaderboard tie-break after `first_line_at` is `marked` (identical for every card, since all cards share the same 24 squares) then display name. Decide on a rule.
- `/bingo` has no Realtime subscription and no feed post when a member completes a line or proposes an incident. Members only learn of confirmations from the Sideline feed post.
- Theo still needs the commissioner role; Victor is the only confirmer.

## Suggested checks on production

1. `/bingo`, `/predictions` and `/recap` show the 5 FAAB copy for a plain member.
2. `/demo/bingo` and `/demo/predictions` still render.
