import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/auth/server'

type Props = { searchParams: Promise<{ archived?: string }> }

export default async function LecturerAssignmentsPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const params = await searchParams
  const archivedView = params.archived === 'true'

  let query = supabase.from('assignments').select('*').order('created_at', { ascending: false })
  query = archivedView ? query.not('archived_at', 'is', null) : query.is('archived_at', null)
  const { data: assignments, error } = await query
  if (error) throw error

  const courseIds = [...new Set(assignments.map((assignment) => assignment.course_id))]
  const policyIds = assignments.flatMap((assignment) => assignment.current_policy_version_id ? [assignment.current_policy_version_id] : [])
  const [coursesResult, policiesResult] = await Promise.all([
    courseIds.length ? supabase.from('courses').select('id, code, title').in('id', courseIds) : Promise.resolve({ data: [], error: null }),
    policyIds.length ? supabase.from('assignment_policy_versions').select('*').in('id', policyIds) : Promise.resolve({ data: [], error: null }),
  ])
  if (coursesResult.error) throw coursesResult.error
  if (policiesResult.error) throw policiesResult.error
  const courseById = new Map((coursesResult.data ?? []).map((course) => [course.id, course]))
  const policyById = new Map((policiesResult.data ?? []).map((policy) => [policy.id, policy]))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">Coursework and evidence</p>
          <h1 className="text-3xl font-bold text-gray-900">Assignments</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/lecturer/assignments" className={`rounded-lg px-3 py-2 text-sm font-semibold ${!archivedView ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-700'}`}>Active</Link>
          <Link href="/lecturer/assignments?archived=true" className={`rounded-lg px-3 py-2 text-sm font-semibold ${archivedView ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-700'}`}>Archived</Link>
          <Link href="/lecturer/assignments/new" className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">Create assignment</Link>
        </div>
      </div>

      {assignments.length === 0 ? (
        <section className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
          <h2 className="text-lg font-semibold text-gray-800">{archivedView ? 'No archived assignments' : 'No assignments yet'}</h2>
          <p className="mt-2 text-sm text-gray-500">{archivedView ? 'Closed assignments you archive will appear here.' : 'Create an assignment draft, configure its policy, and publish it for enrolled students.'}</p>
          {!archivedView && <Link href="/lecturer/assignments/new" className="mt-5 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Create assignment</Link>}
        </section>
      ) : (
        <div className="grid gap-4">
          {assignments.map((assignment) => {
            const policy = assignment.current_policy_version_id ? policyById.get(assignment.current_policy_version_id) : null
            const course = courseById.get(assignment.course_id)
            return (
              <Link key={assignment.id} href={`/lecturer/assignments/${assignment.id}`} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{course ? `${course.code} · ${course.title}` : 'Course'}</p>
                    <h2 className="mt-1 text-lg font-semibold text-gray-900">{assignment.title}</h2>
                    <p className="mt-2 max-w-3xl text-sm text-gray-600">{assignment.description || 'No description provided.'}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${assignment.status === 'published' ? 'bg-green-100 text-green-800' : assignment.status === 'closed' ? 'bg-gray-100 text-gray-700' : 'bg-amber-100 text-amber-800'}`}>
                    {assignment.archived_at ? 'Archived' : assignment.status}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-gray-100 pt-4 text-xs text-gray-500">
                  <span>Deadline: {policy ? new Date(policy.deadline_at).toLocaleString() : 'Not set'}</span>
                  <span>Fallback: {policy?.fallback_enabled ? 'Enabled' : 'Disabled'}</span>
                  <span>Policy version: {policy?.version_number ?? '—'}</span>
                  <span>{assignment.archived_at ? `Archived ${new Date(assignment.archived_at).toLocaleDateString()}` : `Created ${new Date(assignment.created_at).toLocaleDateString()}`}</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
