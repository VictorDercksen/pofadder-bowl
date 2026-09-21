# Pofadder Bowl 2026 · Handoff (2026-09-21, auth routing and security review)

Follow-on to `handoff_2026-09-20_upload-cap-direct-uploads.md`. Infrastructure detail still lives in `handoff_2026-09-17.md`.

## State at handoff

| Item | Value |
|---|---|
| Branch | `claude/auth-routing-security-review-x60wwn`, started from `main` at `e270807` |
| Production | https://pofadder-bowl.vercel.app deploys from `main`; nothing deployed from this branch |
| Schema | New migration `20260921000100_prediction_grants.sql` (grants only, backward compatible) |
| Env | Unchanged |
| Tests | `npm run typecheck`, `npm run lint`, `npm test` (154 vitest, 3 new) pass; `npx next build` passes and `/teaser` still prerenders. Integration tests not run (no local stack in the sandbox) |

## What was asked

1. Route all unauthenticated traffic to the teaser screen.
2. Check that every route is authenticated and that roles cannot reach screens that are not theirs.
3. A quick security review of the application.

## What was done

### Anonymous traffic lands on the teaser

- `src/lib/public-paths.ts` (new, pure, unit tested in `public-paths.test.ts`): `isPublicPath` and `anonymousRedirect`. Public by design: `/`, `/teaser`, `/demo/*`, `/login`, `/auth/*` (confirm, session, signout), `/recap/public/*` (consent-gated RPC), `/setup`, plus framework and brand assets. Everything else is private, including `/home`, the gate pages (`/set-password`, `/choose-sleeper`, `/choose-team`), `/no-access` and `/api/map-route`.
- `src/lib/supabase/proxy.ts` now sends a signed-out request for a private path to `/teaser?next=<path+query>` (307, `Cache-Control: private, no-store`) instead of `/login?next=…&reason=session`. `/` and `/home` add no `next`.
- `src/components/teaser/SignInLink.tsx` (client, under `Suspense`) reads `next` with `useSearchParams`, filters it through `safeInternalPath`, and points the teaser's "League sign-in" button at `/login?next=…`, so a member who opened a shared deep link signs in and lands on it. The teaser page stays static; the prerendered HTML carries the plain `/login` fallback and the client fills in `next` on hydration.
- In-app session loss (a page or server action that finds no verified user after the proxy let it through, i.e. a refresh race or an expired token mid-action) still redirects to `/login?reason=session` from `getLeagueContextRaw`, because that visitor is a member who needs the "session expired" message, not a stranger.

### Hardening found during the review

