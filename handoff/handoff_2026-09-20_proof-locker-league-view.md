# Pofadder Bowl 2026 · Handoff (2026-09-20, proof locker: read-only league view)

Follow-on to `handoff_2026-09-20_tour-colours-sideline-claims.md` and `handoff_2026-09-20_settlements-place-labels.md`. Infrastructure detail still lives in `handoff_2026-09-17.md`.

## State at handoff

| Item | Value |
|---|---|
| Branch | `claude/proof-locker-readonly-view-celw4j`, started from `main` at `ed99c7e` (no PR opened) |
| Production | https://pofadder-bowl.vercel.app deploys from `main`; unaffected until merged |
| Schema | **Unchanged.** No migration. Row-level security already lets active members read submitted, approved, flagged and superseded submissions, their files, the review decisions and the signed media URLs (`20260917000700_stress_test_fixes.sql`, `pb_can_view_submission`). Drafts stay private to the submitter and commissioners |
| Types | Unchanged |
| Env | Unchanged |
| Tests | `npm run typecheck`, `npm run lint`, `npm test` (112 vitest, 9 new) pass; `npx next build` passes. `npm run test:integration` was **not** run (no local stack in the sandbox); it needs no change because no SQL or action changed |

## What was asked

Normal league members should be able to open a read-only Proof Locker: see every challenge's status and view the evidence behind it.

## What was done

### Menu and routes

- `src/components/shell/nav.ts`: "04 Proof locker" is offered to every role (the `roles` filter was removed). The member view (`pb-member-view` cookie) therefore shows it too, read-only.
- `/proof` and `/proof/[challengeId]` now call `getLeagueContext()` instead of `requireParticipant()`. A `league` flag (`!isParticipant && !isCommissioner`) picks the rendering; the participant and commissioner-preview branches are unchanged.
- Game centre: the Next drive button now opens the proof locker for everyone (members used to be sent to the prop board).
- Member-view banner copy (`src/app/(league)/layout.tsx`) and the comment in `src/lib/actions/view.ts` say the locker is read-only in member view instead of hidden.
- `scripts/screenshots.ts`: `/proof` added to the member screen list.

### The league view of `/proof` (`src/app/(league)/proof/page.tsx`)

- Kicker `LEAGUE VIEW · n OF 10 APPROVED`, participant's kit in the title row and on the `KitPanel` (`loadParticipantProfile` in `src/lib/evidence.ts` reads the participant's name, kit and number).
- One row per challenge with `leagueStatusLabel` (never says "draft": "No proof submitted yet", "Submitted v2 · with the commissioner", "Approved · +10 points", "Flagged v1 · sent back for more proof", "Superseded v1"). A **View** link where a visible submission exists, otherwise the muted `AWAITING PROOF` label (`.pb-locker-wait`, end of `globals.css`).
- Right column: **Up next** (first play not yet approved, with a "View the evidence" link when something is submitted), **Latest calls** (last six `review_decisions` for the event, with the challenge title and reason) and **How the locker works** (`data-tour="proof-flow"`), which states that the screen is read-only.

### The league view of `/proof/[challengeId]`

- Title row shows the participant's `MemberBadge`, proof type and points; the tag is the current status ("PENDING REVIEW", "APPROVED", "FLAGGED", "SUPERSEDED") or "AWAITING PROOF".
- Latest visible version as a `pb-clip` card (version, status, caption, file count, submitted time), then the **Evidence** panel with the existing `MediaGallery` (short-lived signed URLs minted by `signedMediaUrl`, which already refuses drafts to non-commissioners) and a read-only note. No submission: `EmptyState` "No proof yet."
- The **Versions and decisions** panel is shared by all three branches (extracted into a local `versions` element).
- No upload, caption, submit or review control is rendered for members. Every write action still re-checks `ctx.isParticipant` / RLS, so the UI change adds no capability.

### Pure helpers and tests

- `src/lib/evidence-status.ts` (no `server-only`): `latestFor`, `statusLabel`, `leagueStatusLabel`, `statusHeading`. `src/lib/evidence.ts` re-exports them, so existing imports are unchanged. Tests in `src/lib/evidence-status.test.ts`.
- `src/lib/roles.test.ts`: the proof locker is now expected in every role's menu; My trip stays participant/commissioner/admin only.

### Tour

- `src/lib/tour.ts`: two new steps for non-participants in the league block, after the map and before the prop board: `proof-view` ("SCREEN 04 · The proof locker, read-only", target `proof-list`) and `proof-view-flow` ("THE WHISTLE", target `proof-flow`). Participants keep their own `proof` / `proof-flow` steps; a commissioner or admin who is the participant gets only those. `src/lib/tour.test.ts` asserts the split. `TOUR_VERSION` was left at 1 (bump it if every member should see the tour again).

## Verified

- `npm run typecheck && npm run lint && npm test` green; `npx next build` green.
- Production server on port 3001 + headless Chromium through a temporary `/demo/preview-tmp` page (deleted) rendering the league list, the league challenge page (pending version with a GPX and a photo, a flagged v1 in the trail) and the empty state, at 390 px and 1280 px: no horizontal overflow, no console errors, the "Awaiting proof" label sits in line with the View buttons, the `pb-clip` card and gallery lay out as on the review page.
- Not verified (no backend in the sandbox): the real pages against Postgres for a `member@local.test` account, i.e. that `loadSubmissions` returns no drafts for a member, that `review_decisions` with the `!inner` join filters by event for a member, and that `MediaGallery` "Load preview" succeeds for a member on a submitted file.

## Suggested checks on production (after merge)

1. Sign in as a plain member (or use the member view): the menu shows "04 Proof locker"; `/proof` lists all ten plays with a status each and no upload controls; the kicker reads LEAGUE VIEW.
2. Open a play with submitted proof: the clip card, the Evidence panel, "Load preview" plays a photo or clip, "Get download link" serves a GPX. Open a play without proof: "No proof yet."
3. As the participant, create a draft and do **not** submit it: the member sees "No proof submitted yet" / "Awaiting proof" for that play and the challenge page shows nothing. Submit it: the member sees "Submitted v1 · with the commissioner" and the files.
4. Commissioner approves or flags: the member's list updates, the decision appears under **Latest calls** and in the challenge's audit trail with the reason.
5. Replay the tour as a member: two new steps land on the locker between the map and the prop board.
6. `npm run screenshots` on the laptop: the member run now includes `/proof`.

## Still open

1. `TOUR_VERSION` unchanged: existing members will not see the new locker steps unless they replay the tour from League access.
2. Press-room answers are still only visible on `/press`; the locker's "Latest calls" labels them "Press room answer" without a link.
3. Carried forward: whether Skip should count as tour done; per-member tour reset for admins; regenerate `database.types.ts` from the local stack; run `scripts/fetch-sleeper-bracket.ts`; custom SMTP before inviting the league.
