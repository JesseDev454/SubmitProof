import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database.types'

export function createAdminClient(): SupabaseClient<Database> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase admin environment variables')
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export const adminClient = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    const client = createAdminClient()
    const value = Reflect.get(client, prop)
    if (typeof value === 'function') {
      return (value as (...args: unknown[]) => unknown).bind(client)
    }
    return value
  },
})

export const supabaseAdmin = adminClient
