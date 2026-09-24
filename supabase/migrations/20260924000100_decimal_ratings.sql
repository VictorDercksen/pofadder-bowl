-- Ratings out of ten take one decimal (1.0 .. 10.0).
--
-- 1. evidence_submissions.rating, predictions.meal_rating and official_results.meal_rating
--    move from smallint to numeric(3,1). The "between 1 and 10" checks and the column grant
--    on evidence_submissions.rating carry over. predictions_revealed pins the column type, so
--    it is dropped and recreated with the same columns.
-- 2. upsert_prediction takes the rating as numeric. The smallint overloads are dropped and
--    recreated with the same argument names, so the previous deploy (whole numbers, same
--    named arguments) resolves to the new functions.
-- 3. submit_submission prints the score without a trailing ".0" in the feed post.
-- Backward compatible: whole numbers are still valid ratings and read back as numbers.

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------
drop view if exists public.predictions_revealed;

alter table public.evidence_submissions alter column rating type numeric(3, 1);
alter table public.predictions alter column meal_rating type numeric(3, 1);
alter table public.official_results alter column meal_rating type numeric(3, 1);

create view public.predictions_revealed
with (security_invoker = true) as
select p.event_id, p.user_id, p.run_seconds, p.meal_rating, p.complaint_count, p.created_at, p.updated_at,
       coalesce(pr.display_name, 'Former member') as display_name, pr.kit_team
from public.predictions p
join public.events e on e.id = p.event_id
left join public.profiles pr on pr.id = p.user_id
where p.user_id = auth.uid() or now() >= e.prediction_reveal_at;

revoke all on public.predictions_revealed from anon;
grant select on public.predictions_revealed to authenticated;

-- ---------------------------------------------------------------------------
-- 2. upsert_prediction with a decimal rating
-- ---------------------------------------------------------------------------
drop function if exists public.upsert_prediction(uuid, integer, smallint);
drop function if exists public.upsert_prediction(uuid, integer, smallint, integer);
drop function if exists public.upsert_prediction(uuid, integer, smallint, smallint, integer, smallint, numeric, integer);

create function public.upsert_prediction(
  p_event uuid, p_run_seconds integer, p_meal_rating numeric,
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
  if p_meal_rating is not null and p_meal_rating <> round(p_meal_rating, 1) then
    raise exception 'rating takes one decimal at most' using errcode = '22023';
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

-- Shims for callers that send three or four arguments.
create function public.upsert_prediction(p_event uuid, p_run_seconds integer, p_meal_rating numeric)
returns public.predictions
language sql security definer set search_path = public as $$
  select public.upsert_prediction(p_event, p_run_seconds, p_meal_rating, null::smallint, null::integer, null::smallint, null::numeric, null::integer);
$$;
create function public.upsert_prediction(p_event uuid, p_run_seconds integer, p_meal_rating numeric, p_complaint_count integer)
returns public.predictions
language sql security definer set search_path = public as $$
  select public.upsert_prediction(p_event, p_run_seconds, p_meal_rating, null::smallint, null::integer, null::smallint, null::numeric, null::integer);
$$;

revoke execute on function public.upsert_prediction(uuid, integer, numeric, smallint, integer, smallint, numeric, integer) from public, anon;
revoke execute on function public.upsert_prediction(uuid, integer, numeric) from public, anon;
revoke execute on function public.upsert_prediction(uuid, integer, numeric, integer) from public, anon;
grant execute on function public.upsert_prediction(uuid, integer, numeric, smallint, integer, smallint, numeric, integer) to authenticated;
grant execute on function public.upsert_prediction(uuid, integer, numeric) to authenticated;
grant execute on function public.upsert_prediction(uuid, integer, numeric, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Feed post prints "7.5 / 10" and "8 / 10"
-- ---------------------------------------------------------------------------
create or replace function public.submit_submission(p_submission uuid)
returns public.evidence_submissions
language plpgsql security definer set search_path = public as $$
declare
  v_row public.evidence_submissions;
  v_title text;
  v_files integer;
  v_rated boolean := false;
begin
  select * into v_row from public.evidence_submissions where id = p_submission for update;
  if v_row.id is null then raise exception 'submission not found' using errcode = 'P0002'; end if;
  if v_row.submitter_id <> auth.uid() then raise exception 'not your submission' using errcode = '42501'; end if;
  if not public.pb_is_event_participant(v_row.event_id) then
    raise exception 'only the event participant can submit evidence' using errcode = '42501';
  end if;
  if v_row.status not in ('draft', 'flagged') then
    raise exception 'submission is % and cannot be submitted', v_row.status using errcode = '22023';
  end if;
  select count(*) into v_files from public.evidence_files where submission_id = p_submission;
  if v_files = 0 then raise exception 'attach at least one uploaded file before submitting' using errcode = '22023'; end if;
  if v_row.challenge_id is not null then
    select coalesce(c.rated, false) into v_rated from public.challenges c where c.id = v_row.challenge_id;
  end if;
  if v_rated and v_row.rating is null then
    raise exception 'rate it out of ten before submitting' using errcode = '22023';
  end if;

  update public.evidence_submissions
  set status = 'submitted', submitted_at = now()
  where id = p_submission
  returning * into v_row;

  select coalesce(c.title, 'Press room · ' || pp.slot::text) into v_title
  from public.evidence_submissions s
  left join public.challenges c on c.id = s.challenge_id
  left join public.press_prompts pp on pp.id = s.press_prompt_id
  where s.id = p_submission;

  insert into public.activity_posts (event_id, author_id, kind, heading, body, ref_submission_id)
  values (v_row.event_id, auth.uid(), 'submission', 'New proof submitted',
          left(v_title
               || case when v_rated and v_row.rating is not null then ' · ' || trim_scale(v_row.rating)::text || ' / 10' else '' end
               || case when v_row.caption <> '' then ' · ' || v_row.caption else '' end, 1000),
          v_row.id);
  return v_row;
end $$;
