-- Pofadder Bowl 2026 · core schema
-- All event instants are stored in UTC (timestamptz). Display uses events.timezone.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.membership_role as enum ('participant', 'member');
create type public.membership_status as enum ('invited', 'active', 'removed');
create type public.submission_status as enum ('draft', 'submitted', 'approved', 'flagged', 'superseded');
create type public.review_decision_kind as enum ('approved', 'flagged', 'superseded');
create type public.post_kind as enum ('checkin', 'comment', 'submission', 'decision', 'bingo', 'prediction', 'system');
create type public.incident_status as enum ('proposed', 'confirmed', 'rejected');
create type public.evidence_kind as enum ('photo', 'video', 'audio', 'document', 'gps');
create type public.press_slot as enum ('midday', 'sunset');
create type public.certificate_status as enum ('pending', 'issued');

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  kit_team text not null default 'nyg' check (kit_team ~ '^[a-z]{2,3}$'),
  kit_number smallint not null default 26 check (kit_number between 0 and 99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Leagues, memberships
-- ---------------------------------------------------------------------------
create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name text not null,
  sleeper_league_id text,
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.membership_role not null default 'member',
  is_commissioner boolean not null default false,
  status public.membership_status not null default 'invited',
  invited_email text,
  invited_by uuid references auth.users (id) on delete set null,
  -- Sleeper identity: the member claims one from the imported league list;
  -- a commissioner confirms it. Sleeper has no OAuth, so this is a link, not a login.
  sleeper_user_id text,
  sleeper_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);
create index memberships_league_status_idx on public.memberships (league_id, status);

-- Imported snapshot of the Sleeper league's users (public read-only Sleeper API).
create table public.sleeper_league_users (
  league_id uuid not null references public.leagues (id) on delete cascade,
  sleeper_user_id text not null,
  username text,
  display_name text not null,
  team_name text,
  avatar text,
  is_owner boolean not null default false,
  season text,
  imported_at timestamptz not null default now(),
  primary key (league_id, sleeper_user_id)
);

-- ---------------------------------------------------------------------------
-- Events and programme content
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]{2,60}$'),
  name text not null,
  subtitle text,
  timezone text not null default 'Africa/Johannesburg',
  participant_user_id uuid references auth.users (id) on delete set null,
  home_town text not null,
  away_town text not null,
  carrier text,
  departure_at timestamptz not null,
  away_arrival_at timestamptz not null,
  return_departure_at timestamptz not null,
  home_arrival_at timestamptz not null,
  prediction_lock_at timestamptz not null,
  prediction_reveal_at timestamptz not null,
  required_run_km numeric(5, 2) not null default 14,
  max_points integer not null default 100,
  stated_programme_distance_km integer,
  season_punished integer,
  created_at timestamptz not null default now(),
  unique (league_id, slug),
  check (away_arrival_at > departure_at),
  check (return_departure_at > away_arrival_at),
  check (home_arrival_at > return_departure_at)
);
create index events_league_idx on public.events (league_id);

create table public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  quarter smallint not null check (quarter between 1 and 4),
  sequence smallint not null,
  starts_at timestamptz not null,
  title text not null,
  description text,
  venue_text text,
  latitude double precision,
  longitude double precision,
  location_verified boolean not null default false,
  unique (event_id, quarter, sequence),
  check ((latitude is null) = (longitude is null)),
  check (location_verified = false or latitude is not null)
);
create index itinerary_event_time_idx on public.itinerary_items (event_id, starts_at);

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  sequence smallint not null,
  title text not null,
  proof_type text not null,
  points integer not null check (points > 0),
  unique (event_id, sequence)
);

create table public.penalties (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  sequence smallint not null,
  text text not null,
  applied boolean not null default false,
  applied_by uuid references auth.users (id) on delete set null,
  applied_at timestamptz,
  note text,
  unique (event_id, sequence)
);

create table public.press_prompts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  slot public.press_slot not null,
  sequence smallint not null,
  question text not null,
  opens_at timestamptz not null,
  closes_at timestamptz,
  unique (event_id, slot, sequence)
);

-- ---------------------------------------------------------------------------
-- Evidence pipeline
-- ---------------------------------------------------------------------------
create table public.evidence_submissions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  challenge_id uuid references public.challenges (id) on delete cascade,
  press_prompt_id uuid references public.press_prompts (id) on delete cascade,
  submitter_id uuid not null references auth.users (id) on delete cascade,
  version integer not null check (version >= 1),
  caption text not null default '' check (char_length(caption) <= 2000),
  status public.submission_status not null default 'draft',
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(challenge_id, press_prompt_id) = 1),
  unique nulls not distinct (event_id, submitter_id, challenge_id, press_prompt_id, version)
);
create index submissions_event_challenge_idx on public.evidence_submissions (event_id, challenge_id, version desc);
create index submissions_status_idx on public.evidence_submissions (event_id, status);

create table public.evidence_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.evidence_submissions (id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  kind public.evidence_kind not null,
  original_name text,
  created_at timestamptz not null default now()
);
create index evidence_files_submission_idx on public.evidence_files (submission_id);

