-- Environment safety is enforced in SQL as well as in the application.
create table public.deployment_settings (
  singleton boolean primary key default true check (singleton),
  testing_reset_enabled boolean not null default false
);
insert into public.deployment_settings (singleton) values (true);
alter table public.deployment_settings enable row level security;
revoke all on public.deployment_settings from public, anon, authenticated;
grant select, update on public.deployment_settings to service_role;

-- Invitation details are visible only to their recipient and league admins.
drop policy memberships_select on public.memberships;
create policy memberships_select on public.memberships for select to authenticated
  using (user_id = auth.uid() or public.pb_is_admin(league_id));

-- The team picker needs claimed identities, not invitation addresses.
create function public.league_roster(p_league uuid)
returns table (user_id uuid, sleeper_user_id text, display_name text)
language sql stable security definer set search_path = public as $$
  select m.user_id, m.sleeper_user_id, p.display_name
  from public.memberships m join public.profiles p on p.id = m.user_id
  where m.league_id = p_league and public.pb_is_member(p_league);
$$;
revoke execute on function public.league_roster(uuid) from public, anon;
grant execute on function public.league_roster(uuid) to authenticated;

-- Validate every attachment, including direct PostgREST inserts from an older deploy.
-- Lock the submission so attaching cannot race with submitting or reviewing.
create function public.validate_evidence_attachment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_sub public.evidence_submissions;
  v_metadata jsonb;
  v_size bigint;
  v_mime text;
  v_kind public.evidence_kind;
begin
  select * into v_sub from public.evidence_submissions
  where id = new.submission_id for update;
  if not found or v_sub.status not in ('draft', 'flagged') then
    raise exception 'Only draft or flagged proof accepts attachments' using errcode = '22023';
  end if;
  if auth.role() <> 'service_role' and
     (v_sub.submitter_id is distinct from auth.uid() or not public.pb_is_event_participant(v_sub.event_id)) then
    raise exception 'Only the participant can attach proof' using errcode = '42501';
  end if;
  if new.storage_path not like v_sub.event_id::text || '/' || v_sub.submitter_id::text || '/' || v_sub.id::text || '/%'
     or array_length(string_to_array(new.storage_path, '/'), 1) <> 4 then
    raise exception 'The file does not belong to this submission' using errcode = '22023';
  end if;
  select metadata into v_metadata from storage.objects
    where bucket_id = 'evidence' and name = new.storage_path;
  if not found then
    raise exception 'Upload the file before attaching it' using errcode = '22023';
  end if;
  v_size := (v_metadata->>'size')::bigint;
  v_mime := lower(split_part(v_metadata->>'mimetype', ';', 1));
  v_kind := case
    when v_mime in ('image/jpeg','image/png','image/webp','image/heic','image/heif') then 'photo'::public.evidence_kind
    when v_mime in ('video/mp4','video/quicktime','video/webm','video/3gpp') then 'video'::public.evidence_kind
    when v_mime in ('audio/webm','audio/mp4','audio/mpeg') then 'audio'::public.evidence_kind
    when v_mime in ('application/gpx+xml','application/vnd.garmin.tcx+xml','text/csv','application/octet-stream')
      and lower(new.storage_path) ~ '\.(gpx|tcx|fit|csv|kml|json)$' then 'gps'::public.evidence_kind
    when v_mime in ('application/pdf','text/plain','application/zip') then 'document'::public.evidence_kind
    else null end;
  if v_kind is null or v_size is null or v_size < 1
     or v_size > (case when v_kind in ('video','audio') then 52428800 else 26214400 end)
     or new.byte_size is distinct from v_size
     or lower(split_part(new.mime_type, ';', 1)) is distinct from v_mime
     or new.kind is distinct from v_kind then
    raise exception 'File metadata or size does not match the uploaded object' using errcode = '22023';
  end if;
  return new;
end $$;
revoke execute on function public.validate_evidence_attachment() from public, anon, authenticated;
create trigger validate_evidence_attachment before insert or update on public.evidence_files
  for each row execute function public.validate_evidence_attachment();

create function public.check_submission_objects()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'submitted' and old.status in ('draft', 'flagged') and exists (
    select 1 from public.evidence_files f left join storage.objects o
      on o.bucket_id = 'evidence' and o.name = f.storage_path
    where f.submission_id = new.id and (o.id is null
      or (o.metadata->>'size')::bigint is distinct from f.byte_size
      or lower(split_part(o.metadata->>'mimetype', ';', 1)) is distinct from lower(split_part(f.mime_type, ';', 1)))
  ) then
    raise exception 'An attached file is missing or changed. Upload it again before submitting' using errcode = '22023';
  end if;
  return new;
end $$;
revoke execute on function public.check_submission_objects() from public, anon, authenticated;
create trigger check_submission_objects before update of status on public.evidence_submissions
  for each row execute function public.check_submission_objects();

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

  if not exists (select 1 from public.deployment_settings where singleton and testing_reset_enabled) then
    raise exception 'Testing reset is disabled in this database' using errcode = '42501';
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
