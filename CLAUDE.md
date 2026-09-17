# Pofadder Bowl 2026 · project instructions

Private fantasy-league punishment app ("Show Us Your TD's"). One participant travels Malmesbury → Pofadder → Malmesbury on 23–25 September 2026, runs 14 km and completes ten proof challenges while the league watches, reacts, plays Punishment Bingo and predicts results. Next.js 16 App Router on Vercel, Supabase (Postgres, Auth, Storage, Realtime), Leaflet map, hand-written CSS design system.

`AGENTS.md` holds the Next.js managed block that points at the version-matched docs in `node_modules/next/dist/docs/`. Read that guide before touching framework APIs; it is the source of truth over training data.

## Start every session here

1. Read the newest file in `handoff/` (sorted by name). It records production state, credentials location, open items and known quirks. Older handoffs hold infrastructure detail that newer ones only reference.
2. Read `README.md` for the local stack and verification commands.
3. Skim `src/lib/league.ts` (context and roles) and `src/lib/roles.ts` before changing anything role-dependent.

## Workflow rules

- **Always write a handoff before committing.** Add a new dated file `handoff/handoff_YYYY-MM-DD[_topic].md` (never overwrite an earlier one) covering: state at handoff (branch, deploy, schema/env changes), what was asked and done, how it works and where it lives, what was verified and what was not, suggested checks on production, and still-open items. Commit the handoff with the work.
- Verify before committing: `npm run typecheck && npm run lint && npm test`. Run `npm run test:integration` when the local Supabase stack is available and the change touches SQL, RLS or actions.
- Work on the assigned branch. Do not open a pull request unless asked. Do not push to `main` unless asked.
- Never commit secrets. `.env*` is ignored except `.env.example`; keep env files LF (a stray `\r` once broke the league slug on Vercel).
- From cloud sessions: no `vercel deploy`, no `supabase db push`. Schema changes go into `supabase/migrations/` and Victor pushes them from the laptop (`npm run db:push`).
- Keep the Next.js managed block in `AGENTS.md`; `next dev` re-adds it if removed.
- Do not put model names or session identifiers into code, commit messages or docs pushed to the repo.

## Stack and versions

| Piece | Version | Notes |
|---|---|---|
| Next.js | 16.3 | App Router, Turbopack, `src/proxy.ts` (the file formerly called middleware), React Compiler lint rules |
| React | 19.2 | Server Components by default |
| Supabase | `@supabase/ssr` 0.12, `supabase-js` 2.x | Cookie-backed sessions, RLS, security-definer RPCs |
| Zod | 4 | Validation in every server action |
| Leaflet | 1.9 + `react-leaflet` 5 | Client only, loaded with `next/dynamic` |
| Vitest | 5 | Pure unit tests in `src/**/*.test.ts` |
| Playwright | 1.63 | Screenshots and auth-flow scripts in `scripts/` |
| Node | 22.x or 24.x | `.node-version` picks 24 on Vercel |

## Next.js 16 practices (from the bundled docs)

- Request APIs are async only: `await cookies()`, `await headers()`, `await params`, `await searchParams`. Sync access was removed in 16.
- Using `cookies()` or `headers()` in a layout or page makes the whole route dynamic. The `(league)` layout is `force-dynamic` on purpose; keep public routes (`/teaser`, `/demo`, `/login`, `/recap/public`) free of request-time APIs so they can prerender.
- Cookies can only be set in a Server Action or Route Handler, never during rendering. Follow `src/lib/actions/view.ts`.
- `src/proxy.ts` refreshes the Supabase session and redirects anonymous visitors. It is a first gate only: every page and server action re-checks membership and role through `getLeagueContext`. Do not put data fetching or authorisation logic in the proxy.
- Server Actions (`src/lib/actions/*.ts`, `"use server"`): validate input with Zod, call `getLeagueContext` and check the role inside the action, return the minimum data the client needs (`ActionResult`), and call `revalidatePath` for the screens that show the changed data. Never trust a role passed from the client.
- Modules that must not reach the browser start with `import "server-only"` (`src/lib/league.ts`, `src/lib/checkins.ts`, ...). Keep pure, testable logic in plain modules without that import (`src/lib/roles.ts`, `src/lib/checkin-path.ts`, `src/lib/time.ts`).
- Use `next/link` for navigation, `next/image` for images, `next/font` for fonts (`src/lib/fonts.ts`). Private responses carry `Cache-Control: private, no-store` (set in the proxy).
- `next/dynamic` with `ssr: false` is only allowed inside a Client Component (`src/components/map/CheckinMap.tsx` wraps Leaflet this way).
- `revalidateTag` now needs a cache-life profile as its second argument; this codebase uses `revalidatePath` throughout.
- Folders starting with `_` under `src/app` are private (no route). Route groups use parentheses: `(league)`.
- `npm run typecheck` runs `next typegen` first so route types exist on a fresh checkout. If `tsc` complains about a deleted page in `.next/types`, rerun `npm run typecheck`.
- Linting is the ESLint CLI with the flat config in `eslint.config.mjs` (`next lint` no longer exists). The React hooks rules are the compiler-era ones: no `setState` inside effects for derived state (use the "adopt new props" pattern as in `SidelineFeed`), `useSyncExternalStore` for browser stores (`src/lib/hooks.ts`), refs for values that must not trigger renders, and stable effect dependencies (pass numbers, not fresh arrays or objects; see `LiveMap`).

