create function private.promote_profile_to_lecturer(target_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set role = 'lecturer'
  where id = target_profile_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'profile does not exist';
  end if;
end;
$$;

create function private.is_enrolled_in_course(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.enrollments e
    where e.course_id = target_course_id
      and e.student_id = auth.uid()
  );
$$;

create function private.owns_assignment(target_assignment_id uuid)
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
      and a.created_by = auth.uid()
  );
$$;

create function private.can_read_lecturer_course(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.courses c
    where c.id = target_course_id
      and c.lecturer_id = auth.uid()
  );
$$;

create function private.lecturer_can_read_profile(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.enrollments e
    join public.courses c on c.id = e.course_id
    where e.student_id = target_profile_id
      and c.lecturer_id = auth.uid()
  );
$$;

create function private.can_read_student_evidence(
  target_assignment_id uuid,
  target_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_student_id = auth.uid()
    or private.owns_assignment(target_assignment_id);
$$;

create function private.can_read_assignment_policy(
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
      )
  );
$$;

create function private.can_read_commitment(target_commitment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.commitments c
    where c.id = target_commitment_id
      and private.can_read_student_evidence(c.assignment_id, c.student_id)
  );
$$;

create function private.can_read_audit_event(
  target_assignment_id uuid,
  target_submission_id uuid,
  target_commitment_id uuid,
  target_upload_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (target_assignment_id is not null and private.owns_assignment(target_assignment_id))
    or exists (
      select 1
      from public.submissions s
      where s.id = target_submission_id
        and s.student_id = auth.uid()
    )
    or exists (
      select 1
      from public.commitments c
      where c.id = target_commitment_id
        and c.student_id = auth.uid()
    )
    or exists (
      select 1
      from public.submission_uploads u
      where u.id = target_upload_id
        and u.student_id = auth.uid()
    );
$$;

revoke all on function private.promote_profile_to_lecturer(uuid) from public, anon, authenticated;
grant execute on function private.promote_profile_to_lecturer(uuid) to service_role;

revoke all on function private.is_enrolled_in_course(uuid) from public, anon, authenticated;
revoke all on function private.owns_assignment(uuid) from public, anon, authenticated;
revoke all on function private.can_read_lecturer_course(uuid) from public, anon, authenticated;
revoke all on function private.lecturer_can_read_profile(uuid) from public, anon, authenticated;
revoke all on function private.can_read_student_evidence(uuid, uuid) from public, anon, authenticated;
revoke all on function private.can_read_assignment_policy(uuid, uuid) from public, anon, authenticated;
revoke all on function private.can_read_commitment(uuid) from public, anon, authenticated;
revoke all on function private.can_read_audit_event(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;
grant execute on function private.is_enrolled_in_course(uuid) to authenticated;
grant execute on function private.owns_assignment(uuid) to authenticated;
grant execute on function private.can_read_lecturer_course(uuid) to authenticated;
grant execute on function private.lecturer_can_read_profile(uuid) to authenticated;
grant execute on function private.can_read_student_evidence(uuid, uuid) to authenticated;
grant execute on function private.can_read_assignment_policy(uuid, uuid) to authenticated;
grant execute on function private.can_read_commitment(uuid) to authenticated;
grant execute on function private.can_read_audit_event(uuid, uuid, uuid, uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.enrollments enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_policy_versions enable row level security;
alter table public.assignment_tokens enable row level security;
alter table public.submissions enable row level security;
alter table public.commitments enable row level security;
alter table public.submission_uploads enable row level security;
alter table public.webhook_events enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_read_own_or_lecturer_course_students
  on public.profiles for select to authenticated
  using (id = auth.uid() or private.lecturer_can_read_profile(id));

create policy profiles_update_own_safe_fields
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy courses_read_owner_or_enrolled_student
  on public.courses for select to authenticated
  using (
    lecturer_id = auth.uid()
    or private.is_enrolled_in_course(id)
  );

create policy enrollments_read_self_or_course_owner
  on public.enrollments for select to authenticated
  using (
    student_id = auth.uid()
    or private.can_read_lecturer_course(course_id)
  );

create policy assignments_read_owner_or_published_enrollment
  on public.assignments for select to authenticated
  using (
    created_by = auth.uid()
    or (
      status = 'published'
      and private.is_enrolled_in_course(course_id)
    )
  );

create policy assignment_policy_versions_read_authorized
  on public.assignment_policy_versions for select to authenticated
  using (
    private.can_read_assignment_policy(assignment_id, id)
  );

create policy submissions_read_student_or_course_owner
  on public.submissions for select to authenticated
  using (
    private.can_read_student_evidence(assignment_id, student_id)
  );

create policy commitments_read_student_or_course_owner
  on public.commitments for select to authenticated
  using (
    private.can_read_student_evidence(assignment_id, student_id)
  );

create policy submission_uploads_read_student_or_course_owner
  on public.submission_uploads for select to authenticated
  using (
    private.can_read_student_evidence(assignment_id, student_id)
  );

create policy webhook_events_read_linked_commitment
  on public.webhook_events for select to authenticated
  using (
    commitment_id is not null
    and private.can_read_commitment(commitment_id)
  );

create policy audit_events_read_related_evidence
  on public.audit_events for select to authenticated
  using (
    private.can_read_audit_event(
      assignment_id,
      submission_id,
      commitment_id,
      upload_id
    )
  );

revoke all on table
  public.profiles,
  public.courses,
  public.enrollments,
  public.assignments,
  public.assignment_policy_versions,
  public.assignment_tokens,
  public.submissions,
  public.commitments,
  public.submission_uploads,
  public.webhook_events,
  public.audit_events
from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;

grant select on
  public.profiles,
  public.courses,
  public.enrollments,
  public.assignments,
  public.assignment_policy_versions,
  public.submissions,
  public.commitments,
  public.submission_uploads,
  public.webhook_events,
  public.audit_events
to authenticated;

grant update (full_name, department, phone_e164)
  on public.profiles to authenticated;
