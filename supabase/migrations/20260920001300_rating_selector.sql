-- Rated proof and a simpler prediction slip.
--
-- 1. The chicken and rib combo is rated out of ten by the participant when the proof is
--    submitted. The rating lives on the submission (one per version) and a challenge says
--    whether it wants one (challenges.rated). submit_submission refuses a rated play without
--    a score and carries the score into the feed post.
-- 2. The prediction slip drops the complaint count: it was never verifiable. The column stays
--    (nullable) so the previous deploy keeps working while Vercel builds; the four-argument
--    upsert_prediction overload is kept as a shim that ignores the count. resolve_predictions
--    no longer awards a "complaints" category; existing awards are recomputed on resolve.
-- Backward compatible: only additive columns, relaxed constraints and replaced functions.

-- ---------------------------------------------------------------------------
-- 1. Rated proof
-- ---------------------------------------------------------------------------
alter table public.challenges add column if not exists rated boolean not null default false;
alter table public.evidence_submissions add column if not exists rating smallint check (rating between 1 and 10);

update public.challenges c
   set rated = true
  from public.events e
 where c.event_id = e.id and e.slug = 'pofadder-bowl-2026'
   and c.sequence = 6 and c.title ilike '%rated out of ten%';

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
               || case when v_rated and v_row.rating is not null then ' · ' || v_row.rating::text || ' / 10' else '' end
               || case when v_row.caption <> '' then ' · ' || v_row.caption else '' end, 1000),
          v_row.id);
  return v_row;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Prediction slip without the complaint count
-- ---------------------------------------------------------------------------
alter table public.predictions alter column complaint_count drop not null;
alter table public.prediction_rules alter column complaints_points set default 0;
update public.prediction_rules set complaints_points = 0 where complaints_points <> 0;

create or replace function public.upsert_prediction(
  p_event uuid, p_run_seconds integer, p_meal_rating smallint
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
  insert into public.predictions (event_id, user_id, run_seconds, meal_rating, complaint_count)
  values (p_event, auth.uid(), p_run_seconds, p_meal_rating, null)
  on conflict (event_id, user_id) do update
    set run_seconds = excluded.run_seconds, meal_rating = excluded.meal_rating, complaint_count = null, updated_at = now()
  returning * into v_row;
  return v_row;
end $$;

-- Shim for the deploy that still sends a complaint count; drop once that deploy is gone.
create or replace function public.upsert_prediction(
  p_event uuid, p_run_seconds integer, p_meal_rating smallint, p_complaint_count integer
) returns public.predictions
language sql security definer set search_path = public as $$
  select public.upsert_prediction(p_event, p_run_seconds, p_meal_rating);
$$;

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

  -- Only slips of members who are still in the league are scored.
  if v_res.run_seconds is not null then
    insert into public.prediction_awards (event_id, user_id, category, points)
    with active as (
      select p.* from public.predictions p
      join public.memberships m on m.league_id = v_league and m.user_id = p.user_id and m.status = 'active'
      where p.event_id = p_event
    )
    select p_event, user_id, 'run', v_rules.run_points
    from active p
    where abs(p.run_seconds - v_res.run_seconds) = (select min(abs(q.run_seconds - v_res.run_seconds)) from active q);
  end if;
  if v_res.meal_rating is not null then
    insert into public.prediction_awards (event_id, user_id, category, points)
    select p_event, p.user_id, 'meal', v_rules.meal_points
    from public.predictions p
    join public.memberships m on m.league_id = v_league and m.user_id = p.user_id and m.status = 'active'
    where p.event_id = p_event and p.meal_rating = v_res.meal_rating;
  end if;

  select count(*) into v_count from public.prediction_awards where event_id = p_event;
  update public.official_results set resolved_at = now() where event_id = p_event;
  -- Re-resolving replaces the earlier announcement instead of stacking posts.
  delete from public.activity_posts where event_id = p_event and kind = 'prediction' and heading = 'Predictions resolved';
  insert into public.activity_posts (event_id, author_id, kind, heading, body)
  values (p_event, auth.uid(), 'prediction', 'Predictions resolved', format('%s award(s) handed out against the official results.', v_count));
  return v_count;
end $$;
