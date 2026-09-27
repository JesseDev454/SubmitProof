import { redirect } from 'next/navigation'
import { createClient } from '@/lib/auth/server'
import LecturerSidebar from '@/components/lecturer/LecturerSidebar'
import LecturerHeader from '@/components/lecturer/LecturerHeader'

export default async function LecturerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, full_name, department')
    .eq('id', user.id)
    .maybeSingle()
  if (error || !profile) redirect('/login')
  if (profile.role !== 'lecturer') redirect('/student')
  const fullName = profile.full_name || user.email || 'Lecturer'
  const department = profile.department || ''

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
