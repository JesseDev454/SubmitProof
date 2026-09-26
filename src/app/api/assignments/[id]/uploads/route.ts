import { NextRequest } from 'next/server'

import { ApiError, jsonError, jsonOk, parseJson, requireActor } from '@/lib/api/http'
import { reserveUploadSchema } from '@/lib/api/schemas'
import { createAdminClient } from '@/lib/db/admin'

type RouteContext = { params: Promise<{ id: string }> }
type ReservationResult = {
  reservationId: string
  submissionId: string
  stagingObjectPath: string
  expiresAt: string
  policyVersionId: string
  status: string
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { actor } = await requireActor(request, ['student'], true)
    const body = await parseJson(request, reserveUploadSchema)
    const { id } = await context.params
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('create_upload_reservation', {
      p_actor_id: actor.id,
      p_assignment_id: id,
      p_kind: body.kind,
      p_mime_type: body.mimeType,
      p_declared_size_bytes: body.fileSizeBytes,
      p_idempotency_key: body.idempotencyKey,
    })
    if (error) throw error
    const reservation = data as unknown as ReservationResult
    if (reservation.status === 'finalized') {
      return jsonOk({ ...reservation, signedUploadUrl: null })
    }

    const { data: signed, error: storageError } = await admin.storage
      .from('submission-files')
      .createSignedUploadUrl(reservation.stagingObjectPath, { upsert: false })
    if (storageError) throw new ApiError(503, 'storage_unavailable', 'A secure upload link could not be created. Retry with the same idempotency key.')
    return jsonOk({ ...reservation, signedUploadUrl: signed.signedUrl }, 201)
  } catch (error) {
    return jsonError(error)
  }
}
