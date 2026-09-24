begin;

select no_plan();

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('50000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'storage-lecturer@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('50000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'storage-student@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('50000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'storage-other-student@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

update public.profiles set role = 'lecturer' where id = '50000000-0000-4000-8000-000000000001';
update public.profiles
set phone_e164 = '+2348098765432'
where id = '50000000-0000-4000-8000-000000000003';
update public.profiles
set phone_e164 = '+2348012345005'
where id = '50000000-0000-4000-8000-000000000002';

insert into public.courses (id, code, title, lecturer_id)
values ('51000000-0000-4000-8000-000000000001', 'PHONE-101', 'Phone Course', '50000000-0000-4000-8000-000000000001');

insert into public.enrollments (course_id, student_id)
values ('51000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002');

insert into public.assignments (id, course_id, created_by, title, status)
values ('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'Phone Assignment', 'published');

insert into public.assignment_policy_versions (
  id, assignment_id, version_number, deadline_at, fallback_enabled,
  grace_period_minutes, allowed_mime_types, max_file_size_bytes, created_by
) values (
  '53000000-0000-4000-8000-000000000001',
  '52000000-0000-4000-8000-000000000001',
  1, now() + interval '1 day', true, 10, array['application/pdf'],
  1048576, '50000000-0000-4000-8000-000000000001'
);

update public.assignments
set current_policy_version_id = '53000000-0000-4000-8000-000000000001'
where id = '52000000-0000-4000-8000-000000000001';

insert into public.assignment_tokens (
  id, assignment_id, student_id, token_hash, phone_e164_snapshot
) values (
  '54000000-0000-4000-8000-000000000001',
  '52000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000002',
  repeat('8', 64),
  '+2348012345005'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '50000000-0000-4000-8000-000000000002', true);

select throws_ok(
  $$update public.profiles set phone_e164 = '08012345678'
    where id = '50000000-0000-4000-8000-000000000002'$$,
  '23514',
  null,
  'profile phones must use E.164 format'
);

select throws_ok(
  $$update public.profiles set phone_e164 = '+2348098765432'
    where id = '50000000-0000-4000-8000-000000000002'$$,
  '23505',
  null,
  'a registered phone number cannot be assigned to two profiles'
);

select lives_ok(
  $$update public.profiles set phone_e164 = '+2348076543210'
    where id = '50000000-0000-4000-8000-000000000002'$$,
  'the signed-in student can change their registered phone'
);

reset role;

select is(
  (select phone_e164_snapshot from public.assignment_tokens where id = '54000000-0000-4000-8000-000000000001'),
  '+2348012345005',
  'an existing token retains the original registered phone snapshot'
);

select ok(
  exists (
    select 1 from storage.buckets
    where id = 'submission-files'
      and public = false
      and file_size_limit = 52428800
  ),
  'submission-files is private and capped at 50 MiB'
);

set local role anon;
select throws_ok(
  $$select * from storage.objects where bucket_id = 'submission-files'$$,
  '42501',
  null,
  'anonymous users cannot access submission objects directly'
);
reset role;

set local role authenticated;
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('submission-files', 'attempted-direct-write')$$,
  '42501',
  null,
  'authenticated users cannot write submission objects directly'
);
select throws_ok(
  $$select * from storage.objects where bucket_id = 'submission-files'$$,
  '42501',
  null,
  'authenticated users cannot read submission objects directly'
);

reset role;
select * from finish();
rollback;
