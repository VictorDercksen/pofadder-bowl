# Pofadder Bowl 2026 · Handoff (2026-09-21, league environment and production branch)

Follow-on to `handoff_2026-09-21_testing-reset-production-branch.md` and `handoff_2026-09-21_supabase-mcp.md`. This session carried out the "Setting up the league (production) environment" steps from the laptop, as far as the session's permissions allowed. Infrastructure detail for the testing project still lives in `handoff_2026-09-17.md`.

## State at handoff

| Item | Value |
|---|---|
| Branches | `main` (testing) and the new `production` (league), both at the commit that adds this file. `production` is pushed. The commit on `main` is local only: push it after L3, because until then the league Vercel project builds its Production deployment from `main` |
| Testing | https://pofadder-bowl.vercel.app, Vercel project `pofadder-bowl` (`prj_GWtFdazjISRc38qW8e1u29HDJK0t`), Supabase `nsiqnqlkaelskimjeyed`. **`PB_TESTING_RESET` is not set yet** (step L4 below) |
| League | Vercel project `pofadder-bowl-league` (`prj_RqhbVt8SIkBfLi28m2vfSVqD6Ema`, scope `victor-4043s-projects`), Supabase project `pofadder-bowl-league`, ref `xfjzfghfytraydwbxcjt`, org "Pofadder Bowl", eu-central-1, free tier. **Database is empty and the deployment is not usable yet** (steps L1 to L3) |
| Schema | No new migrations |
| Env | New ignored file `.env.league` in the repo folder, holding only `SUPABASE_DB_PASSWORD` for the league database (generated this session) |
| Code | None changed; README gets the concrete project names |

## What was asked

Read the latest handoff and implement the production branch and the two environments.

## What was done

1. **Supabase league project** created with the CLI: `pofadder-bowl-league`, ref `xfjzfghfytraydwbxcjt`. The generated database password is in `.env.league`.
2. **Dry run of the schema push** against the league project: all 23 migrations (`20260916000100_schema.sql` to `20260921000200_testing_reset.sql`) plus `supabase/seed.sql` are pending. The real push was not run (see "Not done").
3. **Supabase CLI relinked to testing** afterwards. `supabase/.temp/project-ref` reads `nsiqnqlkaelskimjeyed`, so `npm run db:push` from this folder still targets testing.
4. **Vercel league project** created and connected to `github.com/VictorDercksen/pofadder-bowl`. It was linked from a scratch folder, so the repo's `.vercel/project.json` still points at the testing project. `vercel.json` supplies `framework: nextjs` and `fra1`.
5. **Vercel league env vars (Production)**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_RESUMABLE_URL` (both on the new ref), `NEXT_PUBLIC_APP_ORIGIN=https://pofadder-bowl-league.vercel.app`, and the testing values of `NEXT_PUBLIC_LEAGUE_SLUG`, `NEXT_PUBLIC_EVENT_SLUG`, `SLEEPER_LEAGUE_ID`, `NEXT_PUBLIC_MAP_TILE_URL`, `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION`, `NEXT_PUBLIC_DEMO_ONLY`. Values were piped without a trailing newline. `PB_TESTING_RESET` is not set there.
6. **GitHub environments** `testing` and `league` created. Each holds `SUPABASE_PROJECT_REF` and `SUPABASE_DB_PASSWORD` for its project. `SUPABASE_ACCESS_TOKEN` is missing from both, and there are no repository-level secrets, so the manual migration workflow cannot run yet.
7. **`production` branch** created from `main` and pushed to `origin`.

## Not done, and why

The session's permission classifier refused three actions. They were not worked around.

- Fetching the league project's API keys and writing them to `.env.league` (credential handling).
- `supabase db push --include-seed` with auto-confirmation on the league database.
- Adding `PB_TESTING_RESET=true` to the existing `pofadder-bowl` Vercel project (change to a shared resource).

The Vercel CLI (48.0.2) has no flag for the production branch, and the Supabase auth settings need the dashboard or a management API token, so those are manual too.

