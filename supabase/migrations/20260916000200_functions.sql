-- Pofadder Bowl 2026 · helper functions, derived views and transactional RPCs
-- Every RPC re-checks membership/role from the database; nothing trusts client state.

-- ---------------------------------------------------------------------------
-- Membership helpers (security definer so RLS policies can call them cheaply)
-- ---------------------------------------------------------------------------
create or replace function public.pb_is_member(p_league uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.league_id = p_league and m.user_id = auth.uid() and m.status = 'active'
  );
$$;

create or replace function public.pb_is_commissioner(p_league uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.league_id = p_league and m.user_id = auth.uid() and m.status = 'active' and m.is_commissioner
  );
$$;

create or replace function public.pb_event_league(p_event uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select e.league_id from public.events e where e.id = p_event;
$$;

create or replace function public.pb_is_event_member(p_event uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.pb_is_member(public.pb_event_league(p_event));
$$;

create or replace function public.pb_is_event_commissioner(p_event uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.pb_is_commissioner(public.pb_event_league(p_event));
$$;

create or replace function public.pb_is_event_participant(p_event uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event and e.participant_user_id = auth.uid() and public.pb_is_member(e.league_id)
  );
$$;

create or replace function public.pb_shares_league(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships a
    join public.memberships b on a.league_id = b.league_id
    where a.user_id = auth.uid() and a.status = 'active' and b.user_id = p_user and b.status = 'active'
  );
$$;

-- Marks the caller's invited memberships active after their first verified sign-in.
create or replace function public.activate_membership()
returns void language sql security definer set search_path = public as $$
  update public.memberships set status = 'active'
  where user_id = auth.uid() and status = 'invited';
$$;

-- ---------------------------------------------------------------------------
-- Derived scoring: the score is the sum of points for challenges whose newest
-- decision state is "approved". Never an incrementing counter.
-- ---------------------------------------------------------------------------
create or replace view public.challenge_scores
with (security_invoker = true) as
select
  c.event_id,
  c.id as challenge_id,
  c.sequence,
  c.title,
  c.proof_type,
  c.points,
  s.id as approved_submission_id,
  s.version as approved_version,
  case when s.id is null then 0 else c.points end as awarded_points
from public.challenges c
left join lateral (
  select es.id, es.version
  from public.evidence_submissions es
  where es.challenge_id = c.id and es.status = 'approved'
  order by es.version desc
  limit 1
) s on true;

create or replace view public.event_scores
with (security_invoker = true) as
select
  e.id as event_id,
  e.max_points,
  coalesce(sum(cs.awarded_points), 0)::integer as approved_points,
  count(cs.approved_submission_id)::integer as approved_challenges,
  count(*)::integer as total_challenges
from public.events e
left join public.challenge_scores cs on cs.event_id = e.id
group by e.id, e.max_points;

-- ---------------------------------------------------------------------------
-- Evidence: create / submit
-- ---------------------------------------------------------------------------
create or replace function public.create_submission(
  p_event uuid,
  p_challenge uuid default null,
  p_press_prompt uuid default null,
  p_caption text default ''
) returns public.evidence_submissions
language plpgsql security definer set search_path = public as $$
declare
  v_row public.evidence_submissions;
  v_version integer;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if not public.pb_is_event_participant(p_event) then
    raise exception 'only the event participant can create evidence submissions' using errcode = '42501';
  end if;
  if num_nonnulls(p_challenge, p_press_prompt) <> 1 then
    raise exception 'exactly one of challenge or press prompt is required' using errcode = '22023';
  end if;
  if p_challenge is not null and not exists (select 1 from public.challenges where id = p_challenge and event_id = p_event) then
    raise exception 'challenge does not belong to event' using errcode = '22023';
  end if;
  if p_press_prompt is not null and not exists (select 1 from public.press_prompts where id = p_press_prompt and event_id = p_event) then
    raise exception 'press prompt does not belong to event' using errcode = '22023';
  end if;

  -- Serialise version allocation per (submitter, target).
  perform pg_advisory_xact_lock(hashtext(coalesce(p_challenge::text, p_press_prompt::text) || auth.uid()::text));

  select coalesce(max(version), 0) + 1 into v_version
  from public.evidence_submissions
  where event_id = p_event and submitter_id = auth.uid()
    and challenge_id is not distinct from p_challenge
    and press_prompt_id is not distinct from p_press_prompt;

  insert into public.evidence_submissions (event_id, challenge_id, press_prompt_id, submitter_id, version, caption)
  values (p_event, p_challenge, p_press_prompt, auth.uid(), v_version, left(coalesce(p_caption, ''), 2000))
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.submit_submission(p_submission uuid)
returns public.evidence_submissions
language plpgsql security definer set search_path = public as $$
declare
  v_row public.evidence_submissions;
  v_title text;
  v_files integer;
begin
  select * into v_row from public.evidence_submissions where id = p_submission for update;
  if v_row.id is null then raise exception 'submission not found' using errcode = 'P0002'; end if;
  if v_row.submitter_id <> auth.uid() then raise exception 'not your submission' using errcode = '42501'; end if;
  if v_row.status not in ('draft', 'flagged') then
    raise exception 'submission is % and cannot be submitted', v_row.status using errcode = '22023';
  end if;
  select count(*) into v_files from public.evidence_files where submission_id = p_submission;
  if v_files = 0 then raise exception 'attach at least one uploaded file before submitting' using errcode = '22023'; end if;

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
          left(v_title || case when v_row.caption <> '' then ' · ' || v_row.caption else '' end, 1000), v_row.id);
  return v_row;
end $$;

-- ---------------------------------------------------------------------------
-- Commissioner review: transactional and idempotent.
-- Approving version N of a challenge explicitly supersedes any previously
-- approved version (audited as a 'superseded' decision by the same actor).
-- ---------------------------------------------------------------------------
create or replace function public.review_submission(
  p_submission uuid,
  p_version integer,
  p_decision public.review_decision_kind,
  p_idempotency_key text,
  p_reason text default null,
  p_note text default null
) returns public.review_decisions
language plpgsql security definer set search_path = public as $$
declare
  v_sub public.evidence_submissions;
  v_existing public.review_decisions;
  v_decision public.review_decisions;
  v_prev record;
  v_title text;
  v_points integer;
  v_participant uuid;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then
    raise exception 'idempotency key required' using errcode = '22023';
  end if;

  -- Idempotent replay: same key returns the original decision without side effects.
  select * into v_existing from public.review_decisions where idempotency_key = p_idempotency_key;
  if v_existing.id is not null then return v_existing; end if;

  select * into v_sub from public.evidence_submissions where id = p_submission for update;
  if v_sub.id is null then raise exception 'submission not found' using errcode = 'P0002'; end if;
  if not public.pb_is_event_commissioner(v_sub.event_id) then
    raise exception 'commissioner role required' using errcode = '42501';
  end if;
  if v_sub.version <> p_version then
    raise exception 'submission version mismatch (expected %, got %)', v_sub.version, p_version using errcode = '40001';
  end if;
  if p_decision = 'flagged' and (p_reason is null or char_length(btrim(p_reason)) = 0) then
    raise exception 'a flag requires a reason' using errcode = '22023';
  end if;

  -- Lock the challenge row so concurrent approvals for the same challenge serialise.
  if v_sub.challenge_id is not null then
    perform 1 from public.challenges where id = v_sub.challenge_id for update;
  else
    perform 1 from public.press_prompts where id = v_sub.press_prompt_id for update;
  end if;

  if p_decision = 'approved' then
    if v_sub.status not in ('submitted', 'flagged') then
      raise exception 'only submitted or flagged evidence can be approved (current: %)', v_sub.status using errcode = '22023';
    end if;
    -- Explicit supersede transition for any earlier approved version of this target.
    for v_prev in
      select id, version from public.evidence_submissions
      where event_id = v_sub.event_id
        and challenge_id is not distinct from v_sub.challenge_id
        and press_prompt_id is not distinct from v_sub.press_prompt_id
        and status = 'approved' and id <> v_sub.id
    loop
      update public.evidence_submissions set status = 'superseded' where id = v_prev.id;
      insert into public.review_decisions (submission_id, submission_version, actor_id, decision, reason, note, idempotency_key)
      values (v_prev.id, v_prev.version, auth.uid(), 'superseded',
              format('Superseded by version %s approval', v_sub.version), null,
              p_idempotency_key || ':supersede:' || v_prev.id::text);
    end loop;
    update public.evidence_submissions set status = 'approved' where id = v_sub.id;
  elsif p_decision = 'flagged' then
    if v_sub.status not in ('submitted', 'approved') then
      raise exception 'only submitted or approved evidence can be flagged (current: %)', v_sub.status using errcode = '22023';
    end if;
    update public.evidence_submissions set status = 'flagged' where id = v_sub.id;
  elsif p_decision = 'superseded' then
    if v_sub.status <> 'approved' then
      raise exception 'only approved evidence can be superseded' using errcode = '22023';
    end if;
    update public.evidence_submissions set status = 'superseded' where id = v_sub.id;
  end if;

  insert into public.review_decisions (submission_id, submission_version, actor_id, decision, reason, note, idempotency_key)
  values (v_sub.id, v_sub.version, auth.uid(), p_decision, nullif(btrim(p_reason), ''), nullif(btrim(p_note), ''), p_idempotency_key)
  returning * into v_decision;

  select coalesce(c.title, 'Press room answer'), coalesce(c.points, 0)
    into v_title, v_points
  from public.evidence_submissions s
  left join public.challenges c on c.id = s.challenge_id
  where s.id = v_sub.id;

  insert into public.activity_posts (event_id, author_id, kind, heading, body, ref_submission_id)
  values (
    v_sub.event_id, auth.uid(), 'decision',
    case p_decision when 'approved' then 'Points on the board' when 'flagged' then 'Flag on the play' else 'Proof superseded' end,
    left(case p_decision
      when 'approved' then v_title || case when v_points > 0 then format(' approved. That''s %s points.', v_points) else ' approved.' end
      when 'flagged' then v_title || ' flagged: ' || coalesce(p_reason, '')
      else v_title || ' superseded.' end, 1000),
    v_sub.id
  );
  return v_decision;
end $$;

-- ---------------------------------------------------------------------------
-- Check-ins (participant only, consent required, deduplicated by client id)
-- ---------------------------------------------------------------------------
create or replace function public.record_checkin(
  p_event uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_captured_at timestamptz,
  p_client_id text,
  p_accuracy_m double precision default null
) returns public.checkins
language plpgsql security definer set search_path = public as $$
declare
  v_row public.checkins;
  v_sharing boolean;
begin
  if not public.pb_is_event_participant(p_event) then
    raise exception 'only the event participant can check in' using errcode = '42501';
  end if;
  select sharing_enabled into v_sharing from public.location_settings where event_id = p_event and user_id = auth.uid();
  if not coalesce(v_sharing, false) then
    raise exception 'location sharing is paused; resume sharing before checking in' using errcode = '42501';
  end if;
  if p_client_id is null or char_length(p_client_id) < 8 then
    raise exception 'client id required' using errcode = '22023';
  end if;
  if p_captured_at > now() + interval '5 minutes' or p_captured_at < now() - interval '2 days' then
    raise exception 'captured_at is outside the accepted window' using errcode = '22023';
  end if;

  insert into public.checkins (event_id, user_id, latitude, longitude, accuracy_m, captured_at, client_id)
  values (p_event, auth.uid(), p_latitude, p_longitude, p_accuracy_m, p_captured_at, p_client_id)
  on conflict (user_id, client_id) do update set received_at = public.checkins.received_at
  returning * into v_row;

  -- Only post to the feed for a brand-new check-in (not a replayed client id).
  if v_row.received_at >= now() - interval '2 seconds' and not exists (
    select 1 from public.activity_posts where ref_checkin_id = v_row.id
  ) then
    insert into public.activity_posts (event_id, author_id, kind, heading, body, ref_checkin_id)
    values (p_event, auth.uid(), 'checkin', 'Checked in',
            format('Position shared · accuracy %s m', coalesce(round(p_accuracy_m)::text, '?')), v_row.id);
  end if;
  return v_row;
end $$;

create or replace function public.remove_checkins(p_event uuid, p_ids uuid[] default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  if not public.pb_is_event_participant(p_event) then
    raise exception 'only the event participant can remove check-ins' using errcode = '42501';
  end if;
  update public.checkins set removed_at = now()
  where event_id = p_event and user_id = auth.uid() and removed_at is null
    and (p_ids is null or id = any (p_ids));
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ---------------------------------------------------------------------------
-- Punishment Bingo
-- ---------------------------------------------------------------------------
-- Stable shuffled layout per member, created once. Cell 12 is always the free square.
create or replace function public.ensure_bingo_card(p_event uuid)
returns public.bingo_cards
language plpgsql security definer set search_path = public as $$
declare
  v_card public.bingo_cards;
  v_positions smallint[];
  v_free smallint;
  v_layout smallint[] := array[]::smallint[];
  v_i integer;
begin
  if not public.pb_is_event_member(p_event) then
    raise exception 'league membership required' using errcode = '42501';
  end if;
  select * into v_card from public.bingo_cards where event_id = p_event and user_id = auth.uid();
  if v_card.id is not null then return v_card; end if;

  select position into v_free from public.bingo_squares where event_id = p_event and is_free limit 1;
  select array_agg(position order by random()) into v_positions
  from public.bingo_squares where event_id = p_event and not is_free;
  if v_free is null or array_length(v_positions, 1) <> 24 then
    raise exception 'event needs 24 squares plus one free square' using errcode = '22023';
  end if;
  for v_i in 1..24 loop
    if v_i = 13 then v_layout := v_layout || v_free; end if;
    v_layout := v_layout || v_positions[v_i];
  end loop;

  insert into public.bingo_cards (event_id, user_id, layout)
  values (p_event, auth.uid(), v_layout)
  on conflict (event_id, user_id) do update set layout = public.bingo_cards.layout
  returning * into v_card;
  return v_card;
end $$;

create or replace function public.propose_bingo_incident(p_event uuid, p_square uuid, p_note text default null)
returns public.bingo_incidents
language plpgsql security definer set search_path = public as $$
declare v_row public.bingo_incidents;
begin
  if not public.pb_is_event_member(p_event) then
    raise exception 'league membership required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.bingo_squares where id = p_square and event_id = p_event and not is_free) then
    raise exception 'square does not belong to event' using errcode = '22023';
  end if;
  if exists (select 1 from public.bingo_incidents where event_id = p_event and square_id = p_square and status = 'confirmed') then
    raise exception 'that square is already confirmed' using errcode = '23505';
  end if;
  insert into public.bingo_incidents (event_id, square_id, proposed_by, note)
  values (p_event, p_square, auth.uid(), left(nullif(btrim(p_note), ''), 300))
  returning * into v_row;
  return v_row;
end $$;

-- Pure line detection over card cell indexes; exposed for testing.
create or replace function public.bingo_lines(p_marked_cells smallint[])
returns table (line_key text)
language sql immutable as $$
  with lines as (
    select 'row' || r as key, array_agg((r * 5 + c)::smallint order by c) as cells from generate_series(0, 4) r, generate_series(0, 4) c group by r
    union all
    select 'col' || c, array_agg((r * 5 + c)::smallint order by r) from generate_series(0, 4) r, generate_series(0, 4) c group by c
    union all select 'diag_main', array[0, 6, 12, 18, 24]::smallint[]
    union all select 'diag_anti', array[4, 8, 12, 16, 20]::smallint[]
    union all select 'full_house', (select array_agg(i::smallint) from generate_series(0, 24) i)
  )
  select key from lines where cells <@ p_marked_cells;
$$;

create or replace function public.decide_bingo_incident(p_incident uuid, p_confirm boolean)
returns public.bingo_incidents
language plpgsql security definer set search_path = public as $$
declare
  v_inc public.bingo_incidents;
  v_confirmed smallint[];
  v_card record;
  v_marked smallint[];
  v_i integer;
  v_wins integer := 0;
  v_text text;
begin
  select * into v_inc from public.bingo_incidents where id = p_incident for update;
  if v_inc.id is null then raise exception 'incident not found' using errcode = 'P0002'; end if;
  if not public.pb_is_event_commissioner(v_inc.event_id) then
    raise exception 'commissioner role required' using errcode = '42501';
  end if;
  if v_inc.status <> 'proposed' then return v_inc; end if;  -- idempotent

  update public.bingo_incidents
  set status = (case when p_confirm then 'confirmed' else 'rejected' end)::public.incident_status, decided_by = auth.uid(), decided_at = now()
  where id = p_incident returning * into v_inc;

  if not p_confirm then return v_inc; end if;

  -- Serialise win detection per event.
  perform pg_advisory_xact_lock(hashtext('bingo:' || v_inc.event_id::text));

  select array_agg(distinct sq.position) into v_confirmed
  from public.bingo_incidents bi join public.bingo_squares sq on sq.id = bi.square_id
  where bi.event_id = v_inc.event_id and bi.status = 'confirmed';
  v_confirmed := coalesce(v_confirmed, array[]::smallint[]) || coalesce(
    (select array_agg(position) from public.bingo_squares where event_id = v_inc.event_id and is_free), array[]::smallint[]);

  for v_card in select * from public.bingo_cards where event_id = v_inc.event_id loop
    v_marked := array[]::smallint[];
    for v_i in 1..25 loop
      if v_card.layout[v_i] = any (v_confirmed) then v_marked := v_marked || (v_i - 1)::smallint; end if;
    end loop;
    insert into public.bingo_wins (event_id, user_id, line_key, incident_id, achieved_at)
    select v_inc.event_id, v_card.user_id, l.line_key, v_inc.id, now()
    from public.bingo_lines(v_marked) l
    on conflict (event_id, user_id, line_key) do nothing;
    get diagnostics v_i = row_count;
    v_wins := v_wins + v_i;
  end loop;

  select text into v_text from public.bingo_squares where id = v_inc.square_id;
  insert into public.activity_posts (event_id, author_id, kind, heading, body)
  values (v_inc.event_id, auth.uid(), 'bingo', 'Bingo incident confirmed',
          left(v_text || case when v_wins > 0 then format(' · %s new line(s) completed', v_wins) else '' end, 1000));
  return v_inc;
end $$;

-- Leaderboard without exposing other members' layouts.
create or replace function public.bingo_leaderboard(p_event uuid)
returns table (user_id uuid, display_name text, kit_team text, marked integer, lines integer, first_line_at timestamptz, full_house_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare v_confirmed smallint[];
begin
  if not public.pb_is_event_member(p_event) then
    raise exception 'league membership required' using errcode = '42501';
  end if;
  select array_agg(distinct sq.position) into v_confirmed
  from public.bingo_incidents bi join public.bingo_squares sq on sq.id = bi.square_id
  where bi.event_id = p_event and bi.status = 'confirmed';
  v_confirmed := coalesce(v_confirmed, array[]::smallint[]) || coalesce(
    (select array_agg(position) from public.bingo_squares where event_id = p_event and is_free), array[]::smallint[]);

  return query
  select c.user_id, p.display_name, p.kit_team,
    (select count(*)::integer from unnest(c.layout) l where l = any (v_confirmed)) as marked,
    (select count(*)::integer from public.bingo_wins w where w.event_id = p_event and w.user_id = c.user_id and w.line_key <> 'full_house') as lines,
    (select min(w.achieved_at) from public.bingo_wins w where w.event_id = p_event and w.user_id = c.user_id and w.line_key <> 'full_house') as first_line_at,
    (select min(w.achieved_at) from public.bingo_wins w where w.event_id = p_event and w.user_id = c.user_id and w.line_key = 'full_house') as full_house_at
  from public.bingo_cards c join public.profiles p on p.id = c.user_id
  where c.event_id = p_event
  order by lines desc, first_line_at asc nulls last, marked desc, p.display_name asc;
end $$;

-- ---------------------------------------------------------------------------
-- Predictions: server-side lock at the configured departure timestamp.
-- ---------------------------------------------------------------------------
create or replace function public.upsert_prediction(
  p_event uuid, p_run_seconds integer, p_meal_rating smallint, p_complaint_count integer
) returns public.predictions
language plpgsql security definer set search_path = public as $$
declare v_lock timestamptz; v_row public.predictions;
begin
  if not public.pb_is_event_member(p_event) then
    raise exception 'league membership required' using errcode = '42501';
  end if;
  select prediction_lock_at into v_lock from public.events where id = p_event;
  if now() >= v_lock then
    raise exception 'predictions locked at %', v_lock using errcode = '42501';
  end if;
  insert into public.predictions (event_id, user_id, run_seconds, meal_rating, complaint_count)
  values (p_event, auth.uid(), p_run_seconds, p_meal_rating, p_complaint_count)
  on conflict (event_id, user_id) do update
    set run_seconds = excluded.run_seconds, meal_rating = excluded.meal_rating, complaint_count = excluded.complaint_count
  returning * into v_row;
  return v_row;
end $$;

-- Predictions visible to others only after the reveal time; own rows always.
create or replace view public.predictions_revealed
with (security_invoker = true) as
select p.*, pr.display_name, pr.kit_team
from public.predictions p
join public.events e on e.id = p.event_id
join public.profiles pr on pr.id = p.user_id
where p.user_id = auth.uid() or now() >= e.prediction_reveal_at;

create or replace function public.resolve_predictions(p_event uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_res public.official_results;
  v_rules public.prediction_rules;
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

  delete from public.prediction_awards where event_id = p_event;

  if v_res.run_seconds is not null then
    insert into public.prediction_awards (event_id, user_id, category, points)
    select p_event, user_id, 'run', v_rules.run_points
    from public.predictions p
    where p.event_id = p_event
      and abs(p.run_seconds - v_res.run_seconds) = (select min(abs(q.run_seconds - v_res.run_seconds)) from public.predictions q where q.event_id = p_event);
  end if;
  if v_res.meal_rating is not null then
    insert into public.prediction_awards (event_id, user_id, category, points)
    select p_event, user_id, 'meal', v_rules.meal_points
    from public.predictions p where p.event_id = p_event and p.meal_rating = v_res.meal_rating;
  end if;
  if v_res.complaint_count is not null then
    insert into public.prediction_awards (event_id, user_id, category, points)
    select p_event, user_id, 'complaints', v_rules.complaints_points
    from public.predictions p
    where p.event_id = p_event
      and abs(p.complaint_count - v_res.complaint_count) = (select min(abs(q.complaint_count - v_res.complaint_count)) from public.predictions q where q.event_id = p_event);
  end if;

  select count(*) into v_count from public.prediction_awards where event_id = p_event;
  update public.official_results set resolved_at = now() where event_id = p_event;
  insert into public.activity_posts (event_id, author_id, kind, heading, body)
  values (p_event, auth.uid(), 'prediction', 'Predictions resolved', format('%s award(s) handed out against the official results.', v_count));
  return v_count;
end $$;

-- ---------------------------------------------------------------------------
-- Commissioner administration (server actions call these with the user's session)
-- ---------------------------------------------------------------------------
create or replace function public.set_member_role(
  p_league uuid, p_user uuid, p_role public.membership_role, p_is_commissioner boolean, p_status public.membership_status
) returns public.memberships
language plpgsql security definer set search_path = public as $$
declare v_row public.memberships;
begin
  if not public.pb_is_commissioner(p_league) then
    raise exception 'commissioner role required' using errcode = '42501';
  end if;
  if p_user = auth.uid() and not p_is_commissioner then
    raise exception 'you cannot remove your own commissioner role' using errcode = '22023';
  end if;
  update public.memberships
  set role = p_role, is_commissioner = p_is_commissioner, status = p_status
  where league_id = p_league and user_id = p_user
  returning * into v_row;
  if v_row.id is null then raise exception 'membership not found' using errcode = 'P0002'; end if;
  return v_row;
end $$;

create or replace function public.set_event_participant(p_event uuid, p_user uuid default null)
returns public.events
language plpgsql security definer set search_path = public as $$
declare v_row public.events;
begin
  if not public.pb_is_event_commissioner(p_event) then
    raise exception 'commissioner role required' using errcode = '42501';
  end if;
  update public.events set participant_user_id = p_user where id = p_event returning * into v_row;
  return v_row;
end $$;

create or replace function public.confirm_sleeper_link(p_league uuid, p_user uuid, p_confirmed boolean, p_sleeper_user_id text default null)
returns public.memberships
language plpgsql security definer set search_path = public as $$
declare v_row public.memberships;
begin
  if not public.pb_is_commissioner(p_league) then
    raise exception 'commissioner role required' using errcode = '42501';
  end if;
  if p_sleeper_user_id is not null and not exists (
    select 1 from public.sleeper_league_users where league_id = p_league and sleeper_user_id = p_sleeper_user_id
  ) then
    raise exception 'unknown Sleeper user for this league' using errcode = '22023';
  end if;
  update public.memberships
  set sleeper_user_id = p_sleeper_user_id, sleeper_confirmed = (p_sleeper_user_id is not null and p_confirmed)
  where league_id = p_league and user_id = p_user
  returning * into v_row;
  if v_row.id is null then raise exception 'membership not found' using errcode = 'P0002'; end if;
  return v_row;
end $$;

-- A member may claim (not confirm) a Sleeper identity.
create or replace function public.claim_sleeper_identity(p_league uuid, p_sleeper_user_id text default null)
returns public.memberships
language plpgsql security definer set search_path = public as $$
declare v_row public.memberships;
begin
  if not public.pb_is_member(p_league) then
    raise exception 'league membership required' using errcode = '42501';
  end if;
  if p_sleeper_user_id is not null and not exists (
    select 1 from public.sleeper_league_users where league_id = p_league and sleeper_user_id = p_sleeper_user_id
  ) then
    raise exception 'unknown Sleeper user for this league' using errcode = '22023';
  end if;
  update public.memberships
  set sleeper_user_id = p_sleeper_user_id, sleeper_confirmed = false
  where league_id = p_league and user_id = auth.uid()
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.set_penalty(p_penalty uuid, p_applied boolean, p_note text default null)
returns public.penalties
language plpgsql security definer set search_path = public as $$
declare v_row public.penalties;
begin
  select * into v_row from public.penalties where id = p_penalty;
  if v_row.id is null then raise exception 'penalty not found' using errcode = 'P0002'; end if;
  if not public.pb_is_event_commissioner(v_row.event_id) then
    raise exception 'commissioner role required' using errcode = '42501';
  end if;
  update public.penalties
  set applied = p_applied, applied_by = case when p_applied then auth.uid() else null end,
      applied_at = case when p_applied then now() else null end, note = left(p_note, 500)
  where id = p_penalty returning * into v_row;
  return v_row;
end $$;

create or replace function public.issue_certificate(p_event uuid, p_is_public boolean)
returns public.certificates
language plpgsql security definer set search_path = public as $$
declare
  v_row public.certificates;
  v_score record;
  v_res public.official_results;
  v_participant text;
  v_bingo text;
  v_pred text;
begin
  if not public.pb_is_event_commissioner(p_event) then
    raise exception 'commissioner role required' using errcode = '42501';
  end if;
  select * into v_score from public.event_scores where event_id = p_event;
  select * into v_res from public.official_results where event_id = p_event;
  select p.display_name into v_participant
  from public.events e join public.profiles p on p.id = e.participant_user_id where e.id = p_event;
  select string_agg(p.display_name, ', ' order by w.achieved_at) into v_bingo
  from (select distinct on (user_id) user_id, achieved_at from public.bingo_wins where event_id = p_event and line_key <> 'full_house' order by user_id, achieved_at) w
  join public.profiles p on p.id = w.user_id;
  select string_agg(p.display_name || ' (' || t.pts || ')', ', ' order by t.pts desc) into v_pred
  from (select user_id, sum(points) as pts from public.prediction_awards where event_id = p_event group by user_id) t
  join public.profiles p on p.id = t.user_id;

  insert into public.certificates (event_id, status, issued_by, issued_at, is_public, summary)
  values (p_event, 'issued', auth.uid(), now(), p_is_public, jsonb_build_object(
    'participant', v_participant,
    'approved_points', coalesce(v_score.approved_points, 0),
    'max_points', coalesce(v_score.max_points, 100),
    'approved_challenges', coalesce(v_score.approved_challenges, 0),
    'total_challenges', coalesce(v_score.total_challenges, 0),
    'run_distance_km', v_res.run_distance_km,
    'run_seconds', v_res.run_seconds,
    'bingo_winners', v_bingo,
    'prediction_winners', v_pred,
    'issued_at', now()
  ))
  on conflict (event_id) do update
    set status = 'issued', issued_by = excluded.issued_by, issued_at = excluded.issued_at,
        is_public = excluded.is_public, summary = excluded.summary
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.set_certificate_consent(p_event uuid, p_consent boolean)
returns public.certificates
language plpgsql security definer set search_path = public as $$
declare v_row public.certificates;
begin
  if not public.pb_is_event_participant(p_event) then
    raise exception 'participant only' using errcode = '42501';
  end if;
  insert into public.certificates (event_id, participant_consent) values (p_event, p_consent)
  on conflict (event_id) do update set participant_consent = excluded.participant_consent
  returning * into v_row;
  return v_row;
end $$;

-- Public recap: only when the commissioner published it AND the participant consented.
create or replace function public.public_certificate(p_league_slug text, p_event_slug text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select c.summary || jsonb_build_object('event_name', e.name, 'league_name', l.name)
  from public.certificates c
  join public.events e on e.id = c.event_id
  join public.leagues l on l.id = e.league_id
  where l.slug = p_league_slug and e.slug = p_event_slug
    and c.status = 'issued' and c.is_public and c.participant_consent
  limit 1;
$$;

-- Current effective role of the caller for an event.
create or replace function public.my_event_role(p_event uuid)
returns text
language sql stable security definer set search_path = public as $$
  select case
    when public.pb_is_event_commissioner(p_event) then 'commissioner'
    when public.pb_is_event_participant(p_event) then 'participant'
    when public.pb_is_event_member(p_event) then 'member'
    else null end;
$$;

-- Restrict RPC surface to signed-in users.
revoke execute on all functions in schema public from public, anon;
grant execute on function public.public_certificate(text, text) to anon, authenticated;
grant execute on function public.bingo_lines(smallint[]) to anon, authenticated;
