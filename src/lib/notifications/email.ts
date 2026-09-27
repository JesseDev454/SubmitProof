import 'server-only'

import type { Json } from '@/types/database.types'

export type EmailTemplateKey =
  | 'commitment_recorded'
  | 'upload_finalized'
  | 'fallback_attention'
  | 'submission_flagged'
  | 'assignment_reminder'

export type NotificationEmailInput = {
  templateKey: EmailTemplateKey
  recipientEmail: string
  payload: Json
}

export type NotificationEmail = {
  to: string
  subject: string
  text: string
  html: string
}

export type Fetcher = typeof fetch

function value(payload: Json, key: string): string {
  if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
    const result = payload[key]
    if (typeof result === 'string') return result
    if (typeof result === 'number' || typeof result === 'boolean') return String(result)
  }
  return ''
}

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character)
}

function appLink(baseUrl: string, payload: Json, role: string): string {
  const assignmentId = encodeURIComponent(value(payload, 'assignmentId'))
  const submissionId = encodeURIComponent(value(payload, 'submissionId'))
  if (role === 'lecturer' && assignmentId && submissionId) {
    return `${baseUrl}/lecturer/assignments/${assignmentId}/submissions/${submissionId}`
  }
  return assignmentId ? `${baseUrl}/student/assignments/${assignmentId}` : baseUrl
}

export function buildNotificationEmail(input: NotificationEmailInput, baseUrl: string): NotificationEmail {
  const title = value(input.payload, 'assignmentTitle') || 'your assignment'
  const verification = value(input.payload, 'verificationResult') || 'pending'
  const policy = value(input.payload, 'policyResult') || 'pending'
  const role = value(input.payload, 'recipientRole')
  const link = appLink(baseUrl.replace(/\/$/, ''), input.payload, role)
  let subject: string
  let summary: string

  switch (input.templateKey) {
    case 'commitment_recorded':
      subject = 'Fallback commitment recorded'
      summary = `A simulated fallback commitment for “${title}” has been recorded. This records evidence; the assignment policy still determines whether it qualifies.`
      break
    case 'upload_finalized':
      subject = 'Assignment upload recorded'
      summary = `Your upload for “${title}” has been finalized. File verification: ${verification}. Fallback policy: ${policy}.`
      break
    case 'fallback_attention':
      subject = role === 'lecturer' ? 'Fallback submission needs review' : 'Your fallback upload needs attention'
      summary = `The submission for “${title}” needs review. File verification: ${verification}. Fallback policy: ${policy}.`
      break
    case 'submission_flagged':
      subject = 'Your submission was flagged for review'
      summary = `A lecturer flagged the submission for “${title}” for further review.${value(input.payload, 'reason') ? ` Reason: ${value(input.payload, 'reason')}` : ''}`
      break
    case 'assignment_reminder':
      subject = 'Assignment deadline approaching'
      summary = `“${title}” is due ${value(input.payload, 'deadlineAt') || 'within the next 24 hours'}. Open the assignment to review its requirements.`
      break
  }

  const safeSummary = escapeHtml(summary)
  const safeLink = escapeHtml(link)
  return {
    to: input.recipientEmail,
    subject,
    text: `${summary}\n\nOpen SubmitProof: ${link}\n\nSubmitProof records evidence and evaluates it against the assignment policy. It does not decide institutional lateness.`,
    html: `<main><h1>${escapeHtml(subject)}</h1><p>${safeSummary}</p><p><a href="${safeLink}">Open SubmitProof</a></p><p>SubmitProof records evidence and evaluates it against the assignment policy. It does not decide institutional lateness.</p></main>`,
  }
}

export async function sendNotificationEmail(input: {
  apiKey: string
  fromEmail: string
  idempotencyKey: string
  message: NotificationEmail
  fetcher?: Fetcher
  adapter?: 'resend' | 'fake'
  nodeEnv?: string
}): Promise<{ id: string }> {
  if (input.adapter === 'fake') {
    if (input.nodeEnv === 'production') throw new Error('The fake email adapter is disabled in production.')
    return { id: `fake-${input.idempotencyKey}` }
  }
  if (!input.apiKey || !input.fromEmail) throw new Error('Resend is not configured.')

  const response = await (input.fetcher ?? fetch)('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': input.idempotencyKey,
    },
    body: JSON.stringify({
      from: input.fromEmail,
      to: [input.message.to],
      subject: input.message.subject,
      text: input.message.text,
      html: input.message.html,
    }),
  })
  if (!response.ok) throw new Error(`Resend returned ${response.status}.`)

  const result = await response.json() as { id?: unknown }
  if (typeof result.id !== 'string' || !result.id) throw new Error('Resend returned no message ID.')
  return { id: result.id }
}
