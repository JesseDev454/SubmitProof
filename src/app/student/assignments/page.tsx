import Link from 'next/link'

import { loadStudentAssignments } from '@/lib/student/data'

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function ResultLabel({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  const text = value.replaceAll('_', ' ')
  return <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs capitalize text-slate-600">{label}: {text}</span>
}

export default async function AssignmentsPage() {
  const assignments = await loadStudentAssignments()
  const active = assignments.filter((assignment) => assignment.assignment_status === 'published')
  const past = assignments.filter((assignment) => !active.includes(assignment))

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Assignments</h1>
        <p className="mt-1 text-sm text-slate-500">Coursework published to your enrolled courses.</p>
      </header>

      {assignments.length === 0 ? (
        <section aria-label="No assignments" className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="font-semibold text-slate-900">No assignments available</h2>
          <p className="mt-2 text-sm text-slate-500">Published assignments for your enrolled courses will appear here.</p>
        </section>
      ) : (
        <>
          <section aria-labelledby="active-heading" className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-4">
              <h2 id="active-heading" className="font-bold text-slate-900">Upcoming assignments <span className="ml-1 text-sm font-medium text-slate-500">{active.length}</span></h2>
            </div>
            {active.length ? <ul className="divide-y divide-slate-100">
              {active.map((assignment) => <li key={assignment.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{assignment.course_code} · {assignment.course_name}</p>
                  <h3 className="mt-1 truncate font-bold text-slate-900">{assignment.title}</h3>
                  {assignment.description && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{assignment.description}</p>}
                  <p className="mt-2 text-sm text-slate-600">Due {formatDate(assignment.deadline_at)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {assignment.workflow_status && <ResultLabel label="Workflow" value={assignment.workflow_status} />}
                    <ResultLabel label="Verification" value={assignment.latest_upload?.verification_result ?? null} />
                    <ResultLabel label="Policy" value={assignment.latest_upload?.policy_result ?? null} />
                  </div>
                </div>
                <Link href={`/student/assignments/${assignment.id}`} className="shrink-0 rounded-xl bg-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-blue-700">View assignment</Link>
              </li>)}
            </ul> : <p className="px-6 py-8 text-sm text-slate-500">You are all caught up on upcoming work.</p>}
          </section>

          {past.length > 0 && <section aria-labelledby="past-heading" className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-4">
              <h2 id="past-heading" className="font-bold text-slate-900">Past and closed assignments <span className="ml-1 text-sm font-medium text-slate-500">{past.length}</span></h2>
            </div>
            <ul className="divide-y divide-slate-100">
              {past.map((assignment) => <li key={assignment.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{assignment.course_code} · {assignment.course_name}</p>
                  <h3 className="mt-1 truncate font-bold text-slate-900">{assignment.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{assignment.assignment_status === 'closed' ? 'Closed' : `Due ${formatDate(assignment.deadline_at)}`}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {assignment.workflow_status && <ResultLabel label="Workflow" value={assignment.workflow_status} />}
                    <ResultLabel label="Verification" value={assignment.latest_upload?.verification_result ?? null} />
                    <ResultLabel label="Policy" value={assignment.latest_upload?.policy_result ?? null} />
                  </div>
                </div>
                <Link href={`/student/assignments/${assignment.id}`} className="shrink-0 rounded-xl border border-slate-200 px-4 py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50">View evidence</Link>
              </li>)}
            </ul>
          </section>}
        </>
      )}
    </div>
  )
}
