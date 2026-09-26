import { createHash, randomBytes } from 'node:crypto'
import { NextRequest } from 'next/server'

import { ApiError, jsonError, jsonOk, parseJson, requireActor } from '@/lib/api/http'
import { issueTokenSchema } from '@/lib/api/schemas'
import { createAdminClient } from '@/lib/db/admin'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { actor } = await requireActor(request, ['student'], true)
    if (!actor.phone_e164) throw new ApiError(409, 'phone_required', 'Add a registered phone number before requesting a fallback token.')
    const body = await parseJson(request, issueTokenSchema)
    const { id } = await context.params
    const admin = createAdminClient()
    if (!body.rotate) {
      const { data: activeToken, error: activeTokenError } = await admin
        .from('assignment_tokens')
        .select('id')
        .eq('assignment_id', id)
        .eq('student_id', actor.id)
        .is('revoked_at', null)
        .maybeSingle()
      if (activeTokenError) throw activeTokenError
      if (activeToken) {
        throw new ApiError(409, 'token_rotation_required', 'An active token already exists. Rotate it to issue a replacement; the old token will stop working.')
      }
    }

    const token = randomBytes(32).toString('base64url')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const { data: tokenId, error } = await admin.rpc('issue_assignment_token', {
      p_actor_id: actor.id,
      p_assignment_id: id,
      p_token_hash: tokenHash,
      p_rotate: body.rotate,
    })
    if (error) throw error
    return jsonOk({
      tokenId,
      token,
      phoneSnapshot: actor.phone_e164,
      payloadFormat: 'SP1|<token>|<nonce>|<sha256>',
    }, 201)
  } catch (error) {
    return jsonError(error)
  }
}
