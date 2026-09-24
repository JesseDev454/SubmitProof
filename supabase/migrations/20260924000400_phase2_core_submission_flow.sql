alter table public.assignments
  add column closed_at timestamptz;

alter table public.commitments
  add column provider text not null default 'africastalking'
    check (provider in ('simulated', 'africastalking'));

alter table public.submission_uploads
  add column reservation_id uuid,
  add column policy_version_id uuid,
  add column finalized_at timestamptz not null default now();

create table public.submission_upload_reservations (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null,
  student_id uuid not null,
  submission_id uuid not null,
  policy_version_id uuid not null,
  kind text not null check (kind in ('normal', 'fallback')),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 128),
  declared_mime_type text not null,
  declared_file_size_bytes bigint not null check (declared_file_size_bytes > 0),
  staging_object_path text not null unique,
  status text not null default 'reserved'
    check (status in ('reserved', 'finalized', 'rejected', 'expired')),
  expires_at timestamptz not null,
  storage_received_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint submission_upload_reservations_expiry_check check (expires_at > created_at),
  constraint submission_upload_reservations_staging_path_check check (
    staging_object_path = 'staging/' || assignment_id::text || '/' ||
      student_id::text || '/' || id::text
  ),
  constraint submission_upload_reservations_submission_fk
    foreign key (submission_id, assignment_id, student_id)
    references public.submissions (id, assignment_id, student_id)
    on delete restrict,
  constraint submission_upload_reservations_policy_fk
    foreign key (assignment_id, policy_version_id)
    references public.assignment_policy_versions (assignment_id, id)
    on delete restrict,
  unique (student_id, idempotency_key),
  unique (id, assignment_id, student_id)
);

alter table public.submission_uploads
  add constraint submission_uploads_reservation_owner_fk
    foreign key (reservation_id, assignment_id, student_id)
    references public.submission_upload_reservations (id, assignment_id, student_id)
    on delete restrict,
  add constraint submission_uploads_policy_version_fk
    foreign key (assignment_id, policy_version_id)
    references public.assignment_policy_versions (assignment_id, id)
    on delete restrict,
  add constraint submission_uploads_reservation_unique unique (reservation_id);

create index submission_upload_reservations_expiry_idx
  on public.submission_upload_reservations (expires_at)
  where status = 'reserved';

alter table public.submission_upload_reservations enable row level security;

revoke all on table public.submission_upload_reservations from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;

