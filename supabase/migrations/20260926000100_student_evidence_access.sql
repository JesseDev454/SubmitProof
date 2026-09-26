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
            select 1
            from public.submissions s
            where s.assignment_id = a.id
              and s.student_id = auth.uid()
          )
        )
        or exists (
          select 1
          from public.commitments c
          where c.assignment_id = a.id
            and c.policy_version_id = target_policy_version_id
            and c.student_id = auth.uid()
        )
        or exists (
          select 1
          from public.submission_uploads u
          where u.assignment_id = a.id
            and u.policy_version_id = target_policy_version_id
            and u.student_id = auth.uid()
        )
      )
  );
$$;
