# Eleventh proof: boarding the bus in Malmesbury

## State at handoff

Branch `claude/malmesbury-bus-boarding-proof-m1h7t8`, started from `origin/main` (post `handoff_2026-09-21_ui-security-improvements.md`). Not deployed, not merged. One new migration, `supabase/migrations/20260922000100_malmesbury_boarding_challenge.sql`, applies on merge to `main` through the Supabase GitHub integration and must also reach the league project when `production` is fast-forwarded. No env changes.

## Asked and done

Add a proof to the locker: a photo of boarding the bus in Malmesbury, 5 points, with 5 points taken off the run so the programme still totals 100.

- **Programme.** The new play is #01, "Boarding the Intercape in Malmesbury, ticket and face in frame", proof type `photo`, 5 points, because the locker lists plays in trip order and this is the first thing that happens. Every other play moved down one (night sign #02, run #03 ... 22:30 boarding #11). The run is 20 points. Eleven plays, 100 points. `supabase/seed.sql` and `src/data/league-programme.json` carry the list; a unit test asserts the count, the sequence run and the 100 total.
- **Migration.** Guarded and idempotent: shifts the ten existing rows by one (two hops around the `(event_id, sequence)` unique constraint), inserts the new #01, sets the watch-export play from 25 to 20 points, rewrites penalty #02 ("Run under 10.0 km on the trace: 20 points forfeited ..."; it still said 14.0 km and 25 points), and updates prop #05 to "Out of eleven", line 9.5, only while it is unlocked and unpicked, as the 10 km migration did for prop #01. Submissions, files and decisions reference challenges by id and `event_scores` sums `challenges.points`, so nothing else moves.
- **Copy.** "Ten plays" / "ten proof challenges" became eleven in the proof locker, My Trip, tour, teaser, recap, public recap, certificate export, README and CLAUDE.md. The demo screens show the new #01 and the 20-point run.
- **Sequence-coupled code.** The certificate photo slots on `/recap` used sequences 1, 2 and 10. They now go through `src/lib/photo-slots.ts`, which matches by what the play asks for (the welcome sign in the dark, the watch export, the 22:30 boarding) so the outbound boarding cannot take the "return" slot. The daylight-sign fallback in `review/page.tsx` moved from #03 to #04 (the title regex still wins). The integration test reads the run at sequence 3 and expects 20 / 25 points; the browser check replaces proof on #07 (the rated combo).

## Verified

`npm run typecheck`, `npm run lint`, `npm test` (24 files, 164 tests) pass.

## Not verified

- `npm run test:integration` and `npm run test:browser`: the cloud sandbox has no Docker, so the local stack cannot start. Run them from the laptop after `npm run db:reset` (fresh seed) and, separately, against a database that already holds the ten-play programme to exercise the migration's shift path.
- The migration was not executed against a database here. Read it once before merging.

## Suggested checks on production after the merge

1. Supabase → Database → Migrations: `20260922000100_malmesbury_boarding_challenge` applied. `select sequence, title, points from challenges order by sequence` shows 11 rows summing to 100, #01 the Malmesbury boarding, #03 the run at 20.
2. Proof locker as Victor: #01 opens, accepts a photo, and the header says "Eleven plays. One hundred points." Game centre "Next play" points at #01 before departure.
3. Props: #05 reads "Out of eleven", line 9.5, unless picks already existed (then it is unchanged by design; regenerate from the app if wanted).
4. Predictions, prop generator and the feed are unaffected; the review defaults still find the daylight sign by title.

## Open

- The itinerary Q1 item at Malmesbury Motors still says "Departure clip, ticket close-up." while the proof asks for a photo. Left as is; change the seed and add a migration if the wording should match.
- Old handoffs refer to the combo as #06. That is history; it is #07 now.
