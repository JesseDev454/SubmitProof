import { createHash, randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'

import { ApiError, jsonError, jsonOk, parseJson, requireActor } from '@/lib/api/http'
import { simulateSmsSchema } from '@/lib/api/schemas'
import { createAdminClient } from '@/lib/db/admin'
import { parseCommitmentPayload } from '@/lib/submissions/commitment'
import { isSimulatorEnabled } from '@/lib/submissions/simulator'

export async function POST(request: NextRequest) {
  try {
    if (!isSimulatorEnabled(process.env.NODE_ENV, process.env.ENABLE_SIMULATED_SMS)) {
      throw new ApiError(404, 'not_found', 'The requested endpoint was not found.')
    }
    const { actor } = await requireActor(request, ['student'], true)
    if (!actor.phone_e164) throw new ApiError(409, 'phone_required', 'Add a registered phone number before simulating a commitment.')
    const body = await parseJson(request, simulateSmsSchema)
    const providerMessageId = body.providerMessageId ?? randomUUID()
    const admin = createAdminClient()
    let parsed
    try {
      parsed = parseCommitmentPayload(body.payload)
    } catch {
      await admin.rpc('record_webhook_outcome', {
        p_provider: 'simulated',
        p_provider_message_id: providerMessageId,
        p_outcome: 'rejected',
        p_received_at: new Date().toISOString(),
        p_limited_metadata: { reason: 'malformed_commitment' },
      })
      throw new ApiError(400, 'invalid_commitment', 'The commitment message is malformed.')
    }

    const gatewayEventAt = new Date().toISOString()
    const receivedAt = new Date().toISOString()
    const { data, error } = await admin.rpc('process_commitment_event', {
      p_provider: 'simulated',
      p_provider_message_id: providerMessageId,
      p_token_hash: createHash('sha256').update(parsed.token).digest('hex'),
      p_nonce: parsed.nonce,
      p_file_sha256: parsed.sha256,
      p_sender_phone: actor.phone_e164,
      p_gateway_event_at: gatewayEventAt,
      p_received_at: receivedAt,
    })
    if (error) {
      await admin.rpc('record_webhook_outcome', {
        p_provider: 'simulated',
        p_provider_message_id: providerMessageId,
        p_outcome: 'processing_failed',
        p_received_at: receivedAt,
        p_limited_metadata: { reason: 'processor_unavailable' },
      })
      throw error
    }
    const result = data as { outcome: 'accepted' | 'duplicate' | 'rejected'; commitmentId?: string; reason?: string }
    if (result.outcome === 'rejected') {
      throw new ApiError(400, 'commitment_rejected', 'The commitment could not be accepted.')
    }
    return jsonOk({ ...result, provider: 'simulated' }, result.outcome === 'accepted' ? 201 : 200)
  } catch (error) {
    return jsonError(error)
  }
}
