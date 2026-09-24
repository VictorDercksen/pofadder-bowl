-- Challenge "Final league standings read aloud in the Hotel bar" takes a clip or a picture.
-- Only the stated proof type changes: the upload picker reads it (acceptForProofType) and the
-- review screen quotes it. Points, sequence and existing submissions are untouched.
--
-- Backward compatible: the previous deploy renders any proof_type text; its picker narrows to
-- photos for this value until the new build is live, and the server accepts both either way.
-- Idempotent: guarded on the old value.
update public.challenges c
   set proof_type = 'clip or photo'
  from public.events e
 where c.event_id = e.id and e.slug = 'pofadder-bowl-2026'
   and c.title = 'Final league standings read aloud in the Hotel bar'
   and c.proof_type = 'clip';
