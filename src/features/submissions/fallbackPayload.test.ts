import { describe, expect, it } from 'vitest'

import { buildFallbackPayload } from './fallbackPayload'

describe('buildFallbackPayload', () => {
  it('uses the SP1 protocol and preserves a lowercase SHA-256 fingerprint', () => {
    expect(buildFallbackPayload('a'.repeat(43), 'nonce_12345678', 'a'.repeat(64))).toBe(
      `SP1|${'a'.repeat(43)}|nonce_12345678|${'a'.repeat(64)}`,
    )
  })

  it('rejects a fingerprint that is not lowercase SHA-256', () => {
    expect(() => buildFallbackPayload('a'.repeat(43), 'nonce_12345678', 'A'.repeat(64))).toThrow(
      'Fingerprint must be a lowercase SHA-256 hash.',
    )
  })
})
