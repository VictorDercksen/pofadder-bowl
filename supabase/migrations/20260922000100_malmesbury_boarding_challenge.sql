-- Eleventh proof: a photo of boarding the Intercape in Malmesbury, 5 points, first in the locker.
-- The run drops from 25 to 20 points so the programme still totals 100. seed.sql carries the new
-- list for a fresh database; this migration brings the hosted rows in line (the Supabase GitHub
-- integration applies it on merge; seed.sql is not re-run there).
--
-- Backward compatible: submissions, files and decisions reference challenges by id, and the
-- score view sums challenges.points, so shifting sequences and changing one points value needs
-- no data rewrite. Idempotent: every step is guarded by the state it expects to find.

do $$
declare
  v_event uuid;
begin
  select id into v_event from public.events where slug = 'pofadder-bowl-2026';
  if v_event is null then
    return;
  end if;

  -- 1. Make room at #01. Only when the Malmesbury boarding is not there yet and the programme
  --    still has its ten original plays (the outbound boarding would otherwise already be #01).
  if not exists (select 1 from public.challenges where event_id = v_event and title ilike '%Malmesbury%')
     and exists (select 1 from public.challenges where event_id = v_event and sequence = 1 and title ilike '%welcome sign%')
     and not exists (select 1 from public.challenges where event_id = v_event and sequence > 10) then
    -- Two hops around the unique (event_id, sequence) constraint.
    update public.challenges set sequence = sequence + 100 where event_id = v_event;
    update public.challenges set sequence = sequence - 99 where event_id = v_event;

    insert into public.challenges (event_id, sequence, title, proof_type, points, rated)
    values (v_event, 1, 'Boarding the Intercape in Malmesbury, ticket and face in frame', 'photo', 5, false);
  end if;

  -- 2. The run is worth 20 points.
  update public.challenges
     set points = 20
   where event_id = v_event
     and proof_type = 'watch export'
     and points = 25;
end $$;

-- 3. Penalty #02 quotes the run's points and distance.
update public.penalties p
   set text = 'Run under 10.0 km on the trace: 20 points forfeited, plus 5 km added to next year''s run.'
  from public.events e
 where p.event_id = e.id and e.slug = 'pofadder-bowl-2026'
   and p.sequence = 2
   and p.text like 'Run under % km on the trace: 25 points forfeited%';

-- 4. Prop #05 counts approved plays out of the programme. Left alone once it has locked or
--    anyone has picked a side; the commissioner then re-generates the board from the app.
update public.props p
   set detail = 'Out of eleven. Counted from the commissioner scoreboard when the certificate is issued.',
       line = 9.5
  from public.events e
 where p.event_id = e.id and e.slug = 'pofadder-bowl-2026'
   and p.sequence = 5 and p.line = 8.5
   and now() < p.locks_at
   and not exists (select 1 from public.prop_picks k where k.prop_id = p.id);
