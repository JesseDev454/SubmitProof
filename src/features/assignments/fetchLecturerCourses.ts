import { createClient } from '@/lib/auth/client'

export interface CourseOption {
  id: string
  code: string
  title: string
}

/**
 * Fetches courses where lecturer_id = current user.
 * Returns empty array on any error — callers show a "No courses found" placeholder.
 */
export async function fetchLecturerCourses(): Promise<CourseOption[]> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from('courses')
      .select('id, code, title')
      .eq('lecturer_id', user.id)
      .order('code', { ascending: true })

    if (error || !data) return []

    return data.map(c => ({ id: String(c.id), code: String(c.code), title: String(c.title) }))
  } catch {
    return []
  }
}
