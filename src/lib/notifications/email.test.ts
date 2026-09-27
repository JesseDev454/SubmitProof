import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { buildNotificationEmail, sendNotificationEmail } from './email'

describe('notification emails', () => {
  it('renders verification and policy results separately and escapes untrusted content', () => {
    const message = buildNotificationEmail({
      templateKey: 'fallback_attention',
      recipientEmail: 'student@example.test',
      payload: {
        assignmentTitle: '<script>unsafe</script>',
        assignmentId: 'a1',
        submissionId: 's1',
        verificationResult: 'match',
        policyResult: 'does_not_qualify',
        recipientRole: 'student',
      },
    }, 'https://submitproof.example')

    expect(message.subject).toContain('needs attention')
    expect(message.text).toContain('File verification: match')
    expect(message.text).toContain('Fallback policy: does_not_qualify')
    expect(message.html).not.toContain('<script>unsafe</script>')
    expect(message.html).toContain('&lt;script&gt;unsafe&lt;/script&gt;')
  })

  it('sends a Resend idempotency key and returns the provider message ID', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'email-123' }), { status: 200 }))
    const result = await sendNotificationEmail({
      fromEmail: 'SubmitProof <proof@example.test>',
      apiKey: 'resend_test_key',
      idempotencyKey: 'upload:123:confirmation',
      message: { to: 'student@example.test', subject: 'Uploaded', text: 'Upload recorded', html: '<p>Upload recorded</p>' },
      fetcher,
    })

    expect(result).toEqual({ id: 'email-123' })
    expect(fetcher).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({
      headers: expect.objectContaining({ 'Idempotency-Key': 'upload:123:confirmation' }),
    }))
  })

  it('keeps provider failures retryable by returning a useful error', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'rate limited' }), { status: 429 }))
    await expect(sendNotificationEmail({
      fromEmail: 'SubmitProof <proof@example.test>',
      apiKey: 'resend_test_key',
      idempotencyKey: 'upload:123:confirmation',
      message: { to: 'student@example.test', subject: 'Uploaded', text: 'Upload recorded', html: '<p>Upload recorded</p>' },
      fetcher,
    })).rejects.toThrow('Resend returned 429')
  })
})