- `src/app/login/page.tsx` accepted any `next` starting with `/`, so `/login?next=//evil.com` put a protocol-relative URL into the form. The actions always re-validated with `safeInternalPath`, so no redirect could leave the origin, but the page now uses `safeInternalPath` too.
- `next.config.ts` adds baseline headers on every response: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: geolocation=(self), camera=(), microphone=(), payment=(), usb=()`. No Content-Security-Policy yet (inline styles and third-party tiles need their own pass).

### Security review: fixed on this branch

- `src/app/auth/confirm/route.ts` accepted any `next` starting with `/`. Not exploitable as written (assigning `pathname` keeps the host), but it was the one redirect not using `safeInternalPath`; it does now.
- `supabase/migrations/20260921000100_prediction_grants.sql`: the 3-argument and 8-argument `upsert_prediction` overloads were created after the blanket `revoke execute … from public, anon` (`20260918000100`), so Supabase's default privileges left them callable by `anon`. They refused without a session anyway (`pb_is_event_member`). Now revoked from `public, anon` and granted to `authenticated`. Every other function created since follows the member_locations pattern; keep doing that.
- `src/lib/actions/evidence.ts`: `updateCaption` and `submitDraft` had no `isParticipant` check, so an elevated account in league member view could still edit and submit its own drafts although the banner says the locker is read-only. Ownership was always enforced by RLS and `submit_submission`; both actions now refuse like the other evidence actions.

### Security review: verified sound (no change)

- The secret key is read only in `src/lib/env.ts`, used only by `admin.ts` (server-only) from two admin-gated actions in `members.ts`; nothing under `src/app` or `src/components` references it.
- Every server action validates with Zod, loads the context before writing, and its role check matches the capability (admin: invites, roles, participant, Sleeper links, prediction rules; commissioner: review, penalties, results, prop settlement, certificate; participant: check-ins, uploads, rating, consent). Client-supplied ids are scoped by `ctx.event`/`ctx.league`/`ctx.user` or by the RPC.
- Every `security definer` RPC derives the role from `auth.uid()`, never a parameter, and pins `search_path = public`. `public_certificate` requires issued, public and consented; it is the only `anon` grant.
- Storage: inserts only under `{event}/{uid}/{submission}/` on the participant's own draft or flagged submission; reads gated by `pb_can_view_submission` so drafts never reach members; deletes own draft only; no update policy.
- Redirect targets (login, local sign-in, member view, auth session, teaser) all go through `safeInternalPath`; sign-out redirects to a fixed path. The member-view cookie only removes capabilities and is httpOnly, lax, secure.
- OSRM base URL comes only from `MAP_ROUTING_URL`; coordinates are numeric-validated. Sleeper league id is regex-checked against a fixed host.

### Security review: noted, not changed

1. **Admin one-time sign-in link** (`members.ts`, `sendSignInLink` in link mode): an admin can mint a magic link for any member and therefore sign in as them. Documented as intentional for handing over by WhatsApp, but there is no audit row. Consider restricting link mode to accounts without a password, or posting an audit entry per mint.
2. **`memberships` row-level select** (`policies.sql`, `memberships_select`): any active member can read every membership row, including `invited_email`, `invited_by` and `is_admin`, through PostgREST. The UI shows these only to admins. A column-level revoke would break the legacy `select("*")` fallback and the admin members page, so it needs a view or RPC for the admin page first.
3. **`/api/map-route`** checks for a session but not league membership and has no rate limit. Accounts are invite-only, so exposure is low; `getLeagueContextRaw` or a `pb_is_member` check plus a per-user limit would close it.
4. **Password change without recent sign-in**: `setPassword` calls `auth.updateUser` with no re-authentication; local config has `secure_password_change = false`. Confirm the hosted project setting.
5. **RLS is enabled everywhere but never forced.** Fine while `postgres` owns the tables and every RPC is meant to run as owner.
6. `requireParticipant` admits commissioners to `/my-trip` and the participant's proof view on purpose (preview); every write still requires `isParticipant`.

## Route and role matrix (verified by reading the pages)

| Route | Who | Guard |
|---|---|---|
| `/`, `/teaser`, `/demo/*`, `/login`, `/auth/*`, `/setup`, `/recap/public/…` | Public | proxy allow-list; `/login` bounces signed-in users to `/` |
| `/home`, `/game-centre`, `/map`, `/proof`, `/proof/[id]`, `/props`, `/predictions`, `/press`, `/recap`, `/account` | Every active member | `getLeagueContext` (sign-on gates: password, Sleeper, kit) |
| `/my-trip` | Participant or commissioner | `requireParticipant` → `homeFor` |
| `/review`, `/review/[id]` | Commissioner (admins inherit) | `requireCommissioner` → `homeFor` |
| `/review/members` | Admin | `requireAdmin` → `homeFor` |
| `/set-password`, `/choose-sleeper`, `/choose-team`, `/no-access` | Signed in | `getLeagueContextRaw` / `getVerifiedUser` |
| `/api/map-route` | Signed in | proxy plus its own 401 |

The member-view cookie (`pb-member-view`) only removes capabilities (`resolveAccess`), so an elevated account in member view is redirected off `/my-trip` and `/review` like a member, and the proof page hides the uploader; a plain member setting the cookie gains nothing.

## Verified

- Against `npx next build && npx next start -p 3001` with placeholder Supabase env (no session possible): every private route above redirects to `/teaser` with the expected `next`; `/teaserx` and `/recap/publicity` are treated as private; `/teaser`, `/demo/map`, `/login`, `/setup` answer 200; `/recap/public/x/y` is 404.
- Chromium (Playwright): `/teaser?next=%2Fproof%2Fabc%3Fv%3D2` hydrates the sign-in button to `/login?next=%2Fproof%2Fabc%3Fv%3D2`; `?next=//evil.com` hydrates to plain `/login`; `/login?next=//evil.com` renders `next` as `/`.
- The four headers are present on responses.
- Not verified: a real sign-in round trip through the teaser deep link on production, and the header set against the live Supabase and Sleeper CDN requests (nothing in the set blocks cross-origin fetches or images).

## Suggested checks on production

1. Signed out, open `/game-centre`: lands on the teaser; "League sign-in" goes to `/login?next=%2Fgame-centre`; after sign-in you are on Game centre.
2. Signed out, open `/`: teaser without `next`.
3. Signed in, open `/teaser` and `/login`: teaser renders; login bounces to your role home.
4. A plain member opening `/review` or `/review/members` lands on Game centre; a commissioner opening `/review/members` lands on Review.
5. Response headers on any page show the four new headers.
6. After the migration lands: in the SQL editor, `select has_function_privilege('anon', 'public.upsert_prediction(uuid, integer, smallint)', 'execute')` returns false; a member can still save a prediction.
7. Admin or commissioner in league member view: the caption field and Submit on their own draft answer "Only the participant…".

## Still open

1. Content-Security-Policy: needs an inventory of inline styles (the design system uses `style={{…}}` throughout), tile and avatar hosts, and Supabase endpoints before it can be added without breaking the map or uploads.
2. `/setup` is public and names the required env variables. Harmless, but it could redirect to `/teaser` once the backend is configured and no `reason` is given.
3. Items 1 to 4 under "noted, not changed" above, in that order of value.
4. Carried forward: regenerate `database.types.ts`; run the integration tests; drop the `upsert_prediction` shims later; the rating is not kept in the local IndexedDB draft; tour Skip semantics; per-member reset tour; Sleeper bracket script; custom SMTP.
