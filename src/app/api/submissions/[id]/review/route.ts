import { NextRequest } from 'next/server'

import { jsonError, jsonOk, parseJson, requireActor } from '@/lib/api/http'
import { submissionReviewSchema } from '@/lib/api/schemas'
import { createAdminClient } from '@/lib/db/admin'
import { deliverPendingNotificationEmails } from '@/lib/notifications/outbox'

type RouteContext = { params: Promise<{ id: string }> }

export const maxDuration = 60

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { actor } = await requireActor(request, ['lecturer'], true)
    const { id } = await context.params
    const body = await parseJson(request, submissionReviewSchema)
    const { data, error } = await createAdminClient().rpc('record_submission_review', {
      p_actor_id: actor.id,
      p_submission_id: id,
      p_decision: body.decision,
      p_reason: body.reason ?? null,
    })
    if (error) throw error

    try {
      await deliverPendingNotificationEmails(25)
    } catch {
      // Review is already committed; the outbox remains available to the cron retry worker.
    }
    return jsonOk({ reviewEventId: data, decision: body.decision }, 201)
  } catch (error) {
    return jsonError(error)
  }
}
