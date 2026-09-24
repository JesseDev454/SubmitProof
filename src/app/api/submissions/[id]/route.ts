import { NextRequest } from 'next/server'

import { ApiError, jsonError, jsonOk, requireActor } from '@/lib/api/http'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { supabase } = await requireActor(request)
    const { id } = await context.params
    const { data: submission, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    if (!submission) throw new ApiError(404, 'not_found', 'The requested submission was not found.')

    const [commitments, uploads] = await Promise.all([
      supabase.from('commitments').select('*').eq('submission_id', id).order('created_at'),
      supabase.from('submission_uploads').select('*').eq('submission_id', id).order('uploaded_at'),
    ])
    if (commitments.error) throw commitments.error
    if (uploads.error) throw uploads.error
    return jsonOk({ ...submission, commitments: commitments.data, uploads: uploads.data })
  } catch (error) {
    return jsonError(error)
  }
}
