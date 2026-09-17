# Agent instructions

Project instructions for every coding agent live in `CLAUDE.md` at the repo root: workflow rules (read the newest `handoff/` file first, write a handoff before every commit, verification commands), stack practices for Next.js 16, Supabase, Zod 4 and Leaflet, and where things live. Read `CLAUDE.md` in full before working.

The block below is managed by Next.js and points at the version-matched framework docs. Leave it in place.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
