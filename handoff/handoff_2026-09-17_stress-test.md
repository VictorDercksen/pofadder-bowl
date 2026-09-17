# Pofadder Bowl 2026 · Handoff (2026-09-17, stress test and fixes)

Follow-on to `handoff_2026-09-17_map-drawer-layering.md`. Infrastructure detail still lives in `handoff_2026-09-17.md`.

## State at handoff

| Item | Value |
|---|---|
| Branch | `claude/opis5-subagents-stress-test-mv6c26` (not merged) |
| Production | https://pofadder-bowl.vercel.app deploys from `main`; unaffected until merged |
| Schema | **One new migration**: `supabase/migrations/20260917000700_stress_test_fixes.sql`. Needs `npm run db:push` from the laptop after merge. Types unchanged (no new columns or RPC signatures the app reads) |
| Env | Unchanged. `publicEnv` now trims every value |
| Tests | `npm run typecheck`, `npm run lint`, `npm test` (10 files, 51 vitest, 17 new) pass |
| Commits | `a67214e` (SQL, actions, logic, client) and the follow-up with the browser findings; PR #3 tracks the branch |

## What was asked

Launch several subagents to stress test the whole app (location updates, game mechanics, roles) and find bugs; then report and fix them.

## How the test was run

Four parallel agents, each on one layer, in the cloud sandbox (no Docker, no Supabase credentials, openstreetmap.org blocked):

1. **Database**: a bare PostgreSQL 16 cluster started from the scratchpad with shimmed `auth`/`storage` schemas and Supabase roles; all six migrations plus `seed.sql` applied; seven fixture accounts (admin+participant, commissioner, two members, removed, invited, outsider); every RPC and policy exercised as `authenticated` with the JWT claim set, including real two-connection concurrency.
2. **Server side**: adversarial read of `proxy.ts`, `league.ts`, every server action, auth routes, loaders and page guards against the Next.js 16 docs, with Zod and redirect probes run in Node.
3. **Browser**: `next build && next start`, headless Chromium through `@playwright/test`, driving `/demo`, the public routes and the real client components with fixture data at 360/390/768/1280 px.
4. **Pure logic**: throwaway vitest fuzz files over `time.ts`, `bingo.ts`, `predictions.ts`, `checkin-path.ts`, `evidence-rules.ts`, `env.ts`, `nfl.ts`, `roles.ts`/`nav.ts`, a JSON-vs-`seed.sql` cross-check, and a static read of the client components.

Every finding below was re-verified against the code before it was fixed. The new migration was applied to the agent's Postgres cluster on a clean rebuild and every reproduction re-run against it; the regression set (concurrency, anon, outsider/removed/invited, check-in constraints, prediction boundaries, kits, grants) passed.

## Bugs found and fixed

### Database (`20260917000700_stress_test_fixes.sql`)

