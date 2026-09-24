insert into storage.buckets (id, name, public, file_size_limit)
values ('submission-files', 'submission-files', false, 52428800)
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit;

alter table storage.objects enable row level security;
revoke all on table storage.objects from anon, authenticated;

drop policy if exists submitproof_deny_direct_object_access on storage.objects;
create policy submitproof_deny_direct_object_access
  on storage.objects
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);
