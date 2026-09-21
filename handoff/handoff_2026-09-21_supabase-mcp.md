# Pofadder Bowl 2026 · Handoff (2026-09-21, Supabase MCP config)

Follow-on to `handoff_2026-09-21_testing-reset-production-branch.md`.

## State at handoff

Branch `claude/production-branch-setup-fmhvcc`. No code, schema or env changes; only `.mcp.json`.

## What was done

`.mcp.json` (project scope, committed) now registers the Supabase MCP server as

```
https://mcp.supabase.com/mcp?features=docs,account,database,debugging,development,functions,branching
```

added with `claude mcp add --scope project --transport http supabase "<url>"`. The previous entry pinned `project_ref=nsiqnqlkaelskimjeyed` and `read_only=true`. The new one is account-wide and not read-only, which is what the two-project setup (testing and league) needs, but it means a session that authorises the server can write to either project. Keep the "no `supabase db push` from cloud sessions" rule; migrations still go through `supabase/migrations/`.

The server authenticates by OAuth when a session offers it; this session could not (non-interactive), so the tools were not exercised.

## Suggested checks

1. In an interactive session, `/mcp` shows `supabase` and completes the OAuth flow; the tool list includes docs, account and database tools.
2. Cloud environment network policy still allows `mcp.supabase.com`.

## Still open

Unchanged from the previous handoff.
