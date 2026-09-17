-- Prop board replaces Punishment Bingo.
--
-- Bingo needed a live stream of witnessed incidents confirmed by a commissioner on the road;
-- the prop board is set before departure, every member picks a side per prop, picks lock at
-- the configured instant and a commissioner settles each prop at the end from the record.
-- One point per correct pick; the top score wins.

-- ---------------------------------------------------------------------------
-- 1. Remove bingo
-- ---------------------------------------------------------------------------
drop function if exists public.decide_bingo_incident(uuid, boolean);
drop function if exists public.propose_bingo_incident(uuid, uuid, text);
drop function if exists public.ensure_bingo_card(uuid);
drop function if exists public.bingo_leaderboard(uuid);
drop function if exists public.pb_award_bingo_lines(uuid, uuid, uuid);
drop function if exists public.bingo_lines(smallint[]);

delete from public.activity_posts where kind = 'bingo';
drop table if exists public.bingo_wins;
drop table if exists public.bingo_incidents;
drop table if exists public.bingo_cards;
drop table if exists public.bingo_squares;
drop type if exists public.incident_status;

-- Feed posts for settled props reuse the slot the bingo posts had.
alter type public.post_kind rename value 'bingo' to 'prop';

-- ---------------------------------------------------------------------------
-- 2. Props and picks
-- ---------------------------------------------------------------------------
create type public.prop_kind as enum ('over_under', 'yes_no');
create type public.prop_side as enum ('over', 'under', 'yes', 'no');
create type public.prop_result as enum ('over', 'under', 'yes', 'no', 'void');

create table public.props (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  sequence smallint not null check (sequence between 1 and 99),
  title text not null check (char_length(title) between 1 and 160),
  detail text check (char_length(detail) <= 400),
  kind public.prop_kind not null default 'over_under',
  line numeric(10, 2),
  unit text check (char_length(unit) <= 40),
  locks_at timestamptz not null,
  result public.prop_result,
  settled_by uuid references auth.users (id) on delete set null,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, sequence),
  constraint props_line_for_over_under check (kind <> 'over_under' or line is not null),
  constraint props_result_matches_kind check (
    result is null or result = 'void'
    or (kind = 'over_under' and result in ('over', 'under'))
    or (kind = 'yes_no' and result in ('yes', 'no'))
  )
);
create index props_event_idx on public.props (event_id, sequence);

