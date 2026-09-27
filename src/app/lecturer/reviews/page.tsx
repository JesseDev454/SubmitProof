import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/auth/server'

export default async function LecturerReviewsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: assignments, error: assignmentError } = await supabase.from('assignments').select('id, title').order('created_at', { ascending: false })
  if (assignmentError) throw assignmentError
  const assignmentRows = assignments ?? []
  const assignmentById = new Map(assignmentRows.map((assignment) => [assignment.id, assignment]))
  const assignmentIds = assignmentRows.map((assignment) => assignment.id)
  const { data: submissions, error: submissionsError } = assignmentIds.length
    ? await supabase.from('submissions').select('*').in('assignment_id', assignmentIds)
    : { data: [], error: null }
  if (submissionsError) throw submissionsError
  const submissionRows = submissions ?? []
  const submissionIds = submissionRows.map((submission) => submission.id)
  const studentIds = [...new Set(submissionRows.map((submission) => submission.student_id))]
  const [commitmentsResult, uploadsResult, reviewsResult, profilesResult] = submissionIds.length
    ? await Promise.all([
        supabase.from('commitments').select('submission_id, id, gateway_event_at').in('submission_id', submissionIds).order('created_at', { ascending: false }),
        supabase.from('submission_uploads').select('submission_id, id, verification_result, policy_result, uploaded_at').in('submission_id', submissionIds).order('finalized_at', { ascending: false }),
        supabase.from('submission_review_events').select('submission_id, decision, event_at, reason').in('submission_id', submissionIds).order('event_at', { ascending: false }),
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
  const rows = submissionRows.flatMap((submission) => {
    const commitments = (commitmentsResult.data ?? []).filter((commitment) => commitment.submission_id === submission.id)
    const latestUpload = (uploadsResult.data ?? []).find((upload) => upload.submission_id === submission.id)
    const latestReview = (reviewsResult.data ?? []).find((review) => review.submission_id === submission.id)
    if (commitments.length === 0 || latestReview?.decision === 'accepted') return []
    return [{ submission, commitments, upload: latestUpload, review: latestReview, profile: profileById.get(submission.student_id), assignment: assignmentById.get(submission.assignment_id) }]
  })

  return (
    <div className="space-y-6">
      <div><p className="text-sm text-gray-500">Lecturer review queue</p><h1 className="mt-1 text-3xl font-bold text-gray-900">Fallback reviews</h1><p className="mt-2 text-sm text-gray-600">Review recorded commitment and upload evidence. The policy result remains separate from your decision.</p></div>
      {rows.length === 0 ? <section className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center"><h2 className="text-lg font-semibold text-gray-800">Nothing needs review</h2><p className="mt-2 text-sm text-gray-500">Fallback submissions with recorded commitments will appear here until accepted.</p></section> : <div className="space-y-3">{rows.map(({ submission, commitments, upload, review, profile, assignment }) => <article key={submission.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{assignment?.title ?? 'Assignment'}</p><h2 className="mt-1 font-semibold text-gray-900">{profile?.full_name || profile?.email || 'Student'}</h2><p className="mt-1 text-xs text-gray-500">{commitments.length} recorded commitment{commitments.length === 1 ? '' : 's'}{commitments[0]?.gateway_event_at ? ` · gateway time ${new Date(commitments[0].gateway_event_at).toLocaleString()}` : ''}</p></div><Link href={`/lecturer/assignments/${submission.assignment_id}/submissions/${submission.id}`} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Review evidence</Link></div><dl className="mt-4 grid gap-3 border-t border-gray-100 pt-4 text-sm sm:grid-cols-3"><div><dt className="text-xs text-gray-500">Workflow</dt><dd className="mt-1 capitalize">{submission.workflow_status.replaceAll('_', ' ')}</dd></div><div><dt className="text-xs text-gray-500">File verification</dt><dd className="mt-1 capitalize">{upload?.verification_result ?? 'not applicable'}</dd></div><div><dt className="text-xs text-gray-500">Fallback policy result</dt><dd className="mt-1 capitalize">{upload?.policy_result ?? 'pending upload'}</dd></div></dl>{review && <p className="mt-3 text-xs text-amber-800">Latest decision: flagged{review.reason ? ` — ${review.reason}` : ''}</p>}</article>)}</div>}
    </div>
  )
}
