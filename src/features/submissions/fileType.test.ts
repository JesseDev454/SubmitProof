import { describe, expect, it } from 'vitest'

import { isAllowedFileType } from './fileType'

describe('isAllowedFileType', () => {
  it('matches the browser MIME type against the assignment policy', () => {
    expect(isAllowedFileType({ name: 'report.pdf', type: 'application/pdf' }, ['application/pdf'])).toBe(true)
  })

  it('supports extension policies and rejects unsupported MIME types', () => {
    expect(isAllowedFileType({ name: 'report.PDF', type: '' }, ['.pdf'])).toBe(true)
    expect(isAllowedFileType({ name: 'report.pdf', type: 'application/octet-stream' }, ['application/pdf'])).toBe(false)
  })
})
