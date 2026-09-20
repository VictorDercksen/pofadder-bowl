-- First-run tutorial.
--
-- Every member walks through the guided tour once (existing members included: the column
-- starts null for everyone). The tour version lets a future rewrite of the tour ask
-- members to take it again by bumping TOUR_VERSION in src/lib/tour.ts and comparing.

alter table public.profiles
  add column tutorial_completed_at timestamptz,
  add column tutorial_version smallint;

-- Members mark their own tour as done (profiles_update_self already limits the row to auth.uid()).
grant update (tutorial_completed_at, tutorial_version) on public.profiles to authenticated;