## Remaining steps for Victor

- **L1. Push schema and seed to the league database.** From the repo folder in a terminal:
  ```bash
  export SUPABASE_DB_PASSWORD=$(grep '^SUPABASE_DB_PASSWORD=' .env.league | cut -d= -f2)
  npx supabase link --project-ref xfjzfghfytraydwbxcjt
  npx supabase db push --include-seed        # expect 23 migrations + supabase/seed.sql, answer Y
  export SUPABASE_DB_PASSWORD=$(grep '^SUPABASE_DB_PASSWORD=' .env.local | cut -d= -f2)
  npx supabase link --project-ref nsiqnqlkaelskimjeyed   # relink to testing
  ```
  Never run `seed:local-fixtures` against the league project.
- **L2. League API keys on Vercel.** `npx supabase projects api-keys --project-ref xfjzfghfytraydwbxcjt`. Testing uses the legacy JWT keys (`anon`, `service_role`), so use the same pair. In the Vercel dashboard for `pofadder-bowl-league` add `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (anon) and `SUPABASE_SECRET_KEY` (service_role) for Production. Add the URL and both keys to `.env.league` as well (LF line endings).
- **L3. Production branch.** Vercel → `pofadder-bowl-league` → Settings → Git → Production Branch = `production`. Until this is changed, a push to `main` builds a Production deployment of the league project from `main`. Then use Deployments → Redeploy on the latest `production` commit. Optional: give the league project Preview variables that point at the testing Supabase project with `PB_TESTING_RESET=true`, or disable its preview builds with an Ignored Build Step, because both Vercel projects now build every pushed branch.
- **L4. Testing flag.** On the `pofadder-bowl` Vercel project add `PB_TESTING_RESET=true` for Production and Preview (`printf 'true' | vercel env add PB_TESTING_RESET production`, same for `preview`, from the repo folder), then redeploy `main`.
- **L5. League auth settings.** Supabase dashboard → `pofadder-bowl-league` → Authentication: "Allow new users to sign up" off, email provider on, Site URL `https://pofadder-bowl-league.vercel.app`, redirect URL `https://pofadder-bowl-league.vercel.app/auth/confirm`, custom SMTP. Confirm the private `evidence` bucket exists after L1.
- **L6. First admin.** With the league URL and service-role key in the environment (the script reads `.env.local`; export the league values for that run): `npm run bootstrap:commissioner -- --email victordercksen@gmail.com --name "Victor Dercksen" --participant`. Sign in, set a password, choose the kit, import the Sleeper league, invite Theo as commissioner and the managers.
- **L7. Migration paths.** Connect the Supabase GitHub integration on the league project with branch `production` (dashboard → Project Settings → Integrations). For the manual workflow add `SUPABASE_ACCESS_TOKEN` (https://supabase.com/dashboard/account/tokens) to both GitHub environments.
- **L8. Promotion from now on.** `git checkout production && git merge --ff-only main && git push`.

## Verified

- `supabase projects list` shows both projects `ACTIVE_HEALTHY`; the dry run lists the 23 migrations and the seed for the league ref.
- `vercel env ls` on `pofadder-bowl-league` shows the nine Production variables listed above.
- `gh secret list --env league` and `--env testing` show the two secrets each.
- `supabase/.temp/project-ref` and `.vercel/project.json` in the repo both point at testing.
- Not verified: anything on the league deployment, because it has no keys, no schema and the wrong production branch until L1 to L3 are done. After L1 to L3, check that `/login` returns 200, `/game-centre` redirects to `/login`, no TESTING banner shows, and `select count(*) from challenges` returns 10.
- `npm run typecheck && npm run lint && npm test` were not rerun. This commit changes only this file and the README.

## Still open

1. L1 to L7 above.
2. Carried forward unchanged: SQL kill switch for `reset_event_data` on the league database, Content-Security-Policy, `/setup` redirect, the four "noted, not changed" review items, regenerate `database.types.ts`, run the integration tests on the local stack, custom SMTP.
