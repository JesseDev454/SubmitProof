export type AssignmentRecord = {
  id: string
  course_id: string
  title: string
  description: string | null
  status: 'draft' | 'published' | 'closed'
  current_policy_version_id: string | null
}

export type AssignmentPolicyRecord = {
  id: string
  deadline_at: string
  fallback_enabled: boolean
  grace_period_minutes: number
  allowed_mime_types: string[]
  max_file_size_bytes: number
}

export type AssignmentUploadRecord = {
  id: string
  uploaded_at: string
  verification_result: string
  policy_result: string
  server_sha256?: string
  matched_commitment_id?: string | null
}

export type StudentAssignmentSummary = {
  id: string
  title: string
  description: string | null
  course_id: string
  course_code: string
  course_name: string
  deadline_at: string
  fallback_enabled: boolean
  grace_period_minutes: number
  allowed_file_types: string[]
  max_file_size_bytes: number
  assignment_status: 'draft' | 'published' | 'closed'
  workflow_status: string | null
  submission_id: string | null
  commitment_count: number
  latest_commitment_provider: string | null
  latest_upload: AssignmentUploadRecord | null
}

export function toStudentAssignmentSummary(input: {
  assignment: AssignmentRecord
  course: { code: string; title: string }
  policy: AssignmentPolicyRecord
  submission: { id: string; workflow_status: string } | null
  commitments: Array<{ id: string; provider: string; created_at?: string }>
  uploads: AssignmentUploadRecord[]
}): StudentAssignmentSummary {
  const latestUpload = [...input.uploads].sort(
    (left, right) => Date.parse(right.uploaded_at) - Date.parse(left.uploaded_at),
  )[0] ?? null
  const latestCommitment = [...input.commitments].sort(
    (left, right) => Date.parse(right.created_at ?? '') - Date.parse(left.created_at ?? ''),
  )[0] ?? null

  return {
    id: input.assignment.id,
    title: input.assignment.title,
    description: input.assignment.description,
    course_id: input.assignment.course_id,
    course_code: input.course.code,
    course_name: input.course.title,
    deadline_at: input.policy.deadline_at,
    fallback_enabled: input.policy.fallback_enabled,
    grace_period_minutes: input.policy.grace_period_minutes,
    allowed_file_types: input.policy.allowed_mime_types,
    max_file_size_bytes: input.policy.max_file_size_bytes,
    assignment_status: input.assignment.status,
    workflow_status: input.submission?.workflow_status ?? null,
    submission_id: input.submission?.id ?? null,
    commitment_count: input.commitments.length,
    latest_commitment_provider: latestCommitment?.provider ?? null,
    latest_upload: latestUpload,
  }
}
