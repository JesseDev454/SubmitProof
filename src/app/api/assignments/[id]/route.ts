import { NextRequest } from 'next/server'

import { jsonError, jsonOk, parseJson, requireActor } from '@/lib/api/http'
import { patchAssignmentSchema } from '@/lib/api/schemas'
import { createAdminClient } from '@/lib/db/admin'
import { ApiError } from '@/lib/api/http'

type RouteContext = { params: Promise<{ id: string }> }

async function loadAssignment(id: string, supabase: Awaited<ReturnType<typeof requireActor>>['supabase']) {
  const { data: assignment, error } = await supabase
    .from('assignments')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!assignment) throw new ApiError(404, 'not_found', 'The requested assignment was not found.')

  let policy = null
  if (assignment.current_policy_version_id) {
    const result = await supabase
      .from('assignment_policy_versions')
      .select('*')
      .eq('id', assignment.current_policy_version_id)
      .maybeSingle()
    if (result.error) throw result.error
    policy = result.data
  }
  return { ...assignment, policy }
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { supabase } = await requireActor(request)
    const { id } = await context.params
    return jsonOk(await loadAssignment(id, supabase))
  } catch (error) {
    return jsonError(error)
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { actor } = await requireActor(request, ['lecturer'], true)
    const body = await parseJson(request, patchAssignmentSchema)
    const { id } = await context.params
    const admin = createAdminClient()
    const { error } = await admin.rpc('update_assignment_draft', {
      p_actor_id: actor.id,
      p_assignment_id: id,
      p_title: body.title ?? null,
      p_description: body.description ?? null,
      p_update_description: Object.hasOwn(body, 'description'),
      p_policy: body.policy ?? null,
    })
    if (error) throw error

    const { supabase } = await requireActor(request, ['lecturer'])
    return jsonOk(await loadAssignment(id, supabase))
  } catch (error) {
    return jsonError(error)
  }
}
