# Pofadder Bowl 2026 · Handoff (2026-09-17, session 3: jersey post layout options)

Follow-on to `handoff_2026-09-17_member-view-and-map.md`. Infrastructure detail lives in `handoff_2026-09-17.md`.

## State at handoff

| Item | Value |
|---|---|
| Branch | `claude/jersey-messages-review-mc697l`, not merged, no pull request |
| Production | Unchanged. The live feed still renders the `classic` jersey layout |
| Schema / env | Unchanged |
| Tests | `npm run typecheck`, `npm run lint`, `npm test` (34 vitest) green |

## What was asked

Review the jersey-styled feed posts: keep the jersey styling, put more attention on the actual message, make the feed read more like a forum, and offer a few options with screenshots to choose from.

## What was done

`JerseyCard` (`src/components/ui/JerseyCard.tsx`) gained a `variant` prop plus optional `time`, `kind` and `actions` props. The default `variant="classic"` renders exactly the previous markup, so `SidelineFeed`, the demo game centre and every other caller are unchanged. The jersey silhouette moved into a `JerseyShape` helper and the insignia into `Insignia`; a shared `Post` block renders the forum body (byline with logo, name, `#number`, kind pill and time; heading; message at 17 px; footer with reaction, reply link and post index).

Variants (CSS under `/* --- Jersey posts v3 */` at the end of `src/app/globals.css`, with a 580 px breakpoint block):

| Variant | Class | Layout |
|---|---|---|
| A `post` | `pb-jersey--post` | Full jersey frame. Chest number shrunk and inlined next to the nameplate; a cream forum post sits on the torso with a kit-deep inset border. |
| B `yoke` | `pb-jersey--yoke` | Compact jersey top only (shoulders, collar, sleeve numbers, nameplate, chest number, insignia). The post hangs below on paper with a kit-coloured left rail. |
| C `avatar` | `pb-jersey-row` + `pb-jersey--mini` | Forum row. Small full jersey (number and nameplate) as the avatar column, post on the right, kit-coloured rail. The mini jersey carries its own `style` so the kit variables are not overridden by `.pb-jersey` defaults. |
| D `torso` | `pb-jersey--torso` | Classic jersey untouched; the message block gets a dark translucent panel, kind + time as an accent kicker, upper-case heading, 17 px body and a byline footer. |

Temporary preview page: `src/app/demo/jersey-options/page.tsx` renders all four options and the current layout with the same three sample posts. It is in-memory like the rest of `/demo`. **Delete it once an option is chosen** (CLAUDE.md rule on temporary demo pages; it is kept on this branch only so the options can be viewed on a preview deploy).

## Verified

- Typecheck, lint and unit tests green.
- `npx next build && npx next start -p 3001`, headless Chromium (`/opt/pw-browsers/chromium`) screenshots of each option at 1280 px and 390 px. Checked: kit colours per team on every variant, bengal cuff stripes on the Cincinnati kit, wrapped two-line messages, footer wrapping on phone width.
- Not verified: the variants inside the real `SidelineFeed` (it still uses `classic`), long nameplates in the mini jersey (ellipsis rule is inherited from `.pb-nameplate`), Realtime updates.

## Next step once an option is chosen

1. In `src/components/feed/SidelineFeed.tsx` pass `variant="<chosen>"`, `time={formatTime(post.created_at, timezone)}`, `kind={KIND_LABEL[post.kind] ?? post.kind}` and `actions` (a reply link to the comment box `#sideline-comment` plus an index) to `JerseyCard`; give the comment input `id="sideline-comment"`.
2. Update `Feed()` in `src/components/demo/DemoScreens.tsx` the same way.
3. Delete `src/app/demo/jersey-options/` and the unused variant CSS blocks; optionally drop the `variant` prop if only one layout survives.
4. Re-run `npm run typecheck && npm run lint && npm test`, then a build-and-screenshot pass on `/demo/game-centre`.

## Still open (carried forward)

1. Invite Theo (TheoLotter) as commissioner, not admin.
2. Custom SMTP before inviting the remaining managers.
3. Optional keyed tile provider if OSM usage becomes heavy.
4. Unexercised in a browser: TUS uploads over 6 MB, IndexedDB drafts, MediaRecorder press answers, certificate PNG export, Web Share.
