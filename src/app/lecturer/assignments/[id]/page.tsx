import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import AssignmentLifecycleActions from '@/components/lecturer/AssignmentLifecycleActions'
import SubmissionsTable, { type SubmissionRow } from '@/components/lecturer/SubmissionsTable'
import { createClient } from '@/lib/auth/server'

type Props = { params: Promise<{ id: string }> }

export default async function LecturerAssignmentPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: assignment, error: assignmentError } = await supabase
    .from('assignments')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (assignmentError) throw assignmentError
  if (!assignment) notFound()

  const [policyResult, courseResult, submissionsResult, enrollmentResult] = await Promise.all([
    assignment.current_policy_version_id
      ? supabase.from('assignment_policy_versions').select('*').eq('id', assignment.current_policy_version_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from('courses').select('id, code, title').eq('id', assignment.course_id).maybeSingle(),
    supabase.from('submissions').select('*').eq('assignment_id', id).order('created_at', { ascending: false }),
    supabase.from('enrollments').select('id', { count: 'exact', head: true }).eq('course_id', assignment.course_id),
  ])
  if (policyResult.error) throw policyResult.error
  if (courseResult.error) throw courseResult.error
  if (submissionsResult.error) throw submissionsResult.error
  if (enrollmentResult.error) throw enrollmentResult.error
  const policy = policyResult.data
  const submissions = submissionsResult.data ?? []
  const submissionIds = submissions.map((submission) => submission.id)
  const studentIds = [...new Set(submissions.map((submission) => submission.student_id))]
  const [commitmentsResult, uploadsResult, reviewsResult, profilesResult] = submissionIds.length
    ? await Promise.all([
        supabase.from('commitments').select('*').in('submission_id', submissionIds).order('created_at', { ascending: false }),
        supabase.from('submission_uploads').select('*').in('submission_id', submissionIds).order('finalized_at', { ascending: false }),
        supabase.from('submission_review_events').select('*').in('submission_id', submissionIds).order('event_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name, email').in('id', studentIds),
      ])
    : [
        { data: [], error: null }, { data: [], error: null },
        { data: [], error: null }, { data: [], error: null },
      ]
  if (commitmentsResult.error) throw commitmentsResult.error
  if (uploadsResult.error) throw uploadsResult.error
  if (reviewsResult.error) throw reviewsResult.error
  if (profilesResult.error) throw profilesResult.error

  const profileById = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]))
  const rows: SubmissionRow[] = submissions.map((submission) => {
    const upload = (uploadsResult.data ?? []).find((item) => item.submission_id === submission.id)
    const review = (reviewsResult.data ?? []).find((item) => item.submission_id === submission.id)
    const profile = profileById.get(submission.student_id)
    return {
      id: submission.id,
      studentName: profile?.full_name ?? '',
      studentEmail: profile?.email ?? '',
      workflowStatus: submission.workflow_status,
      commitmentCount: (commitmentsResult.data ?? []).filter((item) => item.submission_id === submission.id).length,
      latestCommitmentAt: (commitmentsResult.data ?? []).find((item) => item.submission_id === submission.id)?.gateway_event_at ?? null,
      upload: upload ? {
        id: upload.id,
        verificationResult: upload.verification_result,
        policyResult: upload.policy_result,
        uploadedAt: upload.uploaded_at,
      } : null,
      reviewDecision: review?.decision ?? null,
    }
  })

  const qualifies = rows.filter((row) => row.upload?.policyResult === 'qualifies').length
  const matched = rows.filter((row) => row.upload?.verificationResult === 'match').length

  return (
    <div className="space-y-6">
      <Link href="/lecturer/assignments" className="text-sm font-medium text-blue-700 hover:underline">← Assignments</Link>
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{courseResult.data ? `${courseResult.data.code} · ${courseResult.data.title}` : 'Course'}</p>
            <h1 className="mt-1 text-3xl font-bold text-gray-900">{assignment.title}</h1>
            <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm text-gray-600">{assignment.description || 'No description provided.'}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${assignment.status === 'published' ? 'bg-green-100 text-green-800' : assignment.status === 'closed' ? 'bg-gray-100 text-gray-700' : 'bg-amber-100 text-amber-800'}`}>{assignment.archived_at ? 'archived' : assignment.status}</span>
        </div>
        <div className="mt-5 grid gap-3 border-t border-gray-100 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="text-xs text-gray-500">Deadline</p><p className="mt-1 text-sm font-medium text-gray-900">{policy ? new Date(policy.deadline_at).toLocaleString() : 'Not configured'}</p></div>
          <div><p className="text-xs text-gray-500">Connectivity fallback</p><p className="mt-1 text-sm font-medium text-gray-900">{policy?.fallback_enabled ? 'Enabled' : 'Disabled'}</p></div>
          <div><p className="text-xs text-gray-500">Grace period</p><p className="mt-1 text-sm font-medium text-gray-900">{policy?.grace_period_minutes ?? 0} minutes</p></div>
          <div><p className="text-xs text-gray-500">Policy version</p><p className="mt-1 text-sm font-medium text-gray-900">{policy?.version_number ?? '—'}</p></div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-5">
          {assignment.status === 'draft' && <Link href={`/lecturer/assignments/${id}/settings`} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700">Edit draft settings</Link>}
          <AssignmentLifecycleActions assignmentId={id} status={assignment.status} archived={Boolean(assignment.archived_at)} />
          {assignment.archived_at && <p className="text-sm text-gray-500">Archived {new Date(assignment.archived_at).toLocaleString()}</p>}
        </div>
        {assignment.status === 'closed' && !assignment.archived_at && <p className="mt-3 text-xs text-gray-500">Closing stops new commitments and submissions. Evidence already recorded remains available under its original policy.</p>}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs text-gray-500">Enrolled</p><p className="mt-1 text-2xl font-bold text-gray-900">{enrollmentResult.count ?? 0}</p></div>
        <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs text-gray-500">File matches</p><p className="mt-1 text-2xl font-bold text-gray-900">{matched}</p><p className="mt-1 text-xs text-gray-500">Verification result only</p></div>
        <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs text-gray-500">Qualifying evidence</p><p className="mt-1 text-2xl font-bold text-gray-900">{qualifies}</p><p className="mt-1 text-xs text-gray-500">According to each upload’s saved policy result</p></div>
      </section>

      <SubmissionsTable rows={rows} totalStudents={enrollmentResult.count ?? 0} assignmentId={id} />
    </div>
  )
}
