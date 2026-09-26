import { redirect } from 'next/navigation'
import { createClient } from '@/lib/auth/server'
import LecturerSidebar from '@/components/lecturer/LecturerSidebar'
import LecturerHeader from '@/components/lecturer/LecturerHeader'

export default async function LecturerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  // Fetch profile — redirect non-lecturers, fall back gracefully on error
  let fullName = session.user.email ?? 'Lecturer'
  let department = ''

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name, department')
      .eq('id', session.user.id)
      .single()

    if (profile?.role && profile.role !== 'lecturer') {
      redirect('/student')
    }

    if (profile?.full_name) fullName = profile.full_name
    if (profile?.department) department = profile.department
  } catch {
    // profile table may not exist yet — allow access in dev
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <LecturerSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <LecturerHeader displayName={fullName} subtitle={department} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
