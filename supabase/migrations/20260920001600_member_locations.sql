-- Member location pins.
--
-- League members (not only the participant) can share where they are while the away game is
-- on. One row per member per event, upserted on every share, so the map shows the latest
-- position of everyone who chose to share it. This is a pin, not a trail: only the
-- participant's check-ins (public.checkins) are drawn as a route.
--
-- 1. public.member_locations: latest shared position per member, labelled from the gazetteer.
-- 2. share_member_location / clear_member_location: the only write paths (security definer,
--    membership re-checked in SQL; RLS allows members to read, never to write directly).
-- 3. event_member_locations: the map's reader, joined with the profile for name and kit.
-- 4. Realtime: the table joins the publication so the map refreshes when a pin moves.

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
create table if not exists public.member_locations (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision check (accuracy_m is null or accuracy_m >= 0),
  place_label text check (place_label is null or char_length(place_label) <= 240),
  captured_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index if not exists member_locations_event_time_idx on public.member_locations (event_id, captured_at desc);

alter table public.member_locations enable row level security;

-- Members read every pin of their event. No insert, update or delete policy: writes go
-- through the two RPCs below so consent (an explicit share) and the label are enforced in SQL.
drop policy if exists member_locations_select on public.member_locations;
create policy member_locations_select on public.member_locations for select to authenticated
  using (public.pb_is_event_member(event_id));

revoke all on public.member_locations from public, anon;
revoke insert, update, delete, truncate, references, trigger on public.member_locations from authenticated;
grant select on public.member_locations to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Write paths
-- ---------------------------------------------------------------------------

-- Upsert the caller's pin. Any active league member may share; the participant included
-- (their pin is separate from the check-in route). The label is computed once here.
create or replace function public.share_member_location(
  p_event uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_captured_at timestamptz,
  p_accuracy_m double precision default null
) returns public.member_locations
language plpgsql security definer set search_path = public as $$
declare
  v_row public.member_locations;
begin
  if not public.pb_is_event_member(p_event) then
    raise exception 'only league members can share a location' using errcode = '42501';
  end if;
  if p_captured_at > now() + interval '5 minutes' or p_captured_at < now() - interval '2 days' then
    raise exception 'captured_at is outside the accepted window' using errcode = '22023';
  end if;

  insert into public.member_locations (event_id, user_id, latitude, longitude, accuracy_m, place_label, captured_at, updated_at)
  values (p_event, auth.uid(), p_latitude, p_longitude, p_accuracy_m, public.pb_place_label(p_latitude, p_longitude), p_captured_at, now())
  on conflict (event_id, user_id) do update set
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    accuracy_m = excluded.accuracy_m,
    place_label = excluded.place_label,
    captured_at = excluded.captured_at,
    updated_at = now()
  returning * into v_row;
  return v_row;
end $$;

-- Remove the caller's pin. Returns true when a row was deleted.
create or replace function public.clear_member_location(p_event uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  if not public.pb_is_event_member(p_event) then
    raise exception 'only league members can clear a location' using errcode = '42501';
  end if;
  delete from public.member_locations where event_id = p_event and user_id = auth.uid();
  get diagnostics v_count = row_count;
  return v_count > 0;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Reader: every pin of the event with the member's name and kit, newest first
-- ---------------------------------------------------------------------------
create or replace function public.event_member_locations(p_event uuid)
returns table (
  user_id uuid,
  display_name text,
  kit_team text,
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  place_label text,
  captured_at timestamptz,
  updated_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select l.user_id, p.display_name, p.kit_team, l.latitude, l.longitude, l.accuracy_m, l.place_label, l.captured_at, l.updated_at
  from public.member_locations l
  join public.profiles p on p.id = l.user_id
  where l.event_id = p_event
    and public.pb_is_event_member(p_event)
  order by l.captured_at desc;
$$;

-- ---------------------------------------------------------------------------
-- 4. Grants and realtime
-- ---------------------------------------------------------------------------
revoke execute on function public.share_member_location(uuid, double precision, double precision, timestamptz, double precision) from public, anon;
revoke execute on function public.clear_member_location(uuid) from public, anon;
revoke execute on function public.event_member_locations(uuid) from public, anon;
grant execute on function public.share_member_location(uuid, double precision, double precision, timestamptz, double precision) to authenticated;
grant execute on function public.clear_member_location(uuid) to authenticated;
grant execute on function public.event_member_locations(uuid) to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'member_locations') then
    alter publication supabase_realtime add table public.member_locations;
  end if;
end $$;
