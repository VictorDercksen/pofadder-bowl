-- The participant confirms the last check-in of the trip. The certificate PNG draws the route
-- from the first check-in up to that one, with the participant's kit badge on it. Until it is
-- set, the certificate draws the whole trail on record as a provisional route.
-- Nullable columns only, so the previous deploy keeps working while Vercel builds.

alter table public.certificates
  add column if not exists final_checkin_id uuid references public.checkins (id) on delete set null,
  add column if not exists final_checkin_confirmed_at timestamptz;

-- Participant (or commissioner on their behalf). p_checkin null clears the confirmation.
-- The check-in must be one of the participant's, not removed. Refused once the certificate is
-- issued so the certified image cannot change underneath the league.
create or replace function public.set_final_checkin(p_event uuid, p_checkin uuid)
returns public.certificates
language plpgsql security definer set search_path = public as $$
declare
  v_row public.certificates;
  v_participant uuid;
begin
  if not (public.pb_is_event_participant(p_event) or public.pb_is_event_commissioner(p_event)) then
    raise exception 'participant or commissioner only' using errcode = '42501';
  end if;
  if exists (select 1 from public.certificates c where c.event_id = p_event and c.status = 'issued') then
    raise exception 'the certificate is issued; the route is set' using errcode = '42501';
  end if;
  if p_checkin is not null then
    select participant_user_id into v_participant from public.events where id = p_event;
    if not exists (
      select 1 from public.checkins k
       where k.id = p_checkin and k.event_id = p_event and k.user_id = v_participant and k.removed_at is null
    ) then
      raise exception 'check-in not found' using errcode = 'P0002';
    end if;
  end if;
  insert into public.certificates (event_id, final_checkin_id, final_checkin_confirmed_at)
  values (p_event, p_checkin, case when p_checkin is null then null else now() end)
  on conflict (event_id) do update
    set final_checkin_id = excluded.final_checkin_id,
        final_checkin_confirmed_at = excluded.final_checkin_confirmed_at
  returning * into v_row;
  return v_row;
end $$;

revoke execute on function public.set_final_checkin(uuid, uuid) from public, anon;
grant execute on function public.set_final_checkin(uuid, uuid) to authenticated;
