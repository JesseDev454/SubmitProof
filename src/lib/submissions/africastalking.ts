import { createHash, timingSafeEqual } from 'node:crypto'

import { parseCommitmentPayload } from './commitment'

const MAX_CALLBACK_BYTES = 4_096
const PROVIDER_MESSAGE_ID_MAX_LENGTH = 200
const E164_PATTERN = /^\+[1-9][0-9]{7,14}$/
const TIMESTAMP_WITH_ZONE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/i

type WebhookOutcome = 'accepted' | 'duplicate' | 'rejected' | 'processing_failed'

type CallbackStore = {
  processCommitmentEvent: (parameters: {
    p_provider: 'africastalking'
    p_provider_message_id: string
    p_token_hash: string
    p_nonce: string
    p_file_sha256: string
    p_sender_phone: string
    p_gateway_event_at: string | null
    p_received_at: string
  }) => Promise<{ data: unknown; error: unknown | null }>
  recordWebhookOutcome: (parameters: {
    p_provider: 'africastalking'
    p_provider_message_id: string | null
    p_outcome: WebhookOutcome
    p_received_at: string
    p_limited_metadata: { reason: string }
  }) => Promise<unknown>
}

type CallbackFields = {
  id?: string
  from?: string
  to?: string
  text?: string
  date?: string
}

type AfricaTalkingWebhookOptions = {
  /** Secret placed in the callback URL's `key` query parameter. */
  secret: string | undefined
  shortcode: string | undefined
  createStore: () => CallbackStore
  now?: () => Date
}

function response(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'text/plain; charset=utf-8',
    },
  })
}

function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided || expected.length < 32) return false

  const providedBytes = Buffer.from(provided)
  const expectedBytes = Buffer.from(expected)
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes)
}

function validProviderMessageId(value: string | undefined): string | null {
  const id = value?.trim()
  if (!id || id.length > PROVIDER_MESSAGE_ID_MAX_LENGTH || /[\u0000-\u001f\u007f]/.test(id)) return null
  return id
}

function gatewayTimestamp(value: string | undefined): string | null {
  if (!value || !TIMESTAMP_WITH_ZONE_PATTERN.test(value)) return null
  const milliseconds = Date.parse(value)
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : null
}

function parseForm(body: string): { fields: CallbackFields | null; malformed: boolean } {
  const params = new URLSearchParams(body)
  const fields: CallbackFields = {}
  const supportedFields = new Set(['id', 'from', 'to', 'text', 'date'])

  for (const [key, value] of params) {
    if (!supportedFields.has(key)) continue
    if (Object.hasOwn(fields, key)) return { fields: null, malformed: true }
    fields[key as keyof CallbackFields] = value
  }

  return { fields, malformed: false }
}

/**
 * Build an Africa's Talking inbound SMS endpoint. The secret and shortcode are
 * supplied at request time by the hosting environment; the database client is
 * created only after the callback URL secret has been checked.
 */
export function createAfricaTalkingWebhookHandler(options: AfricaTalkingWebhookOptions) {
  const now = options.now ?? (() => new Date())

  return async function POST(request: Request): Promise<Response> {
    if (!options.secret || options.secret.length < 32 || !options.shortcode) {
      return response(503, 'Webhook is not configured.')
    }

    let requestUrl: URL
    try {
      requestUrl = new URL(request.url)
    } catch {
      return response(404, 'Not found.')
    }
    if (!secretMatches(requestUrl.searchParams.get('key'), options.secret)) {
      return response(404, 'Not found.')
    }

    const store = options.createStore()
    const receivedAt = now().toISOString()
    let fields: CallbackFields = {}
    let parseReason = ''
    const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()

    if (contentType !== 'application/x-www-form-urlencoded') {
      parseReason = 'unsupported_content_type'
    } else {
      const contentLength = Number(request.headers.get('content-length'))
      if (Number.isFinite(contentLength) && contentLength > MAX_CALLBACK_BYTES) {
        parseReason = 'callback_too_large'
      } else {
        try {
          const body = await request.text()
          if (Buffer.byteLength(body, 'utf8') > MAX_CALLBACK_BYTES) {
            parseReason = 'callback_too_large'
          } else {
            const parsed = parseForm(body)
            fields = parsed.fields ?? {}
            if (parsed.malformed) parseReason = 'duplicate_callback_field'
          }
        } catch {
          parseReason = 'malformed_callback'
        }
      }
    }

    const providerMessageId = validProviderMessageId(fields.id)
    const reject = async (reason: string) => {
      await store.recordWebhookOutcome({
        p_provider: 'africastalking',
        p_provider_message_id: providerMessageId,
        p_outcome: 'rejected',
        p_received_at: receivedAt,
        p_limited_metadata: { reason },
      })
      return response(200, 'OK')
    }

    if (parseReason) return reject(parseReason)
    if (!providerMessageId) return reject('missing_provider_message_id')
    if (fields.to?.trim() !== options.shortcode.trim()) return reject('wrong_recipient')

    const senderPhone = fields.from?.trim()
    if (!senderPhone || !E164_PATTERN.test(senderPhone)) return reject('invalid_sender')

    let commitment
    try {
      commitment = parseCommitmentPayload(fields.text ?? '')
    } catch {
      return reject('malformed_commitment')
    }

    const recordProcessingFailure = async () => {
      try {
        await store.recordWebhookOutcome({
          p_provider: 'africastalking',
          p_provider_message_id: providerMessageId,
          p_outcome: 'processing_failed',
          p_received_at: receivedAt,
          p_limited_metadata: { reason: 'processor_unavailable' },
        })
      } catch {
        // The HTTP retry is the recovery mechanism if the database is unavailable.
      }
      return response(503, 'Temporarily unavailable.')
    }

    let result: { data: unknown; error: unknown | null }
    try {
      result = await store.processCommitmentEvent({
        p_provider: 'africastalking',
        p_provider_message_id: providerMessageId,
        p_token_hash: createHash('sha256').update(commitment.token).digest('hex'),
        p_nonce: commitment.nonce,
        p_file_sha256: commitment.sha256,
        p_sender_phone: senderPhone,
        p_gateway_event_at: gatewayTimestamp(fields.date),
        p_received_at: receivedAt,
      })
    } catch {
      return recordProcessingFailure()
    }

    if (result.error) {
      return recordProcessingFailure()
    }

    const outcome = result.data as { outcome?: unknown } | null
    if (!outcome || !['accepted', 'duplicate', 'rejected'].includes(String(outcome.outcome))) {
      return recordProcessingFailure()
    }
    return response(200, 'OK')
  }
}
