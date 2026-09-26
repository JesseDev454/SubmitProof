import { NextRequest } from 'next/server'

import { jsonError, jsonOk, requireActor } from '@/lib/api/http'
import { createAdminClient } from '@/lib/db/admin'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { actor } = await requireActor(request, ['lecturer'], true)
    const { id } = await context.params
    const { data, error } = await createAdminClient().rpc('publish_assignment', {
      p_actor_id: actor.id,
      p_assignment_id: id,
    })
    if (error) throw error
    return jsonOk({ id: data, status: 'published' })
  } catch (error) {
    return jsonError(error)
  }
}
