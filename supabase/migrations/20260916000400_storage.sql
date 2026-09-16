-- Pofadder Bowl 2026 · private evidence bucket
-- Object path convention: {event_id}/{uploader_user_id}/{submission_id}/{file_id}.{ext}
-- Reads happen only through short-lived signed URLs minted by the server for active members.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidence', 'evidence', false, 524288000,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp',
    'audio/webm', 'audio/mp4', 'audio/mpeg',
    'application/pdf', 'application/gpx+xml', 'application/vnd.garmin.tcx+xml', 'application/octet-stream',
    'text/csv', 'text/plain', 'application/zip'
  ]
)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy evidence_upload_participant on storage.objects for insert to authenticated
  with check (
    bucket_id = 'evidence'
    and array_length(storage.foldername(name), 1) = 3
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.pb_is_event_participant(((storage.foldername(name))[1])::uuid)
    and exists (
      select 1 from public.evidence_submissions s
      where s.id = ((storage.foldername(name))[3])::uuid
        and s.submitter_id = auth.uid() and s.status in ('draft', 'flagged')
    )
  );

create policy evidence_read_members on storage.objects for select to authenticated
  using (
    bucket_id = 'evidence'
    and public.pb_is_event_member(((storage.foldername(name))[1])::uuid)
  );

-- Uploader may remove an object only while its submission is still a draft (no overwrite of reviewed proof).
create policy evidence_delete_own_draft on storage.objects for delete to authenticated
  using (
    bucket_id = 'evidence'
    and (storage.foldername(name))[2] = auth.uid()::text
    and exists (
      select 1 from public.evidence_submissions s
      where s.id = ((storage.foldername(name))[3])::uuid and s.submitter_id = auth.uid() and s.status = 'draft'
    )
  );
