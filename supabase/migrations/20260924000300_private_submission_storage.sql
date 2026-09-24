insert into storage.buckets (id, name, public, file_size_limit)
values ('submission-files', 'submission-files', false, 52428800)
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit;

-- Supabase Storage owns the storage schema and manages RLS on storage.objects.
-- A private bucket with no object-access policies denies direct client access.
