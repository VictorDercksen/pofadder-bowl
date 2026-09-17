# Pofadder Bowl 2026 · Handoff (2026-09-17, navigation speed, football loader, auth options, Sleeper team and losers bracket)

Follow-on to `handoff_2026-09-17_stress-test.md`. Infrastructure detail still lives in `handoff_2026-09-17.md`.

## State at handoff

| Item | Value |
|---|---|
| Branch | `claude/nav-perf-sleeper-ui-poq21b` (not merged, no PR opened) |
| Production | https://pofadder-bowl.vercel.app deploys from `main`; unaffected until merged |
| Schema | **One new migration**: `supabase/migrations/20260917000800_league_context.sql` (new `league_context` RPC; `claim_sleeper_identity` now self-confirms). Run `npm run db:push` from the laptop. The app works before the push too (see "How it works") |
| Types | `src/lib/database.types.ts` was hand-edited to add `league_context` (Args + `Json` return). Regenerate from the local stack when convenient; nothing else changed in the schema |
| Env | Unchanged. `vercel.json` now pins functions to `fra1` (Frankfurt, same region as the Supabase project) |
| Email template | `supabase/templates/magic_link.html` now prints the 6-digit `{{ .Token }}` as well as the link. Paste it into Auth → Email templates once custom SMTP is on |
| Tests | `npm run typecheck`, `npm run lint`, `npm test` (12 files, 58 vitest, 7 new) pass; `npx next build` passes |

## What was asked

1. Navigation feels very slow; investigate.
2. A moving loading icon, football themed.
3. Better auth: Victor keeps having to send sign-in links again.
4. Members confirm their Sleeper team from the current list at sign-on.
5. Show the member's Sleeper team name in the header next to their icon, Sleeper-styled.
6. Show the losing bracket somewhere, Sleeper-styled.

## 1. Why navigation was slow, and what changed

Findings (all verified in code; timings are estimates, no production trace was available from the sandbox):

- **No `loading.tsx` anywhere.** Every private route is `force-dynamic`, so a click did nothing visible until the whole server render finished, and `<Link>` prefetching had nothing to prefetch (dynamic routes only prefetch down to the nearest loading boundary).
- **Six serial round trips before any page query.** Per request: proxy `getClaims()`, then in `getLeagueContextRaw` another `getClaims()` plus `getUser()` (a network call to the Auth server), `activate_membership` RPC (a write, on every request), leagues+profiles, then memberships+events. Then the page's own queries.
- **Wrong continent.** Vercel functions default to `iad1` (US East) while the Supabase project is in `eu-central-1`. Each round trip cost ~90 ms of pure latency, so the chain above alone was ~0.5–0.8 s before the page loaded anything.

Changes:

- `vercel.json`: `"regions": ["fra1"]`. Biggest single win; every round trip drops to a few ms.
- `league_context(p_league_slug, p_event_slug)` RPC (migration `…0800`): activates an invited membership, then returns league, event, membership, profile, the linked Sleeper manager and whether the Sleeper league has been imported, in one call. `getLeagueContextRaw` uses it and **falls back to the old per-table path** when the RPC is missing (`PGRST202`/`42883`), so merge order versus `db:push` does not matter.
- `getVerifiedUser` no longer calls `getUser()`. `ctx.user` is now `{ id, email }` from the verified JWT claims (`getClaims()` checks the signature against the cached JWKS). The only consumer of anything beyond `id` was the account page (`email`).
- `src/app/(league)/loading.tsx`: instant loading state for every private screen, prefetched by `<Link>`, so a click swaps the content area immediately and the page streams in.
- `NavNumber` (`src/components/shell/NavLinks.tsx`) uses `useLinkStatus` to swap the screen number for the tumbling football while that link's navigation is pending; used in the sidebar and the drawer.
- The Sleeper bracket on the game centre streams under `Suspense`, so the third-party fetch never blocks the page.

Not changed: the proxy still runs `getClaims()` once per request (that is the session refresh; leave it). Pages already batch their queries with `Promise.all`.

## 2. Football loader

`src/components/ui/Football.tsx`: plain SVG football (brown leather, cream laces and end stripes) tumbling end over end (`pb-tumble`, 0.85 s, stops under `prefers-reduced-motion`). `LoadingPlay` is the route-level state ("SNAP COUNT · Loading the next play…" with shimmer bars); `compact` is the inline variant for Suspense fallbacks. The ball also shows inside the login/picker buttons while pending. CSS under "Football loader" at the end of `globals.css`.

## 3. Auth: three ways in, same invited account

- **Password** (`/login` → Password tab, `passwordSignIn` in `src/app/login/actions.ts`): set once under League access → Password (`PasswordForm`, `setPassword` action, `supabase.auth.updateUser`, 8+ characters). No Supabase setting needed; the email provider already allows passwords. Wrong credentials give one generic message.
- **6-digit code** (`verifyEmailCode`, `type: "email"`): after "Link sent", a second form accepts the code from the email, for the case where the link opens in a different browser or app and the session lands in the wrong place. The code is only in the email once the custom template (`{{ .Token }}`) is active; with Supabase's default template the email carries the link only.
- **Admin resend** (`sendSignInLink` in `src/lib/actions/members.ts`, buttons in each `MemberRow`): "Email a new link" (`signInWithOtp`, needs working SMTP) or "Copy a link to hand over" (`admin.generateLink`, shown in a read-only field, works once). Either replaces the member's previous unused link.
- Bug fixed: `inviteMember` for an already-registered address called `generateLink` and discarded the result while telling the admin a link "was sent". It now sends one with `signInWithOtp`.

