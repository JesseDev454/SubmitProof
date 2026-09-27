import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import FallbackReviewActions from '@/components/lecturer/FallbackReviewActions'
import DownloadEvidenceButton from '@/components/shared/DownloadEvidenceButton'
import { createClient } from '@/lib/auth/server'

type Props = { params: Promise<{ id: string; submissionId: string }> }

function EvidenceResult({ label, value }: { label: string; value: string }) {
  const style = value === 'match' || value === 'qualifies' || value === 'accepted'
    ? 'bg-green-100 text-green-800'
    : value === 'mismatch' || value === 'does_not_qualify' || value === 'flagged'
      ? 'bg-amber-100 text-amber-800'
      : 'bg-gray-100 text-gray-700'
  return <div className="rounded-lg border border-gray-100 p-4"><p className="text-xs text-gray-500">{label}</p><span className={`mt-2 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${style}`}>{value.replaceAll('_', ' ')}</span></div>
}

export default async function LecturerSubmissionPage({ params }: Props) {
  const { id: assignmentId, submissionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: submission, error: submissionError } = await supabase.from('submissions').select('*').eq('id', submissionId).eq('assignment_id', assignmentId).maybeSingle()
  if (submissionError) throw submissionError
  if (!submission) notFound()

  const [assignmentResult, profileResult, commitmentsResult, uploadsResult, reviewsResult, auditResult] = await Promise.all([
    supabase.from('assignments').select('id, title, status, archived_at, current_policy_version_id').eq('id', assignmentId).maybeSingle(),
    supabase.from('profiles').select('full_name, email').eq('id', submission.student_id).maybeSingle(),
    supabase.from('commitments').select('*').eq('submission_id', submissionId).order('created_at', { ascending: false }),
    supabase.from('submission_uploads').select('*').eq('submission_id', submissionId).order('finalized_at', { ascending: false }),
    supabase.from('submission_review_events').select('*').eq('submission_id', submissionId).order('event_at', { ascending: false }),
    supabase.from('audit_events').select('*').eq('submission_id', submissionId).order('event_at', { ascending: true }),
  ])
  if (assignmentResult.error) throw assignmentResult.error
  if (profileResult.error) throw profileResult.error
  if (commitmentsResult.error) throw commitmentsResult.error
  if (uploadsResult.error) throw uploadsResult.error
  if (reviewsResult.error) throw reviewsResult.error
  if (auditResult.error) throw auditResult.error
  const assignment = assignmentResult.data
  if (!assignment) notFound()

  const uploads = uploadsResult.data ?? []
  const commitments = commitmentsResult.data ?? []
  const reviews = reviewsResult.data ?? []
  const latestUpload = uploads[0] ?? null
  const latestReview = reviews[0] ?? null
  const policyIds = [...new Set([
    ...commitments.map((commitment) => commitment.policy_version_id),
    ...uploads.flatMap((upload) => upload.policy_version_id ? [upload.policy_version_id] : []),
  ])]
  const { data: policies, error: policiesError } = policyIds.length
    ? await supabase.from('assignment_policy_versions').select('id, version_number, deadline_at, fallback_enabled, grace_period_minutes').in('id', policyIds)
    : { data: [], error: null }
  if (policiesError) throw policiesError
  const policyById = new Map((policies ?? []).map((policy) => [policy.id, policy]))

  return (
    <div className="space-y-6">
      <div><Link href={`/lecturer/assignments/${assignmentId}`} className="text-sm font-medium text-blue-700 hover:underline">← {assignment.title}</Link><p className="mt-4 text-xs font-semibold uppercase tracking-wide text-blue-700">Student submission</p><h1 className="mt-1 text-3xl font-bold text-gray-900">{profileResult.data?.full_name || 'Student'}</h1><p className="mt-1 text-sm text-gray-500">{profileResult.data?.email || 'Email unavailable'}</p></div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <EvidenceResult label="Submission workflow" value={submission.workflow_status} />
        <EvidenceResult label="Latest file verification" value={latestUpload?.verification_result ?? 'not_applicable'} />
        <EvidenceResult label="Latest fallback policy result" value={latestUpload?.policy_result ?? 'not_applicable'} />
        <EvidenceResult label="Latest lecturer decision" value={latestReview?.decision ?? 'not reviewed'} />
      </section>
      <p className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">File verification, fallback policy qualification, and the lecturer’s human decision are separate records.</p>

      {latestUpload && <FallbackReviewActions submissionId={submissionId} qualifies={latestUpload.policy_result === 'qualifies'} currentDecision={latestReview?.decision ?? null} />}

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900">Upload evidence</h2>
        {uploads.length === 0 ? <p className="mt-3 text-sm text-gray-500">No finalized upload has been recorded.</p> : <ol className="mt-4 space-y-3">{uploads.map((upload) => {
          const policy = upload.policy_version_id ? policyById.get(upload.policy_version_id) : null
          return <li key={upload.id} className="rounded-lg border border-gray-100 p-4"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-medium text-gray-900">Upload received {new Date(upload.uploaded_at).toLocaleString()}</p><p className="mt-1 text-xs text-gray-500">Finalized {new Date(upload.finalized_at).toLocaleString()} · Policy version {policy?.version_number ?? 'not recorded'}</p><p className="mt-2 break-all font-mono text-xs text-gray-500">SHA-256: {upload.server_sha256}</p></div><DownloadEvidenceButton uploadId={upload.id} /></div><div className="mt-3 flex flex-wrap gap-2"><EvidenceResult label="Verification" value={upload.verification_result} /><EvidenceResult label="Policy" value={upload.policy_result} /></div></li>
        })}</ol>}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900">Fallback commitments</h2>
        {commitments.length === 0 ? <p className="mt-3 text-sm text-gray-500">No fallback commitment was recorded.</p> : <ol className="mt-4 space-y-3">{commitments.map((commitment) => {
          const policy = policyById.get(commitment.policy_version_id)
          return <li key={commitment.id} className="rounded-lg border border-gray-100 p-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-medium text-gray-900">{commitment.provider === 'simulated' ? 'Simulated fallback evidence' : `${commitment.provider} commitment`}</p><span className="text-xs text-gray-500">Policy version {policy?.version_number ?? '—'}</span></div><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-gray-500">Gateway time</dt><dd>{commitment.gateway_event_at ? new Date(commitment.gateway_event_at).toLocaleString() : 'Unavailable; cannot establish a pre-deadline commitment'}</dd></div><div><dt className="text-xs text-gray-500">Webhook received</dt><dd>{new Date(commitment.webhook_received_at).toLocaleString()}</dd></div><div><dt className="text-xs text-gray-500">Processed</dt><dd>{new Date(commitment.processed_at).toLocaleString()}</dd></div><div><dt className="text-xs text-gray-500">Sender snapshot</dt><dd>{commitment.sender_phone_e164}</dd></div><div className="sm:col-span-2"><dt className="text-xs text-gray-500">Committed SHA-256</dt><dd className="break-all font-mono text-xs">{commitment.file_sha256}</dd></div></dl></li>
        })}</ol>}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900">Lecturer review history</h2>
        {reviews.length === 0 ? <p className="mt-3 text-sm text-gray-500">No lecturer decision has been recorded.</p> : <ol className="mt-3 space-y-2">{reviews.map((review) => <li key={review.id} className="rounded-lg bg-gray-50 p-3"><p className="text-sm font-semibold capitalize text-gray-800">{review.decision}{review.reason ? ` — ${review.reason}` : ''}</p><time className="mt-1 block text-xs text-gray-500">{new Date(review.event_at).toLocaleString()}</time></li>)}</ol>}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900">Audit trail</h2>
        {(auditResult.data ?? []).length === 0 ? <p className="mt-3 text-sm text-gray-500">No audit events are available for this submission.</p> : <ol className="mt-3 space-y-2">{(auditResult.data ?? []).map((event) => <li key={event.id} className="flex flex-wrap justify-between gap-2 border-b border-gray-100 py-2 text-sm"><span className="font-medium text-gray-800">{event.event_type.replaceAll('.', ' ')}</span><time className="text-xs text-gray-500">{new Date(event.event_at).toLocaleString()} · recorded {new Date(event.recorded_at).toLocaleString()}</time></li>)}</ol>}
      </section>
    </div>
  )
}
