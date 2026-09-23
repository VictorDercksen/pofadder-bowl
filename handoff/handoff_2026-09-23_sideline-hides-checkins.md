# Sideline feed no longer shows positional check-ins

## State at handoff

Branch `claude/league-sideline-positional-checkins-u38pwf`, from `main`. Not merged, not deployed. No migration, no schema or env changes.

## Asked and done

Positional check-ins should not appear in the league sideline feed.

- **Query filter.** `loadFeed` in `src/lib/feed.ts` adds `.neq("kind", "checkin")` to the `activity_posts` query. The filter lives in the query, so the first page, "Earlier plays" paging and the realtime refresh all agree and no cursor gap opens.
- **Data unchanged.** `record_checkin` still writes a `kind = 'checkin'` post with `ref_checkin_id`; nothing is deleted. The map, the "Where's Victor?" panel and the recap keep reading check-ins from `checkins`, not from the feed.
- **Copy.** `SidelineFeed` empty state reads "The first proof, decision or comment will appear here". The `Check-in` kind label and the captain patch for check-in posts were removed since they can no longer render.

## Verified

`npm run typecheck`, `npm run lint`, `npm test` (24 files, 164 tests) pass.

## Not verified

Not run against a database. `npm run test:integration` needs the local stack (no Docker in the sandbox). The integration test does not assert that check-ins appear in the feed, so it should still pass.

## Suggested checks on production after the merge

1. Share a position from My trip, open Game centre: the map updates, the sideline does not gain a card.
2. `select count(*) from activity_posts where kind = 'checkin';` still grows, confirming the post is written and only hidden.

## Open

- The public `/demo` game centre still shows a sample "Victor checked in" jersey card (`src/components/demo/DemoScreens.tsx`). Left as is; swap it for a proof or comment card if the demo should mirror the league feed.
- A check-in insert still triggers the sideline's realtime `router.refresh()`. Harmless, and the game-centre page also shows the latest position, so the refresh is still useful.
