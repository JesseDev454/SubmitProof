import { NextRequest } from 'next/server'

import { ApiError, jsonError, jsonOk, requireActor } from '@/lib/api/http'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { supabase } = await requireActor(request, ['lecturer'])
    const { id } = await context.params
    const { data: assignment, error: assignmentError } = await supabase
      .from('assignments')
      .select('id, title, status, current_policy_version_id')
      .eq('id', id)
      .maybeSingle()
    if (assignmentError) throw assignmentError
    if (!assignment) throw new ApiError(404, 'not_found', 'The requested assignment was not found.')

    const { data: submissions, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('assignment_id', id)
      .order('created_at', { ascending: true })
    if (error) throw error
    const submissionIds = submissions.map((submission) => submission.id)
    const [commitments, uploads] = submissionIds.length
      ? await Promise.all([
          supabase.from('commitments').select('*').in('submission_id', submissionIds).order('created_at'),
          supabase.from('submission_uploads').select('*').in('submission_id', submissionIds).order('uploaded_at'),
        ])
      : [{ data: [], error: null }, { data: [], error: null }]
    if (commitments.error) throw commitments.error
    if (uploads.error) throw uploads.error

    return jsonOk({
      assignment,
      submissions: submissions.map((submission) => ({
        ...submission,
        commitments: commitments.data?.filter((commitment) => commitment.submission_id === submission.id) ?? [],
        uploads: uploads.data?.filter((upload) => upload.submission_id === submission.id) ?? [],
      })),
    })
  } catch (error) {
    return jsonError(error)
  }
}
