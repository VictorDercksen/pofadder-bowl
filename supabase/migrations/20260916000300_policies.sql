-- Pofadder Bowl 2026 · row level security
-- Principle: every private row is readable only by active league members;
-- writes go through RPCs or narrowly scoped own-row policies. Roles are never
-- self-assignable: memberships are only changed by commissioner RPCs or the
-- service-role invite/bootstrap scripts (which bypass RLS on the server).

alter table public.profiles enable row level security;
alter table public.leagues enable row level security;
alter table public.memberships enable row level security;
alter table public.sleeper_league_users enable row level security;
alter table public.events enable row level security;
alter table public.itinerary_items enable row level security;
alter table public.challenges enable row level security;
alter table public.penalties enable row level security;
alter table public.press_prompts enable row level security;
alter table public.evidence_submissions enable row level security;
alter table public.evidence_files enable row level security;
alter table public.review_decisions enable row level security;
alter table public.location_settings enable row level security;
alter table public.checkins enable row level security;
alter table public.activity_posts enable row level security;
alter table public.reactions enable row level security;
alter table public.bingo_squares enable row level security;
alter table public.bingo_cards enable row level security;
alter table public.bingo_incidents enable row level security;
alter table public.bingo_wins enable row level security;
alter table public.prediction_rules enable row level security;
alter table public.predictions enable row level security;
alter table public.official_results enable row level security;
alter table public.prediction_awards enable row level security;
alter table public.certificates enable row level security;

-- Profiles: self + anyone sharing an active league. Only kit/display columns are self-editable.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.pb_shares_league(id));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (display_name, kit_team, kit_number) on public.profiles to authenticated;

-- Leagues / memberships
create policy leagues_select on public.leagues for select to authenticated
  using (public.pb_is_member(id));
create policy memberships_select on public.memberships for select to authenticated
  using (user_id = auth.uid() or public.pb_is_member(league_id));
-- No insert/update/delete policies: RPCs (security definer) and service role only.
revoke insert, update, delete on public.memberships from authenticated;

create policy sleeper_users_select on public.sleeper_league_users for select to authenticated
  using (public.pb_is_member(league_id));
create policy sleeper_users_write on public.sleeper_league_users for all to authenticated
  using (public.pb_is_commissioner(league_id)) with check (public.pb_is_commissioner(league_id));

-- Event content
create policy events_select on public.events for select to authenticated using (public.pb_is_member(league_id));
create policy events_update on public.events for update to authenticated
  using (public.pb_is_commissioner(league_id)) with check (public.pb_is_commissioner(league_id));
revoke update on public.events from authenticated;
grant update (name, subtitle, departure_at, away_arrival_at, return_departure_at, home_arrival_at, prediction_lock_at, prediction_reveal_at, required_run_km) on public.events to authenticated;

create policy itinerary_select on public.itinerary_items for select to authenticated using (public.pb_is_event_member(event_id));
create policy itinerary_write on public.itinerary_items for all to authenticated
  using (public.pb_is_event_commissioner(event_id)) with check (public.pb_is_event_commissioner(event_id));
create policy challenges_select on public.challenges for select to authenticated using (public.pb_is_event_member(event_id));
create policy penalties_select on public.penalties for select to authenticated using (public.pb_is_event_member(event_id));
create policy press_prompts_select on public.press_prompts for select to authenticated using (public.pb_is_event_member(event_id));
create policy press_prompts_write on public.press_prompts for all to authenticated
  using (public.pb_is_event_commissioner(event_id)) with check (public.pb_is_event_commissioner(event_id));

-- Evidence
create policy submissions_select on public.evidence_submissions for select to authenticated
  using (public.pb_is_event_member(event_id));
-- Drafts: the submitter may edit the caption of their own draft/flagged submission. Status changes go through RPCs.
create policy submissions_update_own on public.evidence_submissions for update to authenticated
  using (submitter_id = auth.uid() and status in ('draft', 'flagged'))
  with check (submitter_id = auth.uid() and status in ('draft', 'flagged'));
revoke update on public.evidence_submissions from authenticated;
grant update (caption) on public.evidence_submissions to authenticated;
create policy submissions_delete_own_draft on public.evidence_submissions for delete to authenticated
  using (submitter_id = auth.uid() and status = 'draft');

