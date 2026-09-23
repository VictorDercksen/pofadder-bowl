-- Other members' prediction slips stay hidden, and the slips cannot be resolved, until the bus is
-- back in Malmesbury (events.home_arrival_at, the "Arrive Malmesbury" stop on My trip).
-- Only moves a reveal that has not passed yet, so slips that are already visible are never re-hidden.
-- lock <= reveal still holds: home_arrival_at is after every earlier lock instant.

update public.events e
   set prediction_reveal_at = e.home_arrival_at
 where now() < e.prediction_reveal_at
   and e.home_arrival_at > e.prediction_reveal_at;

-- resolve_predictions refuses to run before the reveal, so awards (and the feed post that announces
-- them) cannot leak the league's calls while the slips are still hidden.
create or replace function public.resolve_predictions(p_event uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_res public.official_results;
  v_rules public.prediction_rules;
  v_league uuid;
  v_count integer := 0;
begin
  if not public.pb_is_event_commissioner(p_event) then
    raise exception 'commissioner role required' using errcode = '42501';
  end if;
  if now() < (select e.prediction_reveal_at from public.events e where e.id = p_event) then
    raise exception 'predictions resolve once the bus is back in Malmesbury' using errcode = '42501';
  end if;
  select * into v_res from public.official_results where event_id = p_event for update;
  if v_res.event_id is null then raise exception 'official results not entered' using errcode = '22023'; end if;
  select * into v_rules from public.prediction_rules where event_id = p_event;
  if v_rules.event_id is null then
    insert into public.prediction_rules (event_id) values (p_event) returning * into v_rules;
  end if;
  select league_id into v_league from public.events where id = p_event;

  delete from public.prediction_awards where event_id = p_event;

  create temp table pb_active on commit drop as
    select p.* from public.predictions p
    join public.memberships m on m.league_id = v_league and m.user_id = p.user_id and m.status = 'active'
    where p.event_id = p_event;

  if v_res.run_seconds is not null then
    insert into public.prediction_awards (event_id, user_id, category, points)
    select p_event, user_id, 'run', v_rules.run_points from pb_active p
    where abs(p.run_seconds - v_res.run_seconds) = (select min(abs(q.run_seconds - v_res.run_seconds)) from pb_active q);
  end if;
  if v_res.meal_rating is not null then
    insert into public.prediction_awards (event_id, user_id, category, points)
    select p_event, user_id, 'meal', v_rules.meal_points from pb_active p where p.meal_rating = v_res.meal_rating;
  end if;
  if v_res.final_score is not null then
    insert into public.prediction_awards (event_id, user_id, category, points)
    select p_event, user_id, 'final_score', v_rules.final_score_points from pb_active p
    where p.final_score is not null
      and abs(p.final_score - v_res.final_score) = (select min(abs(q.final_score - v_res.final_score)) from pb_active q where q.final_score is not null);
  end if;
  if v_res.sign_photo_minutes is not null then
    insert into public.prediction_awards (event_id, user_id, category, points)
    select p_event, user_id, 'sign_photo', v_rules.sign_photo_points from pb_active p
    where p.sign_photo_minutes is not null
      and abs(p.sign_photo_minutes - v_res.sign_photo_minutes) = (select min(abs(q.sign_photo_minutes - v_res.sign_photo_minutes)) from pb_active q where q.sign_photo_minutes is not null);
  end if;
  if v_res.flag_count is not null then
    insert into public.prediction_awards (event_id, user_id, category, points)
    select p_event, user_id, 'flags', v_rules.flags_points from pb_active p where p.flag_count = v_res.flag_count;
  end if;
  if v_res.run_distance_km is not null then
    insert into public.prediction_awards (event_id, user_id, category, points)
    select p_event, user_id, 'distance', v_rules.distance_points from pb_active p
    where p.run_distance_km is not null
      and abs(p.run_distance_km - v_res.run_distance_km) = (select min(abs(q.run_distance_km - v_res.run_distance_km)) from pb_active q where q.run_distance_km is not null);
  end if;
  if v_res.speech_seconds is not null then
    insert into public.prediction_awards (event_id, user_id, category, points)
    select p_event, user_id, 'speech', v_rules.speech_points from pb_active p
    where p.speech_seconds is not null
      and abs(p.speech_seconds - v_res.speech_seconds) = (select min(abs(q.speech_seconds - v_res.speech_seconds)) from pb_active q where q.speech_seconds is not null);
  end if;

  select count(*) into v_count from public.prediction_awards where event_id = p_event;
  update public.official_results set resolved_at = now() where event_id = p_event;
  delete from public.activity_posts where event_id = p_event and kind = 'prediction' and heading = 'Predictions resolved';
  insert into public.activity_posts (event_id, author_id, kind, heading, body)
  values (p_event, auth.uid(), 'prediction', 'Predictions resolved', format('%s award(s) handed out against the official results.', v_count));
  return v_count;
end $$;

-- The prop board settles at the same stop: settle_prop refuses until events.home_arrival_at has
-- passed (after the existing lock check). Picks are already visible from the lock; this only holds
-- the results, the standings and the "Prop settled" feed posts until the bus is back.
create or replace function public.settle_prop(p_prop uuid, p_result public.prop_result)
returns public.props
language plpgsql security definer set search_path = public as $$
declare
  v_prop public.props;
  v_correct integer;
  v_total integer;
begin
  select * into v_prop from public.props where id = p_prop for update;
  if v_prop.id is null then raise exception 'prop not found' using errcode = 'P0002'; end if;
  if not public.pb_is_event_commissioner(v_prop.event_id) then
    raise exception 'commissioner role required' using errcode = '42501';
  end if;
  if now() < v_prop.locks_at then
    raise exception 'prop settles only after it locks at %', v_prop.locks_at using errcode = '42501';
  end if;
  if now() < (select e.home_arrival_at from public.events e where e.id = v_prop.event_id) then
    raise exception 'props settle once the bus is back in Malmesbury' using errcode = '42501';
  end if;
  if p_result <> 'void' and not public.pb_side_matches_kind(v_prop.kind, p_result::text) then
    raise exception 'result does not fit this prop' using errcode = '22023';
  end if;
  if v_prop.result is not distinct from p_result then return v_prop; end if;  -- idempotent

  update public.props
  set result = p_result, settled_by = auth.uid(), settled_at = now()
  where id = p_prop returning * into v_prop;

  select count(*) filter (where pk.side::text = p_result::text), count(*) into v_correct, v_total
  from public.prop_picks pk where pk.prop_id = p_prop;

  insert into public.activity_posts (event_id, author_id, kind, heading, body)
  values (v_prop.event_id, auth.uid(), 'prop', 'Prop settled',
    left(format('#%s %s · %s', v_prop.sequence, v_prop.title,
      case when p_result = 'void' then 'void, no points'
           else format('%s · %s of %s picks correct', initcap(p_result::text), v_correct, v_total) end), 1000));
  return v_prop;
end $$;
