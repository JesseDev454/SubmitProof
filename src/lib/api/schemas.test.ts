import { describe, expect, it } from 'vitest'

import { submissionReviewSchema } from './schemas'

describe('submissionReviewSchema', () => {
  it('accepts a flagged decision with an optional reason', () => {
    expect(submissionReviewSchema.safeParse({ decision: 'flagged', reason: 'Check the evidence.' }).success).toBe(true)
  })

  it('rejects decisions outside the review contract', () => {
    expect(submissionReviewSchema.safeParse({ decision: 'approved' }).success).toBe(false)
    expect(submissionReviewSchema.safeParse({ decision: 'accepted', reason: 'x'.repeat(1001) }).success).toBe(false)
  })
})
