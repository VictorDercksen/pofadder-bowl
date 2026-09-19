-- Password gate.
--
-- Every member must hold a password so that sign-in never depends on an email link after the
-- first one. league_context now reports whether the caller's auth user has a password
-- (auth.users.encrypted_password), and getLeagueContext sends anyone without one to
-- /set-password before any other screen. The flag is read-only truth from GoTrue; the app
-- also mirrors it into user_metadata.has_password when a password is set so that the gate
-- works before this migration is applied (the RPC then simply omits the key).

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
  v_has_password boolean;
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

  -- Invited accounts have no password until the member sets one (updateUser in the app).
  select exists (
    select 1 from auth.users u
    where u.id = v_uid and coalesce(u.encrypted_password, '') <> ''
  ) into v_has_password;

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
    'sleeper_imported', v_imported,
    'has_password', v_has_password
  );
end $$;

revoke execute on function public.league_context(text, text) from public, anon;
grant execute on function public.league_context(text, text) to authenticated;
