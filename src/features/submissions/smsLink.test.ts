import { describe, expect, it } from 'vitest'

import { buildSmsComposerLink } from './smsLink'

describe('buildSmsComposerLink', () => {
  it('keeps the exact commitment message encoded for the native SMS composer', () => {
    const message = `SP1|${'t'.repeat(43)}|nonce_123456|${'a'.repeat(64)}`
    expect(buildSmsComposerLink(' 12995 ', message)).toBe(`sms:12995?body=${encodeURIComponent(message)}`)
  })

  it('rejects invalid destinations and empty messages', () => {
    expect(buildSmsComposerLink('12995&evil=true', 'SP1|payload')).toBeNull()
    expect(buildSmsComposerLink('12995', '')).toBeNull()
  })
})
