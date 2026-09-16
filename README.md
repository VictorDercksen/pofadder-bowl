# Pofadder Bowl 2026 · Show Us Your TD’s

Private fantasy-football league punishment app: Victor Dercksen travels Malmesbury → Pofadder → Malmesbury (23–25 September 2026), runs 14 km and completes ten proof challenges worth 100 points while the league watches, reacts, plays Punishment Bingo and predicts the damage.

Built with Next.js 16 (App Router, TypeScript), Supabase (Postgres, Auth, Storage, Realtime) and Leaflet, deployed to Vercel.

## What is in the box

| Area | Where |
|---|---|
| Ten screens (game centre, my trip, map, proof locker, commissioner, bingo, predictions, press room, final whistle, league access) | `src/app/(league)/*` |
| Public teaser + share panel, invite-only sign-in, labelled demo | `src/app/teaser`, `src/app/login`, `src/app/demo` |
| Design system ported from the approved mockup, `JerseyCard` and shell | `src/app/globals.css`, `src/components/ui`, `src/components/shell` |
| Database schema, functions/RPCs, RLS, storage policies | `supabase/migrations/*.sql` |
| Production seed (league, event, itinerary, challenges, bingo, prompts) | `supabase/seed.sql` |
| Local fixtures, commissioner bootstrap, integration tests, screenshots | `scripts/*.ts` |
| Supplied programme data, NFL team map, fonts, artwork | `src/data`, `src/fonts`, `public/brand`, `public/nfl`, `public/maps` |

## Authentication and Sleeper

