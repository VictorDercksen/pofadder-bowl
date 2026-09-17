# Pofadder Bowl 2026 · Handoff (2026-09-17, sideline paging)

Follow-on to `handoff_2026-09-17_drawer-identity.md`. Infrastructure detail still lives in `handoff_2026-09-17.md`.

## State at handoff

| Item | Value |
|---|---|
| Branch | `claude/peaceful-cori-ys6zm3` (drawer identity already merged to `main`; this commit is not) |
| Production | https://pofadder-bowl.vercel.app deploys from `main`; unaffected until merged |
| Schema / env | Unchanged. No migration: paging uses the existing `activity_posts` select policy |
| Tests | `npm run typecheck`, `npm run lint`, `npm test` (12 files, 63 vitest, 5 new) pass; `next build` clean |

## What was asked

A "view more" button (better name) on the league sideline that loads older posts, five at a time.

## What was done

- **First page is five posts.** `loadFeed` (`src/lib/feed.ts`) now returns `{ posts, hasMore }`, takes `{ limit, before }`, orders by `created_at desc, id desc`, asks for `limit + 1` to know whether another page exists, and continues from a `(createdAt, id)` cursor with a PostgREST `or` filter so posts sharing a timestamp are never skipped or repeated. Default limit is `FEED_PAGE_SIZE` (5); the old default of 24 is gone.
- **Server action** `loadOlderPosts({ before })` in `src/lib/actions/feed.ts`: Zod-validated cursor (`z.iso.datetime`, `z.uuid`), `getLeagueContext` for membership, returns the next page. RLS scopes the rows; no role check is needed because every active member may read the feed.
- **Button** in `SidelineFeed`: "Earlier plays · 5 more" under the last jersey card (`pb-feed-more`). While loading it reads "Rolling the tape…"; when the tape runs out after at least one press it shows "That is the whole tape." Offline presses are refused with a warning.
- **Refresh merge.** Realtime and the 45 s poll call `router.refresh()`, which re-renders only the first page. The component now merges that fresh page over what is on screen (`mergeFeedPosts`) instead of replacing it, so loaded history survives and a new post at the top never opens a gap. Fresh rows win, so reaction counts on the first page stay current; counts on older loaded rows update the next time they are fetched.
- Pure helpers and tests: `src/lib/feed-page.ts`, `src/lib/feed-page.test.ts` (page size, cursor, ordering, merge without gaps, append without duplicates).
- `src/app/(league)/game-centre/page.tsx` passes `initialHasMore`. `globals.css` gains one `pb-feed-more` rule at the end.

## Verified

- Unit tests for the paging helpers; typecheck, lint, production build.
- Rendered the component with five fixture posts on a throwaway page under `src/app/demo/` (deleted before commit): the button sits centred under the last card in the design system's pill style at 420 px.

## Not verified

- The action against a real database (no credentials in the sandbox). The `or` filter string is `created_at.lt.<iso>,and(created_at.eq.<iso>,id.lt.<uuid>)`; the cursor values come from rows the server itself returned, so they are already in PostgREST's ISO form.
- `npm run test:integration` was not run (no local stack here).

## Suggested checks on production

1. Game centre with more than five posts: exactly five cards, then "Earlier plays · 5 more". Press it: five older cards appear below, in order, no repeats.
2. Keep pressing until the button is replaced by "That is the whole tape." Count should equal the total posts for the event.
3. With older pages loaded, post a comment from another account: the new card lands at the top and the loaded older cards stay.
4. An event with five or fewer posts shows no button and no "whole tape" note.

## Open items

- Type regeneration of `src/lib/database.types.ts` from the local stack (carried over).
