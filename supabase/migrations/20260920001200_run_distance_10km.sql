-- The run is 10 km, not 14 km. seed.sql already carries the new figures for a fresh database;
-- this migration brings the hosted rows in line (the Supabase GitHub integration applies it on
-- merge to main; seed.sql is not re-run there). Backward compatible: only text and numbers change.

-- Event: the required distance the prop generator and the teaser read.
update public.events
   set required_run_km = 10
 where slug = 'pofadder-bowl-2026' and required_run_km = 14;

-- Itinerary: the run block on Thursday morning.
update public.itinerary_items i
   set title = '10 km run',
       description = 'Voortrekker St east, R358 north 3 km, turn at 4.0 km on the watch, back to town, 2 km town loop to the Hotel. GPS export is the proof.'
  from public.events e
 where i.event_id = e.id and e.slug = 'pofadder-bowl-2026'
   and i.quarter = 2 and i.sequence = 3 and i.title = '14 km run';

-- Challenge #02.
update public.challenges c
   set title = '10 km run, full GPS trace including the R358 leg'
  from public.events e
 where c.event_id = e.id and e.slug = 'pofadder-bowl-2026'
   and c.sequence = 2 and c.title = '14 km run, full GPS trace including the R358 leg';

-- Prop #01: the over/under on the approved trace. Left alone once it has locked or anyone has
-- picked a side; the commissioner then re-generates the board from the app if that is wanted.
update public.props p
   set detail = 'The distance on the GPS export the commissioner approves for the 10 km run.',
       line = 10.25
  from public.events e
 where p.event_id = e.id and e.slug = 'pofadder-bowl-2026'
   and p.sequence = 1 and p.line = 14.25
   and now() < p.locks_at
   and not exists (select 1 from public.prop_picks k where k.prop_id = p.id);