Sleeper hosts the league, but Sleeper’s API is public **read-only and offers no OAuth or sign-in** for third-party apps ([docs.sleeper.com](https://docs.sleeper.com)). It therefore cannot be the identity provider. The app uses **Supabase invite-only email sign-in** (magic links; public sign-up disabled) and uses Sleeper for what it can do:

- A commissioner imports the Sleeper league’s managers (`SLEEPER_LEAGUE_ID`, default `1313900125680054272` = Show Us Your TD’s 2026).
- Each member claims their Sleeper manager in **Account → Sleeper identity**; a commissioner confirms the link in **Review → Members**.
- Roles (participant, member, commissioner) and the event participant are set only by commissioners or the bootstrap script and are enforced by RLS and RPCs. There is no client-side role switch.

## Local development

Prerequisites: Node 22+ (`.node-version` pins 24 for Vercel), Docker (for the local Supabase stack), npm.

```bash
npm install
npx supabase start          # local Postgres/Auth/Storage/Realtime (Docker)
npm run db:reset            # applies migrations + seed.sql
cp .env.example .env.local  # then paste the local URL/keys printed by `supabase start`
npm run seed:local-fixtures # four password accounts: participant, commissioner, member, outsider
npm run dev                 # http://localhost:3000
```

Local fixture accounts (password `pofadder-local-2026`): `victor@local.test` (participant), `commish@local.test` (commissioner), `member@local.test`, `outsider@local.test` (no membership). The login page shows a **local-only password form** when `NEXT_PUBLIC_SUPABASE_URL` points at 127.0.0.1/localhost; it refuses to run against any other host. Magic-link emails for the local stack land in Mailpit at http://127.0.0.1:54324.

Demo mode is always available at `/demo`: an in-memory replica of the mockup, visibly labelled, with no backend access.

## Verification

```bash
npm run typecheck        # tsc --noEmit
npm run lint             # eslint (React Compiler rules on)
npm test                 # vitest: bingo lines, prediction scoring/locking, event phases, upload rules
npm run test:integration # against the local stack: RLS across 4 accounts, storage policies,
                         # approval idempotency + concurrency, supersede transition,
                         # prediction lock/reveal/resolution, bingo cards/wins, feed, certificate
npm run build            # next build
npm run screenshots      # Playwright: every screen × 3 roles × 360/390/1280 px + demo/public,
                         # overflow check and keyboard-tab smoke test → ./screenshots
```

## Data model (Supabase)

`profiles`, `leagues`, `memberships` (role + `is_commissioner` + status), `sleeper_league_users`, `events` (all instants UTC, `timezone` = Africa/Johannesburg), `itinerary_items`, `challenges`, `penalties`, `press_prompts`, `evidence_submissions` (versioned: draft → submitted → approved | flagged | superseded), `evidence_files`, `review_decisions` (audit, unique idempotency key), `location_settings`, `checkins`, `activity_posts`, `reactions` (one per member per post), `bingo_squares`, `bingo_cards` (stable shuffled layout per member), `bingo_incidents`, `bingo_wins` (unique per line), `prediction_rules`, `predictions`, `official_results`, `prediction_awards`, `certificates`.

Key server-side behaviour (`20260916000200_functions.sql`):

- `review_submission` — transactional, idempotent approval/flag/supersede with row locks and version check; approving a newer version records an explicit `superseded` decision for the previously approved one. Score is the `event_scores` view over approved state, never a counter.
- `record_checkin` — participant only, requires sharing consent, deduplicates by client id; `remove_checkins` hides history.
- `ensure_bingo_card`, `propose_bingo_incident`, `decide_bingo_incident` (commissioner; detects rows/columns/diagonals/full house for every card, first completion only), `bingo_leaderboard` (no layouts leak).
- `upsert_prediction` — rejects writes at/after `events.prediction_lock_at` (departure); `predictions_revealed` hides others until `prediction_reveal_at`; `resolve_predictions` awards closest/exact with shared ties.
- `issue_certificate` / `set_certificate_consent` / `public_certificate` — certificate stays pending until a commissioner issues it; a public recap needs commissioner publication **and** participant consent.

Storage: private bucket `evidence`, object path `{event_id}/{user_id}/{submission_id}/{file_id}.{ext}`; only the event participant may upload into their own folder while the submission is a draft/flagged; active members read through short-lived signed URLs minted server-side. Files ≤ 6 MB use signed upload URLs, larger files use resumable TUS uploads with a 6 MB chunk size, straight to storage (never through Vercel functions). Unfinished drafts persist in IndexedDB.

## Production setup

1. **Supabase project**: `npx supabase link --project-ref <ref>` then `npm run db:push` (migrations) and run `supabase/seed.sql` (SQL editor or `psql`). In **Auth → Providers → Email** disable *Allow new users to sign up*; keep magic links/OTP on. In **Auth → URL configuration** set the site URL to your origin and add `<origin>/auth/confirm` to redirect URLs. Confirm the `evidence` bucket exists and is private (the storage migration creates it).
2. **Environment** (see `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (server only, needed for invites), `NEXT_PUBLIC_APP_ORIGIN`, `NEXT_PUBLIC_LEAGUE_SLUG`, `NEXT_PUBLIC_EVENT_SLUG`, `SLEEPER_LEAGUE_ID`, `NEXT_PUBLIC_SUPABASE_RESUMABLE_URL` (`https://<ref>.storage.supabase.co/storage/v1/upload/resumable` on hosted projects), `NEXT_PUBLIC_MAP_TILE_URL` + `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION` (licensed tile provider; leave empty for the labelled static fallback).
3. **First commissioner** (trusted server step, never the first public registrant):
   ```bash
   npm run bootstrap:commissioner -- --email you@example.com --name "Your Name" [--participant]
   ```
4. **Vercel**: `vercel link`, add the environment variables above (Production + Preview), then `vercel deploy` or push to the connected GitHub repo. Node 24 is selected via `.node-version`. Private routes send `Cache-Control: private, no-store`.
5. Invite members from **Review → Members**, set the participant role and “Make event participant”, import the Sleeper league and confirm links.

## Notes on supplied data

- Event dates come from `supabase/seed.sql` / `data/league-programme.json` (user-supplied plans, not independently verified). Phase and countdowns derive from the configured event instants.
- The 2024 standings and final-game roster are shown as supplied; apparent team/result mismatches are marked “supplied · unverified” rather than corrected.
- The teaser poster is used whole (public teaser, share/download); the CSS “PB” shield covers tiny UI slots. Team marks are ESPN-hosted PNGs used as design references; the league is unofficial and not NFL-affiliated.
- Barlow is supplied in weights 400/600 only; the mockup’s 500/700 body weights are mapped to those. Barlow Condensed 500/700/900 are supplied.
