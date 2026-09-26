import Link from 'next/link'
import { notFound } from 'next/navigation'

import { loadStudentAssignment } from '@/lib/student/data'

function display(value: string | null | undefined) {
  return value ? value.replaceAll('_', ' ') : 'Not recorded'
}

function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(bytes % (1024 * 1024) ? 1 : 0)} MB` : `${Math.ceil(bytes / 1024)} KB`
}

function formatMimeTypes(types: string[]) {
  return types.map((type) => ({
    'application/pdf': 'PDF',
    'image/png': 'PNG',
    'image/jpeg': 'JPEG',
    'text/plain': 'UTF-8 text',
  }[type] ?? type)).join(', ')
}

export default async function AssignmentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const assignment = await loadStudentAssignment(id)
  if (!assignment) notFound()

  const hasCommitment = assignment.commitment_count > 0
  const hasUpload = assignment.latest_upload !== null
  const canUpload = assignment.assignment_status === 'published' || (hasCommitment && !hasUpload)

  return <div className="mx-auto flex max-w-4xl flex-col gap-6">
    <Link href="/student/assignments" className="w-fit text-sm font-semibold text-blue-700 hover:underline">← All assignments</Link>
    <header className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
      <p className="text-xs font-bold uppercase tracking-wide text-blue-700">{assignment.course_code} · {assignment.course_name}</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{assignment.title}</h1>
      {assignment.description && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">{assignment.description}</p>}
      <p className="mt-5 text-sm text-slate-600">Due {new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short' }).format(new Date(assignment.deadline_at))}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        {canUpload && <Link href={hasCommitment && !hasUpload ? `/student/assignments/${id}/resume` : `/student/assignments/${id}/submit`} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">
          {hasCommitment && !hasUpload ? 'Upload committed file' : 'Upload assignment'}
        </Link>}
        {assignment.assignment_status === 'published' && assignment.fallback_enabled && <Link href={`/student/assignments/${id}/submit`} className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100">Prepare fallback commitment</Link>}
        {assignment.submission_id && <Link href={`/student/assignments/${id}/receipt`} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">View receipt</Link>}
      </div>
      {assignment.assignment_status === 'closed' && !hasCommitment && <p className="mt-4 text-sm text-slate-500">This assignment is closed and is no longer accepting new submissions.</p>}
    </header>

    <section aria-labelledby="policy-heading" className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <h2 id="policy-heading" className="text-lg font-bold text-slate-900">Submission policy</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div><dt className="text-xs font-semibold uppercase text-slate-500">Accepted files</dt><dd className="mt-1 text-sm text-slate-800">{formatMimeTypes(assignment.allowed_file_types)}</dd></div>
        <div><dt className="text-xs font-semibold uppercase text-slate-500">Maximum size</dt><dd className="mt-1 text-sm text-slate-800">{formatBytes(assignment.max_file_size_bytes)}</dd></div>
        <div><dt className="text-xs font-semibold uppercase text-slate-500">Fallback commitment</dt><dd className="mt-1 text-sm text-slate-800">{assignment.fallback_enabled ? 'Available' : 'Not enabled'}</dd></div>
        <div><dt className="text-xs font-semibold uppercase text-slate-500">Grace period</dt><dd className="mt-1 text-sm text-slate-800">{assignment.grace_period_minutes ? `${assignment.grace_period_minutes} minutes after the deadline` : 'No grace period'}</dd></div>
      </dl>
    </section>

    {assignment.submission_id && <section aria-labelledby="evidence-heading" className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <h2 id="evidence-heading" className="text-lg font-bold text-slate-900">Recorded evidence</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-3">
        <div><dt className="text-xs font-semibold uppercase text-slate-500">Workflow</dt><dd className="mt-1 capitalize text-sm text-slate-800">{display(assignment.workflow_status)}</dd></div>
        <div><dt className="text-xs font-semibold uppercase text-slate-500">Verification</dt><dd className="mt-1 capitalize text-sm text-slate-800">{display(assignment.latest_upload?.verification_result)}</dd></div>
        <div><dt className="text-xs font-semibold uppercase text-slate-500">Policy result</dt><dd className="mt-1 capitalize text-sm text-slate-800">{display(assignment.latest_upload?.policy_result)}</dd></div>
      </dl>
      {hasCommitment && <p className="mt-4 text-sm text-slate-600">{assignment.commitment_count} fallback commitment{assignment.commitment_count === 1 ? '' : 's'} recorded{assignment.latest_commitment_provider === 'simulated' ? ' through the local/test simulator' : ''}.</p>}
    </section>}
  </div>
}