## Supabase practices

- Clients: `src/lib/supabase/server.ts` (Server Components, actions, route handlers), `client.ts` (browser singleton), `proxy.ts` (session refresh), `admin.ts` (secret key, server-only scripts and invite action). Never add a `NEXT_PUBLIC_` prefix to the secret key; only `src/lib/env.ts` reads `process.env`.
- Call `supabase.auth.getClaims()` early in a request to validate the JWT (it is verified, not merely decoded), then `getUser()` when the full user object is needed. `getVerifiedUser` in `src/lib/league.ts` does this once per request and is wrapped in React `cache`.
- Refresh tokens are single use. The proxy refreshes once per navigation; concurrent parallel requests with an expired cookie can see `session: null`, so handle that gracefully rather than looping.
- **RLS and RPCs are the enforcement layer; the UI only decides what to show.** Every table has RLS; privileged writes go through `security definer` functions in `supabase/migrations/*_functions.sql` that re-check `pb_is_event_participant`, `pb_is_event_commissioner`, `pb_is_event_member`. New capabilities need a policy or RPC, not a client-side check.
- Migrations in `supabase/migrations/` are the schema's source of truth; `supabase/seed.sql` holds the production programme (league, event, itinerary, challenges, bingo, prompts). Add a new timestamped migration instead of editing an applied one.
- Regenerate types after schema changes: `npx supabase gen types typescript --db-url postgresql://postgres:postgres@127.0.0.1:54322/postgres` into `src/lib/database.types.ts`, stripping anything before `export type Json` (`--local` has hung).
- Realtime: tables must be in the `supabase_realtime` publication (see `*_policies.sql`) and readable under RLS for the subscriber. Subscribe from a client component and call `router.refresh()`; keep a bounded visible-tab poll as fallback (`SidelineFeed`, `CheckinLive`).
- Storage uploads use resumable TUS (`src/lib/uploads.ts`); hosted projects need `NEXT_PUBLIC_SUPABASE_RESUMABLE_URL` on the direct storage host.
- Auth is invite-only magic links. `[auth] enable_signup=false` is invite-only; `[auth.email] enable_signup=false` would disable all email logins. The default mailer only delivers to Supabase org members; custom SMTP is required before inviting the league.

## Roles and the member view

- Effective role resolves admin > commissioner > participant > member (`src/lib/roles.ts`). Admins inherit commissioner. Victor is admin, commissioner and participant at once; the header badge lists every hat.
- Elevated accounts can switch to the league member view. The `pb-member-view` cookie makes `getLeagueContext` resolve the account as a plain member for every page and action. The switch only ever removes capabilities; RLS still knows the real role. UI: `MemberViewToggle`, banner in `src/app/(league)/layout.tsx`.
- Guards: `requireAdmin`, `requireCommissioner`, `requireParticipant` redirect to `homeFor(ctx)`. The menu per role lives in `src/components/shell/nav.ts` and is unit tested.
- `getLeagueContext` loads everything in one `league_context` RPC (falls back to per-table queries until the migration is applied) and applies the sign-on gates: `/choose-sleeper` once the Sleeper league is imported and the member has no confirmed team, then `/choose-team` for a kit. Gate pages use `getLeagueContextRaw`. `ctx.user` comes from the verified JWT claims (`id`, `email`), not a `getUser()` round trip.
- Every private screen has an instant loading state (`src/app/(league)/loading.tsx`, the tumbling `Football`); slow third-party data should stream under `Suspense` so a page never waits on it. Functions run in `fra1` (`vercel.json`) next to the Frankfurt database.

