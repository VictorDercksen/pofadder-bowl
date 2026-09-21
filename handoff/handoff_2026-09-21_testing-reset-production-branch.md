# Pofadder Bowl 2026 · Handoff (2026-09-21, testing reset and the production branch)

Follow-on to `handoff_2026-09-21_auth-routing-security-review.md`. Infrastructure detail still lives in `handoff_2026-09-17.md`.

## State at handoff

| Item | Value |
|---|---|
| Branch | `claude/production-branch-setup-fmhvcc`, started from `main` at `a51beae` (main merged in first) |
| Production | https://pofadder-bowl.vercel.app still deploys from `main` and still points at the existing Supabase project with dummy data; nothing deployed from this branch. After this lands, that deployment becomes the **testing** deployment once `PB_TESTING_RESET=true` is set on it |
| Schema | New migration `20260921000200_testing_reset.sql` (one new function, backward compatible) |
| Env | New server-only flag `PB_TESTING_RESET` (see `.env.example`). Unset means off |
| Tests | `npm run typecheck`, `npm run lint`, `npm test` (156 vitest, 2 new) pass. `npx next build` passes. Integration tests not run (no Docker daemon in the sandbox); the SQL was exercised on a plain Postgres 16 instead, see "Verified" |

## What was asked

1. Pull `main` before starting.
2. Keep `main` as the testing branch with the dummy data, and add an admin-only button that resets everything so testing can start again.
3. Explain how to set up the real production branch and environment to share with the league.

## What was done

### Reset RPC (`supabase/migrations/20260921000200_testing_reset.sql`)

`reset_event_data(p_event uuid, p_confirm_slug text, p_reset_tours boolean default false) returns jsonb`, security definer, `search_path = public`, revoked from `public, anon`, granted to `authenticated`.

- Refuses unless `pb_is_event_admin(p_event)` (errcode 42501) and unless `p_confirm_slug` equals the event's slug (errcode 22023). Locks the event row for the duration.
- Deletes for the event: `activity_posts` (reactions cascade), `evidence_submissions` (files and review decisions cascade), `checkins`, `member_locations`, `location_settings`, `prop_picks`, `predictions`, `prediction_awards`, `official_results`.
- Resets in place: `props.result/settled_by/settled_at` to null, `penalties.applied/applied_by/applied_at/note` to their defaults, `certificates` back to `pending` with no consent, not public, empty summary (row is created if missing).
- With `p_reset_tours`, sets `profiles.tutorial_completed_at/tutorial_version` to null for every membership of the league, so everyone gets the first-run tour again.
- Keeps: leagues, events, memberships, profiles (name, kit), Sleeper links, itinerary, challenges, penalty texts, press prompts, props, prediction rules.
- Returns counts per table plus `storage_paths`, the `evidence_files.storage_path` values that were deleted, for the action to remove from the bucket.

### Server action (`src/lib/actions/testing.ts`)

`resetTestingData({ confirm, resetTours })`: Zod-validated, refuses unless `testingResetEnabled()`, unless `ctx.isAdmin`, and unless `confirm === ctx.event.slug`. Calls the RPC, then removes the returned storage paths from the `evidence` bucket in batches of 100 with the service-role client. If `SUPABASE_SECRET_KEY` is missing or a batch fails, the rows are already gone; the message says how many objects were left orphaned. Ends with `revalidatePath("/", "layout")`.

### Flag (`src/lib/env.ts`)

`parseFlag(value)` (pure, unit tested: true/1/yes/on, trimmed, any case) and `testingResetEnabled()` (server only, reads `PB_TESTING_RESET`). Only `env.ts` reads `process.env`, as before.

### UI

- `src/components/review/TestingReset.tsx` (client): explanation, "Also reset every member's first-run tour" checkbox, a field where the admin must type the event slug, and an orange **Reset the event** button that stays disabled until the slug matches. Result goes to the toast and the router refreshes.
- `src/app/(league)/review/members/page.tsx`: renders the **Testing reset** panel (orange border, `pb-testing-panel`) only when the flag is on. The page is already `requireAdmin`.
- `src/app/(league)/layout.tsx`: a gold **TESTING · Dummy data only** banner (`pb-testing-banner`) under the header on every private screen when the flag is on, so nobody mistakes the two deployments.
- CSS: three rules at the end of `globals.css`.

### Migration workflow (`.github/workflows/supabase-migrate.yml`)

New `target` input (`testing` or `league`) that selects a GitHub **environment** of the same name; the job's `SUPABASE_*` secrets resolve from that environment, falling back to repository secrets. Concurrency group is now per target.

### Docs

README: new "Testing and league environments" section and the updated schema-deploy paragraph; `PB_TESTING_RESET` in the environment list. CLAUDE.md: branch rule and a "Testing reset" row in "Where things live". `.env.example`: the new flag. `scripts/integration-test.ts`: a final test (commissioner refused, wrong slug refused, admin reset empties eight tables, certificate pending, props unsettled, programme and roster survive).

## Verified

