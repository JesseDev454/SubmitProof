begin;

select no_plan();

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('40000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'access-lecturer-one@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('40000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'access-lecturer-two@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('40000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'access-student-one@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('40000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'access-student-two@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

update public.profiles set role = 'lecturer'
where id in ('40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002');
update public.profiles
set phone_e164 = '+2348012345004'
where id = '40000000-0000-4000-8000-000000000003';

insert into public.courses (id, code, title, lecturer_id) values
  ('41000000-0000-4000-8000-000000000001', 'ACCESS-A', 'Lecturer One Course', '40000000-0000-4000-8000-000000000001'),
  ('41000000-0000-4000-8000-000000000002', 'ACCESS-B', 'Lecturer Two Course', '40000000-0000-4000-8000-000000000002');

insert into public.enrollments (course_id, student_id) values
  ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003'),
  ('41000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000004');

insert into public.assignments (id, course_id, created_by, title, status) values
  ('42000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'Published A', 'published'),
  ('42000000-0000-4000-8000-000000000002', '41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'Draft A', 'draft'),
  ('42000000-0000-4000-8000-000000000003', '41000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', 'Published B', 'published');

insert into public.assignment_policy_versions (
  id, assignment_id, version_number, deadline_at, fallback_enabled,
  grace_period_minutes, allowed_mime_types, max_file_size_bytes, created_by
) values
  ('43000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', 1, now() + interval '1 day', true, 15, array['application/pdf'], 10485760, '40000000-0000-4000-8000-000000000001'),
  ('43000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000002', 1, now() + interval '1 day', true, 15, array['application/pdf'], 10485760, '40000000-0000-4000-8000-000000000001'),
  ('43000000-0000-4000-8000-000000000003', '42000000-0000-4000-8000-000000000003', 1, now() + interval '1 day', true, 15, array['application/pdf'], 10485760, '40000000-0000-4000-8000-000000000002');

update public.assignments a
set current_policy_version_id = p.id
from public.assignment_policy_versions p
where p.assignment_id = a.id;

insert into public.assignment_tokens (
  id, assignment_id, student_id, token_hash, phone_e164_snapshot
) values (
  '44000000-0000-4000-8000-000000000001',
  '42000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000003',
  repeat('4', 64),
  '+2348012345004'
);

insert into public.submissions (id, assignment_id, student_id, workflow_status)
values (
  '45000000-0000-4000-8000-000000000001',
  '42000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000003',
  'awaiting_upload'
);

insert into public.submissions (id, assignment_id, student_id, workflow_status)
values (
  '45000000-0000-4000-8000-000000000002',
  '42000000-0000-4000-8000-000000000003',
  '40000000-0000-4000-8000-000000000004',
  'awaiting_upload'
);

insert into public.commitments (
  id, submission_id, assignment_id, student_id, token_id, policy_version_id,
  nonce, file_sha256, provider_message_id, sender_phone_e164,
  gateway_event_at, webhook_received_at, processed_at
) values (
  '46000000-0000-4000-8000-000000000001',
  '45000000-0000-4000-8000-000000000001',
  '42000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000003',
  '44000000-0000-4000-8000-000000000001',
  '43000000-0000-4000-8000-000000000001',
  'access-nonce', repeat('5', 64), 'access-provider',
  '+2348012345004', now(), now(), now()
);

insert into public.submission_uploads (
  id, submission_id, assignment_id, student_id, storage_object_path,
  server_sha256, matched_commitment_id, verification_result, policy_result
) values (
  '47000000-0000-4000-8000-000000000001',
  '45000000-0000-4000-8000-000000000001',
  '42000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000003',
  '42000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000003/45000000-0000-4000-8000-000000000001/47000000-0000-4000-8000-000000000001',
  repeat('5', 64), '46000000-0000-4000-8000-000000000001', 'match', 'qualifies'
);

insert into public.webhook_events (
  id, provider, provider_message_id, outcome, received_at, commitment_id, limited_metadata
) values
  ('48000000-0000-4000-8000-000000000001', 'africastalking', 'access-provider', 'accepted', now(), '46000000-0000-4000-8000-000000000001', '{"field":"safe"}'::jsonb),
  ('48000000-0000-4000-8000-000000000002', 'africastalking', 'access-provider', 'duplicate', now(), '46000000-0000-4000-8000-000000000001', '{"field":"safe"}'::jsonb);

insert into public.audit_events (
  id, actor_id, assignment_id, submission_id, commitment_id,
  event_type, source, event_at, metadata
) values (
  '49000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000003',
  '42000000-0000-4000-8000-000000000001',
  '45000000-0000-4000-8000-000000000001',
  '46000000-0000-4000-8000-000000000001',
  'TEST_AUDIT', 'test', now(), '{}'::jsonb
);

set local role anon;
select throws_ok($$select * from public.profiles$$, '42501', null, 'anonymous users cannot read profiles');
select throws_ok($$select * from public.assignments$$, '42501', null, 'anonymous users cannot read assignments');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000003', true);

select is(
  (select count(*)::integer from public.assignments),
  1,
  'a student sees only published assignments for enrolled courses'
);
select is(
  (select count(*)::integer from public.courses),
  1,
  'a student sees their enrolled course only'
);
select is(
  (select count(*)::integer from public.submissions),
  1,
  'a student can read their own submission'
);
select is(
  (select count(*)::integer from public.commitments),
  1,
  'a student can read their own commitment'
);
select is(
  (select count(*)::integer from public.submission_uploads),
  1,
  'a student can read their own upload evidence'
);
select is(
  (select count(*)::integer from public.audit_events),
  1,
  'a student can read audit events for their own evidence'
);
select is(
  (select count(*)::integer from public.webhook_events),
  2,
  'a student can see callback outcomes linked to their commitment, including duplicates'
);

select throws_ok(
  $$insert into public.assignment_tokens (assignment_id, student_id, token_hash, phone_e164_snapshot)
    values ('42000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003', repeat('6', 64), '+2348012345004')$$,
  '42501',
  null,
  'authenticated clients cannot write assignment tokens directly'
);
select throws_ok(
  $$insert into public.assignment_policy_versions (
      assignment_id, version_number, deadline_at, fallback_enabled,
      grace_period_minutes, allowed_mime_types, max_file_size_bytes, created_by
    ) values ('42000000-0000-4000-8000-000000000001', 2, now(), true, 0, array['application/pdf'], 1000, '40000000-0000-4000-8000-000000000001')$$,
  '42501',
  null,
  'authenticated clients cannot write policy history directly'
);
select throws_ok(
  $$insert into public.commitments (
      submission_id, assignment_id, student_id, token_id, policy_version_id,
      nonce, file_sha256, provider_message_id, sender_phone_e164, webhook_received_at, processed_at
    ) values (
      '45000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000003', '44000000-0000-4000-8000-000000000001',
      '43000000-0000-4000-8000-000000000001', 'client-write', repeat('7', 64),
      'client-write-provider', '+2348012345004', now(), now()
    )$$,
  '42501',
  null,
  'authenticated clients cannot write commitments directly'
);
select throws_ok(
  $$insert into public.submission_uploads (
      submission_id, assignment_id, student_id, storage_object_path, server_sha256
    ) values (
      '45000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000003',
      '42000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000003/45000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000000',
      repeat('7', 64)
    )$$,
  '42501',
  null,
  'authenticated clients cannot write upload evidence directly'
);
select throws_ok(
  $$insert into public.webhook_events (provider, outcome, received_at)
    values ('africastalking', 'accepted', now())$$,
  '42501',
  null,
  'authenticated clients cannot write webhook events directly'
);
select throws_ok(
  $$insert into public.audit_events (event_type, source, event_at)
    values ('CLIENT_WRITE', 'client', now())$$,
  '42501',
  null,
  'authenticated clients cannot write audit events directly'
);
select throws_ok(
  $$insert into public.assignments (course_id, created_by, title)
    values ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'Client Draft')$$,
  '42501',
  null,
  'authenticated clients cannot create assignments before the role-checked write API exists'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000001', true);

select is(
  (select count(*)::integer from public.assignments),
  2,
  'a lecturer sees all assignments in their own course, including drafts'
);
select is(
  (select count(*)::integer from public.courses),
  1,
  'a lecturer cannot read another lecturer course'
);
select is(
  (select count(*)::integer from public.submissions),
  1,
  'a lecturer can read associated student evidence in their course'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000004', true);

select is(
  (select count(*)::integer from public.submissions where id = '45000000-0000-4000-8000-000000000001'),
  0,
  'a student cannot read another student submission'
);
select is(
  (select count(*)::integer from public.assignments),
  1,
  'a student in the other course sees only that course published assignment'
);
select is(
  (select count(*)::integer from public.submissions),
  1,
  'a student can see their own evidence while another student has evidence in a separate course'
);

reset role;
select * from finish();
rollback;
