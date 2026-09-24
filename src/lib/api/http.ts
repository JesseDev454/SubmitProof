import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { createClient } from '@/lib/auth/server'
import type { Database } from '@/types/database.types'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export type Actor = {
  id: string
  role: Database['public']['Enums']['profile_role']
  phone_e164: string | null
}

export async function requireActor(
  request: NextRequest,
  allowedRoles?: Actor['role'][],
  mutation = false,
): Promise<{ actor: Actor; supabase: Awaited<ReturnType<typeof createClient>> }> {
  if (mutation) assertSameOrigin(request)

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new ApiError(401, 'unauthenticated', 'Sign in to continue.')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, phone_e164')
    .eq('id', user.id)
    .maybeSingle()
  if (profileError || !profile) throw new ApiError(401, 'profile_unavailable', 'Your account profile is unavailable.')
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    throw new ApiError(403, 'role_forbidden', 'Your account cannot perform this action.')
  }

  return { actor: profile, supabase }
}

function assertSameOrigin(request: NextRequest): void {
  const origin = request.headers.get('origin')
  if (!origin) return

  let requestOrigin: string
  try {
    requestOrigin = new URL(request.url).origin
  } catch {
    throw new ApiError(400, 'invalid_request_origin', 'The request origin is invalid.')
  }
  if (origin !== requestOrigin) {
    throw new ApiError(403, 'cross_origin_request', 'Cross-origin changes are not allowed.')
  }
}

export async function parseJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw new ApiError(400, 'invalid_json', 'Request body must be valid JSON.')
  }
  const result = schema.safeParse(body)
  if (!result.success) throw new ApiError(400, 'invalid_request_body', 'Request body is invalid.')
  return result.data
}

export function jsonOk(data: unknown, status = 200): Response {
  return Response.json({ data }, { status })
}

export function jsonError(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status })
  }
  if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
    const databaseError = error as { code: string; message: string }
    const mapped = databaseError.code === 'P0002'
      ? new ApiError(404, 'not_found', 'The requested resource was not found.')
      : databaseError.code === 'P0001' || databaseError.code === '23505'
        ? new ApiError(409, 'conflict', 'The request conflicts with the current state.')
        : databaseError.code === '42501'
          ? new ApiError(403, 'forbidden', 'Your account cannot perform this action.')
          : databaseError.code === '22023' || databaseError.code === '22P02'
            ? new ApiError(400, 'invalid_request', 'The request contains invalid values.')
            : null
    if (mapped) return jsonError(mapped)
  }
  return Response.json({ error: { code: 'internal_error', message: 'The request could not be completed.' } }, { status: 500 })
}

export function uuidSchema() {
  return z.string().uuid()
}
