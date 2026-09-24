-- Pofadder Bowl 2026 · production seed
-- Creates the league, the event and its supplied programme content only.
-- No users, no memberships, no approved scores, no winners. Times are SAST (+02:00) stored as UTC.
-- Source: data/league-programme.json (user-supplied plans, not independently verified).

insert into public.leagues (id, slug, name, sleeper_league_id)
values ('4b0c3c9e-0001-4a5e-9a0a-000000000001', 'show-us-your-tds', 'Show Us Your TD’s', '1313900125680054272')
on conflict (slug) do update set name = excluded.name, sleeper_league_id = excluded.sleeper_league_id;

insert into public.events (
  id, league_id, slug, name, subtitle, timezone, home_town, away_town, carrier,
  departure_at, away_arrival_at, return_departure_at, home_arrival_at,
  prediction_lock_at, prediction_reveal_at, required_run_km, max_points,
  stated_programme_distance_km, season_punished
) values (
  '4b0c3c9e-0002-4a5e-9a0a-000000000002', '4b0c3c9e-0001-4a5e-9a0a-000000000001',
  'pofadder-bowl-2026', 'Pofadder Bowl 2026', 'Show Us Your TD’s · Punishment series',
  'Africa/Johannesburg', 'Malmesbury', 'Pofadder', 'Intercape Mainliner',
  '2026-09-23T19:15:00+02:00', '2026-09-24T04:45:00+02:00', '2026-09-24T22:30:00+02:00', '2026-09-25T07:35:00+02:00',
  '2026-09-24T04:45:00+02:00', '2026-09-25T07:35:00+02:00', 10, 100, 974, 2024
)
on conflict (league_id, slug) do update set
  name = excluded.name, subtitle = excluded.subtitle, timezone = excluded.timezone,
  home_town = excluded.home_town, away_town = excluded.away_town, carrier = excluded.carrier,
  departure_at = excluded.departure_at, away_arrival_at = excluded.away_arrival_at,
  return_departure_at = excluded.return_departure_at, home_arrival_at = excluded.home_arrival_at,
  required_run_km = excluded.required_run_km, max_points = excluded.max_points,
  stated_programme_distance_km = excluded.stated_programme_distance_km, season_punished = excluded.season_punished;

-- Itinerary (venue text retained; no coordinates are verified, so no pins are seeded).
insert into public.itinerary_items (event_id, quarter, sequence, starts_at, title, description, venue_text) values
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 1, 1, '2026-09-23T18:45:00+02:00', 'Malmesbury Motors', 'Departure clip, ticket close-up.', 'Malmesbury Motors, 43 Voortrekker Rd'),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 1, 2, '2026-09-23T19:15:00+02:00', 'Intercape departs', 'N7 north, N14 east. One update from the dark, then sleep.', 'Malmesbury'),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 2, 1, '2026-09-24T04:45:00+02:00', 'Arrive KLK Garage', 'Night sign selfie. Walk to the Hotel.', 'KLK Garage, Skool St'),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 2, 2, '2026-09-24T05:00:00+02:00', 'Rest', 'Rest.', 'Hotel'),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 2, 3, '2026-09-24T06:30:00+02:00', '10 km run', 'Voortrekker St east, R358 north 3 km, turn at 4.0 km on the watch, back to town, 2 km town loop to the Hotel. GPS export is the proof.', 'Voortrekker St / R358'),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 2, 4, '2026-09-24T08:30:00+02:00', 'Breakfast at Pofadder Inn', 'Daylight sign selfie.', 'Pofadder Inn'),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 3, 1, '2026-09-24T09:30:00+02:00', 'Tourism Bureau', 'Town history, oldest building, Heritage Day events.', 'Tourism Bureau, 103 Voortrekker St'),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 3, 2, '2026-09-24T10:30:00+02:00', 'Checkpoints on foot', 'See play-by-play.', 'Pofadder'),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 3, 3, '2026-09-24T13:00:00+02:00', 'Chicken and rib combo', 'Rated on camera.', 'Badgers Grill'),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 3, 4, '2026-09-24T14:00:00+02:00', 'Rest', 'Cut footage, write the report.', 'Hotel'),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 4, 1, '2026-09-24T17:30:00+02:00', 'Sunset on the N14 edge of town', 'Loser''s speech.', 'N14 edge of town'),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 4, 2, '2026-09-24T19:00:00+02:00', 'Dinner', 'Dinner, Pofadder Inn.', 'Pofadder Inn'),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 4, 3, '2026-09-24T21:30:00+02:00', 'Check out', 'Walk to KLK Garage.', 'KLK Garage, Skool St'),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 4, 4, '2026-09-24T22:30:00+02:00', 'Intercape departs', 'No second bus.', 'KLK Garage, Skool St'),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 4, 5, '2026-09-25T07:35:00+02:00', 'Arrive Malmesbury', 'Friday. Sentence served.', 'Malmesbury')
on conflict (event_id, quarter, sequence) do update set starts_at = excluded.starts_at, title = excluded.title, description = excluded.description, venue_text = excluded.venue_text;

