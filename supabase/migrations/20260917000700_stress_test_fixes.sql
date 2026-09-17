-- Pofadder Bowl 2026 · fixes from the September stress test
-- Draft privacy, review idempotency, bingo backfill for late cards, participant role
-- enforcement, consent withdrawal for removed members, press prompt gating, Sleeper
-- identity uniqueness, storage policy guards, feed hygiene and RPC grants.

-- ---------------------------------------------------------------------------
-- 1. Helpers
-- ---------------------------------------------------------------------------

-- Safe cast used by storage policies: one malformed object name must not break reads for everyone.
create or replace function public.pb_uuid_or_null(p text)
returns uuid language sql immutable as $$
  select case when p ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then p::uuid else null end;
$$;

-- Participant powers need the participant role on an active membership, not only the pointer on the event.
create or replace function public.pb_is_event_participant(p_event uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.events e
    join public.memberships m on m.league_id = e.league_id and m.user_id = auth.uid()
    where e.id = p_event and e.participant_user_id = auth.uid()
      and m.status = 'active' and m.role = 'participant'
  );
$$;

-- Unsubmitted drafts are private to the submitter and the commissioners; everything else is league-visible.
create or replace function public.pb_can_view_submission(p_submission uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.evidence_submissions s
    where s.id = p_submission
      and public.pb_is_event_member(s.event_id)
      and (s.status <> 'draft' or s.submitter_id = auth.uid() or public.pb_is_event_commissioner(s.event_id))
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. Draft privacy (tables and storage)
-- ---------------------------------------------------------------------------

drop policy if exists submissions_select on public.evidence_submissions;
create policy submissions_select on public.evidence_submissions for select to authenticated
  using (
    public.pb_is_event_member(event_id)
    and (status <> 'draft' or submitter_id = auth.uid() or public.pb_is_event_commissioner(event_id))
  );

drop policy if exists evidence_files_select on public.evidence_files;
create policy evidence_files_select on public.evidence_files for select to authenticated
  using (public.pb_can_view_submission(submission_id));

-- Files must live in their own submission's folder and carry a sane size.
drop policy if exists evidence_files_insert_own on public.evidence_files;
create policy evidence_files_insert_own on public.evidence_files for insert to authenticated
  with check (
    byte_size between 1 and 524288000
    and exists (
      select 1 from public.evidence_submissions s
      where s.id = submission_id and s.submitter_id = auth.uid() and s.status in ('draft', 'flagged')
        and storage_path like s.event_id::text || '/' || auth.uid()::text || '/' || s.id::text || '/%'
    )
  );

-- A flagged submission may lose a bad file as well as gain a better one (the flag decision stays audited).
drop policy if exists evidence_files_delete_own_draft on public.evidence_files;
create policy evidence_files_delete_own_draft on public.evidence_files for delete to authenticated
  using (exists (
    select 1 from public.evidence_submissions s
    where s.id = submission_id and s.submitter_id = auth.uid() and s.status in ('draft', 'flagged')
  ));

drop policy if exists evidence_upload_participant on storage.objects;
create policy evidence_upload_participant on storage.objects for insert to authenticated
  with check (
    bucket_id = 'evidence'
    and array_length(storage.foldername(name), 1) = 3
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.pb_is_event_participant(public.pb_uuid_or_null((storage.foldername(name))[1]))
    and exists (
      select 1 from public.evidence_submissions s
      where s.id = public.pb_uuid_or_null((storage.foldername(name))[3])
        and s.event_id = public.pb_uuid_or_null((storage.foldername(name))[1])
        and s.submitter_id = auth.uid() and s.status in ('draft', 'flagged')
    )
  );

drop policy if exists evidence_read_members on storage.objects;
create policy evidence_read_members on storage.objects for select to authenticated
  using (
    bucket_id = 'evidence'
    and array_length(storage.foldername(name), 1) = 3
    and public.pb_can_view_submission(public.pb_uuid_or_null((storage.foldername(name))[3]))
  );

drop policy if exists evidence_delete_own_draft on storage.objects;
create policy evidence_delete_own_draft on storage.objects for delete to authenticated
  using (
    bucket_id = 'evidence'
    and array_length(storage.foldername(name), 1) = 3
    and (storage.foldername(name))[2] = auth.uid()::text
    and exists (
      select 1 from public.evidence_submissions s
      where s.id = public.pb_uuid_or_null((storage.foldername(name))[3])
        and s.submitter_id = auth.uid() and s.status in ('draft', 'flagged')
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Evidence lifecycle
-- ---------------------------------------------------------------------------

-- Press prompts are time-gated on the server too, not only in the page.
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
  v_opens timestamptz;
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
  if p_press_prompt is not null then
    select opens_at into v_opens from public.press_prompts where id = p_press_prompt and event_id = p_event;
    if v_opens is null then
      raise exception 'press prompt does not belong to event' using errcode = '22023';
    end if;
    if now() < v_opens then
      raise exception 'this press prompt is not open yet' using errcode = '22023';
    end if;
  end if;

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

-- Submitting requires a current participant membership, not only ownership of the draft.
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
  if not public.pb_is_event_participant(v_row.event_id) then
    raise exception 'only the event participant can submit evidence' using errcode = '42501';
  end if;
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

-- Review: authorise before the idempotency lookup, replay only an identical request,
-- and treat a concurrent retry with the same key as a replay instead of a raw unique violation.
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
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then
    raise exception 'idempotency key required' using errcode = '22023';
  end if;

  select * into v_sub from public.evidence_submissions where id = p_submission for update;
  if v_sub.id is null then raise exception 'submission not found' using errcode = 'P0002'; end if;
  if not public.pb_is_event_commissioner(v_sub.event_id) then
    raise exception 'commissioner role required' using errcode = '42501';
  end if;

  -- Idempotent replay: the same key returns the original decision, but only for the same request.
  select * into v_existing from public.review_decisions where idempotency_key = p_idempotency_key;
  if v_existing.id is not null then
    -- Same request and the submission still carries that outcome: a retry, hand back the original.
    if v_existing.submission_id = v_sub.id and v_existing.submission_version = p_version and v_existing.decision = p_decision
       and v_sub.status::text = v_existing.decision::text then
      return v_existing;
    end if;
    raise exception 'this request key was already used for an earlier decision; reload and try again' using errcode = '23505';
  end if;

  if v_sub.version <> p_version then
    raise exception 'submission version mismatch (expected %, got %)', v_sub.version, p_version using errcode = '40001';
  end if;
  if p_decision = 'flagged' and (p_reason is null or char_length(btrim(p_reason)) = 0) then
    raise exception 'a flag requires a reason' using errcode = '22023';
  end if;

  if v_sub.challenge_id is not null then
    perform 1 from public.challenges where id = v_sub.challenge_id for update;
  else
    perform 1 from public.press_prompts where id = v_sub.press_prompt_id for update;
  end if;

  if p_decision = 'approved' then
    if v_sub.status not in ('submitted', 'flagged') then
      raise exception 'only submitted or flagged evidence can be approved (current: %)', v_sub.status using errcode = '22023';
    end if;
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
              p_idempotency_key || ':supersede:' || v_prev.id::text)
      on conflict (idempotency_key) do nothing;
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

  begin
    insert into public.review_decisions (submission_id, submission_version, actor_id, decision, reason, note, idempotency_key)
    values (v_sub.id, v_sub.version, auth.uid(), p_decision, nullif(btrim(p_reason), ''), nullif(btrim(p_note), ''), p_idempotency_key)
    returning * into v_decision;
  exception when unique_violation then
    -- A concurrent retry with the same key committed first: hand back its decision if it is the same request.
    select * into v_existing from public.review_decisions where idempotency_key = p_idempotency_key;
    if v_existing.submission_id = v_sub.id and v_existing.submission_version = p_version and v_existing.decision = p_decision then
      return v_existing;
    end if;
    raise exception 'this request key was already used for a different decision; reload and try again' using errcode = '23505';
  end;

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

-- An event with no challenges scores 0/0, not 0/1.
create or replace view public.event_scores
with (security_invoker = true) as
select
  e.id as event_id,
  e.max_points,
  coalesce(sum(cs.awarded_points), 0)::integer as approved_points,
  count(cs.approved_submission_id)::integer as approved_challenges,
  count(cs.challenge_id)::integer as total_challenges
from public.events e
left join public.challenge_scores cs on cs.event_id = e.id
group by e.id, e.max_points;

-- ---------------------------------------------------------------------------
-- 4. Check-ins: de-duplicate per event; removing history also removes the feed posts;
--    a removed member can still withdraw consent and erase their positions.
-- ---------------------------------------------------------------------------

alter table public.checkins drop constraint if exists checkins_user_id_client_id_key;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'checkins_event_user_client_key') then
    alter table public.checkins add constraint checkins_event_user_client_key unique (event_id, user_id, client_id);
  end if;
end $$;

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
  on conflict (event_id, user_id, client_id) do update set received_at = public.checkins.received_at
  returning * into v_row;

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
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  -- Own rows only; no role check so a member who has left can still erase their history.
  with removed as (
    update public.checkins set removed_at = now()
    where event_id = p_event and user_id = auth.uid() and removed_at is null
      and (p_ids is null or id = any (p_ids))
    returning id
  ), posts as (
    delete from public.activity_posts where ref_checkin_id in (select id from removed) returning 1
  )
  select count(*) into v_count from removed;
  return v_count;
end $$;

drop policy if exists location_settings_update on public.location_settings;
create policy location_settings_update on public.location_settings for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- The action upserts (insert … on conflict do update), so the insert check must also admit an existing own row.
drop policy if exists location_settings_write on public.location_settings;
create policy location_settings_write on public.location_settings for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      public.pb_is_event_participant(event_id)
      or exists (select 1 from public.location_settings l where l.event_id = location_settings.event_id and l.user_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Bingo: a card created after incidents were confirmed still earns its lines.
-- ---------------------------------------------------------------------------

create or replace function public.pb_award_bingo_lines(p_event uuid, p_incident uuid default null, p_user uuid default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_confirmed smallint[];
  v_card record;
  v_marked smallint[];
  v_i integer;
  v_wins integer := 0;
begin
  select array_agg(distinct sq.position) into v_confirmed
  from public.bingo_incidents bi join public.bingo_squares sq on sq.id = bi.square_id
  where bi.event_id = p_event and bi.status = 'confirmed';
  v_confirmed := coalesce(v_confirmed, array[]::smallint[]) || coalesce(
    (select array_agg(position) from public.bingo_squares where event_id = p_event and is_free), array[]::smallint[]);

  for v_card in select * from public.bingo_cards where event_id = p_event and (p_user is null or user_id = p_user) loop
    v_marked := array[]::smallint[];
    for v_i in 1..25 loop
      if v_card.layout[v_i] = any (v_confirmed) then v_marked := v_marked || (v_i - 1)::smallint; end if;
    end loop;
    insert into public.bingo_wins (event_id, user_id, line_key, incident_id, achieved_at)
    select p_event, v_card.user_id, l.line_key, p_incident, now()
    from public.bingo_lines(v_marked) l
    on conflict (event_id, user_id, line_key) do nothing;
    get diagnostics v_i = row_count;
    v_wins := v_wins + v_i;
  end loop;
  return v_wins;
end $$;
revoke execute on function public.pb_award_bingo_lines(uuid, uuid, uuid) from public, anon, authenticated;

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

  -- Lines already completed by earlier confirmations count for a late card too.
  perform pg_advisory_xact_lock(hashtext('bingo:' || p_event::text));
  perform public.pb_award_bingo_lines(p_event, null, auth.uid());
  return v_card;
end $$;

create or replace function public.decide_bingo_incident(p_incident uuid, p_confirm boolean)
returns public.bingo_incidents
language plpgsql security definer set search_path = public as $$
declare
  v_inc public.bingo_incidents;
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

  perform pg_advisory_xact_lock(hashtext('bingo:' || v_inc.event_id::text));
  v_wins := public.pb_award_bingo_lines(v_inc.event_id, v_inc.id, null);

  select text into v_text from public.bingo_squares where id = v_inc.square_id;
  insert into public.activity_posts (event_id, author_id, kind, heading, body)
  values (v_inc.event_id, auth.uid(), 'bingo', 'Bingo incident confirmed',
          left(v_text || case when v_wins > 0 then format(' · %s new line(s) completed', v_wins) else '' end, 1000));
  return v_inc;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Predictions: only active members are scored; one feed post per resolution;
--    rows of departed members still show after the reveal; lock and reveal instants
--    cannot be moved once the reveal has passed.
-- ---------------------------------------------------------------------------

create or replace view public.predictions_revealed
with (security_invoker = true) as
select p.*, coalesce(pr.display_name, 'Former member') as display_name, pr.kit_team
from public.predictions p
join public.events e on e.id = p.event_id
left join public.profiles pr on pr.id = p.user_id
where p.user_id = auth.uid() or now() >= e.prediction_reveal_at;

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
  if v_res.complaint_count is not null then
    insert into public.prediction_awards (event_id, user_id, category, points)
    with active as (
      select p.* from public.predictions p
      join public.memberships m on m.league_id = v_league and m.user_id = p.user_id and m.status = 'active'
      where p.event_id = p_event
    )
    select p_event, user_id, 'complaints', v_rules.complaints_points
    from active p
    where abs(p.complaint_count - v_res.complaint_count) = (select min(abs(q.complaint_count - v_res.complaint_count)) from active q);
  end if;

  select count(*) into v_count from public.prediction_awards where event_id = p_event;
  update public.official_results set resolved_at = now() where event_id = p_event;
  -- Re-resolving replaces the earlier announcement instead of stacking posts.
  delete from public.activity_posts where event_id = p_event and kind = 'prediction' and heading = 'Predictions resolved';
  insert into public.activity_posts (event_id, author_id, kind, heading, body)
  values (p_event, auth.uid(), 'prediction', 'Predictions resolved', format('%s award(s) handed out against the official results.', v_count));
  return v_count;
end $$;

create or replace function public.check_prediction_instants()
returns trigger language plpgsql as $$
begin
  -- Signed-in admins are frozen out once the slips are public; the service role (no JWT) can still correct a typo.
  if auth.uid() is not null and now() >= old.prediction_reveal_at
     and (new.prediction_lock_at is distinct from old.prediction_lock_at or new.prediction_reveal_at is distinct from old.prediction_reveal_at) then
    raise exception 'prediction lock and reveal cannot change once the slips are revealed' using errcode = 'check_violation';
  end if;
  return new;
end $$;

-- Slips can never be edited after they are visible to others: the lock can sit before the reveal, never after.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'events_prediction_lock_before_reveal') then
    alter table public.events add constraint events_prediction_lock_before_reveal check (prediction_lock_at <= prediction_reveal_at);
  end if;
end $$;

create or replace function public.upsert_prediction(
  p_event uuid, p_run_seconds integer, p_meal_rating smallint, p_complaint_count integer
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
  values (p_event, auth.uid(), p_run_seconds, p_meal_rating, p_complaint_count)
  on conflict (event_id, user_id) do update
    set run_seconds = excluded.run_seconds, meal_rating = excluded.meal_rating, complaint_count = excluded.complaint_count
  returning * into v_row;
  return v_row;
end $$;

drop trigger if exists events_prediction_instants_check on public.events;
create trigger events_prediction_instants_check
  before update of prediction_lock_at, prediction_reveal_at on public.events
  for each row execute function public.check_prediction_instants();

-- ---------------------------------------------------------------------------
-- 7. Membership: demoting the participant clears the event pointer; one member per Sleeper manager.
-- ---------------------------------------------------------------------------

create or replace function public.set_member_role(
  p_league uuid, p_user uuid, p_role public.membership_role, p_is_commissioner boolean, p_status public.membership_status, p_is_admin boolean default null
) returns public.memberships
language plpgsql security definer set search_path = public as $$
declare v_row public.memberships;
begin
  if not public.pb_is_admin(p_league) then
    raise exception 'admin role required' using errcode = '42501';
  end if;
  if p_user = auth.uid() and (p_is_admin is false or p_status <> 'active') then
    raise exception 'you cannot remove your own admin access' using errcode = '22023';
  end if;
  update public.memberships
  set role = p_role, is_commissioner = p_is_commissioner, status = p_status,
      is_admin = coalesce(p_is_admin, is_admin)
  where league_id = p_league and user_id = p_user
  returning * into v_row;
  if v_row.id is null then raise exception 'membership not found' using errcode = 'P0002'; end if;
  if p_role <> 'participant' or p_status <> 'active' then
    update public.events set participant_user_id = null where league_id = p_league and participant_user_id = p_user;
  end if;
  return v_row;
end $$;

-- Clear any duplicate claims before enforcing uniqueness (keeps the confirmed or earliest one).
with ranked as (
  select id, row_number() over (partition by league_id, sleeper_user_id order by sleeper_confirmed desc, updated_at asc, id asc) as rn
  from public.memberships where sleeper_user_id is not null
)
update public.memberships m set sleeper_user_id = null, sleeper_confirmed = false
from ranked r where r.id = m.id and r.rn > 1;

create unique index if not exists memberships_sleeper_unique
  on public.memberships (league_id, sleeper_user_id) where sleeper_user_id is not null;

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
  if p_sleeper_user_id is not null and exists (
    select 1 from public.memberships where league_id = p_league and sleeper_user_id = p_sleeper_user_id and user_id <> auth.uid()
  ) then
    raise exception 'That Sleeper manager is already claimed by another member' using errcode = '23505';
  end if;
  update public.memberships
  set sleeper_user_id = p_sleeper_user_id, sleeper_confirmed = false
  where league_id = p_league and user_id = auth.uid()
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.confirm_sleeper_link(p_league uuid, p_user uuid, p_confirmed boolean, p_sleeper_user_id text default null)
returns public.memberships
language plpgsql security definer set search_path = public as $$
declare v_row public.memberships;
begin
  if not public.pb_is_admin(p_league) then
    raise exception 'admin role required' using errcode = '42501';
  end if;
  if p_sleeper_user_id is not null and not exists (
    select 1 from public.sleeper_league_users where league_id = p_league and sleeper_user_id = p_sleeper_user_id
  ) then
    raise exception 'unknown Sleeper user for this league' using errcode = '22023';
  end if;
  if p_sleeper_user_id is not null and exists (
    select 1 from public.memberships where league_id = p_league and sleeper_user_id = p_sleeper_user_id and user_id <> p_user
  ) then
    raise exception 'That Sleeper manager is already linked to another member' using errcode = '23505';
  end if;
  update public.memberships
  set sleeper_user_id = p_sleeper_user_id, sleeper_confirmed = (p_sleeper_user_id is not null and p_confirmed)
  where league_id = p_league and user_id = p_user
  returning * into v_row;
  if v_row.id is null then raise exception 'membership not found' using errcode = 'P0002'; end if;
  return v_row;
end $$;

-- ---------------------------------------------------------------------------
-- 8. New accounts: never abort the auth insert over a display name; only accept string metadata.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  v_name := case when jsonb_typeof(new.raw_user_meta_data -> 'display_name') = 'string' then nullif(btrim(new.raw_user_meta_data ->> 'display_name'), '') end;
  v_name := coalesce(v_name, nullif(btrim(split_part(coalesce(new.email, ''), '@', 1)), ''), 'League member');
  insert into public.profiles (id, display_name, kit_team, kit_number)
  values (new.id, left(v_name, 40), null, 0)
  on conflict (id) do nothing;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 9. Grants: helpers added after the blanket revoke must not be callable anonymously.
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon;
grant execute on function public.public_certificate(text, text) to anon, authenticated;
grant execute on function public.bingo_lines(smallint[]) to anon, authenticated;
grant execute on function public.pb_uuid_or_null(text) to authenticated;
grant execute on function public.pb_can_view_submission(uuid) to authenticated;
