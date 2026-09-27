import { describe, expect, it } from 'vitest'

import { isReminderEligible } from './eligibility'

const now = Date.parse('2026-09-26T12:00:00.000Z')

describe('assignment reminder eligibility', () => {
  it('includes the exact 24-hour boundary and excludes a deadline at the current instant', () => {
    expect(isReminderEligible({
      status: 'published',
      deadlineAt: '2026-09-27T12:00:00.000Z',
      now,
      optedIn: true,
      hasCompletedUpload: false,
    })).toBe(true)
    expect(isReminderEligible({
      status: 'published',
      deadlineAt: '2026-09-26T12:00:00.000Z',
      now,
      optedIn: true,
      hasCompletedUpload: false,
    })).toBe(false)
  })

  it('skips drafts, students who opted out, and completed uploads', () => {
    for (const patch of [
      { status: 'draft' },
      { optedIn: false },
      { hasCompletedUpload: true },
    ]) {
      expect(isReminderEligible({
        status: 'published',
        deadlineAt: '2026-09-27T11:59:00.000Z',
        now,
        optedIn: true,
        hasCompletedUpload: false,
        ...patch,
      })).toBe(false)
    }
  })
})
