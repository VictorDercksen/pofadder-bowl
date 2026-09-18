-- Commissioner can (re)write the prop board from the app. The board is generated in the app
-- from the event programme (src/lib/prop-generator.ts) and handed over as JSON; this RPC
-- validates and stores it. Refused once any prop has locked or holds a pick, so a live
-- board is never rewritten under members.

create or replace function public.upsert_props(p_event uuid, p_props jsonb)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_row jsonb;
  v_kind public.prop_kind;
  v_line numeric;
  v_count integer := 0;
  v_seqs smallint[] := array[]::smallint[];
begin
  if not public.pb_is_event_commissioner(p_event) then
    raise exception 'commissioner role required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_props) <> 'array' or jsonb_array_length(p_props) = 0 or jsonb_array_length(p_props) > 40 then
    raise exception 'between 1 and 40 props expected' using errcode = '22023';
  end if;
  if exists (select 1 from public.props where event_id = p_event and now() >= locks_at) then
    raise exception 'the board has locked' using errcode = '42501';
  end if;
  if exists (select 1 from public.prop_picks where event_id = p_event) then
    raise exception 'members have already picked; the board cannot be rewritten' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext('props:' || p_event::text));

  for v_row in select * from jsonb_array_elements(p_props) loop
    v_kind := coalesce(v_row ->> 'kind', 'over_under')::public.prop_kind;
    v_line := case when v_row ? 'line' and jsonb_typeof(v_row -> 'line') = 'number' then (v_row ->> 'line')::numeric else null end;
    if v_kind = 'over_under' and v_line is null then
      raise exception 'prop % needs a line', v_row ->> 'sequence' using errcode = '22023';
    end if;
    if (v_row ->> 'locks_at')::timestamptz <= now() then
      raise exception 'prop % would already be locked', v_row ->> 'sequence' using errcode = '22023';
    end if;
    insert into public.props (event_id, sequence, title, detail, kind, line, unit, locks_at)
    values (
      p_event,
      (v_row ->> 'sequence')::smallint,
      left(btrim(v_row ->> 'title'), 160),
      nullif(left(btrim(coalesce(v_row ->> 'detail', '')), 400), ''),
      v_kind,
      case when v_kind = 'over_under' then v_line else null end,
      nullif(left(btrim(coalesce(v_row ->> 'unit', '')), 40), ''),
      (v_row ->> 'locks_at')::timestamptz
    )
    on conflict (event_id, sequence) do update
      set title = excluded.title, detail = excluded.detail, kind = excluded.kind, line = excluded.line,
          unit = excluded.unit, locks_at = excluded.locks_at, result = null, settled_by = null, settled_at = null;
    v_seqs := v_seqs || (v_row ->> 'sequence')::smallint;
    v_count := v_count + 1;
  end loop;

  -- Props no longer on the board go; there are no picks to lose (checked above).
  delete from public.props where event_id = p_event and not (sequence = any (v_seqs));
  return v_count;
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.upsert_props(uuid, jsonb) to authenticated;
grant execute on function public.public_certificate(text, text) to anon, authenticated;
grant execute on function public.pb_uuid_or_null(text) to authenticated;
grant execute on function public.pb_can_view_submission(uuid) to authenticated;
