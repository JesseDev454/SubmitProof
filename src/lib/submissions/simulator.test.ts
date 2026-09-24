import { describe, expect, it } from 'vitest'

import { isSimulatorEnabled } from './simulator'

describe('isSimulatorEnabled', () => {
  it('never enables the simulated gateway in production, even when the flag is set', () => {
    expect(isSimulatorEnabled('production', 'true')).toBe(false)
  })

  it('requires an explicit flag in development and test environments', () => {
    expect(isSimulatorEnabled('development', 'true')).toBe(true)
    expect(isSimulatorEnabled('test', 'true')).toBe(true)
    expect(isSimulatorEnabled('development', undefined)).toBe(false)
    expect(isSimulatorEnabled('test', 'false')).toBe(false)
  })
})
