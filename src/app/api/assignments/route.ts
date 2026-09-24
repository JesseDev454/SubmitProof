import { NextRequest } from 'next/server'

import { jsonError, jsonOk, parseJson, requireActor } from '@/lib/api/http'
import { createAssignmentSchema } from '@/lib/api/schemas'
import { createAdminClient } from '@/lib/db/admin'

export async function GET(request: NextRequest) {
  try {
    const { supabase } = await requireActor(request)
    const { data: assignments, error } = await supabase
      .from('assignments')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error

    const policyIds = assignments.flatMap((item) => item.current_policy_version_id ?? [])
    const { data: policies, error: policyError } = policyIds.length
      ? await supabase.from('assignment_policy_versions').select('*').in('id', policyIds)
      : { data: [], error: null }
    if (policyError) throw policyError
    const policyById = new Map((policies ?? []).map((policy) => [policy.id, policy]))
    return jsonOk(assignments.map((assignment) => ({
      ...assignment,
      policy: assignment.current_policy_version_id
        ? policyById.get(assignment.current_policy_version_id) ?? null
        : null,
    })))
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { actor } = await requireActor(request, ['lecturer'], true)
    const body = await parseJson(request, createAssignmentSchema)
    const admin = createAdminClient()
    const { data: assignmentId, error } = await admin.rpc('create_assignment', {
      p_actor_id: actor.id,
      p_course_id: body.courseId,
      p_title: body.title,
      p_description: body.description ?? null,
      p_policy: body.policy,
    })
    if (error) throw error
    return jsonOk({ id: assignmentId, status: 'draft' }, 201)
  } catch (error) {
    return jsonError(error)
  }
}
