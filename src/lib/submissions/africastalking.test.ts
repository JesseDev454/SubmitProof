import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

import { createAfricaTalkingWebhookHandler } from './africastalking'

const secret = 'a'.repeat(48)
const token = 't'.repeat(43)
const sender = '+2348012345678'
const shortcode = '12995'
const validHash = 'a'.repeat(64)
const formBody = (overrides: Record<string, string> = {}) => new URLSearchParams({
  date: '2026-09-28T18:00:00.000Z',
  from: sender,
  id: 'AT-message-123',
  linkId: '',
  text: `SP1|${token}|nonce_123456|${validHash}`,
  to: shortcode,
  ...overrides,
}).toString()

function createHarness(options: {
  data?: unknown
  error?: unknown
  secret?: string
  shortcode?: string
} = {}) {
  const processCommitmentEvent = vi.fn(async () => ({
    data: options.data ?? { outcome: 'accepted', commitmentId: 'commitment-1' },
    error: options.error ?? null,
  }))
  const recordWebhookOutcome = vi.fn(async () => undefined)
  const createStore = vi.fn(() => ({ processCommitmentEvent, recordWebhookOutcome }))
  const handler = createAfricaTalkingWebhookHandler({
    secret: options.secret ?? secret,
    shortcode: options.shortcode ?? shortcode,
    createStore,
    now: () => new Date('2026-09-28T18:00:01.000Z'),
  })

  return { handler, processCommitmentEvent, recordWebhookOutcome, createStore }
}

function callbackRequest(body: string, secretValue = secret, contentType = 'application/x-www-form-urlencoded') {
  return new Request(`https://submitproof.example/api/webhooks/africastalking?key=${secretValue}`, {
    method: 'POST',
    headers: { 'content-type': contentType },
    body,
  })
}

describe('Africa\'s Talking inbound SMS webhook', () => {
  it('accepts a valid callback and sends only the token hash and trusted callback data to the processor', async () => {
    const { handler, processCommitmentEvent, recordWebhookOutcome } = createHarness()

    const response = await handler(callbackRequest(formBody()))

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('OK')
    expect(processCommitmentEvent).toHaveBeenCalledWith({
      p_provider: 'africastalking',
      p_provider_message_id: 'AT-message-123',
      p_token_hash: createHash('sha256').update(token).digest('hex'),
      p_nonce: 'nonce_123456',
      p_file_sha256: validHash,
      p_sender_phone: sender,
      p_gateway_event_at: '2026-09-28T18:00:00.000Z',
      p_received_at: '2026-09-28T18:00:01.000Z',
    })
    expect(recordWebhookOutcome).not.toHaveBeenCalled()
  })

  it('acknowledges duplicate deliveries without creating a second commitment', async () => {
    const { handler, processCommitmentEvent } = createHarness({ data: { outcome: 'duplicate' } })

    expect((await handler(callbackRequest(formBody()))).status).toBe(200)
    expect(processCommitmentEvent).toHaveBeenCalledOnce()
  })

  it('does not process callbacks with a wrong secret or accept a missing secret configuration', async () => {
    const wrongSecret = createHarness()
    expect((await wrongSecret.handler(callbackRequest(formBody(), 'wrong'))).status).toBe(404)
    expect(wrongSecret.createStore).not.toHaveBeenCalled()

    const noSecret = createHarness({ secret: '' })
    expect((await noSecret.handler(callbackRequest(formBody()))).status).toBe(503)
    expect(noSecret.createStore).not.toHaveBeenCalled()
  })

  it('records malformed messages and incorrect destination without calling the processor', async () => {
    const malformed = createHarness()
    expect((await malformed.handler(callbackRequest(formBody({ text: 'not a commitment' })))).status).toBe(200)
    expect(malformed.recordWebhookOutcome).toHaveBeenCalledWith(expect.objectContaining({
      p_provider: 'africastalking',
      p_provider_message_id: 'AT-message-123',
      p_outcome: 'rejected',
      p_limited_metadata: { reason: 'malformed_commitment' },
    }))
    expect(malformed.processCommitmentEvent).not.toHaveBeenCalled()

    const wrongDestination = createHarness()
    expect((await wrongDestination.handler(callbackRequest(formBody({ to: '12345' })))).status).toBe(200)
    expect(wrongDestination.recordWebhookOutcome).toHaveBeenCalledWith(expect.objectContaining({
      p_limited_metadata: { reason: 'wrong_recipient' },
    }))
    expect(wrongDestination.processCommitmentEvent).not.toHaveBeenCalled()
  })

  it('does not turn a missing or timezone-ambiguous gateway date into trusted proof time', async () => {
    const { handler, processCommitmentEvent } = createHarness()
    await handler(callbackRequest(formBody({ date: '' })))
    expect(processCommitmentEvent).toHaveBeenNthCalledWith(1, expect.objectContaining({ p_gateway_event_at: null }))

    await handler(callbackRequest(formBody({ date: '2026-09-28 18:00:00' })))
    expect(processCommitmentEvent).toHaveBeenNthCalledWith(2, expect.objectContaining({ p_gateway_event_at: null }))
  })

  it('returns a retryable server response and records processing failure when the database is unavailable', async () => {
    const { handler, recordWebhookOutcome } = createHarness({ error: new Error('database unavailable') })

    const response = await handler(callbackRequest(formBody()))

    expect(response.status).toBe(503)
    expect(recordWebhookOutcome).toHaveBeenCalledWith(expect.objectContaining({
      p_provider: 'africastalking',
      p_provider_message_id: 'AT-message-123',
      p_outcome: 'processing_failed',
      p_limited_metadata: { reason: 'processor_unavailable' },
    }))
  })
})
