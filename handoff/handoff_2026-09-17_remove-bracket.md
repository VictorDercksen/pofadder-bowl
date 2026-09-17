# Pofadder Bowl 2026 · Handoff (2026-09-17, losers bracket removed)

Follow-on to `handoff_2026-09-17_toilet-bowl-bracket.md`. Infrastructure detail still lives in `handoff_2026-09-17.md`.

## State at handoff

| Item | Value |
|---|---|
| Branch | Committed directly on `main` and pushed, as asked. Production deploys from `main` |
| Schema / env | Unchanged. `SLEEPER_LEAGUE_ID` is still used by the manager import (`src/lib/actions/members.ts`) |
| Tests | `npm run typecheck`, `npm run lint`, `npm test` (11 files, 56 tests) and `npx next build` pass |

## What was asked

Remove the whole Toilet Bowl / losers bracket section from the app (it had been redrawn earlier today and merged in `369c9af`).

## What was removed

- `src/components/sleeper/LosersBracket.tsx`, `src/lib/bracket.ts`, `src/lib/bracket.test.ts`.
- `src/data/sleeper-losers-bracket.json` and `scripts/fetch-sleeper-bracket.ts`.
- `src/lib/sleeper.ts`: the season walk (`resolveSeasonLeague`), cached fetch, week scores and `loadLosersBracket`. What remains is `fetchSleeperLeagueUsers` (manager import) and `sleeperAvatarUrl` (team chip, picker, drawer).
- `src/app/(league)/game-centre/page.tsx`: the `Suspense` slot between the map row and the sideline feed, and the now-unused imports.
- `src/app/globals.css`: the "Losers bracket" and "Toilet Bowl bracket" blocks (`pb-sl-bracket`, `pb-sl-head*`, `pb-tb-*`). The shared Sleeper surfaces (`pb-sl-chip`, `pb-sl-card`, `pb-sl-panel`, `pb-sl-pill`, avatars) are untouched.
- README and CLAUDE.md lines that described the bracket; the `next.config.ts` comment on the Sleeper CDN.

Nothing else referenced the bracket. `LoadingPlay` (route loading state) and `sleeperLeagueId()` (import action) are still in use elsewhere.

## Verified

Typecheck, lint, unit tests and the production build on the resulting tree. No browser check was needed: the change only deletes a section, and the game centre otherwise renders the same map row and sideline feed.

## Suggested checks on production

1. Game centre: map row, next drive, then the sideline feed directly beneath, no bracket and no "Pulling the losers bracket" loader.
2. Header Sleeper chip, `/choose-sleeper` and League access → Sleeper team still show avatars (same helper, unchanged).

## Still open

Carried forward from `handoff_2026-09-17_toilet-bowl-bracket.md`: regenerate `database.types.ts` now that `league_context` is pushed; custom SMTP; lock Sleeper link after confirmation; invite Theo as commissioner; self-review guard; `memberships.invited_email` visibility.
