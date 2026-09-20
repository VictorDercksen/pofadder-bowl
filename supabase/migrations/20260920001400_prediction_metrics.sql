-- Five more prediction calls, each settled from something the app already records:
--   final_score       Victor's final punishment score out of 100 (closest)
--   sign_photo        clock time (minute of day, event timezone) the daylight welcome-sign photo lands (closest)
--   flags             versions flagged by the commissioner over the trip (exact)
--   distance          distance on the approved run trace, km (closest)
--   speech            length of the sunset speech clip, seconds (closest)
-- All new columns are nullable so the earlier upsert_prediction overloads keep working while
-- Vercel builds; the page requires every call. Backward compatible.

alter table public.predictions
  add column if not exists final_score smallint check (final_score between 0 and 100),
  add column if not exists sign_photo_minutes integer check (sign_photo_minutes between 0 and 1439),
  add column if not exists flag_count smallint check (flag_count between 0 and 99),
  add column if not exists run_distance_km numeric(6, 2) check (run_distance_km between 0 and 100),
  add column if not exists speech_seconds integer check (speech_seconds between 0 and 3600);

alter table public.official_results
  add column if not exists final_score smallint check (final_score between 0 and 100),
  add column if not exists sign_photo_minutes integer check (sign_photo_minutes between 0 and 1439),
  add column if not exists flag_count smallint check (flag_count between 0 and 99),
  add column if not exists speech_seconds integer check (speech_seconds between 0 and 3600);

alter table public.prediction_rules
  add column if not exists final_score_points integer not null default 5,
  add column if not exists sign_photo_points integer not null default 5,
  add column if not exists flags_points integer not null default 5,
  add column if not exists distance_points integer not null default 5,
  add column if not exists speech_points integer not null default 5;

alter table public.prediction_awards drop constraint if exists prediction_awards_category_check;
alter table public.prediction_awards add constraint prediction_awards_category_check
  check (category in ('run', 'meal', 'complaints', 'final_score', 'sign_photo', 'flags', 'distance', 'speech'));

create or replace function public.upsert_prediction(
  p_event uuid, p_run_seconds integer, p_meal_rating smallint,
  p_final_score smallint, p_sign_photo_minutes integer, p_flag_count smallint, p_run_distance_km numeric, p_speech_seconds integer
) returns public.predictions
language plpgsql security definer set search_path = public as $$
declare v_lock timestamptz; v_reveal timestamptz; v_row public.predictions;
begin
  if not public.pb_is_event_member(p_event) then
    raise exception 'league membership required' using errcode = '42501';
  end if;
  select prediction_lock_at, prediction_reveal_at into v_lock, v_reveal from public.events where id = p_event;
  if now() >= v_lock or now() >= v_reveal then
    raise exception 'predictions locked at %', least(v_lock, v_reveal) using errcode = '42501';
  end if;
  insert into public.predictions (event_id, user_id, run_seconds, meal_rating, complaint_count, final_score, sign_photo_minutes, flag_count, run_distance_km, speech_seconds)
  values (p_event, auth.uid(), p_run_seconds, p_meal_rating, null, p_final_score, p_sign_photo_minutes, p_flag_count, p_run_distance_km, p_speech_seconds)
  on conflict (event_id, user_id) do update
    set run_seconds = excluded.run_seconds, meal_rating = excluded.meal_rating, complaint_count = null,
        final_score = excluded.final_score, sign_photo_minutes = excluded.sign_photo_minutes, flag_count = excluded.flag_count,
        run_distance_km = excluded.run_distance_km, speech_seconds = excluded.speech_seconds, updated_at = now()
  returning * into v_row;
  return v_row;
end $$;

-- Shims for the deploys that send three or four arguments; drop once they are gone.
create or replace function public.upsert_prediction(p_event uuid, p_run_seconds integer, p_meal_rating smallint)
returns public.predictions
language sql security definer set search_path = public as $$
  select public.upsert_prediction(p_event, p_run_seconds, p_meal_rating, null::smallint, null::integer, null::smallint, null::numeric, null::integer);
$$;
create or replace function public.upsert_prediction(p_event uuid, p_run_seconds integer, p_meal_rating smallint, p_complaint_count integer)
returns public.predictions
language sql security definer set search_path = public as $$
  select public.upsert_prediction(p_event, p_run_seconds, p_meal_rating, null::smallint, null::integer, null::smallint, null::numeric, null::integer);
$$;

-- Closest wins for the numeric calls, exact for the rib rating and the flag count; ties share.
-- A slip that skipped a call (older deploy) simply does not compete in that category.
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
