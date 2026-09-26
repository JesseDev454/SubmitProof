import { NextRequest } from 'next/server'

import { ApiError, jsonError, jsonOk, requireActor } from '@/lib/api/http'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { actor, supabase } = await requireActor(request, ['student'])
    const { id: assignmentId } = await context.params
    const { data: assignment, error: assignmentError } = await supabase
      .from('assignments')
      .select('id')
      .eq('id', assignmentId)
      .maybeSingle()
    if (assignmentError) throw assignmentError
    if (!assignment) throw new ApiError(404, 'not_found', 'The requested assignment was not found.')

    const { data: submission, error: submissionError } = await supabase
      .from('submissions')
      .select('id, assignment_id, student_id, workflow_status, created_at, updated_at')
      .eq('assignment_id', assignmentId)
      .eq('student_id', actor.id)
      .maybeSingle()
    if (submissionError) throw submissionError
    if (!submission) return jsonOk(null)

    const [commitmentsResult, uploadsResult] = await Promise.all([
      supabase
        .from('commitments')
        .select('id, assignment_id, student_id, submission_id, nonce, file_sha256, provider, provider_message_id, sender_phone_e164, policy_version_id, gateway_event_at, webhook_received_at, processed_at, created_at')
        .eq('submission_id', submission.id)
        .order('created_at'),
      supabase
        .from('submission_uploads')
        .select('id, assignment_id, student_id, submission_id, server_sha256, matched_commitment_id, verification_result, policy_result, policy_version_id, uploaded_at, finalized_at')
        .eq('submission_id', submission.id)
        .order('uploaded_at'),
    ])
    if (commitmentsResult.error) throw commitmentsResult.error
    if (uploadsResult.error) throw uploadsResult.error

    const policyVersionIds = [...new Set([
      ...(commitmentsResult.data ?? []).map((commitment) => commitment.policy_version_id),
      ...(uploadsResult.data ?? []).flatMap((upload) => upload.policy_version_id ? [upload.policy_version_id] : []),
    ])]
    const policiesResult = policyVersionIds.length
      ? await supabase
          .from('assignment_policy_versions')
          .select('id, assignment_id, version_number, deadline_at, fallback_enabled, grace_period_minutes, allowed_mime_types, max_file_size_bytes, created_at')
          .in('id', policyVersionIds)
      : { data: [], error: null }
    if (policiesResult.error) throw policiesResult.error
    const policies = new Map((policiesResult.data ?? []).map((policy) => [policy.id, policy]))

    return jsonOk({
      ...submission,
      commitments: (commitmentsResult.data ?? []).map((commitment) => ({
        ...commitment,
        policy: policies.get(commitment.policy_version_id) ?? null,
      })),
      uploads: (uploadsResult.data ?? []).map((upload) => ({
        ...upload,
        policy: upload.policy_version_id ? policies.get(upload.policy_version_id) ?? null : null,
      })),
    })
  } catch (error) {
    return jsonError(error)
  }
}
