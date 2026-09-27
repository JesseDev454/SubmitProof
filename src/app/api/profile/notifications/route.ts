import { NextRequest } from 'next/server'

import { jsonError, jsonOk, parseJson, requireActor } from '@/lib/api/http'
import { notificationPreferencesSchema } from '@/lib/api/schemas'

export async function GET(request: NextRequest) {
  try {
    const { actor, supabase } = await requireActor(request)
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('email_assignment_reminders, email_submission_confirmations, email_fallback_attention, email_product_updates')
      .eq('user_id', actor.id)
      .maybeSingle()
    if (error) throw error
    return jsonOk(data ?? {
      email_assignment_reminders: true,
      email_submission_confirmations: true,
      email_fallback_attention: true,
      email_product_updates: false,
    })
  } catch (error) {
    return jsonError(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { actor, supabase } = await requireActor(request, undefined, true)
    const body = await parseJson(request, notificationPreferencesSchema)
    const { data, error } = await supabase
      .from('notification_preferences')
      .update({
        email_assignment_reminders: body.emailAssignmentReminders,
        email_submission_confirmations: body.emailSubmissionConfirmations,
        email_fallback_attention: body.emailFallbackAttention,
        email_product_updates: body.emailProductUpdates,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', actor.id)
      .select('email_assignment_reminders, email_submission_confirmations, email_fallback_attention, email_product_updates')
      .single()
    if (error) throw error
    return jsonOk(data)
  } catch (error) {
    return jsonError(error)
  }
}
