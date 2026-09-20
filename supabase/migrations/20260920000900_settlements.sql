-- Settlements gazetteer: readable check-in positions ("10 km N of Malmesbury") instead of
-- raw coordinates.
--
-- 1. public.settlements: populated places of South Africa from GeoNames (CC BY 4.0). The rows
--    are loaded by the generated migration that follows (scripts/build-settlements.ts).
-- 2. pb_nearest_settlement / pb_place_label: nearest place weighted by importance, so a town
--    20 km away beats a farm hamlet 10 km away, and a compass direction from that place.
-- 3. checkins.place_label: computed once when the check-in is recorded (record_checkin) and
--    used in the feed post. Older rows are backfilled by the migration after the data load.

-- ---------------------------------------------------------------------------
-- 1. Gazetteer
-- ---------------------------------------------------------------------------

create table if not exists public.settlements (
  geonames_id integer primary key,
  name text not null check (char_length(name) between 1 and 200),
  ascii_name text not null,
  province text,
  feature_code text not null,
  population integer not null default 0 check (population >= 0),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  -- 1 = town or administrative seat, 2 = village with a recorded population, 3 = hamlet or locality.
  tier smallint not null check (tier between 1 and 3)
);
comment on table public.settlements is 'Populated places of South Africa from GeoNames (https://www.geonames.org, CC BY 4.0). Reference data for check-in labels.';
create index if not exists settlements_position_idx on public.settlements (latitude, longitude);

alter table public.settlements enable row level security;
drop policy if exists settlements_select on public.settlements;
create policy settlements_select on public.settlements for select to authenticated using (true);
grant select on public.settlements to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Geometry helpers (pure SQL, no PostGIS)
-- ---------------------------------------------------------------------------

-- Great-circle distance in kilometres (haversine, mean Earth radius).
create or replace function public.pb_distance_km(
  lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision
) returns double precision
language sql immutable strict parallel safe as $$
  select 2 * 6371.0088 * asin(least(1.0, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )))
$$;

-- Initial bearing in degrees (0 = north, clockwise) from point 1 to point 2.
create or replace function public.pb_bearing_deg(
  lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision
) returns double precision
language sql immutable strict parallel safe as $$
  select x - 360 * floor(x / 360)
  from (
    select degrees(atan2(
      sin(radians(lng2 - lng1)) * cos(radians(lat2)),
      cos(radians(lat1)) * sin(radians(lat2)) - sin(radians(lat1)) * cos(radians(lat2)) * cos(radians(lng2 - lng1))
    )) as x
  ) s
$$;

-- Eight-point compass label for a bearing.
create or replace function public.pb_compass(p_bearing double precision)
returns text
language sql immutable strict parallel safe as $$
  select (array['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'])[
    floor(((p_bearing + 22.5) - 360 * floor((p_bearing + 22.5) / 360)) / 45)::integer + 1
  ]
$$;

-- ---------------------------------------------------------------------------
-- 3. Nearest settlement and the label
-- ---------------------------------------------------------------------------

-- The closest place once distance is divided by an importance weight (town 3, village 2,
-- hamlet 1): a hamlet only wins when it is well under a third of the distance to the nearest
-- town. Searches a box of roughly 160 km; returns no row outside it (open sea, other country).
create or replace function public.pb_nearest_settlement(p_latitude double precision, p_longitude double precision)
returns table (
  geonames_id integer, name text, province text, tier smallint, population integer,
  distance_km double precision, bearing_deg double precision, compass text
)
language sql stable strict as $$
  select s.geonames_id, s.name, s.province, s.tier, s.population, d.km, b.deg, public.pb_compass(b.deg)
  from public.settlements s
  cross join lateral (select public.pb_distance_km(s.latitude, s.longitude, p_latitude, p_longitude) as km) d
  cross join lateral (select public.pb_bearing_deg(s.latitude, s.longitude, p_latitude, p_longitude) as deg) b
  where s.latitude between p_latitude - 1.5 and p_latitude + 1.5
    and s.longitude between p_longitude - 1.8 and p_longitude + 1.8
  order by d.km / (case s.tier when 1 then 3.0 when 2 then 2.0 else 1.0 end), d.km, s.geonames_id
  limit 1
$$;

-- "In Pofadder" inside the town, otherwise "10 km N of Malmesbury". Null when nothing is near.
create or replace function public.pb_place_label(p_latitude double precision, p_longitude double precision)
returns text
language plpgsql stable strict as $$
declare
  v record;
  v_town_km double precision;
begin
  select * into v from public.pb_nearest_settlement(p_latitude, p_longitude);
  if v.name is null then return null; end if;
  -- A bigger town covers more ground than a village before "In" stops being true.
  v_town_km := case
    when v.population >= 100000 then 6
    when v.population >= 20000 then 3.5
    when v.population >= 5000 then 2.5
    else 1.5 end;
  if v.distance_km < v_town_km then
    return 'In ' || v.name;
  end if;
  return format('%s km %s of %s', greatest(1, round(v.distance_km))::integer, v.compass, v.name);
end $$;

-- ---------------------------------------------------------------------------
-- 4. Check-ins carry their label; the feed post reads it
-- ---------------------------------------------------------------------------

alter table public.checkins add column if not exists place_label text
  check (place_label is null or char_length(place_label) <= 240);

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
  v_label text;
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

  v_label := public.pb_place_label(p_latitude, p_longitude);

  insert into public.checkins (event_id, user_id, latitude, longitude, accuracy_m, captured_at, client_id, place_label)
  values (p_event, auth.uid(), p_latitude, p_longitude, p_accuracy_m, p_captured_at, p_client_id, v_label)
  on conflict (event_id, user_id, client_id) do update set received_at = public.checkins.received_at
  returning * into v_row;

  if v_row.received_at >= now() - interval '2 seconds' and not exists (
    select 1 from public.activity_posts where ref_checkin_id = v_row.id
  ) then
    insert into public.activity_posts (event_id, author_id, kind, heading, body, ref_checkin_id)
    values (p_event, auth.uid(), 'checkin', 'Checked in',
            format('%s · accuracy %s m', coalesce(v_row.place_label, 'Position shared'), coalesce(round(p_accuracy_m)::text, '?')), v_row.id);
  end if;
  return v_row;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Grants (the schema-wide revoke in the stress-test migration ran before these existed)
-- ---------------------------------------------------------------------------

revoke execute on function public.pb_distance_km(double precision, double precision, double precision, double precision) from public, anon;
revoke execute on function public.pb_bearing_deg(double precision, double precision, double precision, double precision) from public, anon;
revoke execute on function public.pb_compass(double precision) from public, anon;
revoke execute on function public.pb_nearest_settlement(double precision, double precision) from public, anon;
revoke execute on function public.pb_place_label(double precision, double precision) from public, anon;
grant execute on function public.pb_distance_km(double precision, double precision, double precision, double precision) to authenticated;
grant execute on function public.pb_bearing_deg(double precision, double precision, double precision, double precision) to authenticated;
grant execute on function public.pb_compass(double precision) to authenticated;
grant execute on function public.pb_nearest_settlement(double precision, double precision) to authenticated;
grant execute on function public.pb_place_label(double precision, double precision) to authenticated;
