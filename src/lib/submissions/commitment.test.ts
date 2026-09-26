import { describe, expect, it } from 'vitest'

import { detectSupportedMimeType, evaluateFallbackPolicy, parseCommitmentPayload, verifyAgainstCommitments } from './commitment'

const validHash = 'a'.repeat(64)

describe('parseCommitmentPayload', () => {
  it('parses the SP1 wire format and normalizes the hash to lowercase only by rejection', () => {
    expect(parseCommitmentPayload(`SP1|${'t'.repeat(43)}|nonce_123456|${validHash}`)).toEqual({
      token: 't'.repeat(43),
      nonce: 'nonce_123456',
      sha256: validHash,
    })
    expect(() => parseCommitmentPayload(`SP1|${'t'.repeat(43)}|nonce_123456|${'A'.repeat(64)}`)).toThrow()
  })

  it('rejects invalid protocol, token, nonce, and fingerprint shapes', () => {
    for (const payload of [
      `SP2|${'t'.repeat(43)}|nonce_123456|${validHash}`,
      `SP1|short|nonce_123456|${validHash}`,
      `SP1|${'t'.repeat(43)}|bad nonce|${validHash}`,
      `SP1|${'t'.repeat(43)}|nonce_123456|abc`,
    ]) {
      expect(() => parseCommitmentPayload(payload)).toThrow()
    }
  })
})

describe('evaluateFallbackPolicy', () => {
  const policy = {
    fallbackEnabled: true,
    deadlineAt: '2026-09-24T12:00:00.000Z',
    gracePeriodMinutes: 30,
  }

  it('qualifies only a pre-deadline commitment uploaded strictly before grace expiry', () => {
    expect(evaluateFallbackPolicy({
      ...policy,
      gatewayEventAt: '2026-09-24T11:59:59.999Z',
      storageReceivedAt: '2026-09-24T12:29:59.999Z',
    })).toBe('qualifies')

    expect(evaluateFallbackPolicy({
      ...policy,
      gatewayEventAt: '2026-09-24T12:00:00.000Z',
      storageReceivedAt: '2026-09-24T12:10:00.000Z',
    })).toBe('does_not_qualify')

    expect(evaluateFallbackPolicy({
      ...policy,
      gatewayEventAt: null,
      storageReceivedAt: '2026-09-24T12:10:00.000Z',
    })).toBe('does_not_qualify')
  })

  it('does not establish eligibility when fallback is disabled or upload is at grace expiry', () => {
    expect(evaluateFallbackPolicy({
      ...policy,
      fallbackEnabled: false,
      gatewayEventAt: '2026-09-24T11:59:00.000Z',
      storageReceivedAt: '2026-09-24T12:10:00.000Z',
    })).toBe('does_not_qualify')

    expect(evaluateFallbackPolicy({
      ...policy,
      gatewayEventAt: '2026-09-24T11:59:00.000Z',
      storageReceivedAt: '2026-09-24T12:30:00.000Z',
    })).toBe('does_not_qualify')
  })
})

describe('verifyAgainstCommitments', () => {
  it('selects a qualifying exact match ahead of an older matching but ineligible proof', () => {
    expect(verifyAgainstCommitments(validHash, '2026-09-24T12:10:00Z', [
      {
        id: 'older-but-no-gateway-time',
        fileSha256: validHash,
        gatewayEventAt: null,
        deadlineAt: '2026-09-24T12:00:00Z',
        fallbackEnabled: true,
        gracePeriodMinutes: 30,
      },
      {
        id: 'eligible',
        fileSha256: validHash,
        gatewayEventAt: '2026-09-24T11:59:00Z',
        deadlineAt: '2026-09-24T12:00:00Z',
        fallbackEnabled: true,
        gracePeriodMinutes: 30,
      },
    ])).toEqual({
      matchedCommitmentId: 'eligible',
      verificationResult: 'match',
      policyResult: 'qualifies',
    })
  })

  it('keeps hash verification separate from a failed timing policy', () => {
    expect(verifyAgainstCommitments(validHash, '2026-09-24T12:30:00Z', [{
      id: 'late-upload',
      fileSha256: validHash,
      gatewayEventAt: '2026-09-24T11:59:00Z',
      deadlineAt: '2026-09-24T12:00:00Z',
      fallbackEnabled: true,
      gracePeriodMinutes: 30,
    }])).toEqual({
      matchedCommitmentId: 'late-upload',
      verificationResult: 'match',
      policyResult: 'does_not_qualify',
    })

    expect(verifyAgainstCommitments(validHash, '2026-09-24T12:10:00Z', [])).toEqual({
      matchedCommitmentId: null,
      verificationResult: 'mismatch',
      policyResult: 'does_not_qualify',
    })
  })
})

describe('detectSupportedMimeType', () => {
  it('uses file signatures rather than the browser provided content type', () => {
    expect(detectSupportedMimeType(new TextEncoder().encode('%PDF-1.7\n'))).toBe('application/pdf')
    expect(detectSupportedMimeType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(detectSupportedMimeType(new TextEncoder().encode('not a pdf'))).toBe('text/plain')
    expect(detectSupportedMimeType(new Uint8Array([0, 255, 1, 2]))).toBeNull()
  })
})
