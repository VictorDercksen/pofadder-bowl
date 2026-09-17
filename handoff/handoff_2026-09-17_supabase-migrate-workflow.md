# Pofadder Bowl 2026 · Handoff (2026-09-17, automatic schema pushes)

Follow-on to `handoff_2026-09-17_password-gate-fix.md` (merged to `main` as 7900a5a).

## State at handoff

| Item | Value |
|---|---|
| Branch | `claude/first-time-password-setup-mb3xwh` (workflow commit on top; merge to `main` pending) |
| Schema | Unchanged; `20260917000900_password_gate.sql` still **not applied** to the hosted project |
| Env | **Three new repository secrets needed** (GitHub, not Vercel): `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD` |
| Tests | No app code changed; `npm run typecheck && npm run lint && npm test` still green from the previous commit |

## What was asked

Why `db:push` does not happen automatically, and set up the Supabase GitHub path.

## What was added

`.github/workflows/supabase-migrate.yml`:

- Triggers on a push to `main` that touches `supabase/migrations/**` (or the workflow itself), and on `workflow_dispatch` with a `dry_run` option.
- Steps: check the three secrets exist (clear error instead of a CLI prompt hanging), `supabase/setup-cli`, `supabase link --project-ref`, `supabase migration list --linked`, then `supabase db push` (or `--dry-run`), then the list again.
- One concurrency group, no cancellation, so two merges queue instead of racing.
- The CLI applies only migrations absent from `supabase_migrations.schema_migrations`, so reruns are no-ops. Vercel deploys in parallel, so migrations must stay backward compatible with the previous deploy (the app's RPC fallbacks already follow that rule).

README ("Schema deploys") and the CLAUDE.md workflow rule updated.

Not chosen: Supabase's dashboard GitHub integration (needs the paid Branching add-on) and running the push from the Vercel build (puts the DB password in Vercel, runs on previews, and a mid-build failure leaves a half deploy).

## Victor's steps

1. Add the three secrets under the repo's **Settings → Secrets and variables → Actions**. The access token is created at supabase.com → account → Access Tokens; the project ref is `nsiqnqlkaelskimjeyed`; the database password is the one in `.env.hosted` on the laptop (reset it under Project Settings → Database if unknown).
2. Merge this branch to `main` (the workflow only exists for GitHub once it is on the default branch).
3. Actions → **Supabase migrations** → Run workflow, first with dry run ticked to see `20260917000900_password_gate.sql` listed, then without. From then on it runs itself on merges.

## Verified

- YAML parses; step conditions and secret checks reviewed by hand.
- Not verified: an actual run (no GitHub Actions or Supabase access from the sandbox). If `supabase link` warns about config differences between `supabase/config.toml` and the hosted project, that is informational and does not stop `db push`.

## Still open

- Carried forward: SMTP, invite Theo as commissioner, Sleeper bracket snapshot, self-review guard, `memberships.invited_email` visibility.
