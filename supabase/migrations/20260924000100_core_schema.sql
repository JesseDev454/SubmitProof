create schema if not exists private;
revoke all on schema private from public;

create type public.profile_role as enum ('student', 'lecturer');
create type public.assignment_status as enum ('draft', 'published', 'closed');
create type public.submission_workflow_status as enum (
  'pending',
  'awaiting_upload',
  'upload_received',
  'complete'
);
create type public.verification_result as enum (
  'pending',
  'match',
  'mismatch',
  'not_applicable'
);
create type public.policy_result as enum (
  'pending',
  'qualifies',
  'does_not_qualify',
  'not_applicable'
);
create type public.webhook_outcome as enum (
  'received',
  'accepted',
  'duplicate',
  'rejected',
  'processing_failed'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.profile_role not null default 'student',
  full_name text not null default '' check (char_length(full_name) <= 200),
  email text unique,
  department text check (department is null or char_length(department) <= 160),
  phone_e164 text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_phone_e164_check
    check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null check (char_length(btrim(code)) between 1 and 40),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  lecturer_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (lecturer_id, code),
  unique (id, lecturer_id)
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (course_id, student_id)
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null,
  created_by uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text,
  status public.assignment_status not null default 'draft',
  current_policy_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assignments_course_owner_fk
    foreign key (course_id, created_by)
    references public.courses (id, lecturer_id)
    on delete restrict,
  unique (id, created_by)
);

create table public.assignment_policy_versions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null,
  version_number integer not null check (version_number > 0),
  deadline_at timestamptz not null,
  fallback_enabled boolean not null default false,
  grace_period_minutes integer not null default 0
    check (grace_period_minutes >= 0),
  allowed_mime_types text[] not null
    check (
      cardinality(allowed_mime_types) > 0
      and array_position(allowed_mime_types, '') is null
    ),
  max_file_size_bytes bigint not null
    check (max_file_size_bytes between 1048576 and 52428800),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  constraint assignment_policy_versions_assignment_owner_fk
    foreign key (assignment_id, created_by)
    references public.assignments (id, created_by)
    on delete restrict,
  unique (assignment_id, version_number),
  unique (assignment_id, id)
);

alter table public.assignments
  add constraint assignments_current_policy_version_fk
  foreign key (id, current_policy_version_id)
  references public.assignment_policy_versions (assignment_id, id)
  on delete restrict
  deferrable initially deferred;

create table public.assignment_tokens (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete restrict,
  student_id uuid not null references public.profiles (id) on delete restrict,
  token_hash text not null unique
    check (token_hash ~ '^[a-f0-9]{64}$'),
  phone_e164_snapshot text not null
    check (phone_e164_snapshot ~ '^\+[1-9][0-9]{7,14}$'),
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint assignment_tokens_revoked_after_issue_check
    check (revoked_at is null or revoked_at >= issued_at),
  unique (id, assignment_id, student_id, phone_e164_snapshot)
);

create unique index assignment_tokens_one_active_per_student_assignment
  on public.assignment_tokens (assignment_id, student_id)
  where revoked_at is null;

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete restrict,
  student_id uuid not null references public.profiles (id) on delete restrict,
  workflow_status public.submission_workflow_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id),
  unique (id, assignment_id, student_id)
);

create table public.commitments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null,
  assignment_id uuid not null,
  student_id uuid not null,
  token_id uuid not null,
  policy_version_id uuid not null,
  nonce text not null check (char_length(nonce) between 1 and 128),
  file_sha256 text not null check (file_sha256 ~ '^[a-f0-9]{64}$'),
  provider_message_id text not null check (char_length(btrim(provider_message_id)) > 0),
  sender_phone_e164 text not null check (sender_phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  gateway_event_at timestamptz,
  webhook_received_at timestamptz not null,
  processed_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint commitments_submission_owner_fk
    foreign key (submission_id, assignment_id, student_id)
    references public.submissions (id, assignment_id, student_id)
    on delete restrict,
  constraint commitments_token_owner_phone_fk
    foreign key (token_id, assignment_id, student_id, sender_phone_e164)
    references public.assignment_tokens (id, assignment_id, student_id, phone_e164_snapshot)
    on delete restrict,
  constraint commitments_policy_assignment_fk
    foreign key (assignment_id, policy_version_id)
    references public.assignment_policy_versions (assignment_id, id)
    on delete restrict,
  unique (assignment_id, student_id, nonce),
  unique (provider_message_id),
  unique (id, assignment_id, student_id)
);

