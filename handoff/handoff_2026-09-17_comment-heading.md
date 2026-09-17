# Pofadder Bowl 2026 · Handoff (2026-09-17, session 5: no stock heading on comments)

Follow-on to `handoff_2026-09-17_jersey-forum-post.md`.

## State at handoff

| Item | Value |
|---|---|
| Branch | `claude/jersey-messages-review-mc697l`, merged into `main` (fast-forward) |
| Schema / env | Unchanged. The `activity_posts.heading` column still requires 1–120 characters |
| Tests | `npm run typecheck`, `npm run lint`, `npm test` (34 vitest) green; `npx next build` clean |

## What was asked and done

Victor asked to remove the "From the locker room" text from member comments.

- `JerseyCard.heading` is optional; the heading line is not rendered when absent.
- `SidelineFeed` passes no heading for posts of kind `comment`, so existing rows that still store "From the locker room" no longer show it.
- `postComment` (`src/lib/actions/feed.ts`) now stores the heading `League comment` because the column is not nullable. It is never displayed.
- Demo comments lost their "From your locker" heading and use the `League comment` kind pill.
- CSS: the body sits 2 px under the byline when there is no heading.

## Verified

- Checks and build green. Demo game centre: posting a comment renders byline, message and footer only, no heading (screenshot at 1280 px).
- Not verified: the real feed against Supabase.

## Still open

Unchanged from the previous handoff.