create table public.prop_picks (
  event_id uuid not null references public.events (id) on delete cascade,
  prop_id uuid not null references public.props (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  side public.prop_side not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (prop_id, user_id)
);
create index prop_picks_event_user_idx on public.prop_picks (event_id, user_id);
create trigger prop_picks_updated before update on public.prop_picks for each row execute function public.set_updated_at();

alter table public.props enable row level security;
alter table public.prop_picks enable row level security;

create policy props_select on public.props for select to authenticated using (public.pb_is_event_member(event_id));
-- Own picks always; everyone's picks once the prop has locked. Writes go through upsert_prop_pick.
create policy prop_picks_select on public.prop_picks for select to authenticated
  using (
    user_id = auth.uid()
    or (public.pb_is_event_member(event_id) and now() >= (select p.locks_at from public.props p where p.id = prop_id))
  );

alter publication supabase_realtime add table public.props;

-- ---------------------------------------------------------------------------
-- 3. RPCs
-- ---------------------------------------------------------------------------
create or replace function public.pb_side_matches_kind(p_kind public.prop_kind, p_side text)
returns boolean
language sql immutable as $$
  select case p_kind
    when 'over_under' then p_side in ('over', 'under')
    when 'yes_no' then p_side in ('yes', 'no')
    else false end;
$$;
revoke execute on function public.pb_side_matches_kind(public.prop_kind, text) from public, anon, authenticated;

-- Member picks a side; editable until the prop locks.
create or replace function public.upsert_prop_pick(p_prop uuid, p_side public.prop_side)
returns public.prop_picks
language plpgsql security definer set search_path = public as $$
declare
  v_prop public.props;
  v_row public.prop_picks;
begin
  select * into v_prop from public.props where id = p_prop;
  if v_prop.id is null then raise exception 'prop not found' using errcode = 'P0002'; end if;
  if not public.pb_is_event_member(v_prop.event_id) then
    raise exception 'league membership required' using errcode = '42501';
  end if;
  if now() >= v_prop.locks_at or v_prop.result is not null then
    raise exception 'prop locked at %', v_prop.locks_at using errcode = '42501';
  end if;
  if not public.pb_side_matches_kind(v_prop.kind, p_side::text) then
    raise exception 'side does not fit this prop' using errcode = '22023';
  end if;
  insert into public.prop_picks (event_id, prop_id, user_id, side)
  values (v_prop.event_id, p_prop, auth.uid(), p_side)
  on conflict (prop_id, user_id) do update set side = excluded.side, updated_at = now()
  returning * into v_row;
  return v_row;
end $$;

-- Commissioner settles a locked prop; re-settling corrects a mistake and posts again.
create or replace function public.settle_prop(p_prop uuid, p_result public.prop_result)
returns public.props
language plpgsql security definer set search_path = public as $$
declare
  v_prop public.props;
  v_correct integer;
  v_total integer;
begin
  select * into v_prop from public.props where id = p_prop for update;
  if v_prop.id is null then raise exception 'prop not found' using errcode = 'P0002'; end if;
  if not public.pb_is_event_commissioner(v_prop.event_id) then
    raise exception 'commissioner role required' using errcode = '42501';
  end if;
  if now() < v_prop.locks_at then
    raise exception 'prop settles only after it locks at %', v_prop.locks_at using errcode = '42501';
  end if;
  if p_result <> 'void' and not public.pb_side_matches_kind(v_prop.kind, p_result::text) then
    raise exception 'result does not fit this prop' using errcode = '22023';
  end if;
  if v_prop.result is not distinct from p_result then return v_prop; end if;  -- idempotent

  update public.props
  set result = p_result, settled_by = auth.uid(), settled_at = now()
  where id = p_prop returning * into v_prop;

  select count(*) filter (where pk.side::text = p_result::text), count(*) into v_correct, v_total
  from public.prop_picks pk where pk.prop_id = p_prop;

  insert into public.activity_posts (event_id, author_id, kind, heading, body)
  values (v_prop.event_id, auth.uid(), 'prop', 'Prop settled',
    left(format('#%s %s · %s', v_prop.sequence, v_prop.title,
      case when p_result = 'void' then 'void, no points'
           else format('%s · %s of %s picks correct', initcap(p_result::text), v_correct, v_total) end), 1000));
  return v_prop;
end $$;

-- Standings over settled props for active members. Void props score nothing.
create or replace function public.prop_leaderboard(p_event uuid)
returns table (user_id uuid, display_name text, kit_team text, correct integer, wrong integer, picks integer)
language plpgsql stable security definer set search_path = public as $$
declare v_league uuid;
begin
  if not public.pb_is_event_member(p_event) then
    raise exception 'league membership required' using errcode = '42501';
  end if;
  select league_id into v_league from public.events where id = p_event;
  return query
  select m.user_id, p.display_name, p.kit_team,
    (select count(*)::integer from public.prop_picks pk join public.props pr on pr.id = pk.prop_id
      where pk.event_id = p_event and pk.user_id = m.user_id and pr.result is not null and pr.result <> 'void' and pk.side::text = pr.result::text) as correct,
    (select count(*)::integer from public.prop_picks pk join public.props pr on pr.id = pk.prop_id
      where pk.event_id = p_event and pk.user_id = m.user_id and pr.result is not null and pr.result <> 'void' and pk.side::text <> pr.result::text) as wrong,
    (select count(*)::integer from public.prop_picks pk where pk.event_id = p_event and pk.user_id = m.user_id) as picks
  from public.memberships m join public.profiles p on p.id = m.user_id
  where m.league_id = v_league and m.status = 'active'
    and exists (select 1 from public.prop_picks pk where pk.event_id = p_event and pk.user_id = m.user_id)
  order by correct desc, wrong asc, picks desc, p.display_name asc;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Certificate summary names the prop board winner(s) instead of bingo
-- ---------------------------------------------------------------------------
create or replace function public.issue_certificate(p_event uuid, p_is_public boolean)
returns public.certificates
language plpgsql security definer set search_path = public as $$
declare
  v_row public.certificates;
  v_score record;
  v_res public.official_results;
  v_participant text;
  v_props text;
  v_pred text;
begin
  if not public.pb_is_event_commissioner(p_event) then
    raise exception 'commissioner role required' using errcode = '42501';
  end if;
  select * into v_score from public.event_scores where event_id = p_event;
  select * into v_res from public.official_results where event_id = p_event;
  select p.display_name into v_participant
  from public.events e join public.profiles p on p.id = e.participant_user_id where e.id = p_event;
  -- Top correct count shares the prize; nobody wins on zero.
  select string_agg(lb.display_name || ' (' || lb.correct || ')', ', ' order by lb.display_name) into v_props
  from public.prop_leaderboard(p_event) lb
  where lb.correct > 0 and lb.correct = (select max(t.correct) from public.prop_leaderboard(p_event) t);
  select string_agg(p.display_name || ' (' || t.pts || ')', ', ' order by t.pts desc) into v_pred
  from (select user_id, sum(points) as pts from public.prediction_awards where event_id = p_event group by user_id) t
  join public.profiles p on p.id = t.user_id;

  insert into public.certificates (event_id, status, issued_by, issued_at, is_public, summary)
  values (p_event, 'issued', auth.uid(), now(), p_is_public, jsonb_build_object(
    'participant', v_participant,
    'approved_points', coalesce(v_score.approved_points, 0),
    'max_points', coalesce(v_score.max_points, 100),
    'approved_challenges', coalesce(v_score.approved_challenges, 0),
    'total_challenges', coalesce(v_score.total_challenges, 0),
    'run_distance_km', v_res.run_distance_km,
    'run_seconds', v_res.run_seconds,
    'prop_winners', v_props,
    'prediction_winners', v_pred,
    'issued_at', now()
  ))
  on conflict (event_id) do update
    set status = 'issued', issued_by = excluded.issued_by, issued_at = excluded.issued_at,
        is_public = excluded.is_public, summary = excluded.summary
  returning * into v_row;
  return v_row;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Grants: signed-in users only, helpers stay private
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on function public.upsert_prop_pick(uuid, public.prop_side) to authenticated;
grant execute on function public.settle_prop(uuid, public.prop_result) to authenticated;
grant execute on function public.prop_leaderboard(uuid) to authenticated;
grant execute on function public.issue_certificate(uuid, boolean) to authenticated;
grant execute on function public.public_certificate(text, text) to anon, authenticated;
grant execute on function public.pb_uuid_or_null(text) to authenticated;
grant execute on function public.pb_can_view_submission(uuid) to authenticated;
