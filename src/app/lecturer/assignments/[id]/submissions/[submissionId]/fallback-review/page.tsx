import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/auth/server'
import { evaluateFallbackPolicy } from '@/features/assignments/evaluateFallbackPolicy'
import FallbackReviewActions from '@/components/lecturer/FallbackReviewActions'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fileSizeLabel(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} bytes`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function graceDaysLabel(minutes: number | null): string {
  if (!minutes || minutes === 0) return 'No grace period'
  const days = Math.round(minutes / (60 * 24))
  return `${days} day${days === 1 ? '' : 's'} after deadline`
}

function graceEndIso(deadlineIso: string | null, minutes: number | null): string | null {
  if (!deadlineIso || !minutes) return null
  return new Date(new Date(deadlineIso).getTime() + minutes * 60 * 1000).toISOString()
}

// ---------------------------------------------------------------------------
// Check row component
// ---------------------------------------------------------------------------

function CheckRow({
  passes,
  label,
  description,
  value,
  passLabel,
  failLabel,
}: {
  passes: boolean
  label: string
  description: string
  value: string
  passLabel: string
  failLabel: string
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-4">
      {/* Icon */}
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${passes ? 'bg-green-50' : 'bg-red-50'}`}>
        {passes ? (
          <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ) : (
          <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </div>
      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        <p className="text-xs text-gray-400">{description}</p>
      </div>
      {/* Result badge + value */}
      <div className="shrink-0 text-right space-y-1">
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${passes ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            {passes
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            }
          </svg>
          {passes ? passLabel : failLabel}
        </span>
        <p className="text-[11px] text-gray-500">{value}</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Key info row
// ---------------------------------------------------------------------------

function KIRow({ icon, label, value, badge }: { icon: React.ReactNode; label: string; value: string; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
      <span className="text-gray-400">{icon}</span>
      <span className="w-36 shrink-0 text-xs text-gray-500">{label}</span>
      <span className="flex-1 text-xs font-medium text-gray-800">{value}</span>
      {badge && <span className="shrink-0">{badge}</span>}
    </div>
  )
}

function RelativeBadge({ iso, deadlineIso }: { iso: string | null; deadlineIso: string | null }) {
  if (!iso || !deadlineIso) return null
  const diffMs = new Date(iso).getTime() - new Date(deadlineIso).getTime()
  const absDays = Math.round(Math.abs(diffMs) / (1000 * 60 * 60 * 24))
  if (absDays === 0) return null
  const isBefore = diffMs < 0
  const label = `${absDays} day${absDays === 1 ? '' : 's'} ${isBefore ? 'before' : 'after'} deadline`
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${isBefore ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function FallbackReviewPage({
  params,
}: {
  params: Promise<{ id: string; submissionId: string }>
}) {
  const { id: assignmentId, submissionId } = await params
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const lecturerId = session.user.id

  // ── Types ─────────────────────────────────────────────────────────────────

  interface Sub {
    id: string
    assignment_id: string
    student_id: string
    submission_method: string | null
    status: string | null
    verification_result: string | null
    created_at: string | null
    uploaded_at: string | null
    file_name: string | null
    file_type: string | null
    file_size_bytes: number | null
    uploaded_file_hash: string | null
    student: { full_name: string | null; email: string | null; student_id: string | null } | null
    assignment: {
      id: string
      title: string
      description: string | null
      deadline_at: string | null
      grace_period_minutes: number | null
      fallback_enabled: boolean
      created_by: string
      course: { code: string; title: string } | null
    } | null
  }

  interface Commitment {
    id: string
    commitment_id: string | null
    file_hash: string | null
    created_at: string | null
    status: string | null
  }

  // ── Fetch submission ───────────────────────────────────────────────────────

  let sub: Sub | null = null

  try {
    const { data } = await supabase
      .from('submissions')
      .select('id, assignment_id, student_id, submission_method, status, verification_result, created_at, uploaded_at, file_name, file_type, file_size_bytes, uploaded_file_hash, student:profiles!student_id(full_name, email, student_id), assignment:assignments(id, title, description, deadline_at, grace_period_minutes, fallback_enabled, created_by, course:courses(code, title))')
      .eq('id', submissionId)
      .single()

    if (data) {
      const d = data as Record<string, unknown>
      const sRaw = Array.isArray(d.student) ? d.student[0] : d.student
      const s = sRaw as Record<string, unknown> | null
      const aRaw = Array.isArray(d.assignment) ? d.assignment[0] : d.assignment
      const a = aRaw as Record<string, unknown> | null
      let course: { code: string; title: string } | null = null
      if (a) {
        const cRaw = Array.isArray(a.course) ? (a.course as unknown[])[0] : a.course
        const c = cRaw as Record<string, unknown> | null
        course = c ? { code: String(c.code ?? ''), title: String(c.title ?? '') } : null
      }
      sub = {
        id: String(d.id ?? ''),
        assignment_id: String(d.assignment_id ?? ''),
        student_id: String(d.student_id ?? ''),
        submission_method: d.submission_method as string | null,
        status: d.status as string | null,
        verification_result: d.verification_result as string | null,
        created_at: d.created_at as string | null,
        uploaded_at: d.uploaded_at as string | null,
        file_name: d.file_name as string | null,
        file_type: d.file_type as string | null,
        file_size_bytes: d.file_size_bytes as number | null,
        uploaded_file_hash: d.uploaded_file_hash as string | null,
        student: s ? { full_name: s.full_name as string | null, email: s.email as string | null, student_id: s.student_id as string | null } : null,
        assignment: a ? {
          id: String(a.id ?? ''),
          title: String(a.title ?? ''),
          description: a.description as string | null,
          deadline_at: a.deadline_at as string | null,
          grace_period_minutes: a.grace_period_minutes as number | null,
          fallback_enabled: Boolean(a.fallback_enabled),
          created_by: String(a.created_by ?? ''),
          course,
        } : null,
      }
    }
  } catch { /* submissions table may not exist */ }

  // Ownership check
  const owned = sub?.assignment?.created_by === lecturerId && sub?.assignment_id === assignmentId

  if (!sub || !owned) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <svg className="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 className="text-lg font-semibold text-gray-700">Submission not found</h2>
        <p className="text-sm text-gray-400">This submission doesn&apos;t exist or you don&apos;t have access.</p>
        <Link href={`/lecturer/assignments/${assignmentId}`} className="text-sm font-medium text-blue-600 hover:underline">
          ← Back to Assignments
        </Link>
      </div>
    )
  }

  // ── Commitment ────────────────────────────────────────────────────────────
  let commitment: Commitment | null = null
  try {
    const { data } = await supabase
      .from('commitments')
      .select('id, commitment_id, file_hash, created_at, status')
      .eq('assignment_id', assignmentId)
      .eq('student_id', sub.student_id)
      .single()
    if (data) commitment = data
  } catch { /* commitments table may not exist */ }

  // No commitment → this page makes no sense
  if (!commitment) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <svg className="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        <h2 className="text-lg font-semibold text-gray-700">No fallback commitment to review</h2>
        <p className="text-sm text-gray-400 max-w-xs">
          This submission has no associated SMS commitment, so there is no fallback review to perform.
        </p>
        <Link
          href={`/lecturer/assignments/${assignmentId}/submissions/${submissionId}`}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          ← Back to Submission Details
        </Link>
      </div>
    )
  }

  // ── Policy evaluation ─────────────────────────────────────────────────────
  const policy = evaluateFallbackPolicy({
    deadline_at: sub.assignment?.deadline_at ?? null,
    grace_period_minutes: sub.assignment?.grace_period_minutes ?? null,
    commitment_received_at: commitment.created_at,
    commitment_file_hash: commitment.file_hash,
    uploaded_file_hash: sub.uploaded_file_hash,
    uploaded_at: sub.uploaded_at ?? sub.created_at,
  })

  // ── Derived values ────────────────────────────────────────────────────────
  const studentName = sub.student?.full_name ?? 'Unknown Student'
  // TODO: no confirmed student-facing display ID in schema — truncated user id fallback
  const graceEnd = graceEndIso(sub.assignment?.deadline_at ?? null, sub.assignment?.grace_period_minutes ?? null)

  const assignment = sub.assignment!
  const courseCode = assignment.course?.code ?? '??'
  const courseCodeShort = courseCode.replace(/[^A-Z]/g, '').slice(0, 2) || courseCode.slice(0, 2).toUpperCase()

  const BADGE_COLORS: Record<string, string> = {
    CS: 'bg-blue-100 text-blue-700',
    EN: 'bg-green-100 text-green-700',
    MA: 'bg-purple-100 text-purple-700',
    BI: 'bg-amber-100 text-amber-700',
    DS: 'bg-pink-100 text-pink-700',
  }
  const badgeColor = BADGE_COLORS[courseCodeShort] ?? 'bg-gray-100 text-gray-700'

  return (
    <div className="space-y-5">
      {/* Back link — TODO: a dedicated fallback-reviews filtered list could be built later */}
      <Link
        href={`/lecturer/assignments/${assignmentId}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Fallback Reviews
      </Link>

      {/* Heading */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Fallback Review</h1>
        <p className="mt-1 text-sm text-gray-500">Review the submission and verify it meets the fallback policy.</p>
      </div>

      {/* Assignment identity strip */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex items-center gap-4 min-w-0">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${badgeColor}`}>
            {courseCodeShort}
          </span>
          <div className="min-w-0">
            <p className="text-xs text-gray-400 truncate">
              {courseCode} – {assignment.course?.title?.toUpperCase() ?? ''}
            </p>
            <p className="text-lg font-bold text-gray-900 truncate">{assignment.title}</p>
            {assignment.description && (
              <p className="text-xs text-gray-400 truncate">{assignment.description}</p>
            )}
          </div>
        </div>
        {assignment.fallback_enabled ? (
          <div className="shrink-0 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2">
            <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
            <span className="text-sm font-semibold text-green-800">Fallback Enabled</span>
          </div>
        ) : (
          <div className="shrink-0 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728M3 3l18 18" />
            </svg>
            <span className="text-sm font-semibold text-gray-500">Fallback Disabled</span>
          </div>
        )}
      </div>

      {/* Info row */}
      <div className="flex flex-wrap divide-x divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Student */}
        <div className="flex items-center gap-3 px-5 py-3 flex-1 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50">
            <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-gray-400">Student</p>
            <p className="text-sm font-semibold text-gray-900 truncate">{studentName}</p>
            <p className="text-[11px] text-gray-400 truncate">{sub.student?.email ?? '—'}</p>
          </div>
        </div>
        {/* Deadline */}
        <div className="flex items-center gap-3 px-5 py-3 flex-1 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50">
            <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-gray-400">Deadline</p>
            <p className="text-sm font-semibold text-gray-900">{fmtDate(assignment.deadline_at)}</p>
            <p className="text-[11px] text-gray-400">
              {assignment.deadline_at
                ? new Date(assignment.deadline_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + ' (Local time)'
                : '—'}
            </p>
          </div>
        </div>
        {/* Grace period */}
        <div className="flex items-center gap-3 px-5 py-3 flex-1 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50">
            <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-gray-400">Grace Period</p>
            <p className="text-sm font-semibold text-gray-900">{graceDaysLabel(assignment.grace_period_minutes)}</p>
            {graceEnd && <p className="text-[11px] text-gray-400">Until {fmtDate(graceEnd)}</p>}
          </div>
        </div>
        {/* Submission */}
        <div className="flex items-center gap-3 px-5 py-3 flex-1 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50">
            <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-gray-400">Submission</p>
            <p className="text-sm font-semibold text-gray-900">{fmtDate(sub.uploaded_at ?? sub.created_at)}</p>
            <p className="text-[11px] text-gray-400">
              {(sub.uploaded_at ?? sub.created_at)
                ? new Date(sub.uploaded_at ?? sub.created_at!).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + ' (Local time)'
                : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Main two-column */}
      <div className="flex gap-5 items-start">
        {/* LEFT */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* Fallback Verification Checks */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full ${policy.qualifies ? 'bg-green-500' : 'bg-red-500'}`}>
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  {policy.qualifies
                    ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    : <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  }
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Fallback Verification Checks</p>
                <p className="text-xs text-gray-400">
                  All required conditions must be met for the submission to qualify under the fallback policy.
                </p>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <CheckRow
                passes={policy.preDeadlineCommitment}
                label="Verified pre-deadline commitment"
                description="Student committed to a fallback before the deadline."
                value={policy.preDeadlineCommitmentValue}
                passLabel="Verified"
                failLabel="Not verified"
              />
              <CheckRow
                passes={policy.fileMatches}
                label="File matches"
                description="Uploaded file matches the committed file (exact hash match)."
                value={policy.fileMatchesValue}
                passLabel="Match"
                failLabel="Mismatch"
              />
              <CheckRow
                passes={policy.withinGracePeriod}
                label="Uploaded within allowed grace period"
                description={`Submission was uploaded after the deadline but within the ${graceDaysLabel(assignment.grace_period_minutes).toLowerCase()}.`}
                value={policy.withinGracePeriodValue}
                passLabel="Within grace period"
                failLabel="Outside grace period"
              />
            </div>
          </div>

          {/* Key Information */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
              <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-semibold text-gray-800">Key Information</p>
            </div>
            <div className="px-5 py-3">
              <KIRow
                icon={<svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                label="Deadline"
                value={fmt(assignment.deadline_at)}
              />
              <KIRow
                icon={<svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                label="Grace period ends"
                value={graceEnd ? fmt(graceEnd) : '—'}
              />
              <KIRow
                icon={<svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>}
                label="Commitment time"
                value={fmt(commitment.created_at)}
                badge={<RelativeBadge iso={commitment.created_at} deadlineIso={assignment.deadline_at} />}
              />
              <KIRow
                icon={<svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>}
                label="Upload time"
                value={fmt(sub.uploaded_at ?? sub.created_at)}
                badge={<RelativeBadge iso={sub.uploaded_at ?? sub.created_at} deadlineIso={assignment.deadline_at} />}
              />
              <KIRow
                icon={<svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                label="File name"
                value={sub.file_name ?? '—'}
              />
              <KIRow
                icon={<svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>}
                label="File size"
                value={fileSizeLabel(sub.file_size_bytes)}
              />
              <KIRow
                icon={<svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3" /></svg>}
                label="SHA-256 hash"
                value={sub.uploaded_file_hash ?? '—'}
              />
            </div>
          </div>
        </div>

        {/* RIGHT column */}
        <div className="w-64 shrink-0 space-y-4">

          {/* Assignment Fallback Policy */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
              <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-gray-800">Assignment Fallback Policy</p>
                <p className="text-[11px] text-gray-400">
                  This assignment has fallback {assignment.fallback_enabled ? 'enabled' : 'disabled'} with the following policy:
                </p>
              </div>
            </div>
            <div className="divide-y divide-gray-50 p-4 space-y-0">
              {[
                {
                  icon: <svg className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
                  label: 'Commitment deadline',
                  value: 'Before the assignment deadline',
                },
                {
                  icon: <svg className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
                  label: 'Grace period',
                  value: graceDaysLabel(assignment.grace_period_minutes),
                },
                {
                  icon: <svg className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
                  label: 'File requirement',
                  value: 'Must match the committed file (exact hash match)',
                },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-2 py-2.5">
                  <span className="mt-0.5 shrink-0">{item.icon}</span>
                  <div>
                    <p className="text-xs font-semibold text-gray-700">{item.label}</p>
                    <p className="text-[11px] text-gray-400">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Does This Submission Qualify? */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full ${policy.qualifies ? 'bg-green-500' : 'bg-red-500'}`}>
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  {policy.qualifies
                    ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    : <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  }
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-800">Does This Submission Qualify?</p>
            </div>
            <div className="p-4">
              {policy.qualifies ? (
                <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <p className="text-xs font-semibold text-green-800">Qualifies under fallback policy</p>
                    <p className="text-[11px] text-green-600">
                      This submission meets all required conditions and should be accepted for grading under the fallback policy.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <div>
                    <p className="text-xs font-semibold text-red-700">Does not qualify</p>
                    {policy.failureReason && (
                      <p className="text-[11px] text-red-500">{policy.failureReason}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Next Steps + Actions */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
              <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-sm font-semibold text-gray-800">Next Steps</p>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-gray-500">
                You can now accept this submission and proceed with grading, or view more details if needed.
              </p>
              <FallbackReviewActions submissionId={submissionId} qualifies={policy.qualifies} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
