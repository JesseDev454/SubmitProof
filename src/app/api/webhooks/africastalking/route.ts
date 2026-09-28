import { createAfricaTalkingWebhookHandler } from '@/lib/submissions/africastalking'
import { createAdminClient } from '@/lib/db/admin'

export const maxDuration = 30

export async function POST(request: Request): Promise<Response> {
  const handler = createAfricaTalkingWebhookHandler({
    secret: process.env.AFRICASTALKING_CALLBACK_SECRET,
    shortcode: process.env.AFRICASTALKING_SHORTCODE,
    createStore: () => {
      const admin = createAdminClient()
      return {
        processCommitmentEvent: async (parameters) => {
          // Supabase's generated RPC argument types mark nullable Postgres
          // parameters as required strings, although this function accepts NULL.
          const result = await admin.rpc('process_commitment_event', parameters as never)
          return { data: result.data, error: result.error }
        },
        recordWebhookOutcome: async (parameters) => {
          const result = await admin.rpc('record_webhook_outcome', parameters as never)
          if (result.error) throw result.error
        },
      }
    },
  })

  return handler(request)
}