- `npm run typecheck`, `npm run lint`, `npm test`, `npx next build` in the sandbox.
- SQL: the sandbox has Postgres 16 but no Docker, so all 23 migrations and `seed.sql` were applied to a fresh database with a stubbed `auth`/`storage` schema (`auth.uid()` reading `request.jwt.claim.sub`). With two users (one admin+participant, one member), a draft submission with a file, a comment, a check-in, a prediction, settled props, applied penalties and an issued public certificate: the member's call failed with "only a league admin can reset event data"; the admin's call with a wrong slug failed with "confirmation does not match the event slug"; the admin's call with the right slug returned `{"posts": 1, "checkins": 1, "predictions": 1, "submissions": 1, "storage_paths": ["evt/usr/sub/file1.jpg"], "tours": 2, …}` and afterwards every activity table was empty, props unsettled, penalties unapplied, certificate `pending/false`, both tours cleared, 10 challenges, 10 props and 2 memberships intact. `has_function_privilege('anon', …)` is false, `authenticated` true.
- Not verified: the panel in a browser (needs a signed-in admin), the storage removal against a real bucket, the integration test file against the local stack, and the workflow's environment selection on GitHub.

## Suggested checks on the testing deployment

1. Set `PB_TESTING_RESET=true` on the Vercel project for `main` (Production environment of that project), redeploy. Every private screen shows the gold TESTING banner; Review → Members shows the Testing reset panel at the bottom of the right column.
2. As admin, with a couple of submissions, comments and picks in place: type a wrong slug, the button stays disabled; type `pofadder-bowl-2026`, click Reset. The toast lists what was removed. Game centre feed, proof locker, map, prop board and predictions are empty; the certificate is pending; Storage → evidence has no objects under the event folder.
3. Tick "Also reset every member's first-run tour" and reset again: the tour starts on the next navigation for every account.
4. In league member view, or as a commissioner, `/review/members` is not reachable, so the panel is not either.
5. On a deployment without the flag, the panel and banner are absent, and calling the action returns "The reset is only available on the testing deployment".

## Setting up the league (production) environment

Nothing in this branch creates the second environment; these are the manual steps (the Vercel and Supabase MCP servers were not authorised in this session).

1. **Supabase**: create a second project in the "Pofadder Bowl" org (eu-central-1, free tier allows two). Apply the schema either by connecting the Supabase GitHub integration to this repo with branch `production` (it will run all migrations on the first push), or from the laptop: `npx supabase link --project-ref <new-ref>` then `npm run db:push`, then run `supabase/seed.sql` in the SQL editor. Auth: `Allow new users to sign up` off, email provider on, site URL and `<origin>/auth/confirm` in redirect URLs, custom SMTP configured (the built-in mailer will not reach the league). Confirm the `evidence` bucket exists and is private.
2. **Branch**: `git checkout main && git pull && git checkout -b production && git push -u origin production`. Protect it on GitHub if you like (require the fast-forward from `main`).
3. **Vercel**: create a second project from the same GitHub repo (Add New → Project → import `pofadder-bowl` again), set its Production Branch to `production` (Settings → Git), region stays `fra1` from `vercel.json`. Environment variables (Production): the new project's `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_RESUMABLE_URL` (`https://<new-ref>.storage.supabase.co/storage/v1/upload/resumable`), `NEXT_PUBLIC_APP_ORIGIN` (the new project's domain), the two slugs, `SLEEPER_LEAGUE_ID`, map variables as on testing. **Do not set `PB_TESTING_RESET`.** Set "Ignored Build Step" or leave previews on; previews of feature branches will build against whichever project's Preview env vars you give them (point Preview at the testing Supabase project).
4. **Existing project becomes testing**: on the current `pofadder-bowl` Vercel project add `PB_TESTING_RESET=true` (Production and Preview). Its production branch stays `main`.
5. **First admin on the league project**: from the laptop with an `.env.league` holding the new URL and secret key, `npm run bootstrap:commissioner -- --email victordercksen@gmail.com --name "Victor Dercksen" --participant` (the script reads `.env.local`; copy the league values in for that run, or export them in the shell). Then sign in, set a password, choose the kit, import the Sleeper league, invite Theo as commissioner and the managers.
6. **Migrations for the league project**: either the Supabase GitHub integration on branch `production`, or the manual workflow with target `league` after creating the GitHub environment `league` with its three secrets (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`). Create the `testing` environment too, holding the current repository secrets, or leave the repository secrets in place as the fallback.
7. **Promotion**: test on `main`, then `git checkout production && git merge --ff-only main && git push`. Vercel deploys the league project; migrations follow through the integration or the workflow. Migrations stay backward compatible because both projects build in parallel with their databases.

Alternative to step 3: keep one Vercel project, switch its Production Branch to `production`, and give the `main` branch its own Preview environment variables (Vercel scopes Preview variables per branch). Two projects are recommended because the env split is explicit and both URLs stay stable.

## Still open

1. The `reset_event_data` function also exists on the league database once the migration lands there. Only an admin can call it and the slug must match, but there is no server-side kill switch in SQL. If wanted, a `league_settings.testing boolean` column checked inside the function would make it refuse on the league project even from the SQL editor.
2. Storage removal happens after the rows are deleted; an orphaned object costs nothing but stays until removed by hand from the dashboard.
3. Carried forward from the previous handoff: Content-Security-Policy, `/setup` redirect, the four "noted, not changed" review items, regenerate `database.types.ts` (the new RPC type was added by hand), run the integration tests on the local stack, custom SMTP.
