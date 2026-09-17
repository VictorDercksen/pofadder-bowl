#!/bin/bash
# Setup script for Claude Code cloud environments (claude.ai/code → environment → setup script).
# Runs once per environment and is cached. Credentials are injected by Anthropic's proxy for
# api.vercel.com and api.supabase.com; nothing secret belongs in this file or in env vars.
set -u
npm ci || npm install
npm i -g vercel supabase || true
npx playwright install --with-deps chromium || true
