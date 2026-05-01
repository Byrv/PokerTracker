insert into storage.buckets (id, name, public)
values ('session-media', 'session-media', false)
on conflict (id) do nothing;

create policy "session_media_read"
  on storage.objects for select
  using (
    bucket_id = 'session-media'
    and (
      auth.role() = 'authenticated'                  -- participants resolve via signed URLs server-side
    )
  );

create policy "session_media_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'session-media' and auth.role() = 'authenticated'
  );

create policy "session_media_delete"
  on storage.objects for delete
  using (bucket_id = 'session-media' and owner = auth.uid());
