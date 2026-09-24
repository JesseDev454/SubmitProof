begin;

select no_plan();

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('30000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'history-lecturer@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('30000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'history-student@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

update public.profiles set role = 'lecturer' where id = '30000000-0000-4000-8000-000000000001';
update public.profiles
set phone_e164 = '+2348012345003'
where id = '30000000-0000-4000-8000-000000000002';

insert into public.courses (id, code, title, lecturer_id)
values ('31000000-0000-4000-8000-000000000001', 'HIST-101', 'History Course', '30000000-0000-4000-8000-000000000001');

insert into public.enrollments (course_id, student_id)
values ('31000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002');

insert into public.assignments (id, course_id, created_by, title, status)
values ('32000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'History Assignment', 'published');

insert into public.assignment_policy_versions (
  id, assignment_id, version_number, deadline_at, fallback_enabled,
  grace_period_minutes, allowed_mime_types, max_file_size_bytes, created_by
) values (
  '33000000-0000-4000-8000-000000000001',
  '32000000-0000-4000-8000-000000000001',
  1, '2026-10-01 12:00:00+00', true, 30, array['application/pdf'],
  10485760, '30000000-0000-4000-8000-000000000001'
);

update public.assignments
set current_policy_version_id = '33000000-0000-4000-8000-000000000001'
where id = '32000000-0000-4000-8000-000000000001';

insert into public.assignment_tokens (
  id, assignment_id, student_id, token_hash, phone_e164_snapshot
) values (
  '34000000-0000-4000-8000-000000000001',
  '32000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  repeat('1', 64),
  '+2348012345003'
);

insert into public.submissions (id, assignment_id, student_id, workflow_status)
values (
  '35000000-0000-4000-8000-000000000001',
  '32000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  'awaiting_upload'
);

insert into public.commitments (
  id, submission_id, assignment_id, student_id, token_id, policy_version_id,
  nonce, file_sha256, provider_message_id, sender_phone_e164,
  gateway_event_at, webhook_received_at, processed_at
) values (
  '36000000-0000-4000-8000-000000000001',
  '35000000-0000-4000-8000-000000000001',
  '32000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '34000000-0000-4000-8000-000000000001',
  '33000000-0000-4000-8000-000000000001',
  'history-nonce', repeat('2', 64), 'history-provider-message',
  '+2348012345003', null, now(), now()
);

insert into public.assignment_policy_versions (
  id, assignment_id, version_number, deadline_at, fallback_enabled,
  grace_period_minutes, allowed_mime_types, max_file_size_bytes, created_by
) values (
  '33000000-0000-4000-8000-000000000002',
  '32000000-0000-4000-8000-000000000001',
  2, '2026-10-02 12:00:00+00', false, 0, array['application/pdf'],
  5242880, '30000000-0000-4000-8000-000000000001'
);

update public.assignments
set current_policy_version_id = '33000000-0000-4000-8000-000000000002'
where id = '32000000-0000-4000-8000-000000000001';

select is(
  (select version_number from public.assignment_policy_versions where id = '33000000-0000-4000-8000-000000000001'),
  1,
  'version 1 remains unchanged after creating version 2'
);

select is(
  (select policy_version_id::text from public.commitments where id = '36000000-0000-4000-8000-000000000001'),
  '33000000-0000-4000-8000-000000000001',
  'a commitment keeps its original policy version reference'
);

insert into public.audit_events (
  id, actor_id, assignment_id, submission_id, commitment_id,
  event_type, source, event_at, metadata
) values (
  '37000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  '32000000-0000-4000-8000-000000000001',
  '35000000-0000-4000-8000-000000000001',
  '36000000-0000-4000-8000-000000000001',
  'TEST_EVENT', 'test', now(), '{"safe":"value"}'::jsonb
);

select throws_ok(
  $$update public.assignment_policy_versions
    set grace_period_minutes = 5
    where id = '33000000-0000-4000-8000-000000000001'$$,
  '55000',
  null,
  'policy versions cannot be updated'
);

select throws_ok(
  $$delete from public.assignment_policy_versions
    where id = '33000000-0000-4000-8000-000000000001'$$,
  '55000',
  null,
  'policy versions cannot be deleted'
);

select throws_ok(
  $$update public.audit_events
    set metadata = '{"changed":true}'::jsonb
    where id = '37000000-0000-4000-8000-000000000001'$$,
  '55000',
  null,
  'audit events cannot be updated'
);

select throws_ok(
  $$delete from public.audit_events
    where id = '37000000-0000-4000-8000-000000000001'$$,
  '55000',
  null,
  'audit events cannot be deleted'
);

select * from finish();
rollback;
