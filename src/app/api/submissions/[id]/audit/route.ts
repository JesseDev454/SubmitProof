import { NextRequest } from 'next/server'

import { ApiError, jsonError, jsonOk, requireActor } from '@/lib/api/http'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { supabase } = await requireActor(request)
    const { id } = await context.params
    const { data: submission, error: submissionError } = await supabase
      .from('submissions')
      .select('id')
      .eq('id', id)
      .maybeSingle()
    if (submissionError) throw submissionError
    if (!submission) throw new ApiError(404, 'not_found', 'The requested submission was not found.')

    const { data, error } = await supabase
      .from('audit_events')
      .select('*')
      .eq('submission_id', id)
      .order('event_at', { ascending: true })
    if (error) throw error
    return jsonOk(data)
  } catch (error) {
    return jsonError(error)
  }
}
