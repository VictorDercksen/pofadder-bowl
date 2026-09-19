# Pofadder Bowl 2026 · Handoff (2026-09-17, password gate stuck on an existing password)

Follow-on to `handoff_2026-09-17_password-gate.md` (merged to `main` as 8885d18 and deployed).

## State at handoff

| Item | Value |
|---|---|
| Branch | `claude/first-time-password-setup-mb3xwh` (fix commit on top of the merged work; merge to `main` pending) |
| Schema | Unchanged; `20260917000900_password_gate.sql` is still **not pushed** (needs `npm run db:push` from the laptop) |
| Tests | `npm run typecheck`, `npm run lint`, `npm test` (12 files, 63 vitest, 4 new) pass; `npx next build` passes |

## What happened on production

Victor, who had set a password on the earlier build, was sent to `/set-password` on every screen and got "Could not set the password. Sign in again with an email link and retry." when he entered it.

Cause: the migration is not pushed, so the gate ran on the JWT fallback, and his session predates the `has_password` metadata flag. Entering the existing password made GoTrue reply "New password should be different from the old password." (code `same_password`); `setPassword` only matched the phrase "same password", so it fell through to the generic error and never recorded the flag. The generic copy then told him to use the email link, which the gate also blocks.

## Fix (`src/lib/password-gate.ts`, `src/lib/actions/account.ts`, `src/lib/league.ts`)

- `setPassword`: a `same_password` reply (by code or wording) is proof a password exists. The action then writes `user_metadata.has_password = true`, refreshes the session, revalidates and returns ok ("That is already your password. Carry on."). `weak_password` is matched by code too; `reauthentication_needed` (the dashboard's "secure password change" setting) gets its own message; the generic fallback now includes the Auth server's message instead of pointing at the email link.
- `claimsHaveSetPassword`: the JWT counts as proof when `user_metadata.has_password` is true **or** `amr` contains a `password` entry (a session opened with the Password tab). So anyone who signs in with a password is never gated, whatever the metadata says.
- `getLeagueContextRaw`: in the pre-migration window only (RPC does not report `has_password` and the JWT says no), one `supabase.auth.getUser()` round trip reads the live metadata before gating. Covers a `refreshSession()` that did not land. This branch never runs once the migration is applied.

## What Victor should do

1. Merge to `main` (fast-forward) and let Vercel deploy.
2. Reload `/set-password` and enter the password again: it now returns "That is already your password. Carry on." and the app opens. Or sign out and sign in on the Password tab; that session carries `amr: password` and skips the gate.
3. From the laptop, `npm run db:push` so `has_password` comes from `auth.users` and none of the fallbacks matter.

## Verified

- Unit tests for the new helpers (claims with metadata / amr, same-password and reauthentication detection). Typecheck, lint, build green.
- Not verified against GoTrue (no backend in the sandbox): the exact `same_password` reply, `getUser()` metadata after `updateUser`, `amr` contents of a password session. All three follow the documented Auth API.
