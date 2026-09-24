begin;

select no_plan();

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('60000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'phase2-lecturer@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('60000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'phase2-student@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

update public.profiles set role = 'lecturer'
where id = '60000000-0000-4000-8000-000000000001';
update public.profiles set phone_e164 = '+2348012346002'
where id = '60000000-0000-4000-8000-000000000002';

insert into public.courses (id, code, title, lecturer_id)
values ('61000000-0000-4000-8000-000000000001', 'PHASE2-101', 'Phase 2 Course', '60000000-0000-4000-8000-000000000001');
insert into public.enrollments (course_id, student_id)
values ('61000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000002');

select has_table('public', 'submission_upload_reservations', 'upload reservations are stored separately from completed evidence');
select has_column('public', 'commitments', 'provider', 'commitments record provider provenance');
select has_column('public', 'submission_uploads', 'reservation_id', 'completed uploads link to their reservation');
select ok(
  (select relrowsecurity from pg_catalog.pg_class c
   join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'submission_upload_reservations'),
  'upload reservations have row-level security enabled'
);

select ok(
  not has_function_privilege('authenticated', 'public.create_assignment(uuid,uuid,text,text,jsonb)', 'EXECUTE'),
  'authenticated clients cannot invoke privileged assignment writes'
);

create temporary table phase2_fixture (
  assignment_id uuid not null,
  student_id uuid not null,
  original_policy_id uuid,
  current_policy_id uuid,
  original_token_hash text,
  active_token_hash text,
  token_id uuid
) on commit drop;
insert into phase2_fixture (assignment_id, student_id)
values (
  public.create_assignment(
    '60000000-0000-4000-8000-000000000001',
    '61000000-0000-4000-8000-000000000001',
    'Phase 2 assignment',
    'A controlled test fixture',
    '{"deadlineAt":"2026-12-01T12:00:00Z","fallbackEnabled":true,"gracePeriodMinutes":30,"allowedMimeTypes":["application/pdf"],"maxFileSizeBytes":10485760}'::jsonb
  ),
  '60000000-0000-4000-8000-000000000002'
);
select is(
  (select count(*)::integer
   from public.assignment_policy_versions p
   where p.assignment_id = (select assignment_id from phase2_fixture)),
  1,
  'assignment creation atomically adds its initial policy version'
);
update phase2_fixture f
set original_policy_id = p.id,
    current_policy_id = p.id
from public.assignment_policy_versions p
where p.assignment_id = f.assignment_id and p.version_number = 1;

select lives_ok(
  $$select public.update_assignment_draft(
      '60000000-0000-4000-8000-000000000001',
      (select assignment_id from phase2_fixture),
      null, null, false, false,
      jsonb_build_object(
        'deadlineAt', (now() + interval '1 day')::text,
        'fallbackEnabled', true,
        'gracePeriodMinutes', 31,
        'allowedMimeTypes', jsonb_build_array('application/pdf'),
        'maxFileSizeBytes', 10485760
      )
    )$$,
  'draft policy edits append a new immutable version'
);
update phase2_fixture f
set current_policy_id = a.current_policy_version_id
from public.assignments a where a.id = f.assignment_id;
select is(
  (select count(*)::integer from public.assignment_policy_versions where assignment_id = (select assignment_id from phase2_fixture)),
  2,
  'draft policy edit preserves the original version and adds version 2'
);

select is(
  public.publish_assignment(
    '60000000-0000-4000-8000-000000000001',
    (select assignment_id from phase2_fixture)
  )::text,
  (select assignment_id::text from phase2_fixture),
  'lecturer publishes the validated draft'
);
select throws_ok(
  $$select public.update_assignment_draft(
      '60000000-0000-4000-8000-000000000001',
      (select assignment_id from phase2_fixture),
      null, null, false, false,
      jsonb_build_object(
        'deadlineAt', (now() + interval '2 days')::text,
        'fallbackEnabled', true,
        'gracePeriodMinutes', 15,
        'allowedMimeTypes', jsonb_build_array('application/pdf'),
        'maxFileSizeBytes', 10485760
      )
    )$$,
  'P0001', null,
  'published policy cannot be edited'
);

update phase2_fixture f
set original_token_hash = repeat('a', 64),
    token_id = public.issue_assignment_token(
      f.student_id, f.assignment_id, repeat('a', 64), false
    );
select throws_ok(
  $$select public.issue_assignment_token(
      (select student_id from phase2_fixture),
      (select assignment_id from phase2_fixture),
      repeat('c', 64), false
    )$$,
  'P0001', null,
  'an existing active token requires explicit rotation'
);
update phase2_fixture f
set active_token_hash = repeat('b', 64),
    token_id = public.issue_assignment_token(
      f.student_id, f.assignment_id, repeat('b', 64), true
    );
select is(
  (select count(*)::integer from public.assignment_tokens t
   where t.assignment_id = (select assignment_id from phase2_fixture)
     and t.student_id = (select student_id from phase2_fixture)
     and t.revoked_at is null),
  1,
  'token rotation leaves exactly one active token'
);

select is(
  (public.process_commitment_event(
    'simulated', 'phase2-provider-message-1', repeat('b', 64),
    'nonce-phase2-0001', repeat('c', 64), '+2348012346002', now(), now()
  ) ->> 'outcome'),
  'accepted',
  'valid simulated commitment is atomically accepted'
);
select is(
  (public.process_commitment_event(
    'simulated', 'phase2-provider-message-1', repeat('b', 64),
    'nonce-phase2-0001', repeat('c', 64), '+2348012346002', now(), now()
  ) ->> 'outcome'),
  'duplicate',
  'provider retry is retained as a callback event without another commitment'
);
select is(
  (public.process_commitment_event(
    'simulated', 'phase2-provider-message-1', repeat('b', 64),
    'nonce-phase2-0001', repeat('d', 64), '+2348012346002', now(), now()
  ) ->> 'outcome'),
  'rejected',
  'reusing a provider message ID with different content is rejected'
);
select is(
  (public.process_commitment_event(
    'simulated', 'phase2-provider-message-2', repeat('b', 64),
    'nonce-phase2-0001', repeat('d', 64), '+2348012346002', now(), now()
  ) ->> 'outcome'),
  'rejected',
  'a nonce reused for a different fingerprint is rejected'
);
select is(
  (select count(*)::integer from public.commitments where assignment_id = (select assignment_id from phase2_fixture)),
  1,
  'duplicate callback attempts do not duplicate commitment rows'
);

create temporary table phase2_reservation as
select public.create_upload_reservation(
  (select student_id from phase2_fixture),
  (select assignment_id from phase2_fixture),
  'fallback', 'application/pdf', 32, 'phase2-upload-key-001'
) as result;
select is((select result ->> 'status' from phase2_reservation), 'reserved', 'fallback upload intent is reserved');
select is(
  (public.complete_upload_reservation(
    (select student_id from phase2_fixture),
    ((select result from phase2_reservation) ->> 'reservationId')::uuid,
    'application/pdf', 32, repeat('c', 64), now(),
    (select assignment_id::text || '/' || student_id::text || '/' ||
      (result ->> 'submissionId') || '/' || (result ->> 'reservationId')
     from phase2_fixture cross join phase2_reservation)
  ) ->> 'policyResult'),
  'qualifies',
  'matching file uploaded within grace qualifies under its commitment policy'
);
select is(
  (public.complete_upload_reservation(
    (select student_id from phase2_fixture),
    ((select result from phase2_reservation) ->> 'reservationId')::uuid,
    'application/pdf', 32, repeat('c', 64), now(),
    (select assignment_id::text || '/' || student_id::text || '/' ||
      (result ->> 'submissionId') || '/' || (result ->> 'reservationId')
     from phase2_fixture cross join phase2_reservation)
  ) ->> 'idempotent'),
  'true',
  'repeating upload finalization returns the existing evidence'
);

select public.close_assignment(
  '60000000-0000-4000-8000-000000000001',
  (select assignment_id from phase2_fixture)
);
select is(
  (public.create_upload_reservation(
    (select student_id from phase2_fixture),
    (select assignment_id from phase2_fixture),
    'fallback', 'application/pdf', 32, 'phase2-closed-upload-1'
  ) ->> 'status'),
  'reserved',
  'closed assignment permits upload reservations for existing commitments'
);
select is(
  (public.process_commitment_event(
    'simulated', 'phase2-provider-message-closed', repeat('b', 64),
    'nonce-phase2-closed', repeat('e', 64), '+2348012346002', now(), now()
  ) ->> 'outcome'),
  'rejected',
  'closed assignment rejects new commitments'
);

create temporary table phase2_ineligible_assignment as
select public.create_assignment(
  '60000000-0000-4000-8000-000000000001',
  '61000000-0000-4000-8000-000000000001',
  'Closed assignment with late proof',
  null,
  jsonb_build_object(
    'deadlineAt', (now() + interval '1 day')::text,
    'fallbackEnabled', true,
    'gracePeriodMinutes', 30,
    'allowedMimeTypes', jsonb_build_array('application/pdf'),
    'maxFileSizeBytes', 10485760
  )
) as assignment_id;
select public.publish_assignment(
  '60000000-0000-4000-8000-000000000001',
  (select assignment_id from phase2_ineligible_assignment)
);
select public.issue_assignment_token(
  '60000000-0000-4000-8000-000000000002',
  (select assignment_id from phase2_ineligible_assignment),
  repeat('d', 64), false
);
select is(
  (public.process_commitment_event(
    'simulated', 'phase2-provider-message-late', repeat('d', 64),
    'nonce-phase2-late1', repeat('e', 64), '+2348012346002',
    (select p.deadline_at from public.assignment_policy_versions p
      where p.assignment_id = (select assignment_id from phase2_ineligible_assignment)),
    now()
  ) ->> 'outcome'),
  'accepted',
  'a commitment at the deadline is recorded but cannot qualify as pre-deadline proof'
);
select public.close_assignment(
  '60000000-0000-4000-8000-000000000001',
  (select assignment_id from phase2_ineligible_assignment)
);
select throws_ok(
  $$select public.create_upload_reservation(
      '60000000-0000-4000-8000-000000000002',
      (select assignment_id from phase2_ineligible_assignment),
      'fallback', 'application/pdf', 32, 'phase2-ineligible-proof'
    )$$,
  'P0001', null,
  'a closed assignment rejects new reservations when its only commitment is ineligible'
);

grant select on phase2_fixture to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-000000000002', true);
select is(
  (select count(*)::integer from public.assignments
   where id = (select assignment_id from phase2_fixture)),
  1,
  'a student with existing evidence can still read the closed assignment'
);
select is(
  (select count(*)::integer from public.assignment_policy_versions
   where id = (select current_policy_id from phase2_fixture)),
  1,
  'a student with existing evidence can still read its policy after closure'
);
select throws_ok(
  $$select * from public.submission_upload_reservations$$,
  '42501', null,
  'authenticated clients cannot read upload staging paths'
);
reset role;

select is(
  (select count(*)::integer from public.assignment_policy_versions p join public.assignments a on a.current_policy_version_id = p.id where a.title = 'Phase 2 assignment'),
  1,
  'the draft points to its first immutable policy version'
);

select throws_ok(
  $$select public.create_assignment(
      '60000000-0000-4000-8000-000000000002',
      '61000000-0000-4000-8000-000000000001',
      'Student cannot create', null,
      '{"deadlineAt":"2026-12-01T12:00:00Z","fallbackEnabled":true,"gracePeriodMinutes":30,"allowedMimeTypes":["application/pdf"],"maxFileSizeBytes":10485760}'::jsonb
    )$$,
  '42501', null,
  'students cannot create assignments even when an actor id is supplied'
);

select * from finish();
rollback;
