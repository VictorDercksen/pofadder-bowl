# Pofadder Bowl 2026 · Handoff (2026-09-21, league environment follow-up)

Follow-on to `handoff_2026-09-21_league-environment.md`. Victor approved the three steps that were refused earlier in the same session, so L1, L2 and L4 from that handoff are now done. Read that file for the project names, refs and the remaining manual steps.

## State at handoff

| Item | Value |
|---|---|
| Branches | `main` and `production` at the commit that adds this file. `production` is pushed. `origin/main` is at `ff3ce9b` (Victor pushed the first league handoff during the session), so local `main` is one commit ahead with this file: push it after L3 |
| League database | `xfjzfghfytraydwbxcjt`: all 23 migrations and `supabase/seed.sql` applied |
| League Vercel project | `pofadder-bowl-league` now has all eleven Production variables, including `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` (legacy JWT `anon` and `service_role` keys, the same style as testing). Production branch is still `main` (L3) |
| Testing Vercel project | `pofadder-bowl` has `PB_TESTING_RESET=true` for Production and Preview. It takes effect on the next deployment of `main` |
| Env | `.env.league` (ignored, LF) now holds the full league variable set plus `SUPABASE_PROJECT_REF` and `SUPABASE_DB_PASSWORD` |
| Code, schema | No changes |

## What was done

1. **L1**: `supabase link` to the league ref, `supabase db push --include-seed --yes`, then relinked to testing. `supabase/.temp/project-ref` reads `nsiqnqlkaelskimjeyed` again.
2. **L2**: league API keys fetched with `supabase projects api-keys`, written to `.env.league` and piped into `vercel env add … production` from the scratch link folder, without trailing newlines.
3. **L4**: `PB_TESTING_RESET=true` added to `pofadder-bowl` for Production and Preview. No redeploy was triggered.

## Verified

- `psql` against the league pooler: 10 challenges, 10 props, 1 event, 0 memberships, 12 613 settlements, one private `evidence` bucket.
- `vercel env ls` shows `PB_TESTING_RESET` on `pofadder-bowl` for both environments, and the two key variables were reported as added on `pofadder-bowl-league`.
- Not verified: the league deployment in a browser (needs L3 first), and the TESTING banner on the testing deployment (needs a deployment of `main`).

## Still open

1. **L3** production branch = `production` on `pofadder-bowl-league`, then redeploy and push `main`. Pushing `main` also redeploys testing with the flag.
2. **L5** league auth settings and custom SMTP, **L6** bootstrap the first admin (memberships is 0), **L7** Supabase GitHub integration on `production` and `SUPABASE_ACCESS_TOKEN` in both GitHub environments.
3. Carried forward unchanged from the earlier handoffs.