create policy evidence_files_select on public.evidence_files for select to authenticated
  using (exists (select 1 from public.evidence_submissions s where s.id = submission_id and public.pb_is_event_member(s.event_id)));
create policy evidence_files_insert_own on public.evidence_files for insert to authenticated
  with check (exists (
    select 1 from public.evidence_submissions s
    where s.id = submission_id and s.submitter_id = auth.uid() and s.status in ('draft', 'flagged')
      and storage_path like s.event_id::text || '/' || auth.uid()::text || '/%'
  ));
create policy evidence_files_delete_own_draft on public.evidence_files for delete to authenticated
  using (exists (select 1 from public.evidence_submissions s where s.id = submission_id and s.submitter_id = auth.uid() and s.status = 'draft'));

create policy review_decisions_select on public.review_decisions for select to authenticated
  using (exists (select 1 from public.evidence_submissions s where s.id = submission_id and public.pb_is_event_member(s.event_id)));

-- Location
create policy location_settings_select on public.location_settings for select to authenticated
  using (user_id = auth.uid() or public.pb_is_event_commissioner(event_id));
create policy location_settings_write on public.location_settings for insert to authenticated
  with check (user_id = auth.uid() and public.pb_is_event_participant(event_id));
create policy location_settings_update on public.location_settings for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.pb_is_event_participant(event_id));

create policy checkins_select on public.checkins for select to authenticated
  using (removed_at is null and public.pb_is_event_member(event_id));

-- Feed
create policy posts_select on public.activity_posts for select to authenticated using (public.pb_is_event_member(event_id));
create policy posts_insert_comment on public.activity_posts for insert to authenticated
  with check (kind = 'comment' and author_id = auth.uid() and public.pb_is_event_member(event_id)
              and ref_submission_id is null and ref_checkin_id is null);
create policy posts_delete_own_comment on public.activity_posts for delete to authenticated
  using (kind = 'comment' and author_id = auth.uid());
create policy reactions_select on public.reactions for select to authenticated
  using (exists (select 1 from public.activity_posts p where p.id = post_id and public.pb_is_event_member(p.event_id)));
create policy reactions_insert_own on public.reactions for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.activity_posts p where p.id = post_id and public.pb_is_event_member(p.event_id)));
create policy reactions_delete_own on public.reactions for delete to authenticated using (user_id = auth.uid());

-- Bingo
create policy bingo_squares_select on public.bingo_squares for select to authenticated using (public.pb_is_event_member(event_id));
create policy bingo_cards_select on public.bingo_cards for select to authenticated
  using (user_id = auth.uid() or public.pb_is_event_commissioner(event_id));
create policy bingo_incidents_select on public.bingo_incidents for select to authenticated using (public.pb_is_event_member(event_id));
create policy bingo_wins_select on public.bingo_wins for select to authenticated using (public.pb_is_event_member(event_id));

-- Predictions
create policy prediction_rules_select on public.prediction_rules for select to authenticated using (public.pb_is_event_member(event_id));
create policy prediction_rules_write on public.prediction_rules for all to authenticated
  using (public.pb_is_event_commissioner(event_id)) with check (public.pb_is_event_commissioner(event_id));
-- Base table: own rows only. Other members' answers are exposed through predictions_revealed after reveal time.
create policy predictions_select_own on public.predictions for select to authenticated
  using (user_id = auth.uid() or (public.pb_is_event_member(event_id) and now() >= (select e.prediction_reveal_at from public.events e where e.id = event_id)));
create policy official_results_select on public.official_results for select to authenticated using (public.pb_is_event_member(event_id));
create policy official_results_write on public.official_results for all to authenticated
  using (public.pb_is_event_commissioner(event_id)) with check (public.pb_is_event_commissioner(event_id));
create policy prediction_awards_select on public.prediction_awards for select to authenticated using (public.pb_is_event_member(event_id));

-- Certificates
create policy certificates_select on public.certificates for select to authenticated using (public.pb_is_event_member(event_id));

-- Realtime: members receive changes (postgres_changes honours RLS for authenticated subscribers).
alter publication supabase_realtime add table public.activity_posts, public.reactions, public.checkins, public.evidence_submissions, public.bingo_incidents, public.bingo_wins;
