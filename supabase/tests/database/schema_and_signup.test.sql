begin;

select no_plan();

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'courses', 'courses table exists');
select has_table('public', 'enrollments', 'enrollments table exists');
select has_table('public', 'assignments', 'assignments table exists');
select has_table('public', 'assignment_policy_versions', 'policy history table exists');
select has_table('public', 'assignment_tokens', 'hashed assignment token table exists');
select has_table('public', 'submissions', 'logical submissions table exists');
select has_table('public', 'commitments', 'commitments table exists');
select has_table('public', 'submission_uploads', 'upload attempts table exists');
select has_table('public', 'webhook_events', 'webhook outcome table exists');
select has_table('public', 'audit_events', 'audit event table exists');

select ok(
  (
    select count(*) = 11
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'profiles', 'courses', 'enrollments', 'assignments',
        'assignment_policy_versions', 'assignment_tokens', 'submissions',
        'commitments', 'submission_uploads', 'webhook_events', 'audit_events'
      )
      and c.relrowsecurity
  ),
  'RLS is enabled on every application table'
);

select has_column('public', 'commitments', 'gateway_event_at', 'gateway timestamp is stored when available');
select has_column('public', 'commitments', 'webhook_received_at', 'webhook receipt time is stored');
select has_column('public', 'commitments', 'processed_at', 'commitment processing time is stored');
select has_column('public', 'submission_uploads', 'verification_result', 'upload verification result is stored');
select has_column('public', 'submission_uploads', 'policy_result', 'upload policy result is stored separately');

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '10000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'signup-student@example.test',
  '',
  now(),
  '{}'::jsonb,
  '{"role":"lecturer","full_name":"Signup Student"}'::jsonb,
  now(),
  now()
);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '10000000-0000-4000-8000-000000000002',
  'authenticated',
  'authenticated',
  'promotion-target@example.test',
  '',
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

select is(
  (select role::text from public.profiles where id = '10000000-0000-4000-8000-000000000001'),
  'student',
  'signup metadata cannot promote the generated profile'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.promote_profile_to_lecturer(uuid)',
    'EXECUTE'
  ),
  'authenticated clients cannot call the trusted lecturer promotion operation'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

select lives_ok(
  $$update public.profiles
    set full_name = 'Updated Student', department = 'Engineering', phone_e164 = '+2348012345006'
    where id = '10000000-0000-4000-8000-000000000001'$$,
  'a student can update the permitted profile fields'
);

select throws_ok(
  $$update public.profiles
    set role = 'lecturer'
    where id = '10000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'a student cannot update their own role'
);

reset role;
set local role service_role;
select private.promote_profile_to_lecturer('10000000-0000-4000-8000-000000000002');
reset role;

select is(
  (select role::text from public.profiles where id = '10000000-0000-4000-8000-000000000002'),
  'lecturer',
  'the trusted service operation can promote a profile'
);

select * from finish();
rollback;
