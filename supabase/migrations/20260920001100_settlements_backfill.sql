-- Label the check-ins and feed posts recorded before the gazetteer existed.
-- Runs after the generated settlements data migration.

update public.checkins
set place_label = public.pb_place_label(latitude, longitude)
where place_label is null;

update public.activity_posts p
set body = regexp_replace(p.body, '^Position shared', c.place_label)
from public.checkins c
where p.ref_checkin_id = c.id and p.kind = 'checkin' and c.place_label is not null and p.body like 'Position shared%';
