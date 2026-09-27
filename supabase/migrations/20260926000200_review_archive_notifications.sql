create type public.submission_review_decision as enum ('accepted', 'flagged');

alter table public.assignments
  add column archived_at timestamptz,
  add column archived_by uuid references public.profiles (id) on delete set null,
  add constraint assignments_archive_state_check check (
    (archived_at is null and archived_by is null)
    or (archived_at is not null and archived_by is not null and status = 'closed')
  );

create table public.submission_review_events (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null,
  assignment_id uuid not null,
  student_id uuid not null,
  reviewer_id uuid not null references public.profiles (id) on delete restrict,
  decision public.submission_review_decision not null,
  reason text check (reason is null or char_length(reason) <= 1000),
  event_at timestamptz not null default now(),
  constraint submission_review_events_submission_owner_fk
    foreign key (submission_id, assignment_id, student_id)
    references public.submissions (id, assignment_id, student_id) on delete restrict
);

create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  email_assignment_reminders boolean not null default true,
  email_submission_confirmations boolean not null default true,
  email_fallback_attention boolean not null default true,
  email_product_updates boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique check (char_length(event_key) between 1 and 255),
  recipient_user_id uuid references public.profiles (id) on delete set null,
  recipient_email text not null check (char_length(btrim(recipient_email)) between 3 and 320),
  template_key text not null check (template_key in (
    'commitment_recorded', 'upload_finalized', 'fallback_attention', 'submission_flagged', 'assignment_reminder'
  )),
  payload jsonb not null default '{}'::jsonb check (
    jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 8192
  ),
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'cancelled')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  provider_message_id text,
  last_error text check (last_error is null or char_length(last_error) <= 1000),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notification_outbox_ready_idx
  on public.notification_outbox (next_attempt_at, created_at)
  where status in ('pending', 'sending');

create trigger submission_review_events_immutable
  before update or delete on public.submission_review_events
  for each row execute function private.reject_immutable_record_mutation();

create or replace function private.create_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger profiles_create_notification_preferences
  after insert on public.profiles
  for each row execute function private.create_notification_preferences();

insert into public.notification_preferences (user_id)
select p.id from public.profiles p
on conflict (user_id) do nothing;