| Severity | Bug | Fix |
|---|---|---|
| High | Every active member could read the participant's **unsubmitted drafts**: `evidence_submissions`, `evidence_files` rows and the storage objects were all member-readable, and `/press` serialised draft file rows into the page payload | `submissions_select`, `evidence_files_select` and the storage read policy now hide drafts from everyone except the submitter and commissioners (`pb_can_view_submission`). `signedMediaUrl` re-checks status. `/press` sends drafts only to the participant or a commissioner |
| High | `review_submission` **idempotency replay** ran before any authorisation (an outsider could fetch a decision row by key) and replayed a stale decision for a *different* request, so approve → flag → approve in one page load reported success while the submission stayed flagged | Role check first; a reused key must match submission, version, decision **and** the submission's current status, otherwise it raises; a concurrent same-key retry returns the same decision instead of a raw unique violation. `ReviewForm` also mints a fresh key after every decision |
| Medium | A bingo card created **after** incidents were confirmed never earned any lines (only `decide_bingo_incident` awarded wins) | Line detection moved to `pb_award_bingo_lines`; `ensure_bingo_card` runs it for the new card |
| Medium | Demoting the participant's membership role kept all participant powers (`pb_is_event_participant` only checked the event pointer) | The helper now requires an active `participant`-role membership; `set_member_role` clears `events.participant_user_id` on demotion or removal |
| Medium | `submit_submission` had no membership check: a removed member could still submit and post to the feed | Requires `pb_is_event_participant` |
| Medium | An admin could move `prediction_lock_at` after the reveal, read everyone's slip and rewrite their own | Trigger rejects changes to lock/reveal once the reveal has passed (signed-in users only; the service role keeps an escape hatch); `upsert_prediction` also refuses once revealed; check constraint `lock <= reveal` |
| Medium | A removed participant could not withdraw location consent or erase their history, while members kept seeing the positions | `location_settings` insert/update policies accept an existing own row; `remove_checkins` works on own rows without a role check and now also deletes the matching feed posts |
| Medium | Two members could claim and be confirmed on the same Sleeper manager | Partial unique index on `(league_id, sleeper_user_id)` (duplicates cleared first, confirmed one kept) plus friendly errors in `claim_sleeper_identity` and `confirm_sleeper_link` |
| Low | Check-in de-dup key was `(user_id, client_id)`, not event-scoped | Constraint is now `(event_id, user_id, client_id)` |
| Low | `resolve_predictions` awarded removed members and stacked a feed post per run | Only active memberships are scored; re-resolving replaces the announcement |
| Low | `predictions_revealed` dropped rows whose profile was hidden (departed member) | Left join, `Former member` |
| Low | `event_scores.total_challenges` was 1 for an event with no challenges | `count(cs.challenge_id)` |
| Low | One malformed storage object name broke `storage.objects` reads for everyone (unguarded `::uuid` cast) | `pb_uuid_or_null` plus a path-shape guard in every storage policy |
| Low | `evidence_files` insert policy did not bind the path to the submission and accepted any `byte_size` | Path must be `{event}/{user}/{submission}/…`; size bounded to the bucket limit |
| Low | Flagged submissions could gain files but never lose one | Delete policies (table and storage) accept `draft` or `flagged`; the uploader shows Remove on flagged |
| Low | Press prompts were only time-gated in the page | `create_submission` refuses a prompt before `opens_at` |
| Low | `handle_new_user` could abort the auth insert on an empty e-mail and copied non-string metadata into the name | Coalesce chain; only string `display_name` accepted |
| Low | `pb_is_admin`/`pb_is_event_admin` were executable by `anon` | Blanket revoke repeated at the end of the migration |

### Server actions and pages

