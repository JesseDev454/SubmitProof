import { NextRequest } from 'next/server'

import { ApiError, jsonError, jsonOk, requireActor } from '@/lib/api/http'
import { createAdminClient } from '@/lib/db/admin'

type RouteContext = { params: Promise<{ id: string }> }

const DOWNLOAD_TTL_SECONDS = 60

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { supabase } = await requireActor(request)
    const { id } = await context.params
    const { data: upload, error: uploadError } = await supabase
      .from('submission_uploads')
      .select('id, storage_object_path')
      .eq('id', id)
      .maybeSingle()
    if (uploadError) throw uploadError
    if (!upload) throw new ApiError(404, 'not_found', 'The requested file was not found.')

    const admin = createAdminClient()
    const { data: signed, error: signingError } = await admin.storage
      .from('submission-files')
      .createSignedUrl(upload.storage_object_path, DOWNLOAD_TTL_SECONDS, { download: true })
    if (signingError || !signed) {
      throw new ApiError(503, 'storage_unavailable', 'A secure file link could not be created. Try again.')
    }

    return jsonOk({ url: signed.signedUrl, expiresInSeconds: DOWNLOAD_TTL_SECONDS })
  } catch (error) {
    return jsonError(error)
  }
}
