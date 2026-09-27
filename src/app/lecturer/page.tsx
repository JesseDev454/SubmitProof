import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/auth/server'

export default async function LecturerDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: assignments, error: assignmentError }, { data: profile, error: profileError }] = await Promise.all([
    supabase.from('assignments').select('id, title, status, course_id, current_policy_version_id, created_at').order('created_at', { ascending: false }),
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
  ])
  if (assignmentError) throw assignmentError
  if (profileError) throw profileError
  const rows = assignments ?? []
  const ids = rows.map((assignment) => assignment.id)
  const policyIds = rows.flatMap((assignment) => assignment.current_policy_version_id ? [assignment.current_policy_version_id] : [])
  const [submissionResult, commitmentResult, uploadResult, policyResult, auditResult] = await Promise.all([
    ids.length ? supabase.from('submissions').select('id, assignment_id').in('assignment_id', ids) : Promise.resolve({ data: [], error: null }),
    ids.length ? supabase.from('commitments').select('id, assignment_id').in('assignment_id', ids) : Promise.resolve({ data: [], error: null }),
    ids.length ? supabase.from('submission_uploads').select('id, assignment_id, verification_result, policy_result').in('assignment_id', ids) : Promise.resolve({ data: [], error: null }),
    policyIds.length ? supabase.from('assignment_policy_versions').select('id, deadline_at').in('id', policyIds) : Promise.resolve({ data: [], error: null }),
    ids.length ? supabase.from('audit_events').select('id, event_type, event_at, assignment_id').in('assignment_id', ids).order('event_at', { ascending: false }).limit(6) : Promise.resolve({ data: [], error: null }),
  ])
  for (const result of [submissionResult, commitmentResult, uploadResult, policyResult, auditResult]) {
    if (result.error) throw result.error
  }
  const submissions = submissionResult.data ?? []
  const commitments = commitmentResult.data ?? []
  const uploads = uploadResult.data ?? []
  const policyById = new Map((policyResult.data ?? []).map((policy) => [policy.id, policy]))
  const assignmentById = new Map(rows.map((assignment) => [assignment.id, assignment]))
  const publishedCount = rows.filter((assignment) => assignment.status === 'published').length
  const nonqualifying = uploads.filter((upload) => upload.policy_result === 'does_not_qualify').length
  const matched = uploads.filter((upload) => upload.verification_result === 'match').length

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">Lecturer workspace</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-900">Welcome{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}</h1>
          <p className="mt-2 text-sm text-gray-600">Review assignment evidence and the policy results recorded by SubmitProof.</p>
        </div>
        <Link href="/lecturer/assignments/new" className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Create assignment</Link>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Assignments', rows.length, `${publishedCount} published`],
          ['Evidence records', submissions.length, `${commitments.length} commitments`],
          ['Verified file matches', matched, 'Hash verification result'],
          ['Nonqualifying evidence', nonqualifying, 'Saved policy result'],
        ].map(([label, value, detail]) => (
          <article key={label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">{label}</p><p className="mt-2 text-3xl font-bold text-gray-900">{value}</p><p className="mt-1 text-xs text-gray-500">{detail}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4"><div><h2 className="font-semibold text-gray-900">Recent assignments</h2><p className="mt-1 text-xs text-gray-500">Status and deadline from saved assignment policy versions.</p></div><Link href="/lecturer/assignments" className="text-sm font-semibold text-blue-700">View all</Link></div>
          {rows.length === 0 ? <p className="px-5 py-12 text-center text-sm text-gray-500">No assignments yet. Create a draft to get started.</p> : <ul className="divide-y divide-gray-100">{rows.slice(0, 6).map((assignment) => {
            const policy = assignment.current_policy_version_id ? policyById.get(assignment.current_policy_version_id) : null
            return <li key={assignment.id}><Link href={`/lecturer/assignments/${assignment.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-gray-50"><div><p className="font-medium text-gray-900">{assignment.title}</p><p className="mt-1 text-xs text-gray-500">Deadline {policy ? new Date(policy.deadline_at).toLocaleString() : 'not configured'}</p></div><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold capitalize text-gray-700">{assignment.status}</span></Link></li>
          })}</ul>}
        </div>
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4"><h2 className="font-semibold text-gray-900">Evidence activity</h2><p className="mt-1 text-xs text-gray-500">Recorded audit events, newest first.</p></div>
          {(auditResult.data ?? []).length === 0 ? <p className="px-5 py-12 text-center text-sm text-gray-500">Activity will appear when assignments and evidence change.</p> : <ul className="divide-y divide-gray-100">{(auditResult.data ?? []).map((event) => <li key={event.id} className="px-5 py-4"><Link href={event.assignment_id ? `/lecturer/assignments/${event.assignment_id}` : '/lecturer/assignments'} className="font-medium text-gray-800 hover:text-blue-700">{event.event_type.replaceAll('.', ' ')}</Link><p className="mt-1 text-xs text-gray-500">{assignmentById.get(event.assignment_id ?? '')?.title ?? 'Assignment'} · {new Date(event.event_at).toLocaleString()}</p></li>)}</ul>}
        </div>
      </section>
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">SubmitProof reports file verification and fallback policy qualification as separate results. Institutional lateness decisions remain with the lecturer.</div>
    </div>
  )
}