- `signedMediaUrl` (`src/lib/actions/evidence.ts`) refuses draft files for anyone but the owner or a commissioner. `attachFile` requires the participant, pins the path to the submission folder, re-validates the size storage actually holds and removes an oversized object. `deleteDraftFile` counts deleted rows (a filtered delete returned no error and reported success) and checks the storage removal.
- `recordCheckin` reports a **duplicate** when the RPC hands back an existing row (same GPS fix sent twice) instead of "Check-in recorded"; the captured-at window error is passed through with a clock hint; `removeCheckins`/`recordCheckin` revalidate `/my-trip` and `/recap`; `revalidateEvidence` covers `/proof/[challengeId]`, `/review/[submissionId]` and `/recap`.
- `claimKit` used `c in KITS`, which accepts prototype keys (`toString`, `constructor`); now `Object.hasOwn`.
- Open redirect via the backslash form (`/\evil.com`, which browsers and Next's router resolve to another host) in `setMemberView`, the local password login, the magic-link `next` and `/auth/session`; all now use `safeInternalPath` (`src/lib/paths.ts`, tested).
- `isLocalStack` regex was unanchored (`http://localhost.attacker.com` matched); anchored.
- `fetchSleeperLeagueUsers` validates the response is a list, bounds it to 200 rows, bounds every string, and skips rows without a numeric id.
- `/review` queried `review_decisions` across all events; filtered to the event via an inner join.
- `CommissionerTools` formatted two timestamps with `toLocaleString()` (browser zone, hydration mismatch); now `formatDateTime` in the event timezone.

### Pure logic (`src/lib`)

- `evidence-rules.ts`: MIME types with codec parameters (`video/webm;codecs=vp9,opus`, which is what `MediaRecorder` reports, so **no press-room recording could be attached**) and mixed-case types were rejected; a real photo/clip/PDF type now beats a watch-export extension; `validateFile` rejects non-finite sizes; `formatBytes` no longer prints "1024 KB".
- `predictions.ts`: the slip allowed 8 h 59 m but the check constraint caps at 8 h 00 m (raw Postgres error reached the member); `isLocked` fails closed on an unparseable instant; a corrupt row no longer turns every comparison into NaN.
- `time.ts`: an unparseable event instant read as "sentence served"; now `pregame`. `countdown`/`ageLabel`/`isStale` and the formatters no longer print NaN or throw; `secondsToClock` clamps.
- `env.ts`: every public value is trimmed (a stray `\r` once broke the league slug).
- `nfl.ts`: team code lookups are case-insensitive.
- `checkin-path.ts`: same-second bursts tie-break on `received_at` then id instead of reversing.

### Client components

- `EvidenceUploader`: no in-flight guard (a second click or Retry uploaded the same bytes twice and attached two rows); rebuilt `File` objects got a fresh `lastModified`, so tus never fingerprinted the same file and **large uploads could never resume**; the IndexedDB restore could overwrite files added meanwhile and `persist` ran inside a state updater. All fixed; `lastModified` is kept in the local draft.
- `SidelineFeed`: Enter posted duplicate comments while one was pending.
- `PressRoom`: "Next question" was enabled while recording, so the clip was filed against the wrong prompt; the target prompt is pinned at record start and Next is disabled while recording; the recorder is stopped on unmount.
- `LocationSharing`: `maximumAge: 60_000` on a manual press returned the cached fix, whose client id repeats, so the second "Update location" was dropped by the RPC while the UI said it was saved. Manual presses now request a fresh fix and a duplicate is reported as such; the auto-capture throttle is shared across mounts and counts failed attempts.
- `LiveMap`: every server refresh cleared and rebuilt all markers (closing any open popup); layers are rebuilt only when the plotted content changes.
- `MediaGallery`: document/GPS downloads used `window.open` after an `await` (blocked by Safari/Firefox popup blockers); now a real download link. Freshness is re-evaluated on a timer.
- `CertificateExport`: canvas asked for `Barlow` by name but `next/font` hashes family names, so the PNG fell back to Impact/Arial; the families are read from the CSS variables and loaded before rendering.
- `Countdown`: server-rendered minute can differ from the client's; marked `suppressHydrationWarning`.
- `/bingo`: the free square was never marked on the card, so no centre line ever showed and the marked count disagreed with the leaderboard.
- `ReviewForm`, `EvidenceUploader`: `crypto.randomUUID()` is undefined on insecure origins (testing over `http://<lan-ip>`); `newId()` in `src/lib/ids.ts` falls back to `getRandomValues`.
- Demo: the "incident" marked cell 1 instead of the cell holding square 1.

### Found in the browser (headless Chromium against `next start`)

- **A rejected server action crashed the whole page.** Every `startTransition(async …)` except the check-in path awaited the action bare, so a dropped connection ("Failed to fetch") threw inside the transition and Next swapped the screen for "This page couldn't load", losing an unsent comment or slip. `callAction` in `src/lib/actions-client.ts` turns the rejection into `{ ok: false, message }`; all 32 call sites use it, and `uploadAll` catches and explains a failed draft creation (previously silent).
- **One non-finite pin coordinate destroyed the map.** `LiveMap` filtered the route through `validCoordinate` but not the pins; a bad `itinerary_items` row (no range check in the schema) took `/map` and `/game-centre` down with "Invalid LatLng object". Pins are filtered now.
- A rejected file in a multi-file pick was hidden behind the success note; the note now lists what was skipped.
- `/demo/my-trip` overflowed horizontally between roughly 700 and 900 px (the six-column standings tables); they scroll inside a `pb-table-wrap` now.
- Form fields suppressed the site's orange `:focus-visible` ring; the suppression is scoped to `:focus:not(:focus-visible)`.
- `metadataBase` was unset, so the teaser's Open Graph image resolved against localhost in every build; set from `publicEnv.appOrigin`.

## Found, not fixed (decisions for Victor)

1. **Self-review.** Victor is admin, commissioner and participant, so he can approve his own proof. Blocking it would lock reviews until Theo is a commissioner. Suggested: once Theo is in, add `if v_sub.submitter_id = auth.uid() then raise` to `review_submission`.
2. **`memberships` is readable by every member**, including `invited_email` of everyone. Column-level revoke would break the `select("*")` in `league.ts`; needs a small refactor to explicit columns.
3. **Public recap** names bingo and prediction winners with only the participant's consent. Initials or a per-member flag if that matters.
4. A kit held by a removed member stays claimed; `review_decisions.actor_id` is `on delete restrict`, so deleting a commissioner's auth user fails; backfilled bingo wins carry a null `incident_id`.
5. Raw Postgres messages still reach the UI from a few actions (`claimKit`, `claimSleeperIdentity`, `setCertificateConsent`, `savePrediction`, most of `review.ts`/`members.ts`). Intentional for RPC `raise` text; an unexpected DB error would leak a constraint name.
6. The proxy treats any `getClaims()` error as signed-out; the single-use refresh-token race described in CLAUDE.md can bounce one parallel request to `/login`. Not reproducible here.
7. Cancelling a small (≤ 6 MB) upload does not abort the transfer; the object stays orphaned in storage without an `evidence_files` row.
8. Prediction lock and reveal are the same instant in the seed, so slips reveal the moment they lock. By design, noted.
9. **Teaser poster.** In the sandbox the `/_next/image` request for the 3 MB, 1254×1254 teaser PNG never answered when the browser asked for WebP/AVIF, so `/teaser` never finished loading. Likely a sandbox worker problem (Vercel runs image optimisation on its own infrastructure), but open `/teaser` in a fresh browser on production and confirm the poster paints. A pre-compressed asset would remove the risk either way.
10. `CLAUDE.md` says `/login` and `/recap/public` prerender; `/login` is `force-dynamic` (it bounces signed-in users) and the public recap reads the database, so only `/teaser` and `/demo/*` are static. Either adjust the doc or move the signed-in bounce into the proxy.
11. Demo divergences (all deliberate previews, low): demo predictions never lock and accept 0 h 0 m; demo bingo marks your own squares and has no commissioner queue; demo approve/flag is a single toggle with no versioning; demo state resets on client-side navigation between demo screens. No skip-to-content link anywhere although `<main id="main">` exists.
12. If `getCurrentPosition` never calls back at all, the check-in button stays on "Getting GPS fix…"; browsers do fire the 20 s timeout, so this is latent.

## Verification done

- `npm run typecheck && npm run lint && npm test` green (51 tests).
- Migration: applied twice on a clean rebuild of the agent's Postgres 16 cluster (shim → six migrations → seed → fixtures → new migration), re-runnable, every reproduction listed above re-run and passing, regression set passing, and every RPC called from `src/**` still executable by `authenticated` after the final blanket revoke.
- Browser (before the fixes, then re-checked against `a67214e`): 19 public and demo pages plus 11 component harness cases at 360/390/768/1280 px; console quiet apart from the sandbox-blocked OSM tiles and the fake Realtime host; no hydration or key warnings, no duplicate ids, no `Dynamic server usage`, no 500s; every image has alt text, one `h1` per page, drawer focus trap and Escape work, the earlier drawer-over-map fix holds. Verified working for the first time: IndexedDB drafts survive a reload, certificate PNG export and the Web Share fallback, LocationSharing error paths (denied, timeout, offline, no API, weak accuracy, three rapid clicks → one request), map viewport (manual zoom kept on same-set refresh, refit on change, 500 markers in 420 ms, no "Map container is already initialized" across remounts), static-tile mode, demo-only routing, public recap 404 on junk slugs and traversal. The five browser fixes above were not re-run in Chromium after the change; they are small and covered by typecheck and lint.
- Not verified: anything served by Supabase services rather than SQL (signed URLs, TUS, GoTrue, Realtime authorisation), the storage policies against the real storage-api, and the `pb-member-view` cookie against a live session.

## Suggested checks on production (after `db:push`)

1. Sign in as a plain member: `/press` shows "Answer draft." with no file rows in the page source while Victor has an unsubmitted answer; `/proof` and `/review` still work for Victor.
2. As Victor with sharing on, press "Update location" twice from the same spot: the second press says "Same GPS fix as the last check-in", not "saved".
3. Record a press answer in the page and attach it: the WebM clip is accepted (previously "Unsupported file type (video/webm;codecs=…)").
4. Open `/bingo`: the centre square shows as marked and the count matches the leaderboard.
5. Review flow: approve, flag, approve the same submission in one page load without reloading; the third decision must apply.
6. Export the certificate PNG: the headline renders in Barlow Condensed, not Impact.

## Still open (carried forward)

1. Invite Theo (TheoLotter) as commissioner, not admin; then consider the self-review guard above.
2. Custom SMTP (Resend / Postmark) before inviting the remaining managers.
3. Optional keyed tile provider if OSM usage ever becomes heavy.
4. Unexercised in a browser against a backend: TUS uploads over 6 MB, IndexedDB drafts, MediaRecorder press answers, Web Share.
