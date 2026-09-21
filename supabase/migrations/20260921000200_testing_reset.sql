-- Testing reset.
--
-- The testing deployment (branch main, its own Supabase project) accumulates dummy activity
-- while the league is exercised. reset_event_data wipes that activity for one event and
-- restores the programme to its seeded state, so a tester can start again without a
-- database reset. Roster and programme stay: memberships, profiles (name, kit), Sleeper
-- links, the league, the event, itinerary, challenges, penalty texts, press prompts, the
-- prop board and the prediction rules.
--
-- Guards: admin only (pb_is_event_admin), and the caller must repeat the event slug so a
-- wrong event id or a stray call cannot wipe anything by accident. The app shows the
-- button only when PB_TESTING_RESET=true on the server; the league deployment never sets
-- it. Storage objects are removed by the server action afterwards (the storage API, not
-- SQL), from the paths this function returns.

create or replace function public.reset_event_data(p_event uuid, p_confirm_slug text, p_reset_tours boolean default false)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_event public.events%rowtype;
  v_paths text[];
  v_counts jsonb := '{}'::jsonb;
  v_n integer;
begin
  if not public.pb_is_event_admin(p_event) then
    raise exception 'only a league admin can reset event data' using errcode = '42501';
  end if;
  select * into v_event from public.events where id = p_event for update;
  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;
  if p_confirm_slug is distinct from v_event.slug then
    raise exception 'confirmation does not match the event slug' using errcode = '22023';
  end if;

  -- Evidence and press answers (files and review decisions cascade). Collect the storage
  -- paths first so the caller can delete the objects through the storage API.
  select coalesce(array_agg(f.storage_path), '{}') into v_paths
  from public.evidence_files f
  join public.evidence_submissions s on s.id = f.submission_id
  where s.event_id = p_event;

  delete from public.activity_posts where event_id = p_event;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('posts', v_n);

  delete from public.evidence_submissions where event_id = p_event;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('submissions', v_n);

  delete from public.checkins where event_id = p_event;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('checkins', v_n);

  delete from public.member_locations where event_id = p_event;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('member_locations', v_n);

  delete from public.location_settings where event_id = p_event;

  delete from public.prop_picks where event_id = p_event;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('prop_picks', v_n);

  update public.props set result = null, settled_by = null, settled_at = null
  where event_id = p_event and (result is not null or settled_at is not null);

  delete from public.predictions where event_id = p_event;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('predictions', v_n);

  delete from public.prediction_awards where event_id = p_event;
  delete from public.official_results where event_id = p_event;

  update public.penalties set applied = false, applied_by = null, applied_at = null, note = null
  where event_id = p_event and (applied or applied_at is not null or note is not null);

  insert into public.certificates (event_id, status) values (p_event, 'pending')
  on conflict (event_id) do update
    set status = 'pending', issued_by = null, issued_at = null, is_public = false, participant_consent = false, summary = '{}'::jsonb, updated_at = now();

  if p_reset_tours then
    update public.profiles p set tutorial_completed_at = null, tutorial_version = null
    from public.memberships m
    where m.user_id = p.id and m.league_id = v_event.league_id;
    get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('tours', v_n);
  end if;

  return v_counts || jsonb_build_object('storage_paths', to_jsonb(v_paths));
end $$;

revoke execute on function public.reset_event_data(uuid, text, boolean) from public, anon;
grant execute on function public.reset_event_data(uuid, text, boolean) to authenticated;
