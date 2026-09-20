# Pofadder Bowl 2026 · Handoff (2026-09-20, number fields keep what you type)

Follow-on to `handoff_2026-09-20_rating-grant.md`.

## State at handoff

| Item | Value |
|---|---|
| Branch | `claude/proof-locker-rating-selectors-sau4ux`, merged into `main` at Victor's request (no PR) |
| Schema / Env | Unchanged |
| Tests | `npm run typecheck`, `npm run lint`, `npm test` (144 vitest) pass; `npx next build` passes |

## What was asked

On a phone every number box kept a leading 0 that could not be deleted ("058" after typing 58 into the minutes field of Official results).

## Cause and fix

Controlled `<input type="number">` fields parsed the box on every keystroke (`Number(e.target.value)`) and wrote the number back; clearing the box parsed to 0, which snapped back in, and the next digit landed after it.

New `src/components/ui/NumberInput.tsx`: keeps the typed string in local state, reports `null` while empty and the parsed number otherwise, and adopts a value from props only when it differs from what the draft already says (state adopted during render, the compiler-era pattern; no effect). Sets `inputMode` numeric (decimal when `step` is fractional) for the phone keypad.

Swapped in everywhere a field parsed on change: `ResultsForm` run h/m/s, `PredictionSlip` (all whole-number calls) and `RulesEditor`, the account nameplate number and `TeamPicker` kit number, and the demo slip. Callers that need a number map `null` to `NaN` (validation refuses it) or to 0 where 0 is the meaning (run seconds, kit number). Fields that already held strings (results distance, final score, flags, sign time, speech; slip distance) were unaffected and are unchanged.

## Verified

Typecheck, lint, unit tests, `next build`. Headless Chromium on `/demo/predictions` at 390 px: clearing the minutes box leaves it empty, typing 58 gives "58", clearing the score box and typing 7 gives "7".

## Suggested check on production

Commissioner → Official results → clear the minutes box and type 58: it reads "58". Same on the prediction slip, League access → kit number, and Account → nameplate number.

## Still open

Unchanged from `handoff_2026-09-20_rating-grant.md`.
