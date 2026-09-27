import { timingSafeEqual } from 'node:crypto'
import { NextRequest } from 'next/server'

import { jsonError, jsonOk, ApiError } from '@/lib/api/http'
import { createAdminClient } from '@/lib/db/admin'
import { deliverPendingNotificationEmails } from '@/lib/notifications/outbox'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET
    const authorization = request.headers.get('authorization') ?? ''
    if (!secret) throw new ApiError(503, 'cron_unavailable', 'The notification job is not configured.')
    if (!safeBearerEqual(authorization, secret)) throw new ApiError(401, 'unauthenticated', 'A valid cron secret is required.')

    const { error: reminderError } = await createAdminClient().rpc('enqueue_due_submission_reminders')
    if (reminderError) throw reminderError
    const result = await deliverPendingNotificationEmails(100)
    return jsonOk(result)
  } catch (error) {
    return jsonError(error)
  }
}

function safeBearerEqual(header: string, secret: string): boolean {
  const provided = Buffer.from(header)
  const expected = Buffer.from(`Bearer ${secret}`)
  return provided.length === expected.length && timingSafeEqual(provided, expected)
}