create table public.review_decisions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.evidence_submissions (id) on delete cascade,
  submission_version integer not null,
  actor_id uuid not null references auth.users (id) on delete restrict,
  decision public.review_decision_kind not null,
  reason text,
  note text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  check (decision <> 'flagged' or (reason is not null and char_length(btrim(reason)) > 0))
);
create index review_decisions_submission_idx on public.review_decisions (submission_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Check-ins and location consent
-- ---------------------------------------------------------------------------
create table public.location_settings (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  sharing_enabled boolean not null default false,
  auto_update boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision check (accuracy_m is null or accuracy_m >= 0),
  captured_at timestamptz not null,
  received_at timestamptz not null default now(),
  client_id text not null,
  removed_at timestamptz,
  unique (user_id, client_id)
);
create index checkins_event_time_idx on public.checkins (event_id, captured_at desc) where removed_at is null;

-- ---------------------------------------------------------------------------
-- Activity feed
-- ---------------------------------------------------------------------------
create table public.activity_posts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  kind public.post_kind not null,
  heading text not null check (char_length(heading) between 1 and 120),
  body text not null default '' check (char_length(body) <= 1000),
  ref_submission_id uuid references public.evidence_submissions (id) on delete set null,
  ref_checkin_id uuid references public.checkins (id) on delete set null,
  created_at timestamptz not null default now()
);
create index activity_event_time_idx on public.activity_posts (event_id, created_at desc);

create table public.reactions (
  post_id uuid not null references public.activity_posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Punishment Bingo
-- ---------------------------------------------------------------------------
create table public.bingo_squares (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  position smallint not null check (position between 0 and 24),
  text text not null,
  is_free boolean not null default false,
  unique (event_id, position)
);

-- layout[i] = square position shown at card cell i (0..24). Cell 12 is always the free square.
create table public.bingo_cards (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  layout smallint[] not null check (array_length(layout, 1) = 25),
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create table public.bingo_incidents (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  square_id uuid not null references public.bingo_squares (id) on delete cascade,
  proposed_by uuid references auth.users (id) on delete set null,
  note text check (char_length(note) <= 300),
  status public.incident_status not null default 'proposed',
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index bingo_incidents_event_idx on public.bingo_incidents (event_id, status, created_at desc);

create table public.bingo_wins (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  line_key text not null,
  incident_id uuid references public.bingo_incidents (id) on delete set null,
  achieved_at timestamptz not null default now(),
  unique (event_id, user_id, line_key)
);
create index bingo_wins_event_time_idx on public.bingo_wins (event_id, achieved_at);

-- ---------------------------------------------------------------------------
-- Predictions
-- ---------------------------------------------------------------------------
create table public.prediction_rules (
  event_id uuid primary key references public.events (id) on delete cascade,
  run_points integer not null default 10,
  meal_points integer not null default 5,
  complaints_points integer not null default 5,
  updated_at timestamptz not null default now()
);

create table public.predictions (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  run_seconds integer not null check (run_seconds between 0 and 8 * 3600),
  meal_rating smallint not null check (meal_rating between 1 and 10),
  complaint_count integer not null check (complaint_count between 0 and 999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table public.official_results (
  event_id uuid primary key references public.events (id) on delete cascade,
  run_seconds integer check (run_seconds between 0 and 8 * 3600),
  run_distance_km numeric(6, 2),
  meal_rating smallint check (meal_rating between 1 and 10),
  complaint_count integer check (complaint_count between 0 and 999),
  set_by uuid references auth.users (id) on delete set null,
  set_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.prediction_awards (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null check (category in ('run', 'meal', 'complaints')),
  points integer not null,
  awarded_at timestamptz not null default now(),
  primary key (event_id, user_id, category)
);

-- ---------------------------------------------------------------------------
-- Certificates
-- ---------------------------------------------------------------------------
create table public.certificates (
  event_id uuid primary key references public.events (id) on delete cascade,
  status public.certificate_status not null default 'pending',
  issued_by uuid references auth.users (id) on delete set null,
  issued_at timestamptz,
  is_public boolean not null default false,
  participant_consent boolean not null default false,
  summary jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger memberships_updated before update on public.memberships for each row execute function public.set_updated_at();
create trigger submissions_updated before update on public.evidence_submissions for each row execute function public.set_updated_at();
create trigger predictions_updated before update on public.predictions for each row execute function public.set_updated_at();
create trigger certificates_updated before update on public.certificates for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Profile bootstrap on sign-up (invite creates the auth user)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_teams text[] := array['buf','mia','ne','nyj','bal','cin','cle','pit','hou','ind','jax','ten','den','kc','lv','lac','dal','nyg','phi','wsh','chi','det','gb','min','atl','car','no','tb','ari','lar','sf','sea'];
  v_hash integer;
begin
  v_name := coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), 'League member');
  v_hash := abs(('x' || substr(md5(new.id::text), 1, 8))::bit(32)::int);
  insert into public.profiles (id, display_name, kit_team, kit_number)
  values (new.id, left(v_name, 40), v_teams[1 + (v_hash % 32)], 1 + (v_hash % 99))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Participant must be an active participant-role member of the event's league
-- ---------------------------------------------------------------------------
create or replace function public.check_event_participant()
returns trigger language plpgsql as $$
begin
  if new.participant_user_id is not null and not exists (
    select 1 from public.memberships m
    where m.league_id = new.league_id
      and m.user_id = new.participant_user_id
      and m.role = 'participant'
      and m.status = 'active'
  ) then
    raise exception 'participant_user_id must be an active participant member of the league' using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger events_participant_check
  before insert or update of participant_user_id on public.events
  for each row execute function public.check_event_participant();
