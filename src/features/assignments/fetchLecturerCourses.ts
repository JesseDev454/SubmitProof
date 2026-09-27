import { createClient } from '@/lib/auth/client'

export interface CourseOption {
  id: string
  code: string
  title: string
}

/**
 * Fetches courses where lecturer_id = current user. Query errors bubble up so
 * the create-assignment form can distinguish a failed read from an empty list.
 */
export async function fetchLecturerCourses(): Promise<CourseOption[]> {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) return []

  const { data, error } = await supabase
    .from('courses')
    .select('id, code, title')
    .eq('lecturer_id', user.id)
    .order('code', { ascending: true })

  if (error) throw error
  if (!data) return []

  return data.map(c => ({ id: c.id, code: c.code, title: c.title }))
}