## Zod 4

Prefer the top-level validators: `z.iso.datetime()`, `z.email()`, `z.uuid()`, `z.url()`. The string-method forms (`z.string().datetime()`) still work but are deprecated. Parse with `safeParse` and return a friendly `message` on failure.

## Map

- Leaflet renders only in the browser: `CheckinMap` (client) dynamically imports `LiveMap`. Never import `leaflet` from a Server Component.
- Tiles default to public OpenStreetMap (`resolveTileUrl` in `src/lib/env.ts`); `NEXT_PUBLIC_MAP_TILE_URL=static` shows the labelled regional preview. Attribution must stay visible.
- The route line is `checkinPath` (oldest → newest). Fit the viewport only when the plotted set changes so viewers are not reset by the poll.
- Check-ins are participant-only, consent-gated (`location_settings.sharing_enabled`), de-duplicated by client id, and each new one posts to the feed (`record_checkin`). The map is not proof of the run.

## Design system

- All styling is hand-written in `src/app/globals.css` with `pb-*` classes, ported from the approved mockup. No Tailwind, no CSS-in-JS. Add new rules at the end of the file under a comment, and keep the mobile breakpoints (850 px sidebar → drawer, 580 px compact header) working.
- Reuse the existing pieces: `TitleRow`, `Status`, `EmptyState` (`src/components/ui/TitleRow.tsx`), `JerseyCard`, `KitPanel`, `Marks` (team logos, shield, patch), `AppShell` and the drawer.
- Team marks are ESPN assets under `public/nfl`; kits and colours come from `src/data/nfl-teams.json` via `src/lib/nfl.ts`. Fonts are Barlow 400/600 and Barlow Condensed 500/700/900 only.
- Copy tone: NFL broadcast, short, confident, South African spelling. Times display in the event timezone (SAST) via `src/lib/time.ts`.

## Testing and verification

- Unit tests: Vitest in the `node` environment, `src/**/*.test.ts`. Test pure modules; do not import `server-only` modules or React components. Add a test when you add pure logic.
- Integration (`scripts/integration-test.ts`) needs the local stack: `npx supabase start`, `npm run db:reset`, `npm run seed:local-fixtures` (fixture password `pofadder-local-2026`).
- Browser checks run against `npx next build && npx next start -p 3001`, not `next dev` (dev is slow and the Realtime socket blocks `networkidle`). `npm run screenshots` and `npm run test:auth-flow` live in `scripts/`.
- In the cloud sandbox: no backend credentials, `openstreetmap.org` and `supabase.com` are blocked, and the Playwright MCP wants Google Chrome. Drive `@playwright/test` directly with `executablePath: "/opt/pw-browsers/chromium"` from a script inside the project (so it resolves the package). A temporary page under `src/app/demo/` is a good way to render a component visually; delete it before committing.

## Where things live

| Area | Path |
|---|---|
| Private screens | `src/app/(league)/*` (game-centre, my-trip, map, proof, review, bingo, predictions, press, recap, account), `review/members`, `choose-team` |
| Public routes | `/teaser`, `/demo/*` (in-memory, never touches the backend), `/login`, `/recap/public/[league]/[event]` |
| Server actions | `src/lib/actions/*.ts` |
| Context, roles, guards | `src/lib/league.ts`, `src/lib/roles.ts` |
| Data loaders | `src/lib/checkins.ts`, `evidence.ts`, `feed.ts`, `itinerary.ts`, `predictions.ts`, `bingo.ts` |
| Shell and navigation | `src/components/shell/*` |
| Map | `src/components/map/*`, `src/lib/checkin-path.ts` |
| Schema, RPCs, RLS, storage | `supabase/migrations/*.sql`, `supabase/seed.sql`, `supabase/config.toml` |
| Programme data and assets | `src/data/league-programme.json`, `public/brand`, `public/nfl`, `public/maps`, `src/fonts` |
| Scripts | `scripts/` (bootstrap admin, seed fixtures, integration and auth-flow tests, screenshots, cloud setup) |
| Handoffs | `handoff/` (newest first by name) |

@AGENTS.md