create function private.queue_notification(
  p_event_key text,
  p_user_id uuid,
  p_email text,
  p_template_key text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nullif(btrim(p_email), '') is null then
    return;
  end if;
  insert into public.notification_outbox (
    event_key, recipient_user_id, recipient_email, template_key, payload
  ) values (
    p_event_key, p_user_id, p_email, p_template_key, coalesce(p_payload, '{}'::jsonb)
  ) on conflict (event_key) do nothing;
end;
$$;

create function private.queue_commitment_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  student_email text;
  wants_email boolean;
  assignment_title text;
begin
  select p.email, coalesce(np.email_submission_confirmations, true)
  into student_email, wants_email
  from public.profiles p
  left join public.notification_preferences np on np.user_id = p.id
  where p.id = new.student_id;

  if not coalesce(wants_email, false) then
    return new;
  end if;
  select a.title into assignment_title
  from public.assignments a where a.id = new.assignment_id;
  perform private.queue_notification(
    'commitment:' || new.id::text || ':confirmation', new.student_id, student_email,
    'commitment_recorded', jsonb_build_object(
      'assignmentId', new.assignment_id,
      'assignmentTitle', assignment_title,
      'submissionId', new.submission_id,
      'commitmentId', new.id,
      'gatewayEventAt', new.gateway_event_at,
      'recipientRole', 'student'
    )
  );
  return new;
end;
$$;

create trigger commitments_enqueue_confirmation
  after insert on public.commitments
  for each row execute function private.queue_commitment_confirmation();

create function private.queue_upload_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  student_email text;
  student_wants_confirmation boolean;
  student_wants_attention boolean;
  lecturer_id uuid;
  lecturer_email text;
  lecturer_wants_attention boolean;
  assignment_title text;
  has_commitment boolean;
  payload jsonb;
begin
  select p.email,
         coalesce(np.email_submission_confirmations, true),
         coalesce(np.email_fallback_attention, true)
  into student_email, student_wants_confirmation, student_wants_attention
  from public.profiles p
  left join public.notification_preferences np on np.user_id = p.id
  where p.id = new.student_id;

  select a.title, c.lecturer_id into assignment_title, lecturer_id
  from public.assignments a
  join public.courses c on c.id = a.course_id
  where a.id = new.assignment_id;

  payload := jsonb_build_object(
    'assignmentId', new.assignment_id,
    'assignmentTitle', assignment_title,
    'submissionId', new.submission_id,
    'uploadId', new.id,
    'verificationResult', new.verification_result::text,
    'policyResult', new.policy_result::text,
    'recipientRole', 'student'
  );

  if coalesce(student_wants_confirmation, false) then
    perform private.queue_notification(
      'upload:' || new.id::text || ':confirmation', new.student_id, student_email,
      'upload_finalized', payload
    );
  end if;

  select exists (
    select 1 from public.commitments cmt where cmt.submission_id = new.submission_id
  ) into has_commitment;
  if has_commitment and new.policy_result <> 'qualifies'::public.policy_result then
    select p.email, coalesce(np.email_fallback_attention, true)
    into lecturer_email, lecturer_wants_attention
    from public.profiles p
    left join public.notification_preferences np on np.user_id = p.id
    where p.id = lecturer_id;

    if coalesce(student_wants_attention, false) then
      perform private.queue_notification(
        'upload:' || new.id::text || ':attention:student', new.student_id, student_email,
        'fallback_attention', payload || jsonb_build_object('recipientRole', 'student')
      );
    end if;
    if coalesce(lecturer_wants_attention, false) then
      perform private.queue_notification(
        'upload:' || new.id::text || ':attention:lecturer', lecturer_id, lecturer_email,
        'fallback_attention', payload || jsonb_build_object('recipientRole', 'lecturer')
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger submission_uploads_enqueue_notifications
  after insert on public.submission_uploads
  for each row execute function private.queue_upload_notifications();

create function private.queue_flagged_review_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  student_email text;
  wants_attention boolean;
  assignment_title text;
begin
  if new.decision <> 'flagged'::public.submission_review_decision then
    return new;
  end if;
  select p.email, coalesce(np.email_fallback_attention, true)
    into student_email, wants_attention
  from public.profiles p
  left join public.notification_preferences np on np.user_id = p.id
  where p.id = new.student_id;
  if not coalesce(wants_attention, false) then
    return new;
  end if;
  select a.title into assignment_title
  from public.assignments a where a.id = new.assignment_id;
  perform private.queue_notification(
    'review:' || new.id::text || ':flagged', new.student_id, student_email,
    'submission_flagged', jsonb_build_object(
      'assignmentId', new.assignment_id,
      'assignmentTitle', assignment_title,
      'submissionId', new.submission_id,
      'reviewEventId', new.id,
      'reason', new.reason,
      'recipientRole', 'student'
    )
  );
  return new;
end;
$$;

create trigger submission_review_events_enqueue_flagged
  after insert on public.submission_review_events
  for each row execute function private.queue_flagged_review_notification();

create function public.record_submission_review(
  p_actor_id uuid,
  p_submission_id uuid,
  p_decision public.submission_review_decision,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  submission_row public.submissions%rowtype;
  assignment_row public.assignments%rowtype;
  latest_policy_result public.policy_result;
  normalized_reason text := nullif(btrim(p_reason), '');
  review_id uuid;
begin
  if p_decision is null or char_length(coalesce(normalized_reason, '')) > 1000 then
    raise exception using errcode = '22023', message = 'invalid review input';
  end if;
  select * into submission_row from public.submissions
  where id = p_submission_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'submission not found';
  end if;
  select * into assignment_row from public.assignments
  where id = submission_row.assignment_id and created_by = p_actor_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'submission not found';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_actor_id and p.role = 'lecturer') then
    raise exception using errcode = '42501', message = 'lecturer role required';
  end if;

  select u.policy_result into latest_policy_result
  from public.submission_uploads u
  where u.submission_id = p_submission_id
  order by u.finalized_at desc, u.id desc
  limit 1;
  if p_decision = 'accepted'::public.submission_review_decision
      and latest_policy_result is distinct from 'qualifies'::public.policy_result
      and normalized_reason is null then
    raise exception using errcode = '22023', message = 'a reason is required to accept a non-qualifying submission';
  end if;

  insert into public.submission_review_events (
    submission_id, assignment_id, student_id, reviewer_id, decision, reason
  ) values (
    submission_row.id, submission_row.assignment_id, submission_row.student_id,
    p_actor_id, p_decision, normalized_reason
  ) returning id into review_id;

  insert into public.audit_events (
    actor_id, source, course_id, assignment_id, submission_id,
    event_type, event_at, metadata
  ) values (
    p_actor_id, 'api', assignment_row.course_id, assignment_row.id, submission_row.id,
    'submission.review.' || p_decision::text, now(),
    jsonb_strip_nulls(jsonb_build_object('reviewEventId', review_id, 'decision', p_decision, 'reason', normalized_reason))
  );
  return review_id;
end;
$$;

create function public.archive_closed_assignment(p_actor_id uuid, p_assignment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  assignment_row public.assignments%rowtype;
begin
  select * into assignment_row from public.assignments
  where id = p_assignment_id and created_by = p_actor_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'assignment not found';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_actor_id and p.role = 'lecturer') then
    raise exception using errcode = '42501', message = 'lecturer role required';
  end if;
  if assignment_row.status <> 'closed' then
    raise exception using errcode = 'P0001', message = 'only a closed assignment can be archived';
  end if;
  if assignment_row.archived_at is not null then
    return p_assignment_id;
  end if;
  update public.assignments
  set archived_at = now(), archived_by = p_actor_id
  where id = p_assignment_id;
  insert into public.audit_events (
    actor_id, source, course_id, assignment_id, event_type, event_at, metadata
  ) values (
    p_actor_id, 'api', assignment_row.course_id, p_assignment_id,
    'assignment.archived', now(), '{}'::jsonb
  );
  return p_assignment_id;
end;
$$;

create function public.enqueue_due_submission_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer := 0;
begin
  with due as (
    select distinct on (a.id, e.student_id)
      a.id as assignment_id, a.title, e.student_id, p.email, pv.deadline_at
    from public.assignments a
    join public.assignment_policy_versions pv on pv.id = a.current_policy_version_id
    join public.enrollments e on e.course_id = a.course_id
    join public.profiles p on p.id = e.student_id
    join public.notification_preferences np on np.user_id = e.student_id
    where a.status = 'published'
      and pv.deadline_at > now()
      and pv.deadline_at <= now() + interval '24 hours'
      and np.email_assignment_reminders
      and p.email is not null
      and not exists (
        select 1 from public.submissions s
        join public.submission_uploads u on u.submission_id = s.id
        where s.assignment_id = a.id and s.student_id = e.student_id
      )
    order by a.id, e.student_id
  ), queued as (
    insert into public.notification_outbox (
      event_key, recipient_user_id, recipient_email, template_key, payload
    )
    select
      'reminder:' || due.assignment_id::text || ':' || due.student_id::text,
      due.student_id, due.email, 'assignment_reminder',
      jsonb_build_object(
        'assignmentId', due.assignment_id,
        'assignmentTitle', due.title,
        'studentId', due.student_id,
        'deadlineAt', due.deadline_at,
        'recipientRole', 'student'
      )
    from due
    on conflict (event_key) do nothing
    returning 1
  ) select count(*)::integer into inserted_count from queued;
  return inserted_count;
end;
$$;

create function public.claim_notification_outbox(p_limit integer default 25)
returns setof public.notification_outbox
language sql
security definer
set search_path = ''
as $$
  with candidates as (
    select o.id
    from public.notification_outbox o
    where o.next_attempt_at <= now()
      and (o.status = 'pending' or (o.status = 'sending' and o.claimed_at < now() - interval '10 minutes'))
    order by o.created_at
    for update skip locked
    limit least(greatest(coalesce(p_limit, 25), 1), 100)
  )
  update public.notification_outbox o
  set status = 'sending', attempts = o.attempts + 1, claimed_at = now(), updated_at = now()
  from candidates c
  where o.id = c.id
  returning o.*
$$;

create function public.complete_notification_delivery(
  p_outbox_id uuid,
  p_provider_message_id text default null,
  p_error text default null,
  p_cancelled boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notification_outbox o
  set status = case
        when p_cancelled then 'cancelled'
        when p_error is null then 'sent'
        else 'pending'
      end,
      provider_message_id = case when p_error is null then p_provider_message_id else o.provider_message_id end,
      last_error = case when p_error is null then null else left(p_error, 1000) end,
      next_attempt_at = case
        when p_error is null then o.next_attempt_at
        else now() + make_interval(secs => least(3600, (30 * power(2, greatest(o.attempts - 1, 0)))::integer))
      end,
      claimed_at = null,
      sent_at = case when p_error is null then now() else null end,
      updated_at = now()
  where o.id = p_outbox_id and o.status = 'sending';
  return found;
end;
$$;

revoke all on function private.create_notification_preferences() from public, anon, authenticated, service_role;
revoke all on function private.queue_notification(text, uuid, text, text, jsonb) from public, anon, authenticated, service_role;
revoke all on function private.queue_commitment_confirmation() from public, anon, authenticated, service_role;
revoke all on function private.queue_upload_notifications() from public, anon, authenticated, service_role;
revoke all on function private.queue_flagged_review_notification() from public, anon, authenticated, service_role;
revoke all on function public.record_submission_review(uuid, uuid, public.submission_review_decision, text) from public, anon, authenticated;
revoke all on function public.archive_closed_assignment(uuid, uuid) from public, anon, authenticated;
revoke all on function public.enqueue_due_submission_reminders() from public, anon, authenticated;
revoke all on function public.claim_notification_outbox(integer) from public, anon, authenticated;
revoke all on function public.complete_notification_delivery(uuid, text, text, boolean) from public, anon, authenticated;

grant execute on function public.record_submission_review(uuid, uuid, public.submission_review_decision, text) to service_role;
grant execute on function public.archive_closed_assignment(uuid, uuid) to service_role;
grant execute on function public.enqueue_due_submission_reminders() to service_role;
grant execute on function public.claim_notification_outbox(integer) to service_role;
grant execute on function public.complete_notification_delivery(uuid, text, text, boolean) to service_role;

alter table public.submission_review_events enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_outbox enable row level security;

create policy submission_review_events_read_evidence_owner
  on public.submission_review_events for select to authenticated
  using (private.can_read_student_evidence(assignment_id, student_id));
create policy notification_preferences_read_self
  on public.notification_preferences for select to authenticated
  using (user_id = auth.uid());
create policy notification_preferences_update_self
  on public.notification_preferences for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on table public.submission_review_events, public.notification_preferences, public.notification_outbox
  from anon, authenticated;
grant select on public.submission_review_events to authenticated;
grant select on public.notification_preferences to authenticated;
grant update (email_assignment_reminders, email_submission_confirmations, email_fallback_attention, email_product_updates, updated_at)
  on public.notification_preferences to authenticated;
grant all on public.submission_review_events, public.notification_preferences, public.notification_outbox to service_role;