## 4 & 5. Sleeper team at sign-on, and the header chip

- `getLeagueContext` gates in order: `/choose-sleeper` (when the Sleeper league is imported and the member has no `sleeper_user_id`), then `/choose-team`. Both gate pages use `getLeagueContextRaw`.
- `/choose-sleeper` (`src/app/choose-sleeper/page.tsx`, `SleeperPicker`): Sleeper-style dark panel listing every imported manager as a card (avatar or initials, team name, `@username`, COMMISH pill for the league owner). Teams confirmed by other members are locked with "Taken by …". Confirm calls `claimSleeperIdentity`, which now marks the link **confirmed** (migration). If nothing is imported yet the page offers Continue and the gate does not trigger.
- Header (`src/app/(league)/layout.tsx`): kit badge, then `SleeperTeamChip` (dark rounded chip, avatar, bold team name, handle beneath). Without a link the chip reads "No Sleeper team · Confirm yours" and goes to the picker. The drawer identity carries the same chip. Below 580 px the chip collapses to the avatar.
- League access → Sleeper team: shows the confirmed card and lets the member change it (taken teams disabled). Admin override in Review → Members is unchanged.
- Sleeper avatars come from `sleepercdn.com` (`next.config.ts` `images.remotePatterns`, `unoptimized`).

## 6. Losers bracket

- `src/lib/bracket.ts` (pure, tested): parses Sleeper's `losers_bracket`, `rosters` and `users` shapes with Zod, resolves feeder slots ("Winner of M1") from decided matches, labels rounds (`ROUND n`, `SEMIS`, `TOILET BOWL`) and placement games (`FINAL`, `3RD PLACE`, …), and picks the sentenced team: the programme's `sentenced` manager (`@VictorDercksen` in `league-programme.json`) wins, else the loser of the last-place game.
- `src/lib/sleeper.ts`: `resolveSeasonLeague` walks `previous_league_id` from the configured league back to season 2024; `loadLosersBracket` fetches with `next: { revalidate: 3600 }`, falls back to `src/data/sleeper-losers-bracket.json`, else returns null.
- `LosersBracketPanel` (`src/components/sleeper/LosersBracket.tsx`) on `/game-centre` between the map row and the sideline feed, under `Suspense`. Sleeper look: dark card, teal "S" mark, rounds left to right (horizontal scroll on phones), avatar rows with W/L chips, winner tint, sentenced row and header pill in orange ("Bound for Pofadder"). When neither Sleeper nor the snapshot is available it shows the bottom six of the supplied 2024 standings with the sentenced flag.
- `scripts/fetch-sleeper-bracket.ts` writes the snapshot (`npx tsx scripts/fetch-sleeper-bracket.ts`). **Run it once from the laptop and commit the JSON**; the sandbox cannot reach `api.sleeper.app`, so the committed snapshot is still empty.

## Verified

- `npm run typecheck && npm run lint && npm test` green; `npx next build` green.
- `next start` + headless Chromium via a temporary `/demo/preview-tmp` page (deleted): loader animates (transform changes between frames), picker selection and locked cards, login tabs, header chip, bracket with sample rows and the standings fallback, at 390 and 1280 px, no console errors, no horizontal overflow. Sidebar navigation in the demo shell works with the new `NavNumber`.
- Not verified (no backend or Sleeper access in the sandbox): the `league_context` RPC against Postgres (SQL was written to the patterns of the existing functions and only uses columns that exist), the legacy fallback path against a live session, password/code sign-in against GoTrue, the real Sleeper bracket, Sleeper avatar loading, the `/choose-sleeper` gate with a live session.

## Suggested checks on production (after merge and `db:push`)

1. Click through the sidebar signed in: the number turns into the spinning ball and the content area shows "Loading the next play" at once; pages should feel markedly faster (functions now in `fra1`).
2. Victor lands on `/choose-sleeper` once (league already imported), confirms "Chase-ing Mahomelessness", then sees the chip in the header and the drawer.
3. League access → Password → set one; sign out; sign in with the Password tab.
4. Review → Members → "Copy a link to hand over" for a member: a one-time link appears; opening it signs that member in.
5. Game centre shows the 2024 Toilet Bowl from Sleeper with Victor marked SENTENCED. If it shows "Sleeper unavailable", check `SLEEPER_LEAGUE_ID` / `leagues.sleeper_league_id` and run the snapshot script.
6. Regenerate `database.types.ts` from the local stack after `db:reset` and confirm no diff beyond `league_context`.

## Still open

1. Run `scripts/fetch-sleeper-bracket.ts` and commit the snapshot.
2. Custom SMTP before inviting the rest of the league (unchanged); the emailed 6-digit code needs the custom template.
3. Members can change their own Sleeper link at any time; if that should lock after confirmation, add a check in `claim_sleeper_identity`.
4. Carried forward from the stress-test handoff: invite Theo as commissioner, self-review guard, `memberships.invited_email` visibility.
