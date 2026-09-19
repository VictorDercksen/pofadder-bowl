# Pofadder Bowl 2026 · Handoff (2026-09-19, automatic migrations through the Supabase GitHub integration)

Follow-on to `handoff_2026-09-18_generate-props.md`. Integration detail is in `handoff_2026-09-17_supabase-migrate-workflow.md`.

## State at handoff

| Item | Value |
|---|---|
| Branch | `main` (this commit) |
| Production | `20260917001000_prop_board` is applied (the `props` table exists: `/props` shows the empty-board notice). `20260918000100_generate_props` was **not** applied: pressing "Generate the board" fails with `Could not find the function public.upsert_props(p_event, p_props) in the schema cache` |
| Schema | No new migration. The pending one gained a two-line header comment so this push touches `supabase/migrations/` and starts the integration |
| Secrets | The manual workflow `Supabase migrations` ran once (dry run) and failed at "Check secrets": `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF` are not set on the repository |
| Tests | Unchanged code; typecheck, lint and unit tests green from the previous commit |

## What was asked

Victor reconnected the Supabase GitHub integration and asked for automatic migrations to be set up.

## What was done

Nothing on the Supabase side can be changed from the repo. The integration is configured in the dashboard (Project Settings → Integrations → GitHub: repository, production branch `main`, Supabase directory `supabase`, "deploy to production on merge"). It applies `supabase/migrations/` when a push to `main` changes files under `supabase/`. The pending migration was already on `main` before the integration was reconnected, so nothing triggered it. This commit touches the pending migration (comment only) to fire the integration.

## Check after this push

1. GitHub: the commit on `main` gets a "Supabase" check or commit status from the integration. If none appears within a few minutes, the integration is not watching this repository or branch: re-check the dashboard settings above (production branch must be `main`, directory `supabase`).
2. Supabase dashboard → Database → Migrations: `20260918000100_generate_props` listed.
3. `/props` as Victor: "Generate the board" creates ten props.

If the integration runs but fails, the likely cause is migration history: the CLI applies every version missing from `supabase_migrations.schema_migrations`. If earlier migrations were applied by pasting SQL rather than `db push`, they are not recorded and the run will try to re-create existing tables. Fix from the laptop with `supabase migration repair --status applied <version>` for each already-applied version, then re-run.

## Watch: config sync

`supabase/config.toml` carries local values (`site_url = "http://localhost:3000"`, localhost redirect URLs). If the integration is set to sync configuration to production as well as migrations, those would overwrite the hosted auth URLs and break magic links. After the first run, confirm Authentication → URL Configuration still shows the Vercel origin. If it changed, turn off config sync in the integration settings and restore the URLs.

## Fallbacks (unchanged)

- Laptop: `git pull && npm run db:push`.
- SQL editor: paste `supabase/migrations/20260918000100_generate_props.sql` and run it; safe to repeat. Then `notify pgrst, 'reload schema';` if the API still reports the function missing.
- Manual workflow: set the three repository secrets (names above; token from Account → Access Tokens, ref `nsiqnqlkaelskimjeyed`, database password from Project Settings → Database), then Actions → Supabase migrations → Run workflow.

## Still open

- Regenerate `database.types.ts` from the hosted schema.
- Carried forward: invite Theo as commissioner; custom SMTP.
