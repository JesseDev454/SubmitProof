import { describe, expect, it } from 'vitest'

import { explainPolicyResult } from './policyExplanation'

const policy = { deadlineAt: '2026-10-04T12:00:00Z', gracePeriodMinutes: 60 }
const onTimeUpload = '2026-09-29T00:42:00Z'

describe('stored fallback policy result explanation', () => {
  it('explains that normal online uploads do not use SMS fallback checks', () => {
    expect(explainPolicyResult({ verificationResult: 'not_applicable', policyResult: 'not_applicable', uploadedAt: onTimeUpload, matchedCommitment: null, policy }))
      .toContain('Normal online upload')
  })

  it('identifies a missing gateway timestamp without changing a matching hash result', () => {
    expect(explainPolicyResult({ verificationResult: 'match', policyResult: 'does_not_qualify', uploadedAt: onTimeUpload, matchedCommitment: { gatewayEventAt: null }, policy }))
      .toContain('gateway time was not recorded')
  })

  it('identifies late SMS and late storage against the saved policy', () => {
    expect(explainPolicyResult({ verificationResult: 'match', policyResult: 'does_not_qualify', uploadedAt: onTimeUpload, matchedCommitment: { gatewayEventAt: '2026-10-04T12:00:00Z' }, policy }))
      .toContain('at or after the deadline')
    expect(explainPolicyResult({ verificationResult: 'match', policyResult: 'does_not_qualify', uploadedAt: '2026-10-04T13:00:00Z', matchedCommitment: { gatewayEventAt: '2026-10-04T11:59:00Z' }, policy }))
      .toContain('grace window')
  })

  it('explains a different uploaded file and a qualifying fallback', () => {
    expect(explainPolicyResult({ verificationResult: 'mismatch', policyResult: 'does_not_qualify', uploadedAt: onTimeUpload, matchedCommitment: null, policy }))
      .toContain('does not match')
    expect(explainPolicyResult({ verificationResult: 'match', policyResult: 'qualifies', uploadedAt: onTimeUpload, matchedCommitment: { gatewayEventAt: '2026-09-29T00:38:00Z' }, policy }))
      .toContain('qualified')
  })
})
