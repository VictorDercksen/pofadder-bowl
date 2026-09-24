-- Challenge "Boarding the 22:30 bus, ticket and face in frame" takes a clip or a picture, like
-- the standings challenge (20260924000100). Only the stated proof type changes: the upload
-- picker reads it (acceptForProofType) and the review screen quotes it. Points, sequence and
-- existing submissions are untouched.
--
-- Backward compatible: the previous deploy renders any proof_type text; its picker narrows to
-- photos for this value until the new build is live, and the server accepts both either way.
-- Idempotent: guarded on the old value.
update public.challenges c
   set proof_type = 'clip or photo'
  from public.events e
 where c.event_id = e.id and e.slug = 'pofadder-bowl-2026'
   and c.title = 'Boarding the 22:30 bus, ticket and face in frame'
   and c.proof_type = 'clip';
