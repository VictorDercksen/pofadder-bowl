-- Admin role: above commissioner. Only admins administer the app (invites, roles, the
-- event participant, Sleeper links, event settings). Commissioners keep refereeing duties.

alter table public.memberships add column is_admin boolean not null default false;

-- The league owner's account is the admin.
update public.memberships set is_admin = true, is_commissioner = true
where lower(invited_email) = 'victordercksen@gmail.com';

create or replace function public.pb_is_admin(p_league uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.league_id = p_league and m.user_id = auth.uid() and m.status = 'active' and m.is_admin
  );
$$;

-- Admins carry commissioner powers as well.
create or replace function public.pb_is_commissioner(p_league uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.league_id = p_league and m.user_id = auth.uid() and m.status = 'active' and (m.is_commissioner or m.is_admin)
  );
$$;

create or replace function public.pb_is_event_admin(p_event uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.pb_is_admin(public.pb_event_league(p_event));
$$;

create or replace function public.my_event_role(p_event uuid)
returns text
language sql stable security definer set search_path = public as $$
  select case
    when public.pb_is_event_admin(p_event) then 'admin'
    when public.pb_is_event_commissioner(p_event) then 'commissioner'
    when public.pb_is_event_participant(p_event) then 'participant'
    when public.pb_is_event_member(p_event) then 'member'
    else null end;
$$;

-- Membership administration: admin only.
drop function if exists public.set_member_role(uuid, uuid, public.membership_role, boolean, public.membership_status);
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
  return v_row;
end $$;
revoke execute on function public.set_member_role(uuid, uuid, public.membership_role, boolean, public.membership_status, boolean) from public, anon;
grant execute on function public.set_member_role(uuid, uuid, public.membership_role, boolean, public.membership_status, boolean) to authenticated;

create or replace function public.set_event_participant(p_event uuid, p_user uuid default null)
returns public.events
language plpgsql security definer set search_path = public as $$
declare v_row public.events;
begin
  if not public.pb_is_event_admin(p_event) then
    raise exception 'admin role required' using errcode = '42501';
  end if;
  update public.events set participant_user_id = p_user where id = p_event returning * into v_row;
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
  update public.memberships
  set sleeper_user_id = p_sleeper_user_id, sleeper_confirmed = (p_sleeper_user_id is not null and p_confirmed)
  where league_id = p_league and user_id = p_user
  returning * into v_row;
  if v_row.id is null then raise exception 'membership not found' using errcode = 'P0002'; end if;
  return v_row;
end $$;

-- App configuration tables: admin only for writes.
drop policy if exists sleeper_users_write on public.sleeper_league_users;
create policy sleeper_users_write on public.sleeper_league_users for all to authenticated
  using (public.pb_is_admin(league_id)) with check (public.pb_is_admin(league_id));

drop policy if exists events_update on public.events;
create policy events_update on public.events for update to authenticated
  using (public.pb_is_admin(league_id)) with check (public.pb_is_admin(league_id));

drop policy if exists itinerary_write on public.itinerary_items;
create policy itinerary_write on public.itinerary_items for all to authenticated
  using (public.pb_is_event_admin(event_id)) with check (public.pb_is_event_admin(event_id));

drop policy if exists press_prompts_write on public.press_prompts;
create policy press_prompts_write on public.press_prompts for all to authenticated
  using (public.pb_is_event_admin(event_id)) with check (public.pb_is_event_admin(event_id));

drop policy if exists prediction_rules_write on public.prediction_rules;
create policy prediction_rules_write on public.prediction_rules for all to authenticated
  using (public.pb_is_event_admin(event_id)) with check (public.pb_is_event_admin(event_id));
