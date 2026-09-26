import 'server-only'

import { createClient } from '@/lib/auth/server'

import { toStudentAssignmentSummary } from './assignment-data'

export async function loadStudentAssignments() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) return []

  const { data: enrollments, error: enrollmentError } = await supabase
    .from('enrollments')
    .select('course_id')
    .eq('student_id', user.id)
  if (enrollmentError) throw enrollmentError
  const courseIds = (enrollments ?? []).map((row) => row.course_id)
  if (!courseIds.length) return []

  const { data: assignments, error: assignmentError } = await supabase
    .from('assignments')
    .select('id, course_id, title, description, status, current_policy_version_id')
    .in('course_id', courseIds)
    .in('status', ['published', 'closed'])
    .order('created_at', { ascending: false })
  if (assignmentError) throw assignmentError
  if (!assignments?.length) return []

  const assignmentIds = assignments.map((assignment) => assignment.id)
  const policyVersionIds = assignments.flatMap((assignment) =>
    assignment.current_policy_version_id ? [assignment.current_policy_version_id] : [],
  )
  const currentCourseIds = [...new Set(assignments.map((assignment) => assignment.course_id))]

  const [coursesResult, policiesResult, submissionsResult] = await Promise.all([
    supabase.from('courses').select('id, code, title').in('id', currentCourseIds),
    policyVersionIds.length
      ? supabase
          .from('assignment_policy_versions')
          .select('id, assignment_id, deadline_at, fallback_enabled, grace_period_minutes, allowed_mime_types, max_file_size_bytes')
          .in('id', policyVersionIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('submissions')
      .select('id, assignment_id, workflow_status')
      .eq('student_id', user.id)
      .in('assignment_id', assignmentIds),
  ])
  if (coursesResult.error) throw coursesResult.error
  if (policiesResult.error) throw policiesResult.error
  if (submissionsResult.error) throw submissionsResult.error

  const submissionIds = (submissionsResult.data ?? []).map((submission) => submission.id)
  const [commitmentsResult, uploadsResult] = submissionIds.length
    ? await Promise.all([
        supabase
          .from('commitments')
          .select('id, submission_id, provider, created_at')
          .in('submission_id', submissionIds),
        supabase
          .from('submission_uploads')
          .select('id, submission_id, uploaded_at, verification_result, policy_result, server_sha256, matched_commitment_id')
          .in('submission_id', submissionIds),
      ])
    : [{ data: [], error: null }, { data: [], error: null }]
  if (commitmentsResult.error) throw commitmentsResult.error
  if (uploadsResult.error) throw uploadsResult.error

  const courseById = new Map((coursesResult.data ?? []).map((course) => [course.id, course]))
  const policyById = new Map((policiesResult.data ?? []).map((policy) => [policy.id, policy]))
  const submissionByAssignmentId = new Map((submissionsResult.data ?? []).map((submission) => [submission.assignment_id, submission]))
  const commitmentsBySubmissionId = groupBy((commitmentsResult.data ?? []), (row) => row.submission_id)
  const uploadsBySubmissionId = groupBy((uploadsResult.data ?? []), (row) => row.submission_id)

  return assignments.flatMap((assignment) => {
    const course = courseById.get(assignment.course_id)
    const policy = assignment.current_policy_version_id
      ? policyById.get(assignment.current_policy_version_id)
      : null
    if (!course || !policy) return []

    const submission = submissionByAssignmentId.get(assignment.id) ?? null
    return [toStudentAssignmentSummary({
      assignment,
      course,
      policy,
      submission,
      commitments: submission ? commitmentsBySubmissionId.get(submission.id) ?? [] : [],
      uploads: submission ? uploadsBySubmissionId.get(submission.id) ?? [] : [],
    })]
  })
}

export async function loadStudentAssignment(assignmentId: string) {
  const assignments = await loadStudentAssignments()
  return assignments.find((assignment) => assignment.id === assignmentId) ?? null
}

export async function loadStudentProfile() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, department, phone_e164, role')
    .eq('id', user.id)
    .maybeSingle()
  if (error) throw error
  return data
}

function groupBy<T, K extends string>(items: T[], keyFor: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>()
  for (const item of items) {
    const key = keyFor(item)
    groups.set(key, [...(groups.get(key) ?? []), item])
  }
  return groups
}
