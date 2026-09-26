import { describe, expect, it, vi } from 'vitest'

import { clearUploadIdempotencyKey, getUploadIdempotencyKey, uploadSubmission } from './uploadSubmission'

describe('getUploadIdempotencyKey', () => {
  it('reuses one key for a retry of the same assignment, kind, and file', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    const createKey = vi.fn()
      .mockReturnValueOnce('upload-key-1')
      .mockReturnValueOnce('upload-key-2')

    const first = getUploadIdempotencyKey('assignment-1', 'normal', 'a'.repeat(64), storage, createKey)
    const retry = getUploadIdempotencyKey('assignment-1', 'normal', 'a'.repeat(64), storage, createKey)
    const differentFile = getUploadIdempotencyKey('assignment-1', 'normal', 'b'.repeat(64), storage, createKey)

    expect(first).toBe('upload-key-1')
    expect(retry).toBe(first)
    expect(differentFile).toBe('upload-key-2')
    expect(createKey).toHaveBeenCalledTimes(2)
  })

  it('keeps retry keys stable in memory when browser storage is unavailable', () => {
    const storage = {
      getItem: () => { throw new Error('storage blocked') },
      setItem: () => { throw new Error('storage blocked') },
    }
    const createKey = vi.fn().mockReturnValueOnce('memory-key-1').mockReturnValueOnce('memory-key-2')

    const first = getUploadIdempotencyKey('assignment-memory', 'fallback', 'c'.repeat(64), storage, createKey)
    const retry = getUploadIdempotencyKey('assignment-memory', 'fallback', 'c'.repeat(64), storage, createKey)

    expect(first).toBe('memory-key-1')
    expect(retry).toBe(first)
    expect(createKey).toHaveBeenCalledTimes(1)
  })

  it('starts a fresh idempotency key after a completed upload attempt', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    }
    const createKey = vi.fn().mockReturnValueOnce('attempt-1').mockReturnValueOnce('attempt-2')

    const first = getUploadIdempotencyKey('assignment-1', 'normal', 'a'.repeat(64), storage, createKey)
    clearUploadIdempotencyKey('assignment-1', 'normal', 'a'.repeat(64), storage)
    const nextAttempt = getUploadIdempotencyKey('assignment-1', 'normal', 'a'.repeat(64), storage, createKey)

    expect(first).toBe('attempt-1')
    expect(nextAttempt).toBe('attempt-2')
  })
})

describe('uploadSubmission', () => {
  it('reserves, transfers the file to signed storage, and finalizes before resolving', async () => {
    const order: string[] = []
    const stages: string[] = []
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/api/assignments/assignment-1/uploads')) {
        order.push('reserve')
        expect(init?.method).toBe('POST')
        expect(JSON.parse(String(init?.body))).toEqual({
          kind: 'normal',
          mimeType: 'application/pdf',
          fileSizeBytes: 4,
          idempotencyKey: 'retry-key',
        })
        return Response.json({ data: {
          reservationId: 'reservation-1',
          stagingObjectPath: 'staging/path',
          signedUploadUrl: 'https://storage.test/upload?token=signed-token',
        } })
      }
      order.push('finalize')
      expect(url).toBe('/api/uploads/reservation-1/complete')
      expect(init?.method).toBe('POST')
      return Response.json({ data: {
        uploadId: 'upload-1',
        verificationResult: 'not_applicable',
        policyResult: 'not_applicable',
      } }, { status: 201 })
    })
    const transfer = vi.fn(async (...args: unknown[]) => {
      order.push('transfer')
      expect(args.slice(0, 2)).toEqual(['staging/path', 'signed-token'])
      expect(args[2]).toMatchObject({ size: 4, type: 'application/pdf' })
      return { error: null }
    })

    const result = await uploadSubmission({
      assignmentId: 'assignment-1',
      file: new File(['%PDF'], 'work.pdf', { type: 'application/pdf' }),
      kind: 'normal',
      idempotencyKey: 'retry-key',
      fetcher,
      transfer,
      onStage: (stage) => stages.push(stage),
    })

    expect(order).toEqual(['reserve', 'transfer', 'finalize'])
    expect(stages).toEqual(['reserving', 'transferring', 'verifying'])
    expect(result).toMatchObject({ uploadId: 'upload-1', verificationResult: 'not_applicable' })
  })

  it('never finalizes or reports a receipt when the signed transfer fails', async () => {
    const fetcher = vi.fn(async () => Response.json({ data: {
      reservationId: 'reservation-1',
      stagingObjectPath: 'staging/path',
      signedUploadUrl: 'https://storage.test/upload?token=signed-token',
    } }, { status: 201 }))
    const transfer = vi.fn(async () => ({ error: new Error('storage offline') }))

    await expect(uploadSubmission({
      assignmentId: 'assignment-1',
      file: new File(['%PDF'], 'work.pdf', { type: 'application/pdf' }),
      kind: 'normal',
      idempotencyKey: 'retry-key',
      fetcher,
      transfer,
    })).rejects.toThrow('storage offline')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
