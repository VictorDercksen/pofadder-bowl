# Pofadder Bowl 2026 · Handoff (2026-09-17, mandatory password at first sign-in)

Follow-on to `handoff_2026-09-17_nav-perf-sleeper-ui.md`. Infrastructure detail still lives in `handoff_2026-09-17.md`.

## State at handoff

| Item | Value |
|---|---|
| Branch | `claude/first-time-password-setup-mb3xwh` (not merged, no PR opened) |
| Production | https://pofadder-bowl.vercel.app deploys from `main`; unaffected until merged |
| Schema | **One new migration**: `supabase/migrations/20260917000900_password_gate.sql` (replaces `league_context`, adds `has_password`). Run `npm run db:push` from the laptop. The gate works before the push too (see "How it works") |
| Types | Unchanged (`league_context` still returns `Json`) |
| Env | Unchanged |
| Tests | `npm run typecheck`, `npm run lint`, `npm test` (12 files, 61 vitest, 3 new) pass; `npx next build` passes |

## What was asked

1. A member signing in for the first time from a link with no password must be prompted to set one.
2. Any member entering the app without a password must be forced to set one before continuing.
3. Does this solve the "keep having to get an email and sign in" problem?

## How it works

- **Gate.** `getLeagueContext` (`src/lib/league.ts`) now checks `ctx.hasPassword` before the Sleeper-team and kit gates and redirects to `/set-password`. Every private page and every server action that calls `getLeagueContext` is covered; `/choose-sleeper` and `/choose-team` (which use `getLeagueContextRaw`) redirect there too, so the order is password → Sleeper team → kit. The invite link, magic link and 6-digit code all land on `/home`, which runs the gate, so a first-time member sees the password screen straight after the link.
- **Page.** `src/app/set-password/page.tsx` (`getLeagueContextRaw`, redirects to `/home` once a password exists). Reuses `PasswordForm` from `src/components/account/AccountForms.tsx`, which gained `afterSave` (navigates on success) and `label` props. Sign out is offered underneath.
- **Where "has a password" comes from** (`src/lib/password-gate.ts`, pure, tested):
  1. `has_password` in the `league_context` RPC payload: `exists(select 1 from auth.users where id = auth.uid() and coalesce(encrypted_password,'') <> '')`. GoTrue truth; invited accounts have no hash until `updateUser({ password })`.
  2. Fallback when the RPC does not report the key (migration not yet pushed, or the legacy per-table path): `user_metadata.has_password === true` from the verified JWT claims. `setPassword` (`src/lib/actions/account.ts`) now writes that flag alongside the password and calls `refreshSession()` so the very next request carries the new claim instead of waiting for the hourly token refresh; it also revalidates the layout.
  The RPC answer wins whenever present. A member who set a password on the previous build (before the metadata flag existed) is recognised by the RPC after `db:push`; before the push they would be asked once more and simply set it again.
- **Login page.** `/login` opens on the **Password** tab; **Email link** (with the 6-digit code form) is the second tab, for the invite and for a forgotten password. Copy on `/login` and on League access → Password reflects this. The local fixture form is unchanged.
- **Docs.** README auth bullet and the CLAUDE.md Supabase auth line updated. `scripts/auth-flow-test.ts` completes the gate after both invite variants (`passGate`) and clicks the Email link tab before requesting a magic link.

## Answer to the question

Yes for the sign-in half: once every member has a password, nobody needs an email to get back in from a new device or after a lost session, and the Password tab is now the default. Email is still needed once per member (the invite; custom SMTP remains a blocker for the league) and for a forgotten password (the Email link tab is the reset path; there is no separate "forgot password" flow).

It does not change how long a session lasts. Cookie sessions already persist across visits, so if Victor is being asked to sign in mid-use on the same browser the cause is elsewhere: most likely the single-use refresh-token race the stress-test handoff noted (parallel requests with an expired token can bounce one of them to `/login?reason=session`), or an in-app browser (Gmail, WhatsApp) that does not share cookies with Safari/Chrome. With a password the recovery is a few seconds instead of a round trip to the inbox, which is the practical win; if the bounce keeps happening on production, that race is the next thing to chase.

## Verified

- `npm run typecheck && npm run lint && npm test` green; `npx next build` green (`/set-password` listed as a dynamic route).
- `next start` + headless Chromium through a temporary `/demo/preview-tmp` page (deleted): the set-password panel and the login tabs render at 390 and 1280 px, Password is the selected tab, no console errors, no horizontal overflow.
- Not verified (no backend in the sandbox): the RPC against Postgres (SQL reuses the previous function body plus one `exists` over `auth.users`, which `handle_new_user` already reads as the same definer), `refreshSession()` writing cookies from the server action against GoTrue, the redirect chain with a live session, `scripts/auth-flow-test.ts` against Mailpit.

## Suggested checks on production (after merge and `db:push`)

1. Review → Members → "Copy a link to hand over" for a test member with no password; open it in a private window: land on `/set-password`, set one, arrive at the game centre; sign out; sign in with the Password tab.
2. Victor (password already set): sign in with the password and confirm no gate appears; then `/account` → Password still changes it.
3. Sign in with the email link as an account that has a password: no gate; straight to the role home.
4. Local stack: `npm run db:reset && npm run seed:local-fixtures`, `npx next build && npx next start -p 3001`, `npm run test:auth-flow` (the script now completes the gate).

## Still open

1. `db:push` for `20260917000900_password_gate.sql`; then `npx supabase gen types` for good measure (no diff expected).
2. A proper "forgot password" flow (`resetPasswordForEmail` + `/auth/confirm?type=recovery`) if the Email link tab proves confusing; today the magic link doubles as the reset path.
3. If sessions still drop mid-use on production, investigate the refresh-token race noted in `handoff_2026-09-17_stress-test.md` item 6.
4. Carried forward: run `scripts/fetch-sleeper-bracket.ts` and commit the snapshot; custom SMTP; invite Theo as commissioner; self-review guard; `memberships.invited_email` visibility.
