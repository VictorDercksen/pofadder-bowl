# UI, UX and security improvements

## State at handoff

The user requested implementation of the twelve review findings, UI polish, removal of the production teaser's interactive demo button, and pushes to both main and production after checks pass. Work started on production at 846d021. Both remote branches were fetched and matched that commit. Changes were moved to main for the commit, to be promoted to production by fast-forward.

Migration `20260921000300_review_safeguards.sql` was applied to local Supabase and database types were regenerated from it. No hosted database configuration or schema was changed during local verification. Branch pushes trigger the configured deployment integrations. Confirm their results separately.

## Changes

1. F1 adds a database reset switch, disabled by default even for direct admin RPC calls. Only trusted SQL or service-role access can enable it.
2. F2 permits camera and microphone on `/press`, while keeping them disabled on other routes.
3. F3 retains the newly created submission ID when starting replacement proof. Uploaded files render once after the server refresh.
4. F4 uses TUS above 6 MB, retains object identity and upload fingerprints across retries, and checks for already completed transfers before repeating them. The maximum remains 50 MB for audio/video and 25 MB for other evidence.
5. F5 keeps the confirmed location-sharing setting until the server accepts a change. Failed changes show an error and retain the previous state.
6. F6 validates direct evidence attachment inserts and updates against actual storage metadata and submission ownership. Submitting also rejects missing or changed objects.
7. F7 limits membership details to their owner and admins. A scoped roster RPC supplies claimed Sleeper identities without invitation addresses.
8. F8 saves captions, ratings and files together, serialises local saves, restores before accepting edits, and preserves caption changes during uploads.
9. F9 chooses flagged proof, drafts and unstarted challenges before pending submissions. My Trip loads up to 50 check-ins for history management.
10. F10 improves mobile text, touch targets, file wrapping, panel spacing and upload instructions. Predictions distinguish unsaved edits from confirmed saves.
11. F11 surfaces core query failures through retry screens and keeps the existing feed visible during refresh failures.
12. F12 adds CI build, database and browser checks, runs typecheck/lint/unit tests before every npm build, and restricts manual migration targets to their intended branches.

The production teaser hides Interactive demo. Development, testing with `PB_TESTING_RESET=true`, and demo-only builds retain the link. The demo routes remain available directly.

Implementation lives in the evidence uploader/actions/upload client, location and prediction controls, core loaders, next-play helper, appended globals.css rules, Next headers, env helper, migration and workflows. README documents the verification commands and database switch.

## Verification

1. `npm run build` passed, including typecheck, ESLint and 160 unit tests across 23 files.
2. The local integration suite passed all 27 checks, including reset-switch enforcement, roster privacy, attachment metadata validation, missing objects, storage permissions and existing review/prediction workflows.
3. The final built app passed `scripts/browser-review-test.ts` against local fixtures. Checks covered production teaser visibility, recording policy headers, draft caption/rating recovery, a deliberately interrupted 7 MB resumable upload, caption edits during transfer, exactly two proof versions, failed location updates and prediction save feedback.
4. Browser checks covered My Trip, Proof, Predictions, Review, Game Centre and Props at 360, 390 and 1280 pixels with no horizontal overflow or page errors. Screenshots remain under ignored `screenshots/`. Proof detail was visually inspected.

Local test environment files were separate from `.env.local`. No tests targeted hosted Supabase. Browser checks replace only the local fixture participant's challenge-six evidence, but also seed local accounts and set local prediction deadlines. Integration tests reset local fixture event data.

The build retains an existing metadataBase warning. Physical phone camera/microphone hardware, real mobile network conditions and hosted CI execution were not covered by the local runs.

## Deployment checks

1. Apply the new migration through the configured Supabase integration or approved migration workflow on each corresponding branch. The app's new roster RPC requires it.
2. On the testing database only, trusted SQL must run `update public.deployment_settings set testing_reset_enabled = true where singleton;` to restore the testing reset capability. Keep `PB_TESTING_RESET=true` on the testing app.
3. Leave the league database switch false and the league app's `PB_TESTING_RESET` unset. Confirm that the production teaser has no demo button and the testing teaser retains it.
4. Verify hosted build and migration results after branch pushes. Repository branch protection, SMTP, initial league admin setup and other infrastructure items from earlier handoffs were not changed here.

No unrelated files under the existing untracked `.claude/` or `.codex/` directories belong in this commit.
