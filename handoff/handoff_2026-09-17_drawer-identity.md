# Pofadder Bowl 2026 · Handoff (2026-09-17, drawer identity block)

Follow-on to `handoff_2026-09-17_merge-main.md`. Infrastructure detail still lives in `handoff_2026-09-17.md`.

## State at handoff

| Item | Value |
|---|---|
| Branch | `claude/peaceful-cori-ys6zm3` (not merged) |
| Production | https://pofadder-bowl.vercel.app deploys from `main`; unaffected until merged |
| Schema / env | Unchanged |
| Tests | `npm run typecheck`, `npm run lint`, `npm test` (11 files, 58 vitest) pass; `next build` clean |

## What was asked

Improve the look of the identity block at the top of the mobile drawer (name, kit, roles, Sleeper chip), remove redundancy, offer options. Four mockups were rendered against the real CSS and fonts; Victor chose **option D, "Minimal"**.

## What was done

- New server-safe component `src/components/shell/DrawerIdentity.tsx`: kit badge with the jersey number pinned to its corner (orange tag), name in Barlow Condensed, one line with the Sleeper avatar and team name, and a small gold role kicker. It links to `/account` when `href` is given, otherwise renders a static block (demo).
- `src/app/(league)/layout.tsx` and `src/app/demo/layout.tsx` use it. The league layout no longer imports `teamName`; the Sleeper handle and the full franchise name are gone from the drawer (the logo carries the franchise, the handle stays on `/account`).
- `src/app/globals.css`: the old `.pb-drawer-identity` and `.pb-drawer-sleeper` rules were removed; the new `pb-drawer-mark`, `pb-drawer-number`, `pb-drawer-id-text`, `pb-drawer-id-sub` rules sit at the end of the file under a comment.

## States handled

| State | Shows |
|---|---|
| Kit + Sleeper | Logo with `#NN` badge · name · avatar + Sleeper team · roles |
| No kit | League shield, no number badge; sub line reads "No kit or Sleeper team yet" if Sleeper is also missing |
| Kit, no Sleeper | Logo + badge · "No Sleeper team yet" in muted green |
| Member view | Kicker reads `LEAGUE MEMBER VIEW` (from `describeRole`) |
| Demo | Giants kit `#07`, sample Sleeper team name, kicker `INTERACTIVE DEMO` |

## Verified

- `npx next build && npx next start -p 3001`, headless Chromium at 390 px: `/demo` drawer renders the new block on one column, name, sub line and kicker each on one line, number badge overlapping the logo corner, close button unaffected.
- Desktop sidebar and the header account chip are untouched (the `SleeperTeamChip` still shows the handle there).

## Not verified

- The real league drawer with a signed-in account (no backend credentials in the sandbox). The markup is the same component as the demo, fed from `ctx.profile` and `ctx.sleeper`.
- Long names: the name line truncates with an ellipsis at 340 px drawer width; a very long Sleeper team name truncates on the sub line.

## Suggested checks on production

1. Open the drawer on a phone as Victor: expect `VICTOR DERCKSEN`, Jaguars logo with `#02`, `Skattle Ranch` with the Sleeper avatar, kicker `ADMIN · PARTICIPANT`.
2. Switch to league member view: kicker should read `LEAGUE MEMBER VIEW`.
3. A member without a Sleeper team should see "No Sleeper team yet".

## Open items

- None from this change. Earlier open items (db push of `league_context`, type regeneration) still stand per the previous handoff.
