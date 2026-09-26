import { redirect } from 'next/navigation'
import { createClient } from '@/lib/auth/server'
import ProfileSettingsForm from '@/components/shared/ProfileSettingsForm'

export default async function LecturerProfilePage() {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const lecturerId = session.user.id

  // ── Fetch lecturer profile ────────────────────────────────────────────────

  interface Profile {
    id: string
    full_name: string | null
    email: string | null
    phone: string | null
    student_id: string | null
    school_account_name: string | null
    school_account_connected: boolean | null
  }

  let profile: Profile | null = null

  try {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, student_id, school_account_name, school_account_connected')
      .eq('id', lecturerId)
      .single()

    if (data) {
      profile = data
    }
  } catch { /* profile table may not exist */ }

  // ── Graceful fallback ─────────────────────────────────────────────────────

  const fullName = profile?.full_name ?? session.user.email?.split('@')[0] ?? 'Lecturer'
  const email = profile?.email ?? session.user.email ?? 'unknown@example.com'
  const phone = profile?.phone ?? null
  const schoolAccountName = profile?.school_account_name ?? null
  const schoolAccountConnected = profile?.school_account_connected ?? false
  const displayId = profile?.student_id ?? null

  return (
    <ProfileSettingsForm
      userId={lecturerId}
      initialData={{
        fullName,
        email,
        phone,
        roleLabel: 'Lecturer',
        contextLabel: 'Department', // Lecturer context (would be specific department if available)
        displayId,
        schoolAccountName,
        schoolAccountConnected,
      }}
    />
  )
}
