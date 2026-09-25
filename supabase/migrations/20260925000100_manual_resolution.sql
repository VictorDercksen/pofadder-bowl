-- Resolution of the prop board and the predictions is a commissioner decision, not a clock.
-- Before this, settle_prop waited for events.home_arrival_at and resolve_predictions (and the
-- visibility of other members' slips) waited for events.prediction_reveal_at. Now all three wait
-- for events.resolution_opened_at, which only set_resolution_open() writes: the "Resolve props and
-- predictions" button on Review. Nothing opens on its own.

alter table public.events
  add column if not exists resolution_opened_at timestamptz,
  add column if not exists resolution_opened_by uuid references auth.users(id) on delete set null;

-- Keep events that were already settled or resolved consistent: they count as opened.
update public.events e
   set resolution_opened_at = now()
 where e.resolution_opened_at is null
   and (exists (select 1 from public.props p where p.event_id = e.id and p.result is not null)
        or exists (select 1 from public.official_results r where r.event_id = e.id and r.resolved_at is not null));

-- Other members' slips are visible only once resolution is open (was: now() >= prediction_reveal_at).
-- predictions_revealed is security_invoker, so this policy also gates the view.
drop policy if exists predictions_select_own on public.predictions;
create policy predictions_select_own on public.predictions for select to authenticated
  using (user_id = auth.uid() or (public.pb_is_event_member(event_id)
    and (select e.resolution_opened_at from public.events e where e.id = event_id) is not null));

-- The button. Opening is refused before the slips lock; it pulls prediction_reveal_at forward to now
-- when the reveal is still ahead, so the predictions_revealed view (which also reads the reveal)
-- shows the slips at once. Closing again is allowed only while nothing has been settled or resolved.
create or replace function public.set_resolution_open(p_event uuid, p_open boolean)
returns public.events
language plpgsql security definer set search_path = public as $$
declare
  v_event public.events;
begin
  if not public.pb_is_event_commissioner(p_event) then
    raise exception 'commissioner role required' using errcode = '42501';
  end if;
  select * into v_event from public.events where id = p_event for update;
  if v_event.id is null then raise exception 'event not found' using errcode = 'P0002'; end if;

  if p_open then
    if v_event.resolution_opened_at is not null then return v_event; end if;  -- idempotent
    if now() < v_event.prediction_lock_at then
      raise exception 'resolution opens only after predictions lock' using errcode = '42501';
    end if;
    update public.events
       set resolution_opened_at = now(), resolution_opened_by = auth.uid(),
           prediction_reveal_at = case when now() < prediction_reveal_at then now() else prediction_reveal_at end
     where id = p_event returning * into v_event;
    insert into public.activity_posts (event_id, author_id, kind, heading, body)
    values (p_event, auth.uid(), 'system', 'Resolution open',
      'The commissioner is settling the prop board and resolving the predictions. The league''s calls are now visible.');
  else
    if v_event.resolution_opened_at is null then return v_event; end if;
    if exists (select 1 from public.props p where p.event_id = p_event and p.result is not null)
       or exists (select 1 from public.official_results r where r.event_id = p_event and r.resolved_at is not null) then
      raise exception 'resolution cannot close once a prop is settled or the predictions are resolved' using errcode = '42501';
    end if;
    update public.events set resolution_opened_at = null, resolution_opened_by = null
     where id = p_event returning * into v_event;
    delete from public.activity_posts where event_id = p_event and kind = 'system' and heading = 'Resolution open';
  end if;
  return v_event;
end $$;

revoke execute on function public.set_resolution_open(uuid, boolean) from public, anon;
grant execute on function public.set_resolution_open(uuid, boolean) to authenticated;

-- resolve_predictions: the reveal-time check becomes the resolution check. Otherwise unchanged
-- (copied from 20260923000200_reveal_at_home_arrival.sql).
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
  if (select e.resolution_opened_at from public.events e where e.id = p_event) is null then
    raise exception 'predictions resolve once a commissioner opens resolution' using errcode = '42501';
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

-- settle_prop: the home-arrival check becomes the resolution check. Otherwise unchanged
-- (copied from 20260923000200_reveal_at_home_arrival.sql). The per-prop lock check stays.
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
  if (select e.resolution_opened_at from public.events e where e.id = v_prop.event_id) is null then
    raise exception 'props settle once a commissioner opens resolution' using errcode = '42501';
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
