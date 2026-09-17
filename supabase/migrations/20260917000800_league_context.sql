-- Navigation speed and Sleeper sign-on.
--
-- 1. league_context: everything getLeagueContext needs for the caller in ONE round trip
--    (was: activate_membership RPC + two query batches, each a trip to Frankfurt from the
--    Vercel function on every navigation). Security definer, but it only ever returns the
--    caller's own profile and membership plus the league/event rows every member may read.
-- 2. claim_sleeper_identity: members confirm their own Sleeper team at sign-on, so a claim
--    is a confirmed link. Admins can still override in Review → Members.

create or replace function public.league_context(p_league_slug text, p_event_slug text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_league public.leagues;
  v_event public.events;
  v_membership public.memberships;
  v_profile public.profiles;
  v_sleeper public.sleeper_league_users;
  v_imported boolean;
begin
  if v_uid is null then
    return jsonb_build_object('status', 'signed_out');
  end if;

  select * into v_league from public.leagues where slug = p_league_slug;
  if v_league.id is null then
    return jsonb_build_object('status', 'no_league');
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.id is null then
    return jsonb_build_object('status', 'no_profile');
  end if;

  -- First sign-in after an invite: activate the membership (was a separate RPC per request).
  update public.memberships set status = 'active'
  where user_id = v_uid and league_id = v_league.id and status = 'invited';

  select * into v_membership from public.memberships
  where league_id = v_league.id and user_id = v_uid and status = 'active';
  if v_membership.id is null then
    return jsonb_build_object('status', 'no_membership');
  end if;

  select * into v_event from public.events where league_id = v_league.id and slug = p_event_slug;
  if v_event.id is null then
    return jsonb_build_object('status', 'no_event');
  end if;

  if v_membership.sleeper_user_id is not null then
    select * into v_sleeper from public.sleeper_league_users
    where league_id = v_league.id and sleeper_user_id = v_membership.sleeper_user_id;
  end if;
  select exists (select 1 from public.sleeper_league_users where league_id = v_league.id) into v_imported;

  return jsonb_build_object(
    'status', 'ok',
    'league', to_jsonb(v_league),
    'event', to_jsonb(v_event),
    'membership', to_jsonb(v_membership),
    'profile', to_jsonb(v_profile),
    'sleeper', case when v_sleeper.sleeper_user_id is null then null else jsonb_build_object(
      'sleeper_user_id', v_sleeper.sleeper_user_id,
      'username', v_sleeper.username,
      'display_name', v_sleeper.display_name,
      'team_name', v_sleeper.team_name,
      'avatar', v_sleeper.avatar
    ) end,
    'sleeper_imported', v_imported
  );
end $$;

revoke execute on function public.league_context(text, text) from public, anon;
grant execute on function public.league_context(text, text) to authenticated;

-- Members confirm their own Sleeper team (picked from the imported list at sign-on).
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
    raise exception 'That manager is not in the imported Sleeper league' using errcode = '22023';
  end if;
  if p_sleeper_user_id is not null and exists (
    select 1 from public.memberships where league_id = p_league and sleeper_user_id = p_sleeper_user_id and user_id <> auth.uid()
  ) then
    raise exception 'That Sleeper team is already taken by another member' using errcode = '23505';
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
