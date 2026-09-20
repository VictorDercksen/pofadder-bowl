# Pofadder Bowl 2026 · Handoff (2026-09-20, prop board: Save button instead of save-per-tap)

Follow-on to `handoff_2026-09-20_tour-colours-sideline-claims.md`. Infrastructure detail still lives in `handoff_2026-09-17.md`.

## State at handoff

| Item | Value |
|---|---|
| Branch | `claude/prop-board-save-button-8thxr7`, started from `main` (no PR opened) |
| Production | https://pofadder-bowl.vercel.app deploys from `main`; unaffected until merged |
| Schema | Unchanged. No migration; the existing `upsert_prop_pick` RPC is reused |
| Types | Unchanged |
| Env | Unchanged |
| Tests | `npm run typecheck`, `npm run lint`, `npm test` (109 vitest, 2 new) pass; `npx next build` passes. `npm run test:integration` not run (no local stack in the sandbox); its prop block calls the RPC directly and is unaffected |

## What was asked

On the Prop Board page, stop saving every side as it is tapped. Add a Save button at the bottom that saves the form's values when clicked.

## What was done

- **`src/components/props/PropBoard.tsx`**: tapping a side now only records a draft in component state (`drafts`, keyed by prop id). The shown side per prop is the draft if there is one, else the saved side. A drafted side that differs from the saved one gets the `draft` class (dashed gold ring) and the state line reads "Over · not saved yet." Tapping back to the saved side makes the prop clean again.
- **Save bar** under the list (only while at least one prop is still open): `Save picks` (disabled until something changed, then `Save N picks`), `Discard changes` (clears drafts, shown only when dirty) and a note. A `beforeunload` guard warns on leaving the page with unsaved sides. Commissioner settle buttons are unchanged and still act immediately (a different action, on locked props).
- **`src/lib/actions/props.ts`**: `savePropPick` (one pick) is replaced by `savePropPicks({ picks })`. Zod validates an array of 1–100 `{ propId, side }`, de-duplicates by prop, then runs every pick through the existing `upsert_prop_pick` RPC in parallel. The lock and side/kind checks stay per prop in the database. One refused pick does not undo the others; the message says "N saved, M refused. That prop has locked. No late picks." (or the side-fit message, or the raw error). `revalidatePath` runs when at least one pick was saved.
- **`src/lib/props.ts`**: pure `pendingPicks(props, drafts)` returns the picks a save must send (drafts on open props that differ from the saved side). Unit tests in `src/lib/props.test.ts`.
- **`src/app/(league)/props/page.tsx`**: footnote now reads "Tap your sides, then Save picks. …".
- **`src/app/globals.css`**: new rules at the end under "Prop board: drafted sides and the Save button".
- The `/demo/props` screen is untouched (in-memory, no save concept); the tour copy for the props step is untouched.

## How the draft state resolves

Drafts are overrides, not a copy of the server state, so no effect syncs props into state (React Compiler rules). After a save, `router.refresh()` brings the new saved sides down; a draft equal to its saved side counts as clean, so the counter drops to zero without clearing anything. A Realtime or poll refresh from `PropLive` while the member is mid-edit keeps their unsaved drafts.

## Verified

- `npm run typecheck && npm run lint && npm test` green; `npx next build` green.
- Production server on port 3001 + headless Chromium through a temporary `/demo/preview-tmp` page (deleted), 390 px and 1280 px: Save disabled on load; three taps → "Save 3 picks"; reverting one prop to its saved side → "Save 2 picks"; state lines and dashed ring correct; locked prop's buttons disabled; Discard returns to "Save picks" disabled; no horizontal overflow, no console errors.
- Not verified (no backend in the sandbox): the save round trip against Postgres, the partial-refusal message when a prop locks between tap and save, and the `beforeunload` prompt in a real browser.

## Suggested checks on production (after merge)

1. Prop board as a member: tap sides on a few props. Nothing is written until Save; the standings panel's "picked" count stays put until you save.
2. Save. The status reads "N picks saved. Editable until the board locks." and the sides stay selected without the dashed ring after the refresh.
3. Change one side, reload without saving: the browser should ask before leaving; after reload the saved side is back.
4. Once the board locks: no Save bar, sides disabled, commissioner settle buttons unchanged.

## Still open

1. Carried forward: whether Skip should count as done in the tour; a per-member "reset tour" for admins; regenerate `database.types.ts` from the local stack; run `scripts/fetch-sleeper-bracket.ts`; custom SMTP before inviting the league.
