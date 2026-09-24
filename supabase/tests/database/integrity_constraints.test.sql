begin;

select no_plan();

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('20000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'integrity-lecturer@example.test', '', now(), '{}'::jsonb, '{"full_name":"Integrity Lecturer"}'::jsonb, now(), now()),
  ('20000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'integrity-student-one@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('20000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'integrity-student-two@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('20000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'integrity-lecturer-two@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

update public.profiles
set role = 'lecturer'
where id in ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000004');

update public.profiles set phone_e164 = '+2348012345001'
where id = '20000000-0000-4000-8000-000000000002';
update public.profiles set phone_e164 = '+2348098765002'
where id = '20000000-0000-4000-8000-000000000003';

insert into public.courses (id, code, title, lecturer_id) values
  ('21000000-0000-4000-8000-000000000001', 'INT-101', 'Integrity Course', '20000000-0000-4000-8000-000000000001'),
  ('21000000-0000-4000-8000-000000000002', 'INT-201', 'Other Integrity Course', '20000000-0000-4000-8000-000000000004');

select throws_ok(
  $$insert into public.assignments (course_id, created_by, title)
    values ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000004', 'Wrong Course Owner')$$,
  '23503',
  null,
  'an assignment cannot be owned by a lecturer other than its course owner'
);

insert into public.enrollments (id, course_id, student_id) values
  ('22000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002'),
  ('22000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003');

select throws_ok(
  $$insert into public.enrollments (course_id, student_id)
    values ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002')$$,
  '23505',
  null,
  'duplicate course enrollment is rejected'
);

insert into public.assignments (id, course_id, created_by, title, status) values
  ('23000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Integrity Assignment One', 'published'),
  ('23000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Integrity Assignment Two', 'published');

insert into public.assignment_policy_versions (
  id, assignment_id, version_number, deadline_at, fallback_enabled,
  grace_period_minutes, allowed_mime_types, max_file_size_bytes, created_by
) values
  ('24000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000001', 1, now() + interval '1 day', true, 60, array['application/pdf'], 52428800, '20000000-0000-4000-8000-000000000001'),
  ('24000000-0000-4000-8000-000000000002', '23000000-0000-4000-8000-000000000002', 1, now() + interval '1 day', true, 60, array['application/pdf'], 1048576, '20000000-0000-4000-8000-000000000001');

update public.assignments
set current_policy_version_id = '24000000-0000-4000-8000-000000000001'
where id = '23000000-0000-4000-8000-000000000001';

update public.assignments
set current_policy_version_id = '24000000-0000-4000-8000-000000000002'
where id = '23000000-0000-4000-8000-000000000002';

insert into public.assignment_tokens (
  id, assignment_id, student_id, token_hash, phone_e164_snapshot, issued_at
) values (
  '25000000-0000-4000-8000-000000000001',
  '23000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  repeat('a', 64),
  '+2348012345001',
  now()
);

insert into public.assignment_tokens (
  id, assignment_id, student_id, token_hash, phone_e164_snapshot, issued_at
) values (
  '25000000-0000-4000-8000-000000000002',
  '23000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000003',
  repeat('b', 64),
  '+2348098765002',
  now()
);

select throws_ok(
  $$insert into public.assignment_tokens (assignment_id, student_id, token_hash, phone_e164_snapshot)
    values ('23000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', repeat('b', 64), '+2348012345001')$$,
  '23505',
  null,
  'a student cannot have two active tokens for the same assignment'
);

select throws_ok(
  $$insert into public.assignment_tokens (assignment_id, student_id, token_hash, phone_e164_snapshot)
    values ('23000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', repeat('f', 64), '+2348076543210')$$,
  '23514',
  null,
  'a new token snapshots the phone registered on the profile'
);

insert into public.submissions (id, assignment_id, student_id, workflow_status) values
  ('26000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'awaiting_upload'),
  ('26000000-0000-4000-8000-000000000002', '23000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', 'awaiting_upload');

select throws_ok(
  $$insert into public.submissions (assignment_id, student_id)
    values ('23000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002')$$,
  '23505',
  null,
  'only one logical submission can exist per assignment and student'
);

insert into public.commitments (
  id, submission_id, assignment_id, student_id, token_id, policy_version_id,
  nonce, file_sha256, provider_message_id, sender_phone_e164, webhook_received_at, processed_at
) values
  ('27000000-0000-4000-8000-000000000001', '26000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', '25000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000001', 'nonce-one', repeat('c', 64), 'provider-one', '+2348012345001', now(), now()),
  ('27000000-0000-4000-8000-000000000002', '26000000-0000-4000-8000-000000000002', '23000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', '25000000-0000-4000-8000-000000000002', '24000000-0000-4000-8000-000000000001', 'nonce-student-two', repeat('d', 64), 'provider-two', '+2348098765002', now(), now())
;

select throws_ok(
  $$insert into public.commitments (
      submission_id, assignment_id, student_id, token_id, policy_version_id,
      nonce, file_sha256, provider_message_id, sender_phone_e164, webhook_received_at, processed_at
    ) values (
      '26000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002', '25000000-0000-4000-8000-000000000001',
      '24000000-0000-4000-8000-000000000001', 'nonce-two', repeat('e', 64),
      'provider-one', '+2348012345001', now(), now()
    )$$,
  '23505',
  null,
  'provider message IDs are unique for commitments'
);

select throws_ok(
  $$insert into public.commitments (
      submission_id, assignment_id, student_id, token_id, policy_version_id,
      nonce, file_sha256, provider_message_id, sender_phone_e164, webhook_received_at, processed_at
    ) values (
      '26000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002', '25000000-0000-4000-8000-000000000001',
      '24000000-0000-4000-8000-000000000001', 'nonce-one', repeat('e', 64),
      'provider-three', '+2348012345001', now(), now()
    )$$,
  '23505',
  null,
  'an assignment and student nonce can only be committed once'
);

select is(
  (select count(*)::integer from public.commitments where student_id = '20000000-0000-4000-8000-000000000002'),
  1,
  'one valid commitment is stored'
);

select lives_ok(
  $$insert into public.commitments (
      submission_id, assignment_id, student_id, token_id, policy_version_id,
      nonce, file_sha256, provider_message_id, sender_phone_e164, webhook_received_at, processed_at
    ) values (
      '26000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002', '25000000-0000-4000-8000-000000000001',
      '24000000-0000-4000-8000-000000000001', 'nonce-two', repeat('e', 64),
      'provider-three', '+2348012345001', now(), now()
    )$$,
  'two commitments with distinct nonces can be retained'
);

select throws_ok(
  $$insert into public.commitments (
      submission_id, assignment_id, student_id, token_id, policy_version_id,
      nonce, file_sha256, provider_message_id, sender_phone_e164, webhook_received_at, processed_at
    ) values (
      '26000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002', '25000000-0000-4000-8000-000000000001',
      '24000000-0000-4000-8000-000000000001', 'nonce-bad-hash', repeat('A', 64),
      'provider-bad-hash', '+2348012345001', now(), now()
    )$$,
  '23514',
  null,
  'commitment hashes must be lowercase 64-character hexadecimal values'
);

select throws_ok(
  $$insert into public.assignment_policy_versions (
      assignment_id, version_number, deadline_at, fallback_enabled,
      grace_period_minutes, allowed_mime_types, max_file_size_bytes, created_by
    ) values (
      '23000000-0000-4000-8000-000000000001', 2, now(), true, 0,
      array['application/pdf'], 52428801, '20000000-0000-4000-8000-000000000001'
    )$$,
  '23514',
  null,
  'assignment file limits cannot exceed 50 MiB'
);

select throws_ok(
  $$insert into public.assignment_policy_versions (
      assignment_id, version_number, deadline_at, fallback_enabled,
      grace_period_minutes, allowed_mime_types, max_file_size_bytes, created_by
    ) values (
      '23000000-0000-4000-8000-000000000001', 2, now(), true, -1,
      array['application/pdf'], 1048576, '20000000-0000-4000-8000-000000000001'
    )$$,
  '23514',
  null,
  'grace period cannot be negative'
);

select throws_ok(
  $$insert into public.assignment_policy_versions (
      assignment_id, version_number, deadline_at, fallback_enabled,
      grace_period_minutes, allowed_mime_types, max_file_size_bytes, created_by
    ) values (
      '23000000-0000-4000-8000-000000000001', 2, now(), true, 0,
      array['application/pdf'], 1048575, '20000000-0000-4000-8000-000000000001'
    )$$,
  '23514',
  null,
  'assignment file limit cannot be below 1 MiB'
);

select throws_ok(
  $$insert into public.commitments (
      submission_id, assignment_id, student_id, token_id, policy_version_id,
      nonce, file_sha256, provider_message_id, sender_phone_e164, webhook_received_at, processed_at
    ) values (
      '26000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002', '25000000-0000-4000-8000-000000000001',
      '24000000-0000-4000-8000-000000000002', 'wrong-policy-assignment', repeat('f', 64),
      'provider-wrong-policy', '+2348012345001', now(), now()
    )$$,
  '23503',
  null,
  'a commitment cannot use another assignment policy version'
);

select throws_ok(
  $$insert into public.commitments (
      submission_id, assignment_id, student_id, token_id, policy_version_id,
      nonce, file_sha256, provider_message_id, sender_phone_e164, webhook_received_at, processed_at
    ) values (
      '26000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002', '25000000-0000-4000-8000-000000000002',
      '24000000-0000-4000-8000-000000000001', 'wrong-student-token', repeat('f', 64),
      'provider-wrong-token', '+2348098765002', now(), now()
    )$$,
  '23503',
  null,
  'a commitment token must belong to the same student and assignment'
);

select throws_ok(
  $$insert into public.submission_uploads (
      id, submission_id, assignment_id, student_id, storage_object_path,
      server_sha256, matched_commitment_id
    ) values (
      '28000000-0000-4000-8000-000000000001',
      '26000000-0000-4000-8000-000000000001',
      '23000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002',
      '23000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000002/26000000-0000-4000-8000-000000000001/28000000-0000-4000-8000-000000000001',
      repeat('9', 64),
      '27000000-0000-4000-8000-000000000002'
    )$$,
  '23503',
  null,
  'an upload cannot match another student commitment'
);

reset role;
select * from finish();
rollback;
