# Pofadder Bowl 2026 · Handoff (2026-09-21, auth routing and security review)

Follow-on to `handoff_2026-09-20_upload-cap-direct-uploads.md`. Infrastructure detail still lives in `handoff_2026-09-17.md`.

## State at handoff

| Item | Value |
|---|---|
| Branch | `claude/auth-routing-security-review-x60wwn`, started from `main` at `e270807` |
| Production | https://pofadder-bowl.vercel.app deploys from `main`; nothing deployed from this branch |
| Schema | Unchanged |
| Env | Unchanged |
| Tests | `npm run typecheck`, `npm run lint`, `npm test` (154 vitest, 3 new) pass; `npx next build` passes and `/teaser` still prerenders |

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

## Still open

1. Content-Security-Policy: needs an inventory of inline styles (the design system uses `style={{…}}` throughout), tile and avatar hosts, and Supabase endpoints before it can be added without breaking the map or uploads.
2. `/setup` is public and names the required env variables. Harmless, but it could redirect to `/teaser` once the backend is configured and no `reason` is given.
3. Carried forward: regenerate `database.types.ts`; run the integration tests; drop the `upsert_prediction` shims later; the rating is not kept in the local IndexedDB draft; tour Skip semantics; per-member reset tour; Sleeper bracket script; custom SMTP.
