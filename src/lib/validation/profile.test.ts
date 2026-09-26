import { describe, expect, it } from 'vitest'

import { profileSettingsSchema } from './profile'

describe('profileSettingsSchema', () => {
  it('accepts a normalized name, department, and E.164 phone number', () => {
    const result = profileSettingsSchema.safeParse({
      fullName: '  Ada Student  ',
      department: ' Computer Science ',
      phoneE164: '+2348012345678',
    })

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.fullName).toBe('Ada Student')
  })

  it('rejects a locally formatted phone number that is not E.164', () => {
    expect(profileSettingsSchema.safeParse({
      fullName: 'Ada Student',
      department: 'Computer Science',
      phoneE164: '08012345678',
    }).success).toBe(false)
  })
})
