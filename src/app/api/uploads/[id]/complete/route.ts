import { createHash } from 'node:crypto'
import { NextRequest } from 'next/server'

import { ApiError, jsonError, jsonOk, requireActor } from '@/lib/api/http'
import { createAdminClient } from '@/lib/db/admin'
import type { Database } from '@/types/database.types'
import { detectSupportedMimeType } from '@/lib/submissions/commitment'

type RouteContext = { params: Promise<{ id: string }> }
type Reservation = Database['public']['Tables']['submission_upload_reservations']['Row']
type CompleteResult = {
  uploadId?: string
  verificationResult?: string
  policyResult?: string
  matchedCommitmentId?: string | null
  idempotent?: boolean
  error?: string
}

export const runtime = 'nodejs'

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { actor } = await requireActor(request, ['student'], true)
    const { id } = await context.params
    const admin = createAdminClient()
    const { data: reservation, error: reservationError } = await admin
      .from('submission_upload_reservations')
      .select('*')
      .eq('id', id)
      .eq('student_id', actor.id)
      .maybeSingle()
    if (reservationError) throw reservationError
    if (!reservation) throw new ApiError(404, 'not_found', 'The upload reservation was not found.')

    if (reservation.status === 'finalized') {
      const { data: existingUpload, error } = await admin
        .from('submission_uploads')
        .select('*')
        .eq('reservation_id', id)
        .maybeSingle()
      if (error) throw error
      if (!existingUpload) throw new ApiError(500, 'evidence_missing', 'Finalized upload evidence is unavailable.')
      await removeStagingObject(admin, reservation.staging_object_path)
      return jsonOk(existingUpload)
    }
    if (reservation.status !== 'reserved') {
      throw new ApiError(409, 'reservation_inactive', 'This upload reservation cannot be completed.')
    }

    const bucket = admin.storage.from('submission-files')
    const { data: fileInfo, error: infoError } = await bucket.info(reservation.staging_object_path)
    if (infoError || !fileInfo) {
      throw new ApiError(409, 'upload_missing', 'Upload the file to the signed URL before completing the reservation.')
    }
    if (fileInfo.size === undefined || fileInfo.size > 52428800) {
      throw new ApiError(413, 'file_too_large', 'The uploaded file exceeds the storage limit.')
    }

    const { data: blob, error: downloadError } = await bucket.download(reservation.staging_object_path)
    if (downloadError || !blob) throw new ApiError(503, 'storage_unavailable', 'The uploaded file could not be read. Retry completion.')
    const bytes = Buffer.from(await blob.arrayBuffer())
    if (bytes.byteLength !== fileInfo.size) {
      throw new ApiError(409, 'storage_size_mismatch', 'The stored file size could not be verified.')
    }
    const detectedMime = detectSupportedMimeType(bytes)
    if (!detectedMime) {
      await rejectReservation(admin, actor.id, reservation, bytes.byteLength, 'application/octet-stream', '0'.repeat(64), fileInfo.createdAt)
      await removeStagingObject(admin, reservation.staging_object_path)
      throw new ApiError(400, 'unsupported_file_type', 'The uploaded file type is not supported.')
    }
    const serverSha256 = createHash('sha256').update(bytes).digest('hex')
    const finalObjectPath = `${reservation.assignment_id}/${reservation.student_id}/${reservation.submission_id}/${reservation.id}`

    const { data: policy, error: policyError } = await admin
      .from('assignment_policy_versions')
      .select('allowed_mime_types, max_file_size_bytes')
      .eq('id', reservation.policy_version_id)
      .maybeSingle()
    if (policyError) throw policyError
    if (!policy) throw new ApiError(500, 'policy_missing', 'The upload policy is unavailable.')
    if (
      bytes.byteLength > policy.max_file_size_bytes ||
      !policy.allowed_mime_types.includes(detectedMime) ||
      detectedMime !== reservation.declared_mime_type
    ) {
      await rejectReservation(admin, actor.id, reservation, bytes.byteLength, detectedMime, serverSha256, fileInfo.createdAt)
      await removeStagingObject(admin, reservation.staging_object_path)
      throw new ApiError(400, 'file_policy_mismatch', 'The uploaded file does not meet the assignment file rules.')
    }

    const { error: finalUploadError } = await bucket.upload(finalObjectPath, bytes, {
      contentType: detectedMime,
      cacheControl: '0',
      upsert: false,
    })
    if (finalUploadError) {
      const { data: existingFinal, error: existingFinalError } = await bucket.download(finalObjectPath)
      if (existingFinalError || !existingFinal) throw new ApiError(503, 'storage_unavailable', 'The verified file could not be finalized. Retry completion.')
      const existingHash = createHash('sha256').update(Buffer.from(await existingFinal.arrayBuffer())).digest('hex')
      if (existingHash !== serverSha256) throw new ApiError(409, 'final_object_conflict', 'The final evidence object already contains different bytes.')
    }

    const { data, error } = await admin.rpc('complete_upload_reservation', {
      p_actor_id: actor.id,
      p_reservation_id: reservation.id,
      p_detected_mime_type: detectedMime,
      p_actual_size_bytes: bytes.byteLength,
      p_server_sha256: serverSha256,
      p_storage_received_at: fileInfo.createdAt,
      p_final_object_path: finalObjectPath,
    })
    if (error) throw error
    const result = data as unknown as CompleteResult
    if (result.error) {
      await bucket.remove([finalObjectPath])
      await removeStagingObject(admin, reservation.staging_object_path)
      const status = ['upload_expired', 'assignment_closed'].includes(result.error) ? 409 : 400
      throw new ApiError(status, result.error, 'The upload does not satisfy the reservation and assignment rules.')
    }

    await removeStagingObject(admin, reservation.staging_object_path)
    return jsonOk(result, result.idempotent ? 200 : 201)
  } catch (error) {
    return jsonError(error)
  }
}

async function rejectReservation(
  admin: ReturnType<typeof createAdminClient>,
  actorId: string,
  reservation: Reservation,
  actualSize: number,
  mimeType: string,
  sha256: string,
  storageReceivedAt: string,
) {
  const finalPath = `${reservation.assignment_id}/${reservation.student_id}/${reservation.submission_id}/${reservation.id}`
  const { data, error } = await admin.rpc('complete_upload_reservation', {
    p_actor_id: actorId,
    p_reservation_id: reservation.id,
    p_detected_mime_type: mimeType,
    p_actual_size_bytes: actualSize,
    p_server_sha256: sha256,
    p_storage_received_at: storageReceivedAt,
    p_final_object_path: finalPath,
  })
  if (error) throw error
  if (!(data as CompleteResult | null)?.error) {
    throw new Error('The upload reservation was not marked rejected.')
  }
}

async function removeStagingObject(admin: ReturnType<typeof createAdminClient>, path: string) {
  const { error } = await admin.storage.from('submission-files').remove([path])
  if (error) {
    // Cleanup retries stale rejected and finalized staging objects after signed URLs expire.
    console.error('Could not remove staging upload; cleanup can retry it.')
  }
}
