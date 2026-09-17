# Pofadder Bowl 2026 · Handoff (2026-09-17, session 3: agent instructions)

Follow-on to `handoff_2026-09-17_member-view-and-map.md`. No application code changed.

## State at handoff

| Item | Value |
|---|---|
| Branch | `claude/league-view-map-checkins-567r8u`, one commit ahead of `main` (this one) |
| Schema / env | Unchanged |
| Checks | Markdown only; `npm run typecheck && npm run lint && npm test` still green from the previous commit |

## What was done

- `CLAUDE.md` is now the project instruction file: session start routine (newest `handoff/` file first), workflow rules (a handoff before every commit, verification commands, branch and secret hygiene, no deploys from the cloud), stack table, Next.js 16 practices taken from the bundled docs (`node_modules/next/dist/docs`: async request APIs, proxy instead of middleware, server action security, dynamic rendering, `next typegen`, compiler-era hooks rules), Supabase practices (`@supabase/ssr` guidance on `getClaims`, single-use refresh tokens, RLS and security-definer RPCs as the enforcement layer, migrations and type generation, Realtime, auth config gotchas), roles and the member view, Zod 4 validators, map rules, design system, testing and cloud-sandbox notes, and a "where things live" table. It ends with `@AGENTS.md` so the Next.js managed block is pulled in.
- `AGENTS.md` now opens with a pointer to `CLAUDE.md` for agents that read `AGENTS.md` first (Codex, Cursor, Copilot), followed by the untouched Next.js managed block. Verified with `hasCurrentAgentRules()` from `generate-agent-files.js` that `next dev` still recognises the block and will not rewrite the file.

## Research sources

- Next.js: `02-guides/upgrading/version-16.md`, `02-guides/ai-agents.md`, `02-guides/data-security.md`, `02-guides/server-actions.md`, `02-guides/production-checklist.md`, `01-getting-started/16-proxy.md`, `03-api-reference/04-functions/cookies.md` in `node_modules/next/dist/docs/01-app`.
- Supabase: `node_modules/@supabase/ssr/README.md` and the `setAll` / `getClaims` notes in `dist/main/types.d.ts` (supabase.com is blocked from the cloud sandbox).
- Zod 4 deprecations from `node_modules/zod/v4/classic/schemas.d.ts`.

## Still open

Unchanged from the previous handoff: invite Theo as commissioner, custom SMTP before inviting the league, optional keyed tile provider, browser pass over uploads / drafts / press recorder / certificate export.