-- Eleven proof challenges worth exactly 100 points.
insert into public.challenges (event_id, sequence, title, proof_type, points, rated) values
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 1, 'Boarding the Intercape in Malmesbury, ticket and face in frame', 'photo', 5, false),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 2, 'Town welcome sign, in the dark, on arrival', 'photo', 5, false),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 3, '10 km run, full GPS trace including the R358 leg', 'watch export', 20, false),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 4, 'Welcome sign again, in daylight, still in running kit', 'photo', 5, false),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 5, 'Three locals asked what Pofadder is known for', '3 clips', 10, false),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 6, 'Oldest building in town, with its year', 'photo', 5, false),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 7, 'Chicken and rib combo, rated out of ten', 'clip', 5, true),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 8, 'Final league standings read aloud in the Hotel bar', 'clip or photo', 15, false),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 9, 'R50 spent in Pofadder on a public holiday', 'receipt', 10, false),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 10, 'Sunset loser''s speech on the N14', 'clip', 10, false),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 11, 'Boarding the 22:30 bus, ticket and face in frame', 'clip', 10, false)
on conflict (event_id, sequence) do update set title = excluded.title, proof_type = excluded.proof_type, points = excluded.points, rated = excluded.rated;

insert into public.penalties (event_id, sequence, text) values
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 1, 'Missed the 22:30 bus: sentence doubled next season.'),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 2, 'Run under 10.0 km on the trace: 20 points forfeited, plus 5 km added to next year''s run.'),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 3, 'Any checkpoint without proof: zero points for that play.')
on conflict (event_id, sequence) do update set text = excluded.text;

-- Press room: midday prompts open at 12:00 SAST on the Thursday; the sunset speech at 17:30.
insert into public.press_prompts (event_id, slot, sequence, question, opens_at) values
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 'midday', 1, 'Has ownership lost confidence in your drafting strategy?', '2026-09-24T12:00:00+02:00'),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 'midday', 2, 'At what point did you realise your bench had more potential than your starting lineup?', '2026-09-24T12:00:00+02:00'),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 'midday', 3, 'What would you say to the fans who paid absolutely nothing to watch this?', '2026-09-24T12:00:00+02:00'),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 'midday', 4, 'What changes will management make before next season?', '2026-09-24T12:00:00+02:00'),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 'sunset', 1, 'The sunset speech: address the league, own the result, and give your next-season promise.', '2026-09-24T17:30:00+02:00')
on conflict (event_id, slot, sequence) do update set question = excluded.question, opens_at = excluded.opens_at;

-- Prop board: ten over/under and yes/no props, set before departure. Picks lock when the bus arrives in Pofadder.
-- Settled by a commissioner from the record after the trip (see detail for each rule).
insert into public.props (event_id, sequence, title, detail, kind, line, unit, locks_at) values
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 1, 'Watch distance on the approved run trace', 'The distance on the GPS export the commissioner approves for the 10 km run.', 'over_under', 10.25, 'km', '2026-09-24T04:45:00+02:00'),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 2, 'Minutes the Intercape arrives late at KLK Garage', 'Scheduled 04:45. Settled from the arrival check-in or the night sign photo timestamp.', 'over_under', 20, 'min late', '2026-09-24T04:45:00+02:00'),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 3, 'Chicken and rib combo finished on camera', 'Plate clean in the rating clip. Bones do not count as leftovers.', 'yes_no', null, null, '2026-09-24T04:45:00+02:00'),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 4, 'Locals approached before three agree to be filmed', 'Victor keeps the tally and states it in the third clip. Commissioner may audit the footage.', 'over_under', 4.5, 'locals', '2026-09-24T04:45:00+02:00'),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 5, 'Proof challenges approved by the final whistle', 'Out of eleven. Counted from the commissioner scoreboard when the certificate is issued.', 'over_under', 9.5, 'approved', '2026-09-24T04:45:00+02:00'),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 6, 'Sideline feed comments before the sunset speech', 'Member comments on the feed posted before 17:30 on Thursday. System posts and reactions excluded.', 'over_under', 60.5, 'comments', '2026-09-24T04:45:00+02:00'),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 7, 'Map check-ins over the whole trip', 'Every check-in on the map between departure and arrival home.', 'over_under', 15.5, 'check-ins', '2026-09-24T04:45:00+02:00'),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 8, 'Length of the sunset loser''s speech', 'Duration of the approved N14 clip, first word to last.', 'over_under', 90, 'seconds', '2026-09-24T04:45:00+02:00'),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 9, 'Rand spent in Pofadder on receipts', 'Total of every receipt submitted as proof, including the R50 challenge.', 'over_under', 150, 'rand', '2026-09-24T04:45:00+02:00'),
  ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 10, 'The 22:30 Intercape leaves within 15 minutes of schedule', 'Settled from the boarding clip and the departure check-in.', 'yes_no', null, null, '2026-09-24T04:45:00+02:00')
on conflict (event_id, sequence) do update set title = excluded.title, detail = excluded.detail, kind = excluded.kind, line = excluded.line, unit = excluded.unit, locks_at = excluded.locks_at;

insert into public.prediction_rules (event_id, run_points, meal_points, final_score_points, sign_photo_points, flags_points, distance_points, speech_points)
values ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 10, 5, 5, 5, 5, 5, 5)
on conflict (event_id) do nothing;

-- Certificate starts pending. It is only issued by a commissioner decision.
insert into public.certificates (event_id, status) values ('4b0c3c9e-0002-4a5e-9a0a-000000000002', 'pending')
on conflict (event_id) do nothing;
