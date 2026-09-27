import { NextRequest } from 'next/server'

import { jsonError, jsonOk, parseJson, requireActor } from '@/lib/api/http'
import { profileSettingsSchema } from '@/lib/validation/profile'

export async function PATCH(request: NextRequest) {
  try {
    const { actor, supabase } = await requireActor(request, undefined, true)
    const body = await parseJson(request, profileSettingsSchema)
    const { data, error } = await supabase
      .from('profiles')
      .update({
        full_name: body.fullName,
        department: body.department || null,
        phone_e164: body.phoneE164,
      })
      .eq('id', actor.id)
      .select('id, full_name, department, phone_e164')
      .single()
    if (error) throw error
    return jsonOk(data)
  } catch (error) {
    return jsonError(error)
  }
}
