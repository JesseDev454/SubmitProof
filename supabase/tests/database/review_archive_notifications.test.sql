begin;

select no_plan();

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('62000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'review-lecturer@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('62000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'review-student@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('62000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'review-other@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

update public.profiles set role = 'lecturer'
where id = '62000000-0000-4000-8000-000000000001';
update public.profiles set phone_e164 = '+2348012346202'
where id = '62000000-0000-4000-8000-000000000002';

insert into public.courses (id, code, title, lecturer_id)
values ('62100000-0000-4000-8000-000000000001', 'REV-101', 'Review Course', '62000000-0000-4000-8000-000000000001');
insert into public.enrollments (course_id, student_id)
values ('62100000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000002');

create temporary table review_fixture on commit drop as
select public.create_assignment(
  '62000000-0000-4000-8000-000000000001',
  '62100000-0000-4000-8000-000000000001',
  'Reviewable assignment', 'Audit and review fixture',
  jsonb_build_object(
    'deadlineAt', (now() + interval '2 days')::text,
    'fallbackEnabled', true,
    'gracePeriodMinutes', 30,
    'allowedMimeTypes', jsonb_build_array('application/pdf'),
    'maxFileSizeBytes', 10485760
  )
) as assignment_id;

select public.publish_assignment(
  '62000000-0000-4000-8000-000000000001',
  (select assignment_id from review_fixture)
);

insert into public.submissions (id, assignment_id, student_id, workflow_status)
select '62200000-0000-4000-8000-000000000001', assignment_id,
  '62000000-0000-4000-8000-000000000002', 'awaiting_upload'
from review_fixture;

select has_table('public', 'submission_review_events', 'human review decisions are stored separately');
select has_table('public', 'notification_preferences', 'email preferences have their own table');
select has_table('public', 'notification_outbox', 'notifications use a persistent outbox');
select has_column('public', 'assignments', 'archived_at', 'assignments can be archived after closing');

select throws_ok(
  $$select public.record_submission_review(
      '62000000-0000-4000-8000-000000000001',
      '62200000-0000-4000-8000-000000000001', 'accepted', null
    )$$,
  '22023', null,
  'accepting a submission without a qualifying policy result requires a reason'
);

select lives_ok(
  $$select public.record_submission_review(
      '62000000-0000-4000-8000-000000000001',
      '62200000-0000-4000-8000-000000000001', 'flagged', null
    )$$,
  'a lecturer can flag a submission for review'
);
select lives_ok(
  $$select public.record_submission_review(
      '62000000-0000-4000-8000-000000000001',
      '62200000-0000-4000-8000-000000000001', 'accepted', 'Reviewed evidence manually.'
    )$$,
  'a flagged submission can later be accepted with a reason'
);
select is(
  (select count(*)::integer from public.submission_review_events
   where submission_id = '62200000-0000-4000-8000-000000000001'),
  2,
  'each lecturer decision is appended as a separate review event'
);
select throws_ok(
  $$update public.submission_review_events set reason = 'rewritten'
    where submission_id = '62200000-0000-4000-8000-000000000001'$$,
  '55000', null, 'review history cannot be updated'
);
select throws_ok(
  $$update public.audit_events set metadata = '{"changed":true}'::jsonb
    where assignment_id = (select assignment_id from review_fixture)
      and event_type = 'submission.review.flagged'$$,
  '55000', null, 'review audit events cannot be updated'
);

select throws_ok(
  $$select public.archive_closed_assignment(
      '62000000-0000-4000-8000-000000000001',
      (select assignment_id from review_fixture)
    )$$,
  'P0001', null, 'an assignment cannot be archived before it is closed'
);
select public.close_assignment(
  '62000000-0000-4000-8000-000000000001',
  (select assignment_id from review_fixture)
);
select lives_ok(
  $$select public.archive_closed_assignment(
      '62000000-0000-4000-8000-000000000001',
      (select assignment_id from review_fixture)
    )$$,
  'the owner can archive a closed assignment'
);
select ok(
  (select archived_at is not null and archived_by = '62000000-0000-4000-8000-000000000001'
   from public.assignments where id = (select assignment_id from review_fixture)),
  'archive actor and time are recorded'
);

select is(
  (select count(*)::integer from public.notification_outbox
   where template_key = 'submission_flagged'
     and (payload ->> 'submissionId') = '62200000-0000-4000-8000-000000000001'),
  1,
  'flagging a submission transactionally queues one student notification'
);
insert into public.notification_outbox (event_key, recipient_email, template_key)
values ('review-duplicate-key', 'review-student@example.test', 'submission_flagged');
select throws_ok(
  $$insert into public.notification_outbox (event_key, recipient_email, template_key)
    values ('review-duplicate-key', 'review-student@example.test', 'submission_flagged')$$,
  '23505', null, 'notification event keys are unique'
);

create temporary table reminder_fixture on commit drop as
select public.create_assignment(
  '62000000-0000-4000-8000-000000000001',
  '62100000-0000-4000-8000-000000000001',
  'Reminder assignment', 'Due within the daily reminder window',
  jsonb_build_object(
    'deadlineAt', (now() + interval '23 hours')::text,
    'fallbackEnabled', false,
    'gracePeriodMinutes', 0,
    'allowedMimeTypes', jsonb_build_array('application/pdf'),
    'maxFileSizeBytes', 10485760
  )
) as assignment_id;
select public.publish_assignment(
  '62000000-0000-4000-8000-000000000001',
  (select assignment_id from reminder_fixture)
);
select is(
  public.enqueue_due_submission_reminders(), 1,
  'one opted-in enrolled student with no completed upload receives a due-window reminder'
);
select is(
  (select count(*)::integer from public.notification_outbox
   where event_key = 'reminder:' || (select assignment_id::text from reminder_fixture) || ':62000000-0000-4000-8000-000000000002'),
  1,
  'the reminder outbox event is keyed by assignment and student'
);
select is(
  public.enqueue_due_submission_reminders(), 0,
  'a repeated daily run does not enqueue a duplicate reminder'
);

select set_config('test.assignment_id', (select assignment_id::text from review_fixture), true);
set local role authenticated;
select set_config('request.jwt.claim.sub', '62000000-0000-4000-8000-000000000002', true);
select is(
  (select count(*)::integer from public.notification_preferences), 1,
  'a student can read only their own notification preferences'
);
select is(
  (select count(*)::integer from public.submission_review_events
   where submission_id = '62200000-0000-4000-8000-000000000001'),
  2,
  'a student can read review history for their own submission'
);
select is(
  (select count(*)::integer from public.submissions
   where id = '62200000-0000-4000-8000-000000000001'),
  1,
  'a student retains access to their evidence after the assignment is archived'
);
select lives_ok(
  $$update public.notification_preferences
    set email_product_updates = true
    where user_id = '62000000-0000-4000-8000-000000000002'$$,
  'a student can save their own notification preferences'
);
select throws_ok(
  $$insert into public.notification_preferences (user_id)
    values ('62000000-0000-4000-8000-000000000003')$$,
  '42501', null, 'clients cannot create preference rows for another account'
);
select throws_ok(
  $$insert into public.submission_review_events (
      submission_id, assignment_id, student_id, reviewer_id, decision
    ) values (
      '62200000-0000-4000-8000-000000000001',
      current_setting('test.assignment_id')::uuid,
      '62000000-0000-4000-8000-000000000002',
      '62000000-0000-4000-8000-000000000002', 'flagged'
    )$$,
  '42501', null, 'students cannot write lecturer review events directly'
);
reset role;

select * from finish();
rollback;
