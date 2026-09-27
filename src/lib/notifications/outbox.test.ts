import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/notifications/email', () => ({
  buildNotificationEmail: vi.fn(() => ({ to: 'student@example.test', subject: 'Recorded', text: 'Recorded', html: '<p>Recorded</p>' })),
  sendNotificationEmail: vi.fn(),
}))

import { createAdminClient } from '@/lib/db/admin'
import { sendNotificationEmail } from '@/lib/notifications/email'

import { deliverPendingNotificationEmails } from './outbox'

describe('notification outbox delivery', () => {
  const row = {
    id: 'outbox-1',
    event_key: 'upload:upload-1:confirmation',
    recipient_user_id: 'student-1',
    recipient_email: 'student@example.test',
    template_key: 'upload_finalized',
    payload: { assignmentId: 'assignment-1' },
    status: 'sending',
    attempts: 1,
    next_attempt_at: '2026-09-27T12:00:00.000Z',
    claimed_at: '2026-09-27T12:00:00.000Z',
    provider_message_id: null,
    last_error: null,
    sent_at: null,
    created_at: '2026-09-27T12:00:00.000Z',
    updated_at: '2026-09-27T12:00:00.000Z',
  }
  const rpc = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    rpc.mockImplementation(async (name: string) => name === 'claim_notification_outbox'
      ? { data: [row], error: null }
      : { data: true, error: null })
    vi.mocked(createAdminClient).mockReturnValue({ rpc } as never)
    vi.mocked(sendNotificationEmail).mockRejectedValue(new Error('Resend returned 429.'))
  })

  it('records a provider failure as retryable without failing the source operation', async () => {
    await expect(deliverPendingNotificationEmails()).resolves.toEqual({ sent: 0, retried: 1, cancelled: 0 })

    expect(rpc).toHaveBeenCalledWith('complete_notification_delivery', expect.objectContaining({
      p_outbox_id: row.id,
      p_error: 'Resend returned 429.',
      p_cancelled: false,
    }))
  })
})