create table public.submission_uploads (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null,
  assignment_id uuid not null,
  student_id uuid not null,
  storage_object_path text not null unique,
  server_sha256 text not null check (server_sha256 ~ '^[a-f0-9]{64}$'),
  matched_commitment_id uuid,
  verification_result public.verification_result not null default 'pending',
  policy_result public.policy_result not null default 'pending',
  uploaded_at timestamptz not null default now(),
  constraint submission_uploads_generated_path_check check (
    storage_object_path =
      assignment_id::text || '/' ||
      student_id::text || '/' ||
      submission_id::text || '/' ||
      id::text
  ),
  constraint submission_uploads_submission_owner_fk
    foreign key (submission_id, assignment_id, student_id)
    references public.submissions (id, assignment_id, student_id)
    on delete restrict,
  constraint submission_uploads_matched_commitment_owner_fk
    foreign key (matched_commitment_id, assignment_id, student_id)
    references public.commitments (id, assignment_id, student_id)
    on delete restrict,
  unique (id, assignment_id, student_id)
);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (char_length(btrim(provider)) between 1 and 80),
  provider_message_id text,
  outcome public.webhook_outcome not null,
  gateway_event_at timestamptz,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  commitment_id uuid references public.commitments (id) on delete restrict,
  limited_metadata jsonb not null default '{}'::jsonb
    check (
      jsonb_typeof(limited_metadata) = 'object'
      and pg_column_size(limited_metadata) <= 4096
    ),
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  source text not null check (char_length(btrim(source)) between 1 and 40),
  course_id uuid references public.courses (id) on delete set null,
  assignment_id uuid references public.assignments (id) on delete set null,
  submission_id uuid references public.submissions (id) on delete set null,
  commitment_id uuid references public.commitments (id) on delete set null,
  upload_id uuid references public.submission_uploads (id) on delete set null,
  event_type text not null check (char_length(btrim(event_type)) between 1 and 100),
  event_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
    check (
      jsonb_typeof(metadata) = 'object'
      and pg_column_size(metadata) <= 8192
    )
);

create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role, full_name, email, created_at, updated_at)
  values (
    new.id,
    'student',
    left(
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
        nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
        ''
      ),
      200
    ),
    new.email,
    coalesce(new.created_at, now()),
    coalesce(new.updated_at, now())
  );

  return new;
end;
$$;

create trigger on_auth_user_created_submitproof
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

create function private.sync_auth_user_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set email = new.email
  where id = new.id;

  return new;
end;
$$;

create trigger on_auth_user_email_changed_submitproof
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.sync_auth_user_email();

create function private.prevent_self_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and auth.uid() = old.id then
    raise exception using
      errcode = '42501',
      message = 'users cannot change their own role';
  end if;

  return new;
end;
$$;

create trigger prevent_self_profile_role_change
  before update of role on public.profiles
  for each row execute function private.prevent_self_role_change();

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create trigger assignments_set_updated_at
  before update on public.assignments
  for each row execute function private.set_updated_at();

create trigger submissions_set_updated_at
  before update on public.submissions
  for each row execute function private.set_updated_at();

create function private.require_lecturer_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = new.lecturer_id
      and p.role = 'lecturer'
  ) then
    raise exception using
      errcode = '23514',
      message = 'course owner must have the lecturer role';
  end if;

  return new;
end;
$$;

create trigger courses_require_lecturer
  before insert or update of lecturer_id on public.courses
  for each row execute function private.require_lecturer_profile();

create function private.require_enrolled_student()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = new.student_id
      and p.role = 'student'
  ) then
    raise exception using
      errcode = '23514',
      message = 'enrolled user must have the student role';
  end if;

  return new;
end;
$$;

create trigger enrollments_require_student
  before insert or update of student_id on public.enrollments
  for each row execute function private.require_enrolled_student();

create function private.require_enrollment_for_assignment_student()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  registered_phone text;
  profile_role public.profile_role;
begin
  select p.role, p.phone_e164
  into profile_role, registered_phone
  from public.profiles p
  where p.id = new.student_id
  for share;

  if profile_role is distinct from 'student'::public.profile_role then
    raise exception using
      errcode = '23514',
      message = 'assignment evidence owner must have the student role';
  end if;

  if not exists (
    select 1
    from public.assignments a
    join public.enrollments e on e.course_id = a.course_id
    where a.id = new.assignment_id
      and e.student_id = new.student_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'student must be enrolled in the assignment course';
  end if;

  if tg_table_name = 'assignment_tokens' then
    if registered_phone is distinct from new.phone_e164_snapshot then
      raise exception using
        errcode = '23514',
        message = 'token phone snapshot must match the registered profile phone';
    end if;
  end if;

  return new;
end;
$$;

create trigger assignment_tokens_require_course_enrollment
  before insert or update of assignment_id, student_id on public.assignment_tokens
  for each row execute function private.require_enrollment_for_assignment_student();

create trigger submissions_require_course_enrollment
  before insert or update of assignment_id, student_id on public.submissions
  for each row execute function private.require_enrollment_for_assignment_student();

create function private.reject_immutable_record_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = tg_table_name || ' records are immutable';
end;
$$;

create trigger assignment_policy_versions_immutable
  before update or delete on public.assignment_policy_versions
  for each row execute function private.reject_immutable_record_mutation();

create trigger audit_events_immutable
  before update or delete on public.audit_events
  for each row execute function private.reject_immutable_record_mutation();
