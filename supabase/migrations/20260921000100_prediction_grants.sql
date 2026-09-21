-- The 3-argument and 8-argument upsert_prediction overloads were created after the blanket
-- "revoke execute ... from public, anon" in 20260918000100, so Supabase's default privileges
-- left them callable by anon. They refuse without a session anyway (pb_is_event_member), but
-- every RPC should be authenticated-only at the grant level. Follow the pattern of
-- 20260920001600_member_locations.sql for each new function.

revoke execute on function public.upsert_prediction(uuid, integer, smallint) from public, anon;
revoke execute on function public.upsert_prediction(uuid, integer, smallint, smallint, integer, smallint, numeric, integer) from public, anon;
grant execute on function public.upsert_prediction(uuid, integer, smallint) to authenticated;
grant execute on function public.upsert_prediction(uuid, integer, smallint, smallint, integer, smallint, numeric, integer) to authenticated;
