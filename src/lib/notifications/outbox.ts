import 'server-only'

import { createAdminClient } from '@/lib/db/admin'
import { buildNotificationEmail, sendNotificationEmail, type EmailTemplateKey } from '@/lib/notifications/email'
import { isReminderEligible } from '@/lib/notifications/eligibility'
import type { Database } from '@/types/database.types'

type OutboxRow = Database['public']['Tables']['notification_outbox']['Row']
type AdminClient = ReturnType<typeof createAdminClient>

type ReminderPayload = {
  assignmentId?: string
  studentId?: string
}

export async function deliverPendingNotificationEmails(limit = 25): Promise<{ sent: number; retried: number; cancelled: number }> {
  const admin = createAdminClient()
  const { data: rows, error } = await admin.rpc('claim_notification_outbox', { p_limit: limit })
  if (error) throw error

  const result = { sent: 0, retried: 0, cancelled: 0 }
  const claimed = rows ?? []
  for (let offset = 0; offset < claimed.length; offset += 10) {
    const batch = claimed.slice(offset, offset + 10)
    const results = await Promise.all(batch.map((row) => deliverOne(admin, row)))
    for (const item of results) result[item] += 1
  }
  return result
}

async function deliverOne(admin: AdminClient, row: OutboxRow): Promise<'sent' | 'retried' | 'cancelled'> {
  let recipientEmail = row.recipient_email
  try {
    if (row.template_key === 'assignment_reminder') {
      const eligibility = await recheckReminder(admin, row)
      if (!eligibility.eligible) {
        await finish(admin, row.id, { cancelled: true, error: 'Reminder eligibility changed before delivery.' })
        return 'cancelled'
      }
      recipientEmail = eligibility.email ?? recipientEmail
    }

    const message = buildNotificationEmail({
      templateKey: asTemplateKey(row.template_key),
      recipientEmail,
      payload: row.payload,
    }, applicationBaseUrl())
    const delivery = await sendNotificationEmail({
      apiKey: process.env.RESEND_API_KEY ?? '',
      fromEmail: process.env.RESEND_FROM_EMAIL ?? '',
      idempotencyKey: row.event_key,
      message,
      adapter: process.env.EMAIL_ADAPTER === 'fake' ? 'fake' : 'resend',
      nodeEnv: process.env.NODE_ENV,
    })
    await finish(admin, row.id, { providerMessageId: delivery.id })
    return 'sent'
  } catch (error) {
    await finish(admin, row.id, { error: error instanceof Error ? error.message : 'Email delivery failed.' })
    return 'retried'
  }
}

function asTemplateKey(value: string): EmailTemplateKey {
  switch (value) {
    case 'commitment_recorded':
    case 'upload_finalized':
    case 'fallback_attention':
    case 'submission_flagged':
    case 'assignment_reminder':
      return value
    default:
      throw new Error('Unknown notification template.')
  }
}

function applicationBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

async function recheckReminder(admin: AdminClient, row: OutboxRow): Promise<{ eligible: boolean; email?: string }> {
  const payload = row.payload as ReminderPayload
  if (!payload.assignmentId || !payload.studentId) return { eligible: false }

  const { data: assignment, error: assignmentError } = await admin
    .from('assignments')
    .select('id, status, current_policy_version_id, course_id')
    .eq('id', payload.assignmentId)
    .maybeSingle()
  if (assignmentError) throw assignmentError
  if (!assignment?.current_policy_version_id) return { eligible: false }

  const [policyResult, enrollmentResult, preferenceResult, profileResult] = await Promise.all([
    admin.from('assignment_policy_versions').select('deadline_at').eq('id', assignment.current_policy_version_id).maybeSingle(),
    admin.from('enrollments').select('id').eq('course_id', assignment.course_id).eq('student_id', payload.studentId).maybeSingle(),
    admin.from('notification_preferences').select('email_assignment_reminders').eq('user_id', payload.studentId).maybeSingle(),
    admin.from('profiles').select('email').eq('id', payload.studentId).maybeSingle(),
  ])
  if (policyResult.error) throw policyResult.error
  if (enrollmentResult.error) throw enrollmentResult.error
  if (preferenceResult.error) throw preferenceResult.error
  if (profileResult.error) throw profileResult.error
  if (!policyResult.data || !enrollmentResult.data || !preferenceResult.data || !profileResult.data?.email) {
    return { eligible: false }
  }

  const { data: submission, error: submissionError } = await admin
    .from('submissions')
    .select('id')
    .eq('assignment_id', payload.assignmentId)
    .eq('student_id', payload.studentId)
    .maybeSingle()
  if (submissionError) throw submissionError
  let hasCompletedUpload = false
  if (submission) {
    const { count, error: uploadError } = await admin
      .from('submission_uploads')
      .select('id', { count: 'exact', head: true })
      .eq('submission_id', submission.id)
    if (uploadError) throw uploadError
    hasCompletedUpload = (count ?? 0) > 0
  }

  return {
    eligible: isReminderEligible({
      status: assignment.status,
      deadlineAt: policyResult.data.deadline_at,
      now: Date.now(),
      optedIn: preferenceResult.data.email_assignment_reminders,
      hasCompletedUpload,
    }),
    email: profileResult.data.email,
  }
}

async function finish(
  admin: AdminClient,
  id: string,
  result: { providerMessageId?: string; error?: string; cancelled?: boolean },
) {
  const { error } = await admin.rpc('complete_notification_delivery', {
    p_outbox_id: id,
    p_provider_message_id: result.providerMessageId ?? null,
    p_error: result.error ?? null,
    p_cancelled: result.cancelled ?? false,
  })
  if (error) throw error
}
