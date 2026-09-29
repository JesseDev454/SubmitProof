import { describe, expect, it } from 'vitest'

import { parseGracePeriodMinutes, validateCreateAssignment } from './assignmentEditor'

const valid = {
  title: 'Field report',
  courseId: 'course-1',
  description: 'Write a field report.',
  deadlineLocal: '2026-10-04T12:00',
  mimeTypes: ['application/pdf'],
  graceInput: '60',
}

describe('assignment editor validation', () => {
  it('allows clearing zero before typing a whole grace period', () => {
    expect(parseGracePeriodMinutes('')).toBeNull()
    expect(parseGracePeriodMinutes('0')).toBe(0)
    expect(parseGracePeriodMinutes(' 90 ')).toBe(90)
    expect(parseGracePeriodMinutes('-1')).toBeNull()
    expect(parseGracePeriodMinutes('2.5')).toBeNull()
    expect(parseGracePeriodMinutes('2147483648')).toBeNull()
  })

  it('allows an optional description and points publication at missing policy fields', () => {
    const now = new Date('2026-09-29T00:00:00Z')
    expect(validateCreateAssignment({ ...valid, description: '' }, 'published', now)).toBeNull()
    expect(validateCreateAssignment({ ...valid, deadlineLocal: '' }, 'published', now)).toEqual({
      field: 'assignment-deadline',
      message: 'Choose a future deadline date before publishing.',
    })
    expect(validateCreateAssignment({ ...valid, mimeTypes: [] }, 'published', now)?.field).toBe('assignment-file-types')
  })

  it('allows an incomplete draft but validates policy values before saving', () => {
    const now = new Date('2026-09-29T00:00:00Z')
    expect(validateCreateAssignment({ ...valid, description: '', deadlineLocal: '' }, 'draft', now)).toBeNull()
    expect(validateCreateAssignment({ ...valid, graceInput: '' }, 'draft', now)?.field).toBe('grace-minutes')
    expect(validateCreateAssignment(valid, 'published', now)).toBeNull()
  })
})
