import Link from 'next/link'

import { loadStudentAssignments, loadStudentProfile } from '@/lib/student/data'

function label(value: string | null) {
  return value ? value.replaceAll('_', ' ') : 'Not started'
}

export default async function StudentDashboardPage() {
  const [assignments, profile] = await Promise.all([loadStudentAssignments(), loadStudentProfile()])
  const upcoming = assignments.filter((assignment) =>
    assignment.assignment_status === 'published',
  )
  const awaitingUpload = assignments.filter((assignment) =>
    assignment.commitment_count > 0 && assignment.latest_upload === null,
  )
  const withUploads = assignments.filter((assignment) => assignment.latest_upload !== null)
  const verified = withUploads.filter((assignment) => assignment.latest_upload?.verification_result === 'match')
  const needsAttention = withUploads.filter((assignment) =>
    assignment.latest_upload?.verification_result === 'mismatch' ||
    assignment.latest_upload?.policy_result === 'does_not_qualify',
  )
  const recent = [...assignments]
    .filter((assignment) => assignment.submission_id)
    .sort((left, right) => Date.parse(right.latest_upload?.uploaded_at ?? '') - Date.parse(left.latest_upload?.uploaded_at ?? ''))
    .slice(0, 5)
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || 'Student'

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-blue-700">Student workspace</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">Welcome, {firstName}</h1>
          <p className="mt-2 text-sm text-slate-500">Your assignments and recorded submission evidence.</p>
        </div>
        <Link href="/student/assignments" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Browse assignments</Link>
      </header>

      <section aria-label="Submission overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Open assignments', upcoming.length, 'Assignments that are still published'],
          ['Awaiting file', awaitingUpload.length, 'Recorded fallback commitments without an upload'],
          ['Hash matches', verified.length, 'Uploads that match a recorded commitment'],
          ['Needs attention', needsAttention.length, 'Uploads that mismatch or do not qualify'],
        ].map(([title, count, detail]) => <article key={title} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{count}</p>
          <p className="mt-1 text-xs text-slate-500">{detail}</p>
        </article>)}
      </section>

      <section aria-labelledby="due-heading" className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 id="due-heading" className="font-bold text-slate-900">Open assignments</h2>
            <p className="mt-1 text-xs text-slate-500">Published assignments and policy results from the database.</p>
          </div>
          <Link href="/student/assignments" className="text-sm font-semibold text-blue-700 hover:underline">All assignments</Link>
        </div>
        {upcoming.length ? <ul className="divide-y divide-slate-100">
          {upcoming.slice(0, 5).map((assignment) => <li key={assignment.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{assignment.course_code} · {assignment.course_name}</p>
              <h3 className="mt-1 truncate font-bold text-slate-900">{assignment.title}</h3>
              <p className="mt-1 text-sm text-slate-600">Due {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(assignment.deadline_at))}</p>
              <p className="mt-2 text-xs capitalize text-slate-500">Workflow: {label(assignment.workflow_status)}</p>
              {assignment.latest_upload && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs capitalize">
                <span className="text-slate-600">Verification: {label(assignment.latest_upload.verification_result)}</span>
                <span className="text-slate-600">Policy: {label(assignment.latest_upload.policy_result)}</span>
              </div>}
            </div>
            <Link href={`/student/assignments/${assignment.id}`} className="shrink-0 rounded-xl border border-slate-200 px-4 py-2 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50">Open</Link>
          </li>)}
        </ul> : <p className="px-6 py-10 text-center text-sm text-slate-500">No upcoming assignments are published for your courses.</p>}
      </section>

      <section aria-labelledby="recent-heading" className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 id="recent-heading" className="font-bold text-slate-900">Recent submission records</h2>
        </div>
        {recent.length ? <ul className="divide-y divide-slate-100">
          {recent.map((assignment) => <li key={assignment.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="font-semibold text-slate-900">{assignment.title}</p>
              <p className="mt-1 text-xs capitalize text-slate-500">Workflow: {label(assignment.workflow_status)}</p>
              {assignment.latest_upload && <p className="mt-1 text-xs capitalize text-slate-500">Verification: {label(assignment.latest_upload.verification_result)} · Policy: {label(assignment.latest_upload.policy_result)}</p>}
            </div>
            <div className="flex gap-2">
              {assignment.commitment_count > 0 && !assignment.latest_upload && <Link href={`/student/assignments/${assignment.id}/resume`} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Upload file</Link>}
              <Link href={`/student/assignments/${assignment.id}/receipt`} className="rounded-lg px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">View receipt</Link>
            </div>
          </li>)}
        </ul> : <p className="px-6 py-10 text-center text-sm text-slate-500">Your submission records will appear here after evidence is recorded.</p>}
      </section>
    </div>
  )
}
