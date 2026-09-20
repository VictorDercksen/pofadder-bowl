-- The participant's rating write was refused on production: authenticated may only update
-- the caption column (column-level grant in 20260916000300_policies.sql). Extend it to the
-- rating; the submissions_update_own policy still limits it to the owner's draft or flagged row.
grant update (caption, rating) on public.evidence_submissions to authenticated;
