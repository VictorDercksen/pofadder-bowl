-- Kits: each member claims one NFL franchise; a franchise can be held by only one member.
-- New accounts start without a kit and choose one at first sign-in.

alter table public.profiles alter column kit_team drop not null;
alter table public.profiles alter column kit_team drop default;
alter table public.profiles alter column kit_number set default 0;

-- Existing hash-assigned defaults were never chosen: clear them so members pick their own.
update public.profiles set kit_team = null;

create unique index profiles_kit_team_unique on public.profiles (kit_team) where kit_team is not null;

-- New users: no kit yet.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  v_name := coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), 'League member');
  insert into public.profiles (id, display_name, kit_team, kit_number)
  values (new.id, left(v_name, 40), null, 0)
  on conflict (id) do nothing;
  return new;
end $$;

-- Members may not change kit_team directly; they claim through the RPC below.
revoke update on public.profiles from authenticated;
grant update (display_name, kit_number) on public.profiles to authenticated;

create or replace function public.claim_kit(p_team text, p_number smallint)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  v_teams text[] := array['buf','mia','ne','nyj','bal','cin','cle','pit','hou','ind','jax','ten','den','kc','lv','lac','dal','nyg','phi','wsh','chi','det','gb','min','atl','car','no','tb','ari','lar','sf','sea'];
  v_row public.profiles;
  v_holder text;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if not exists (select 1 from public.memberships where user_id = auth.uid() and status = 'active') then
    raise exception 'active league membership required' using errcode = '42501';
  end if;
  if p_team is null or not (p_team = any (v_teams)) then
    raise exception 'unknown franchise' using errcode = '22023';
  end if;
  if p_number is null or p_number < 0 or p_number > 99 then
    raise exception 'number must be between 0 and 99' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('kit:' || p_team));
  select display_name into v_holder from public.profiles where kit_team = p_team and id <> auth.uid();
  if v_holder is not null then
    raise exception 'The % kit is already worn by %', upper(p_team), v_holder using errcode = '23505';
  end if;
  update public.profiles set kit_team = p_team, kit_number = p_number where id = auth.uid() returning * into v_row;
  return v_row;
end $$;

revoke execute on function public.claim_kit(text, smallint) from public, anon;
grant execute on function public.claim_kit(text, smallint) to authenticated;

-- Which franchises are taken (and by whom), visible to any active member.
create or replace function public.claimed_kits()
returns table (kit_team text, display_name text, user_id uuid)
language sql stable security definer set search_path = public as $$
  select p.kit_team, p.display_name, p.id
  from public.profiles p
  where p.kit_team is not null
    and exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.status = 'active');
$$;
revoke execute on function public.claimed_kits() from public, anon;
grant execute on function public.claimed_kits() to authenticated;
