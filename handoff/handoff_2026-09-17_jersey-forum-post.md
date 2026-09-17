# Pofadder Bowl 2026 · Handoff (2026-09-17, session 4: jersey posts as forum posts)

Follow-on to `handoff_2026-09-17_jersey-forum-options.md` (the four options). Infrastructure detail lives in `handoff_2026-09-17.md`.

## State at handoff

| Item | Value |
|---|---|
| Branch | `claude/jersey-messages-review-mc697l`, not merged, no pull request |
| Production | Unchanged until the branch is merged |
| Schema / env | Unchanged |
| Tests | `npm run typecheck`, `npm run lint`, `npm test` (34 vitest) green; `npx next build` clean |

## What was asked and done

Victor chose **option A**: keep the full jersey, put a cream forum post on the torso. It is now the only layout.

- `src/components/ui/JerseyCard.tsx`: single layout again. The `variant` prop and the other three layouts are gone. `timestamp` was replaced by `time` (right of the byline) and optional `kind` (pill in the byline); `actions` renders next to the reaction in the post footer. The chest number is smaller and sits inline next to the nameplate so the message is the largest element on the card.
- `src/app/globals.css`: the classic torso message rules were removed; the chest row and kit number rules were adjusted; the forum post rules live under `/* --- Jersey posts v3 */` at the end of the file with a 580 px block.
- `src/components/feed/SidelineFeed.tsx`: passes `time`, `kind` and, when commenting is allowed, a Reply link that jumps to the comment input (`id="sideline-comment"`).
- `src/components/demo/DemoScreens.tsx` and `src/components/account/TeamPicker.tsx`: updated to the new props. The demo comment input has `id="demo-comment"` for its Reply link.
- `src/app/demo/jersey-options/` (temporary comparison page) was deleted.

The post index (`#1`, `#2`) shown in the option mock-ups was dropped: the feed loads the latest 24 posts, so a position-based number would shift as older posts fall off.

## Verified

- Typecheck, lint, unit tests and production build green.
- `next start` + headless Chromium: `/demo/game-centre` sideline at 1280 px and 390 px shows the new posts with correct kit colours, bengal cuffs, reaction state and the Reply link; the comment box follows.
- Not verified visually: the `TeamPicker` preview card on `/account` (no demo route renders it; it only changed prop names and compiles), the real feed against Supabase.

## Suggested checks on production after merge

1. `/game-centre`: posts read as forum posts on the jersey; Reply scrolls to the comment box; the reaction toggle still works.
2. `/account`: the kit preview card renders with "PREVIEW" pill and "Not posted".
3. A phone at 390 px: byline wraps to two lines on long kind labels without overflow.

## Still open (carried forward)

1. Invite Theo (TheoLotter) as commissioner, not admin.
2. Custom SMTP before inviting the remaining managers.
3. Optional keyed tile provider if OSM usage becomes heavy.
4. Unexercised in a browser: TUS uploads over 6 MB, IndexedDB drafts, MediaRecorder press answers, certificate PNG export, Web Share.
