import { describe, expect, it } from 'vitest'

import { toStudentAssignmentSummary } from './assignment-data'

describe('toStudentAssignmentSummary', () => {
  it('keeps verification and policy results independent on the latest upload', () => {
    const summary = toStudentAssignmentSummary({
      assignment: {
        id: 'assignment-1', course_id: 'course-1', title: 'Lab report', description: null,
        status: 'published', current_policy_version_id: 'policy-2',
      },
      course: { code: 'BIO101', title: 'Biology' },
      policy: {
        id: 'policy-2', deadline_at: '2026-10-01T12:00:00Z', fallback_enabled: true,
        grace_period_minutes: 45, allowed_mime_types: ['application/pdf'], max_file_size_bytes: 10485760,
      },
      submission: { id: 'submission-1', workflow_status: 'complete' },
      commitments: [{ id: 'commitment-1', provider: 'simulated' }],
      uploads: [
        { id: 'upload-old', uploaded_at: '2026-09-25T10:00:00Z', verification_result: 'match', policy_result: 'qualifies' },
        { id: 'upload-new', uploaded_at: '2026-09-26T10:00:00Z', verification_result: 'mismatch', policy_result: 'does_not_qualify' },
      ],
    })

    expect(summary.deadline_at).toBe('2026-10-01T12:00:00Z')
    expect(summary.fallback_enabled).toBe(true)
    expect(summary.course_name).toBe('Biology')
    expect(summary.workflow_status).toBe('complete')
    expect(summary.commitment_count).toBe(1)
    expect(summary.latest_upload).toMatchObject({
      id: 'upload-new',
      verification_result: 'mismatch',
      policy_result: 'does_not_qualify',
    })
  })

  it('does not invent a submission result when no evidence exists', () => {
    const summary = toStudentAssignmentSummary({
      assignment: {
        id: 'assignment-2', course_id: 'course-2', title: 'Essay', description: null,
        status: 'published', current_policy_version_id: 'policy-3',
      },
      course: { code: 'ENG201', title: 'English' },
      policy: {
        id: 'policy-3', deadline_at: '2026-10-02T12:00:00Z', fallback_enabled: false,
        grace_period_minutes: 0, allowed_mime_types: ['application/pdf'], max_file_size_bytes: 1048576,
      },
      submission: null,
      commitments: [],
      uploads: [],
    })

    expect(summary.workflow_status).toBeNull()
    expect(summary.latest_upload).toBeNull()
    expect(summary.commitment_count).toBe(0)
  })
})
