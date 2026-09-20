-- One member per Sleeper team, one member per NFL kit.
--
-- Both were already enforced by partial unique indexes (profiles_kit_team_unique,
-- memberships_sleeper_unique) and by the claim RPCs. This migration makes the Sleeper side
-- match the kit side exactly: the RPCs take a transaction-scoped advisory lock on the team
-- before checking, so two members confirming the same team at the same moment get the
-- friendly "already taken" message instead of a raw unique-violation from the index. The
-- indexes are re-asserted so a database restored from an older dump still has them.

create unique index if not exists profiles_kit_team_unique
  on public.profiles (kit_team) where kit_team is not null;

create unique index if not exists memberships_sleeper_unique
  on public.memberships (league_id, sleeper_user_id) where sleeper_user_id is not null;

-- Members confirm their own Sleeper team (sign-on picker and League access).
create or replace function public.claim_sleeper_identity(p_league uuid, p_sleeper_user_id text default null)
returns public.memberships
language plpgsql security definer set search_path = public as $$
declare
  v_row public.memberships;
  v_holder text;
begin
  if not public.pb_is_member(p_league) then
    raise exception 'league membership required' using errcode = '42501';
  end if;
  if p_sleeper_user_id is not null and not exists (
    select 1 from public.sleeper_league_users where league_id = p_league and sleeper_user_id = p_sleeper_user_id
  ) then
    raise exception 'That manager is not in the imported Sleeper league' using errcode = '22023';
  end if;
  if p_sleeper_user_id is not null then
    perform pg_advisory_xact_lock(hashtext('sleeper:' || p_league::text || ':' || p_sleeper_user_id));
    select coalesce(p.display_name, 'another member') into v_holder
    from public.memberships m left join public.profiles p on p.id = m.user_id
    where m.league_id = p_league and m.sleeper_user_id = p_sleeper_user_id and m.user_id <> auth.uid();
    if v_holder is not null then
      raise exception 'That Sleeper team is already taken by %', v_holder using errcode = '23505';
    end if;
  end if;
  update public.memberships
  set sleeper_user_id = p_sleeper_user_id, sleeper_confirmed = (p_sleeper_user_id is not null)
  where league_id = p_league and user_id = auth.uid()
  returning * into v_row;
  if v_row.id is null then raise exception 'membership not found' using errcode = 'P0002'; end if;
  return v_row;
end $$;

revoke execute on function public.claim_sleeper_identity(uuid, text) from public, anon;
grant execute on function public.claim_sleeper_identity(uuid, text) to authenticated;

-- Admins link a member to a Sleeper manager from League admin; same lock, same rule.
create or replace function public.confirm_sleeper_link(p_league uuid, p_user uuid, p_confirmed boolean, p_sleeper_user_id text default null)
returns public.memberships
language plpgsql security definer set search_path = public as $$
declare
  v_row public.memberships;
  v_holder text;
begin
  if not public.pb_is_admin(p_league) then
    raise exception 'admin role required' using errcode = '42501';
  end if;
  if p_sleeper_user_id is not null and not exists (
    select 1 from public.sleeper_league_users where league_id = p_league and sleeper_user_id = p_sleeper_user_id
  ) then
    raise exception 'That manager is not in the imported Sleeper league' using errcode = '22023';
  end if;
  if p_sleeper_user_id is not null then
    perform pg_advisory_xact_lock(hashtext('sleeper:' || p_league::text || ':' || p_sleeper_user_id));
    select coalesce(p.display_name, 'another member') into v_holder
    from public.memberships m left join public.profiles p on p.id = m.user_id
    where m.league_id = p_league and m.sleeper_user_id = p_sleeper_user_id and m.user_id <> p_user;
    if v_holder is not null then
      raise exception 'That Sleeper team is already taken by %', v_holder using errcode = '23505';
    end if;
  end if;
  update public.memberships
  set sleeper_user_id = p_sleeper_user_id, sleeper_confirmed = (p_sleeper_user_id is not null and p_confirmed)
  where league_id = p_league and user_id = p_user
  returning * into v_row;
  if v_row.id is null then raise exception 'membership not found' using errcode = 'P0002'; end if;
  return v_row;
end $$;

revoke execute on function public.confirm_sleeper_link(uuid, uuid, boolean, text) from public, anon;
grant execute on function public.confirm_sleeper_link(uuid, uuid, boolean, text) to authenticated;