create function private.validate_phase2_policy(p_policy jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  mime_type text;
begin
  if jsonb_typeof(p_policy) is distinct from 'object'
     or not (p_policy ? 'deadlineAt')
     or jsonb_typeof(p_policy -> 'fallbackEnabled') is distinct from 'boolean'
     or jsonb_typeof(p_policy -> 'gracePeriodMinutes') is distinct from 'number'
     or jsonb_typeof(p_policy -> 'allowedMimeTypes') is distinct from 'array'
     or jsonb_typeof(p_policy -> 'maxFileSizeBytes') is distinct from 'number' then
    raise exception using errcode = '22023', message = 'invalid assignment policy';
  end if;

  if (p_policy ->> 'gracePeriodMinutes')::integer < 0
     or (p_policy ->> 'maxFileSizeBytes')::bigint not between 1048576 and 52428800
     or jsonb_array_length(p_policy -> 'allowedMimeTypes') = 0 then
    raise exception using errcode = '22023', message = 'invalid assignment policy limits';
  end if;

  for mime_type in select jsonb_array_elements_text(p_policy -> 'allowedMimeTypes') loop
    if mime_type not in ('application/pdf', 'image/png', 'image/jpeg', 'text/plain') then
      raise exception using errcode = '22023', message = 'unsupported assignment file type';
    end if;
  end loop;

  perform (p_policy ->> 'deadlineAt')::timestamptz;
end;
$$;

create function private.insert_assignment_policy_version(
  target_assignment_id uuid,
  target_actor_id uuid,
  target_version integer,
  p_policy jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  new_policy_id uuid;
  allowed_types text[];
begin
  perform private.validate_phase2_policy(p_policy);
  select array_agg(value)
  into allowed_types
  from jsonb_array_elements_text(p_policy -> 'allowedMimeTypes') as item(value);

  insert into public.assignment_policy_versions (
    assignment_id, version_number, deadline_at, fallback_enabled,
    grace_period_minutes, allowed_mime_types, max_file_size_bytes, created_by
  ) values (
    target_assignment_id,
    target_version,
    (p_policy ->> 'deadlineAt')::timestamptz,
    (p_policy ->> 'fallbackEnabled')::boolean,
    (p_policy ->> 'gracePeriodMinutes')::integer,
    allowed_types,
    (p_policy ->> 'maxFileSizeBytes')::bigint,
    target_actor_id
  ) returning id into new_policy_id;

  return new_policy_id;
end;
$$;

create function public.create_assignment(
  p_actor_id uuid,
  p_course_id uuid,
  p_title text,
  p_description text,
  p_policy jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_assignment_id uuid;
  new_policy_id uuid;
begin
  if not exists (
    select 1 from public.profiles p where p.id = p_actor_id and p.role = 'lecturer'
  ) then
    raise exception using errcode = '42501', message = 'lecturer role required';
  end if;
  if not exists (
    select 1 from public.courses c where c.id = p_course_id and c.lecturer_id = p_actor_id
  ) then
    raise exception using errcode = 'P0002', message = 'course not found';
  end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'invalid assignment title';
  end if;

  insert into public.assignments (course_id, created_by, title, description)
  values (p_course_id, p_actor_id, btrim(p_title), nullif(btrim(p_description), ''))
  returning id into new_assignment_id;

  new_policy_id := private.insert_assignment_policy_version(
    new_assignment_id, p_actor_id, 1, p_policy
  );
  update public.assignments
  set current_policy_version_id = new_policy_id
  where id = new_assignment_id;

  insert into public.audit_events (
    actor_id, source, course_id, assignment_id, event_type, event_at, metadata
  ) values (
    p_actor_id, 'api', p_course_id, new_assignment_id, 'assignment.created', now(),
    jsonb_build_object('policyVersion', 1)
  );
  return new_assignment_id;
end;
$$;

create function public.update_assignment_draft(
  p_actor_id uuid,
  p_assignment_id uuid,
  p_title text,
  p_description text,
  p_update_title boolean,
  p_update_description boolean,
  p_policy jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  assignment_row public.assignments%rowtype;
  current_policy public.assignment_policy_versions%rowtype;
  new_policy_id uuid;
  policy_changed boolean := false;
  allowed_types text[];
begin
  select * into assignment_row from public.assignments
  where id = p_assignment_id and created_by = p_actor_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'assignment not found';
  end if;
  if not exists (
    select 1 from public.profiles p where p.id = p_actor_id and p.role = 'lecturer'
  ) then
    raise exception using errcode = '42501', message = 'lecturer role required';
  end if;
  if assignment_row.status <> 'draft' then
    raise exception using errcode = 'P0001', message = 'assignment is not a draft';
  end if;
  if not p_update_title and not p_update_description and p_policy is null then
    raise exception using errcode = '22023', message = 'empty assignment update';
  end if;
  if p_update_title and char_length(btrim(p_title)) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'invalid assignment title';
  end if;

  if p_policy is not null then
    perform private.validate_phase2_policy(p_policy);
    select * into current_policy from public.assignment_policy_versions
    where id = assignment_row.current_policy_version_id;
    select array_agg(value)
      into allowed_types
      from jsonb_array_elements_text(p_policy -> 'allowedMimeTypes') as item(value);
    policy_changed :=
      current_policy.deadline_at is distinct from (p_policy ->> 'deadlineAt')::timestamptz
      or current_policy.fallback_enabled is distinct from (p_policy ->> 'fallbackEnabled')::boolean
      or current_policy.grace_period_minutes is distinct from (p_policy ->> 'gracePeriodMinutes')::integer
      or current_policy.allowed_mime_types is distinct from allowed_types
      or current_policy.max_file_size_bytes is distinct from (p_policy ->> 'maxFileSizeBytes')::bigint;
  end if;

  update public.assignments
  set title = case when p_update_title then btrim(p_title) else title end,
      description = case
        when p_update_description then nullif(btrim(p_description), '')
        else description
      end
  where id = p_assignment_id;

  if policy_changed then
    select private.insert_assignment_policy_version(
      p_assignment_id, p_actor_id, current_policy.version_number + 1, p_policy
    ) into new_policy_id;
    update public.assignments
    set current_policy_version_id = new_policy_id
    where id = p_assignment_id;
  end if;

  insert into public.audit_events (
    actor_id, source, course_id, assignment_id, event_type, event_at, metadata
  ) values (
    p_actor_id, 'api', assignment_row.course_id, p_assignment_id,
    'assignment.draft_updated', now(),
    jsonb_build_object('policyVersionCreated', policy_changed)
  );
  return coalesce(new_policy_id, assignment_row.current_policy_version_id);
end;
$$;

create function public.publish_assignment(p_actor_id uuid, p_assignment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  assignment_row public.assignments%rowtype;
  policy_row public.assignment_policy_versions%rowtype;
begin
  select * into assignment_row from public.assignments
  where id = p_assignment_id and created_by = p_actor_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'assignment not found';
  end if;
  if not exists (
    select 1 from public.profiles p where p.id = p_actor_id and p.role = 'lecturer'
  ) then
    raise exception using errcode = '42501', message = 'lecturer role required';
  end if;
  if assignment_row.status <> 'draft' then
    raise exception using errcode = 'P0001', message = 'assignment is not a draft';
  end if;
  select * into policy_row from public.assignment_policy_versions
  where id = assignment_row.current_policy_version_id;
  if not found or policy_row.deadline_at <= now() then
    raise exception using errcode = 'P0001', message = 'assignment deadline must be in the future';
  end if;

  update public.assignments
  set status = 'published', closed_at = null
  where id = p_assignment_id;
  insert into public.audit_events (
    actor_id, source, course_id, assignment_id, event_type, event_at, metadata
  ) values (
    p_actor_id, 'api', assignment_row.course_id, p_assignment_id,
    'assignment.published', now(), jsonb_build_object('policyVersion', policy_row.version_number)
  );
  return p_assignment_id;
end;
$$;

create function public.close_assignment(p_actor_id uuid, p_assignment_id uuid)
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
  if not exists (
    select 1 from public.profiles p where p.id = p_actor_id and p.role = 'lecturer'
  ) then
    raise exception using errcode = '42501', message = 'lecturer role required';
  end if;
  if assignment_row.status <> 'published' then
    raise exception using errcode = 'P0001', message = 'assignment is not published';
  end if;

  update public.assignments
  set status = 'closed', closed_at = now()
  where id = p_assignment_id;
  insert into public.audit_events (
    actor_id, source, course_id, assignment_id, event_type, event_at, metadata
  ) values (
    p_actor_id, 'api', assignment_row.course_id, p_assignment_id,
    'assignment.closed', now(), '{}'::jsonb
  );
  return p_assignment_id;
end;
$$;

create function public.issue_assignment_token(
  p_actor_id uuid,
  p_assignment_id uuid,
  p_token_hash text,
  p_rotate boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  assignment_row public.assignments%rowtype;
  policy_row public.assignment_policy_versions%rowtype;
  student_phone text;
  new_token_id uuid;
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'invalid token hash';
  end if;
  select * into assignment_row from public.assignments
  where id = p_assignment_id
  for update;
  if not found or assignment_row.status <> 'published' then
    raise exception using errcode = 'P0002', message = 'assignment not found';
  end if;
  select * into policy_row from public.assignment_policy_versions
  where id = assignment_row.current_policy_version_id;
  if not policy_row.fallback_enabled then
    raise exception using errcode = 'P0001', message = 'fallback is disabled';
  end if;
  if not exists (
    select 1 from public.profiles p where p.id = p_actor_id and p.role = 'student'
  ) then
    raise exception using errcode = '42501', message = 'student role required';
  end if;
  if not exists (
    select 1 from public.enrollments e
    join public.courses c on c.id = e.course_id
    where e.course_id = assignment_row.course_id
      and e.student_id = p_actor_id
      and c.lecturer_id = assignment_row.created_by
  ) then
    raise exception using errcode = 'P0002', message = 'assignment not found';
  end if;
  select phone_e164 into student_phone from public.profiles
  where id = p_actor_id
  for update;
  if student_phone is null then
    raise exception using errcode = 'P0001', message = 'registered phone required';
  end if;

  if exists (
    select 1 from public.assignment_tokens t
    where t.assignment_id = p_assignment_id and t.student_id = p_actor_id and t.revoked_at is null
  ) then
    if not p_rotate then
      raise exception using errcode = 'P0001', message = 'active token exists; rotation required';
    end if;
    update public.assignment_tokens
    set revoked_at = now()
    where assignment_id = p_assignment_id and student_id = p_actor_id and revoked_at is null;
  end if;

  insert into public.assignment_tokens (
    assignment_id, student_id, token_hash, phone_e164_snapshot
  ) values (
    p_assignment_id, p_actor_id, p_token_hash, student_phone
  ) returning id into new_token_id;

  insert into public.audit_events (
    actor_id, source, course_id, assignment_id, event_type, event_at, metadata
  ) values (
    p_actor_id, 'api', assignment_row.course_id, p_assignment_id,
    'fallback.token_issued', now(), jsonb_build_object('rotated', p_rotate)
  );
  return new_token_id;
end;
$$;

create function public.record_webhook_outcome(
  p_provider text,
  p_provider_message_id text,
  p_outcome public.webhook_outcome,
  p_received_at timestamptz,
  p_limited_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_event_id uuid;
begin
  insert into public.webhook_events (
    provider, provider_message_id, outcome, received_at, processed_at, limited_metadata
  ) values (
    p_provider, p_provider_message_id, p_outcome, p_received_at, now(),
    coalesce(p_limited_metadata, '{}'::jsonb)
  ) returning id into new_event_id;
  return new_event_id;
end;
$$;

create function public.process_commitment_event(
  p_provider text,
  p_provider_message_id text,
  p_token_hash text,
  p_nonce text,
  p_file_sha256 text,
  p_sender_phone text,
  p_gateway_event_at timestamptz,
  p_received_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  token_row public.assignment_tokens%rowtype;
  assignment_row public.assignments%rowtype;
  policy_row public.assignment_policy_versions%rowtype;
  submission_id uuid;
  commitment_id uuid;
  existing_commitment public.commitments%rowtype;
  outcome public.webhook_outcome;
  reason text;
  new_event_id uuid;
  has_existing_provider_message boolean;
begin
  if p_provider is null or p_provider not in ('simulated', 'africastalking')
     or p_provider_message_id is null
     or char_length(btrim(p_provider_message_id)) not between 1 and 200
     or p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$'
     or p_file_sha256 is null or p_file_sha256 !~ '^[a-f0-9]{64}$'
     or p_nonce is null or p_nonce !~ '^[A-Za-z0-9_-]{8,128}$'
     or p_sender_phone is null or p_sender_phone !~ '^\+[1-9][0-9]{7,14}$' then
    insert into public.webhook_events (
      provider, provider_message_id, outcome, received_at, processed_at, limited_metadata
    ) values (
      coalesce(p_provider, 'simulated'), p_provider_message_id, 'rejected',
      coalesce(p_received_at, now()), now(), '{"reason":"malformed_callback"}'::jsonb
    ) returning id into new_event_id;
    return jsonb_build_object('outcome', 'rejected', 'reason', 'malformed_callback');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('provider:' || p_provider || ':' || p_provider_message_id, 0)
  );
  select * into existing_commitment from public.commitments
  where provider_message_id = p_provider_message_id;
  has_existing_provider_message := found;
  if has_existing_provider_message and exists (
    select 1
    from public.commitments c
    join public.assignment_tokens t on t.id = c.token_id
    where c.id = existing_commitment.id
      and c.provider = p_provider
      and c.nonce = p_nonce
      and c.file_sha256 = p_file_sha256
      and c.sender_phone_e164 = p_sender_phone
      and t.token_hash = p_token_hash
  ) then
    insert into public.webhook_events (
      provider, provider_message_id, outcome, gateway_event_at,
      received_at, processed_at, commitment_id, limited_metadata
    ) values (
      p_provider, p_provider_message_id, 'duplicate', p_gateway_event_at,
      coalesce(p_received_at, now()), now(), existing_commitment.id,
      '{"reason":"provider_message_replay"}'::jsonb
    );
    return jsonb_build_object('outcome', 'duplicate', 'commitmentId', existing_commitment.id);
  elsif has_existing_provider_message then
    insert into public.webhook_events (
      provider, provider_message_id, outcome, gateway_event_at,
      received_at, processed_at, commitment_id, limited_metadata
    ) values (
      p_provider, p_provider_message_id, 'rejected', p_gateway_event_at,
      coalesce(p_received_at, now()), now(), existing_commitment.id,
      '{"reason":"provider_message_conflict"}'::jsonb
    );
    return jsonb_build_object('outcome', 'rejected', 'reason', 'provider_message_conflict');
  end if;

  select * into token_row from public.assignment_tokens t
  where t.token_hash = p_token_hash and t.revoked_at is null
  for share;
  if not found then
    reason := 'unknown_or_revoked_token';
  elsif token_row.phone_e164_snapshot <> p_sender_phone then
    reason := 'sender_mismatch';
  else
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'nonce:' || token_row.assignment_id::text || ':' ||
        token_row.student_id::text || ':' || p_nonce,
        0
      )
    );
    select * into existing_commitment from public.commitments c
    where c.assignment_id = token_row.assignment_id
      and c.student_id = token_row.student_id
      and c.nonce = p_nonce;
    if found then
      if existing_commitment.file_sha256 = p_file_sha256
         and existing_commitment.token_id = token_row.id then
        insert into public.webhook_events (
          provider, provider_message_id, outcome, gateway_event_at,
          received_at, processed_at, commitment_id, limited_metadata
        ) values (
          p_provider, p_provider_message_id, 'duplicate', p_gateway_event_at,
          coalesce(p_received_at, now()), now(), existing_commitment.id,
          '{"reason":"nonce_replay"}'::jsonb
        );
        return jsonb_build_object('outcome', 'duplicate', 'commitmentId', existing_commitment.id);
      end if;
      reason := 'nonce_conflict';
    else
      select * into assignment_row from public.assignments a
      where a.id = token_row.assignment_id
      for share;
      if assignment_row.status <> 'published' then
        reason := 'assignment_not_open';
      else
        select * into policy_row from public.assignment_policy_versions p
        where p.id = assignment_row.current_policy_version_id;
        if not found or not policy_row.fallback_enabled then
          reason := 'fallback_disabled';
        elsif not exists (
          select 1 from public.profiles p
          where p.id = token_row.student_id and p.role = 'student'
        ) then
          reason := 'student_unavailable';
        else
          insert into public.submissions (assignment_id, student_id, workflow_status)
          values (token_row.assignment_id, token_row.student_id, 'awaiting_upload')
          on conflict (assignment_id, student_id) do update
          set workflow_status = case
            when submissions.workflow_status = 'pending' then 'awaiting_upload'
            else public.submissions.workflow_status
          end
          returning id into submission_id;

          insert into public.commitments (
            submission_id, assignment_id, student_id, token_id, policy_version_id,
            nonce, file_sha256, provider_message_id, sender_phone_e164, provider,
            gateway_event_at, webhook_received_at, processed_at
          ) values (
            submission_id, token_row.assignment_id, token_row.student_id, token_row.id,
            policy_row.id, p_nonce, p_file_sha256, p_provider_message_id,
            p_sender_phone, p_provider, p_gateway_event_at,
            coalesce(p_received_at, now()), now()
          ) returning id into commitment_id;

          insert into public.webhook_events (
            provider, provider_message_id, outcome, gateway_event_at,
            received_at, processed_at, commitment_id, limited_metadata
          ) values (
            p_provider, p_provider_message_id, 'accepted', p_gateway_event_at,
            coalesce(p_received_at, now()), now(), commitment_id,
            '{"protocol":"SP1"}'::jsonb
          );
          insert into public.audit_events (
            actor_id, source, course_id, assignment_id, submission_id,
            commitment_id, event_type, event_at, metadata
          ) values (
            null, p_provider, assignment_row.course_id, assignment_row.id,
            submission_id, commitment_id, 'fallback.commitment_recorded',
            coalesce(p_gateway_event_at, p_received_at, now()),
            jsonb_build_object('policyVersion', policy_row.version_number)
          );
          return jsonb_build_object('outcome', 'accepted', 'commitmentId', commitment_id);
        end if;
      end if;
    end if;
  end if;

  insert into public.webhook_events (
    provider, provider_message_id, outcome, gateway_event_at,
    received_at, processed_at, limited_metadata
  ) values (
    p_provider, p_provider_message_id, 'rejected', p_gateway_event_at,
    coalesce(p_received_at, now()), now(), jsonb_build_object('reason', reason)
  );
  return jsonb_build_object('outcome', 'rejected', 'reason', reason);
end;
$$;

create function public.create_upload_reservation(
  p_actor_id uuid,
  p_assignment_id uuid,
  p_kind text,
  p_mime_type text,
  p_declared_size_bytes bigint,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  assignment_row public.assignments%rowtype;
  policy_row public.assignment_policy_versions%rowtype;
  submission_id uuid;
  reservation_row public.submission_upload_reservations%rowtype;
  reservation_id uuid;
  reservation_path text;
begin
  if p_kind not in ('normal', 'fallback')
     or p_mime_type not in ('application/pdf', 'image/png', 'image/jpeg', 'text/plain')
     or p_declared_size_bytes is null or p_declared_size_bytes <= 0
     or p_idempotency_key is null
     or char_length(p_idempotency_key) not between 8 and 128 then
    raise exception using errcode = '22023', message = 'invalid upload reservation';
  end if;
  if not exists (
    select 1 from public.profiles p where p.id = p_actor_id and p.role = 'student'
  ) then
    raise exception using errcode = '42501', message = 'student role required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('upload:' || p_actor_id::text || ':' || coalesce(p_idempotency_key, ''), 0)
  );
  select * into reservation_row from public.submission_upload_reservations r
  where r.student_id = p_actor_id and r.idempotency_key = p_idempotency_key;
  if found then
    if reservation_row.assignment_id <> p_assignment_id
       or reservation_row.kind <> p_kind
       or reservation_row.declared_mime_type <> p_mime_type
       or reservation_row.declared_file_size_bytes <> p_declared_size_bytes then
      raise exception using errcode = 'P0001', message = 'idempotency key reused with different upload data';
    end if;
    if reservation_row.status not in ('reserved', 'finalized') then
      raise exception using errcode = 'P0001', message = 'upload reservation is no longer active';
    end if;
    return jsonb_build_object(
      'reservationId', reservation_row.id,
      'submissionId', reservation_row.submission_id,
      'stagingObjectPath', reservation_row.staging_object_path,
      'expiresAt', reservation_row.expires_at,
      'policyVersionId', reservation_row.policy_version_id,
      'status', reservation_row.status
    );
  end if;

  select * into assignment_row from public.assignments a
  where a.id = p_assignment_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'assignment not found';
  end if;
  if assignment_row.status = 'closed' and p_kind <> 'fallback' then
    raise exception using errcode = 'P0001', message = 'assignment is closed';
  end if;
  if assignment_row.status not in ('published', 'closed') then
    raise exception using errcode = 'P0001', message = 'assignment is not published';
  end if;
  if not exists (
    select 1 from public.enrollments e
    where e.course_id = assignment_row.course_id and e.student_id = p_actor_id
  ) then
    raise exception using errcode = 'P0002', message = 'assignment not found';
  end if;
  select * into policy_row from public.assignment_policy_versions p
  where p.id = assignment_row.current_policy_version_id;
  if not found
     or p_mime_type <> all(policy_row.allowed_mime_types)
     or p_declared_size_bytes > policy_row.max_file_size_bytes then
    raise exception using errcode = '22023', message = 'file violates assignment policy';
  end if;
  if p_kind = 'fallback' and not policy_row.fallback_enabled then
    raise exception using errcode = 'P0001', message = 'fallback is disabled';
  end if;

  select s.id into submission_id from public.submissions s
  where s.assignment_id = p_assignment_id and s.student_id = p_actor_id;
  if assignment_row.status = 'closed' and (
    submission_id is null or not exists (
      select 1
      from public.commitments c
      join public.assignment_policy_versions commitment_policy
        on commitment_policy.id = c.policy_version_id
      where c.assignment_id = p_assignment_id
        and c.student_id = p_actor_id
        and c.processed_at <= assignment_row.closed_at
        and commitment_policy.fallback_enabled
        and c.gateway_event_at is not null
        and c.gateway_event_at < commitment_policy.deadline_at
        and now() < commitment_policy.deadline_at
          + make_interval(mins => commitment_policy.grace_period_minutes)
    )
  ) then
    raise exception using errcode = 'P0001', message = 'closed assignment accepts only eligible fallback evidence';
  end if;

  if submission_id is null then
    insert into public.submissions (assignment_id, student_id, workflow_status)
    values (p_assignment_id, p_actor_id, 'pending')
    returning id into submission_id;
  end if;

  reservation_id := gen_random_uuid();
  reservation_path := 'staging/' || p_assignment_id::text || '/' ||
    p_actor_id::text || '/' || reservation_id::text;
  insert into public.submission_upload_reservations (
    id, assignment_id, student_id, submission_id, policy_version_id, kind,
    idempotency_key, declared_mime_type, declared_file_size_bytes,
    staging_object_path, expires_at
  ) values (
    reservation_id, p_assignment_id, p_actor_id, submission_id,
    assignment_row.current_policy_version_id, p_kind, p_idempotency_key,
    p_mime_type, p_declared_size_bytes, reservation_path, now() + interval '2 hours'
  ) returning * into reservation_row;

  insert into public.audit_events (
    actor_id, source, course_id, assignment_id, submission_id,
    event_type, event_at, metadata
  ) values (
    p_actor_id, 'api', assignment_row.course_id, p_assignment_id, submission_id,
    'upload.reserved', now(), jsonb_build_object('kind', p_kind, 'policyVersion', policy_row.version_number)
  );
  return jsonb_build_object(
    'reservationId', reservation_row.id,
    'submissionId', reservation_row.submission_id,
    'stagingObjectPath', reservation_row.staging_object_path,
    'expiresAt', reservation_row.expires_at,
      'policyVersionId', reservation_row.policy_version_id,
      'status', reservation_row.status
  );
end;
$$;

create function public.complete_upload_reservation(
  p_actor_id uuid,
  p_reservation_id uuid,
  p_detected_mime_type text,
  p_actual_size_bytes bigint,
  p_server_sha256 text,
  p_storage_received_at timestamptz,
  p_final_object_path text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation_row public.submission_upload_reservations%rowtype;
  assignment_row public.assignments%rowtype;
  policy_row public.assignment_policy_versions%rowtype;
  upload_row public.submission_uploads%rowtype;
  selected_commitment public.commitments%rowtype;
  qualifies boolean := false;
  verification public.verification_result;
  policy public.policy_result;
  computed_path text;
begin
  select * into reservation_row from public.submission_upload_reservations r
  where r.id = p_reservation_id and r.student_id = p_actor_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'upload reservation not found';
  end if;
  if not exists (
    select 1 from public.profiles p where p.id = p_actor_id and p.role = 'student'
  ) then
    raise exception using errcode = '42501', message = 'student role required';
  end if;
  if reservation_row.status = 'finalized' then
    select * into upload_row from public.submission_uploads u
    where u.reservation_id = reservation_row.id;
    if upload_row.server_sha256 <> p_server_sha256 then
      raise exception using errcode = 'P0001', message = 'completed upload hash changed';
    end if;
    return jsonb_build_object(
      'uploadId', upload_row.id,
      'verificationResult', upload_row.verification_result,
      'policyResult', upload_row.policy_result,
      'matchedCommitmentId', upload_row.matched_commitment_id,
      'idempotent', true
    );
  end if;
  if reservation_row.status <> 'reserved' then
    raise exception using errcode = 'P0001', message = 'upload reservation is not active';
  end if;
  if p_server_sha256 is null or p_server_sha256 !~ '^[a-f0-9]{64}$'
     or p_actual_size_bytes is null or p_actual_size_bytes <= 0
     or p_detected_mime_type is null then
    update public.submission_upload_reservations
    set status = 'rejected', failure_code = 'invalid_file', updated_at = now()
    where id = p_reservation_id;
    insert into public.audit_events (
      actor_id, source, course_id, assignment_id, submission_id,
      event_type, event_at, metadata
    ) values (
      p_actor_id, 'api', null, reservation_row.assignment_id,
      reservation_row.submission_id, 'upload.rejected', now(),
      '{"reason":"invalid_file"}'::jsonb
    );
    return jsonb_build_object('error', 'invalid_file');
  end if;

  select * into assignment_row from public.assignments a
  where a.id = reservation_row.assignment_id;
  select * into policy_row from public.assignment_policy_versions p
  where p.id = reservation_row.policy_version_id;
  if p_actual_size_bytes > policy_row.max_file_size_bytes
     or p_detected_mime_type <> all(policy_row.allowed_mime_types)
     or p_detected_mime_type <> reservation_row.declared_mime_type then
    update public.submission_upload_reservations
    set status = 'rejected', failure_code = 'file_policy_mismatch', updated_at = now()
    where id = p_reservation_id;
    insert into public.audit_events (
      actor_id, source, course_id, assignment_id, submission_id,
      event_type, event_at, metadata
    ) values (
      p_actor_id, 'api', assignment_row.course_id, assignment_row.id, reservation_row.submission_id,
      'upload.rejected', now(), jsonb_build_object('reason', 'file_policy_mismatch')
    );
    return jsonb_build_object('error', 'file_policy_mismatch');
  end if;
  if p_storage_received_at is null
     or p_storage_received_at < reservation_row.created_at
     or p_storage_received_at >= reservation_row.expires_at then
    update public.submission_upload_reservations
    set status = 'rejected', failure_code = 'upload_expired', updated_at = now()
    where id = p_reservation_id;
    insert into public.audit_events (
      actor_id, source, course_id, assignment_id, submission_id,
      event_type, event_at, metadata
    ) values (
      p_actor_id, 'api', assignment_row.course_id, assignment_row.id, reservation_row.submission_id,
      'upload.rejected', now(), jsonb_build_object('reason', 'upload_expired')
    );
    return jsonb_build_object('error', 'upload_expired');
  end if;

  computed_path := reservation_row.assignment_id::text || '/' ||
    reservation_row.student_id::text || '/' || reservation_row.submission_id::text || '/' ||
    p_reservation_id::text;
  if p_final_object_path is distinct from computed_path then
    raise exception using errcode = '22023', message = 'invalid final object path';
  end if;

  if reservation_row.kind = 'normal' then
    verification := 'not_applicable';
    policy := 'not_applicable';
  else
    select c.* into selected_commitment
    from public.commitments c
    join public.assignment_policy_versions cp on cp.id = c.policy_version_id
    where c.assignment_id = reservation_row.assignment_id
      and c.student_id = reservation_row.student_id
      and c.file_sha256 = p_server_sha256
    order by (
      cp.fallback_enabled
      and c.gateway_event_at is not null
      and c.gateway_event_at < cp.deadline_at
      and p_storage_received_at < cp.deadline_at + make_interval(mins => cp.grace_period_minutes)
    ) desc,
    c.gateway_event_at asc nulls last,
    c.id asc
    limit 1;
    if found then
      verification := 'match';
      policy := 'does_not_qualify';
      select (
        cp.fallback_enabled
        and selected_commitment.gateway_event_at is not null
        and selected_commitment.gateway_event_at < cp.deadline_at
        and p_storage_received_at < cp.deadline_at + make_interval(mins => cp.grace_period_minutes)
      ) into qualifies
      from public.assignment_policy_versions cp
      where cp.id = selected_commitment.policy_version_id;
      if qualifies then policy := 'qualifies'; end if;
    else
      verification := 'mismatch';
      policy := 'does_not_qualify';
    end if;
  end if;

  insert into public.submission_uploads (
    id, submission_id, assignment_id, student_id, reservation_id, policy_version_id,
    storage_object_path, server_sha256, matched_commitment_id,
    verification_result, policy_result, uploaded_at, finalized_at
  ) values (
    reservation_row.id, reservation_row.submission_id, reservation_row.assignment_id, reservation_row.student_id,
    reservation_row.id, reservation_row.policy_version_id, p_final_object_path,
    p_server_sha256,
    case when verification = 'match' then selected_commitment.id else null end,
    verification, policy, p_storage_received_at, now()
  ) returning * into upload_row;

  update public.submission_upload_reservations
  set status = 'finalized', storage_received_at = p_storage_received_at,
      updated_at = now()
  where id = p_reservation_id;
  update public.submissions
  set workflow_status = 'complete'
  where id = reservation_row.submission_id;

  insert into public.audit_events (
    actor_id, source, course_id, assignment_id, submission_id, upload_id,
    event_type, event_at, metadata
  ) values (
    p_actor_id, 'api', assignment_row.course_id, assignment_row.id,
    reservation_row.submission_id, upload_row.id, 'upload.finalized',
    p_storage_received_at,
    jsonb_build_object('verification', verification, 'policy', policy)
  );
  return jsonb_build_object(
    'uploadId', upload_row.id,
    'verificationResult', upload_row.verification_result,
    'policyResult', upload_row.policy_result,
    'matchedCommitmentId', upload_row.matched_commitment_id,
    'idempotent', false
  );
end;
$$;

create function public.mark_upload_reservation_expired(p_reservation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.submission_upload_reservations
  set status = 'expired', updated_at = now()
  where id = p_reservation_id
    and status = 'reserved'
    and expires_at < now() - interval '2 hours';
  return found;
end;
$$;

revoke all on function private.validate_phase2_policy(jsonb) from public, anon, authenticated, service_role;
revoke all on function private.insert_assignment_policy_version(uuid, uuid, integer, jsonb) from public, anon, authenticated, service_role;

revoke all on function public.create_assignment(uuid, uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.update_assignment_draft(uuid, uuid, text, text, boolean, boolean, jsonb) from public, anon, authenticated;
revoke all on function public.publish_assignment(uuid, uuid) from public, anon, authenticated;
revoke all on function public.close_assignment(uuid, uuid) from public, anon, authenticated;
revoke all on function public.issue_assignment_token(uuid, uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.record_webhook_outcome(text, text, public.webhook_outcome, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.process_commitment_event(text, text, text, text, text, text, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.create_upload_reservation(uuid, uuid, text, text, bigint, text) from public, anon, authenticated;
revoke all on function public.complete_upload_reservation(uuid, uuid, text, bigint, text, timestamptz, text) from public, anon, authenticated;
revoke all on function public.mark_upload_reservation_expired(uuid) from public, anon, authenticated;

grant execute on function public.create_assignment(uuid, uuid, text, text, jsonb) to service_role;
grant execute on function public.update_assignment_draft(uuid, uuid, text, text, boolean, boolean, jsonb) to service_role;
grant execute on function public.publish_assignment(uuid, uuid) to service_role;
grant execute on function public.close_assignment(uuid, uuid) to service_role;
grant execute on function public.issue_assignment_token(uuid, uuid, text, boolean) to service_role;
grant execute on function public.record_webhook_outcome(text, text, public.webhook_outcome, timestamptz, jsonb) to service_role;
grant execute on function public.process_commitment_event(text, text, text, text, text, text, timestamptz, timestamptz) to service_role;
grant execute on function public.create_upload_reservation(uuid, uuid, text, text, bigint, text) to service_role;
grant execute on function public.complete_upload_reservation(uuid, uuid, text, bigint, text, timestamptz, text) to service_role;
grant execute on function public.mark_upload_reservation_expired(uuid) to service_role;

create or replace function private.can_read_assignment_policy(
  target_assignment_id uuid,
  target_policy_version_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.assignments a
    where a.id = target_assignment_id
      and (
        a.created_by = auth.uid()
        or (
          a.status = 'published'
          and a.current_policy_version_id = target_policy_version_id
          and private.is_enrolled_in_course(a.course_id)
        )
        or (
          a.status = 'closed'
          and a.current_policy_version_id = target_policy_version_id
          and exists (
            select 1 from public.submissions s
            where s.assignment_id = a.id and s.student_id = auth.uid()
          )
        )
      )
  );
$$;

create policy assignments_read_closed_with_own_evidence
  on public.assignments for select to authenticated
  using (
    status = 'closed'
    and exists (
      select 1 from public.submissions s
      where s.assignment_id = assignments.id and s.student_id = auth.uid()
    )
  );
