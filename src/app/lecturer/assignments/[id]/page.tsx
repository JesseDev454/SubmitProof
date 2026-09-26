import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/auth/server'
import SubmissionsTable, { type SubmissionRow } from '@/components/lecturer/SubmissionsTable'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function gracePeriodLabel(minutes: number | null): string {
  if (!minutes || minutes === 0) return 'No grace period'
  const days = Math.round(minutes / (60 * 24))
  return `${days} day${days === 1 ? '' : 's'} after deadline`
}

function gracePeriodDays(minutes: number | null): number {
  if (!minutes) return 0
  return Math.round(minutes / (60 * 24))
}

function fileSizeLabel(bytes: number | null): string {
  if (!bytes) return '—'
  const mb = bytes / (1024 * 1024)
  return `${Math.round(mb)} MB`
}

function initials(name: string): string {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  count, label, sublabel, accent, iconBg, icon,
}: {
  count: number
  label: string
  sublabel: string
  accent: string
  iconBg: string
  icon: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
          {icon}
        </div>
        <div>
          <p className={`text-xl font-bold ${accent}`}>{count}</p>
          <p className="text-xs font-medium text-gray-700">{label}</p>
          <p className="text-[11px] text-gray-400">{sublabel}</p>
        </div>
      </div>
      <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Info bar cell
// ---------------------------------------------------------------------------

function InfoCell({ label, value1, value2, icon }: {
  label: string
  value1: string
  value2?: string
  icon: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 flex-1 min-w-0">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-500">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-gray-400">{label}</p>
        <p className="text-sm font-semibold text-gray-900 truncate">{value1}</p>
        {value2 && <p className="text-[11px] text-gray-400 truncate">{value2}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: assignmentId } = await params
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const lecturerId = session.user.id

  // ── Fetch assignment ──────────────────────────────────────────────────────
  let assignment: {
    id: string
    title: string
    description: string | null
    status: string
    fallback_enabled: boolean
    deadline_at: string | null
    grace_period_minutes: number | null
    max_file_size_bytes: number | null
    allowed_file_types: string[] | null
    created_by: string
    course: { id: string; code: string; title: string } | null
  } | null = null

  try {
    const { data } = await supabase
      .from('assignments')
      .select('id, title, description, status, fallback_enabled, deadline_at, grace_period_minutes, max_file_size_bytes, allowed_file_types, created_by, course:courses(id, code, title)')
      .eq('id', assignmentId)
      .single()

    if (data) {
      const raw = Array.isArray(data.course) ? data.course[0] : data.course
      const c = raw as Record<string, unknown> | null
      assignment = {
        ...data,
        course: c ? { id: String(c.id ?? ''), code: String(c.code ?? ''), title: String(c.title ?? '') } : null,
      }
    }
  } catch { /* assignment table may not exist */ }

  // Ownership check
  if (!assignment || assignment.created_by !== lecturerId) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <svg className="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 className="text-lg font-semibold text-gray-700">Assignment not found</h2>
        <p className="text-sm text-gray-400">This assignment doesn&apos;t exist or you don&apos;t have access.</p>
        <Link href="/lecturer/assignments" className="text-sm font-medium text-blue-600 hover:underline">
          ← Back to Assignments
        </Link>
      </div>
    )
  }

  // ── Lecturer name ─────────────────────────────────────────────────────────
  let lecturerName = session.user.email ?? 'Lecturer'
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', lecturerId)
      .single()
    if (profile?.full_name) lecturerName = profile.full_name
  } catch { /* profile table may not exist */ }

  // ── Enrollment count ──────────────────────────────────────────────────────
  let enrolledCount = 0
  try {
    if (assignment.course?.id) {
      const { count } = await supabase
        .from('enrollments')
        .select('id', { count: 'exact', head: true })
        .eq('course_id', assignment.course.id)
      enrolledCount = count ?? 0
    }
  } catch { /* enrollments table may not exist */ }

  // ── Submissions + commitments ─────────────────────────────────────────────
  interface RawSub {
    id: string
    student_id: string
    submission_method: string | null
    status: string | null
    verification_result: string | null
    created_at: string | null
    profile: { full_name: string | null; student_id: string | null } | null
  }

  let rawSubs: RawSub[] = []
  try {
    const { data } = await supabase
      .from('submissions')
      .select('id, student_id, submission_method, status, verification_result, created_at, profile:profiles(full_name, student_id)')
      .eq('assignment_id', assignmentId)
      .order('created_at', { ascending: false })

    if (data) {
      rawSubs = data.map(s => {
        const pRaw = Array.isArray(s.profile) ? s.profile[0] : s.profile
        const p = pRaw as Record<string, unknown> | null
        return {
          ...s,
          profile: p ? { full_name: p.full_name as string | null, student_id: p.student_id as string | null } : null,
        }
      })
    }
  } catch { /* submissions table may not exist */ }

  // Commitments (keyed by student_id)
  interface RawCommitment {
    id: string
    student_id: string
    status: string | null
    created_at: string | null
  }
  const commitmentsByStudent = new Map<string, RawCommitment>()
  try {
    const { data } = await supabase
      .from('commitments')
      .select('id, student_id, status, created_at')
      .eq('assignment_id', assignmentId)
    if (data) {
      for (const c of data) {
        commitmentsByStudent.set(c.student_id, c)
      }
    }
  } catch { /* commitments table may not exist */ }

  // ── Compute deadline / grace period ──────────────────────────────────────
  const now = Date.now()
  const deadlineMs = assignment.deadline_at ? new Date(assignment.deadline_at).getTime() : null
  const gracePeriodMs = (assignment.grace_period_minutes ?? 0) * 60 * 1000
  const graceEndMs = deadlineMs ? deadlineMs + gracePeriodMs : null

  // ── Map submissions to display rows ──────────────────────────────────────
  function deriveStatus(sub: RawSub): SubmissionRow['status'] {
    const vr = (sub.verification_result ?? '').toLowerCase()
    if (vr.includes('mismatch') || vr.includes('fail')) return 'Mismatch'
    if (vr.includes('pass') || vr.includes('match')) return 'Fallback Verified'
    const st = (sub.status ?? '').toUpperCase()
    if (st === 'AWAITING_FULL_UPLOAD') return 'Awaiting Upload'
    const method = (sub.submission_method ?? '').toLowerCase()
    if (method === 'normal') return 'Submitted'
    return 'Committed'
  }

  function deriveMethod(sub: RawSub): string {
    const method = (sub.submission_method ?? '').toLowerCase()
    if (method === 'normal') return 'Online Upload'
    if (!deadlineMs || !sub.created_at) return 'Offline Fallback'
    const submittedMs = new Date(sub.created_at).getTime()
    if (submittedMs <= deadlineMs) return 'Fallback (Pre-deadline)'
    return 'Fallback (Grace Period)'
  }

  const submissionRows: SubmissionRow[] = rawSubs.map(sub => {
    const name = sub.profile?.full_name ?? 'Unknown Student'
    // TODO: no student-facing display ID field exists yet — using truncated user id as fallback
    const displayId = sub.profile?.student_id
      ? String(sub.profile.student_id)
      : `S${sub.student_id.replace(/-/g, '').slice(0, 7).toUpperCase()}`

    return {
      submissionId: sub.id,
      studentName: name,
      studentDisplayId: displayId,
      studentInitials: initials(name),
      submittedAt: sub.created_at,
      status: deriveStatus(sub),
      method: deriveMethod(sub),
      assignmentId,
    }
  })

  // Enrolled students who haven't submitted — mark as Committed or Expired
  // We only do this if we have commitment data; otherwise we can't enumerate non-submitters
  // (enumerating all enrolled students would require a separate query — add if needed)
  const submittedStudentIds = new Set(rawSubs.map(s => s.student_id))
  for (const [studentId, commitment] of commitmentsByStudent.entries()) {
    if (submittedStudentIds.has(studentId)) continue // already have a submission row

    const name = 'Student'
    // TODO: no student-facing display ID field — truncated
    const displayId = `S${studentId.replace(/-/g, '').slice(0, 7).toUpperCase()}`
    const isExpired = graceEndMs ? now > graceEndMs : false
    const cStatus = (commitment.status ?? '').toUpperCase()

    submissionRows.push({
      submissionId: null,
      studentName: name,
      studentDisplayId: displayId,
      studentInitials: initials(name),
      submittedAt: commitment.created_at,
      status: isExpired ? 'Expired' : cStatus === 'AWAITING_FULL_UPLOAD' ? 'Awaiting Upload' : 'Committed',
      method: 'Offline Fallback',
      assignmentId,
    })
  }

  // ── Compute stat counts ───────────────────────────────────────────────────
  let submittedNormally = 0
  let preDeadlineCommitments = 0
  let awaitingUpload = 0
  let fallbackVerified = 0
  let mismatches = 0
  let expired = 0

  for (const row of submissionRows) {
    switch (row.status) {
      case 'Submitted': submittedNormally++; break
      case 'Committed': preDeadlineCommitments++; break
      case 'Awaiting Upload': awaitingUpload++; break
      case 'Fallback Verified': fallbackVerified++; break
      case 'Mismatch': mismatches++; break
      case 'Expired': expired++; break
    }
  }

  // Fallback summary
  const totalFallbackCommitments = commitmentsByStudent.size
  const fallbackVerifiedCount = fallbackVerified
  const fallbackMismatches = mismatches
  const pendingVerification = awaitingUpload

  // ── Grace end date label ─────────────────────────────────────────────────
  const graceEndLabel = graceEndMs
    ? `Until ${new Date(graceEndMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : ''

  const isOpen = !['closed', 'inactive'].includes((assignment.status ?? '').toLowerCase())

  return (
    <div className="space-y-5">
      {/* Back link */}
      <Link
        href="/lecturer/assignments"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Assignments
      </Link>

      {/* Heading row */}
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          {assignment.course && (
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {assignment.course.code} – {assignment.course.title.toUpperCase()}
            </p>
          )}
          <h1 className="text-3xl font-bold text-gray-900">{assignment.title}</h1>
          {assignment.description && (
            <p className="mt-1.5 text-sm text-gray-500">{assignment.description}</p>
          )}
        </div>
        {/* Fallback badge */}
        {assignment.fallback_enabled ? (
          <div className="shrink-0 flex items-center gap-2.5 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
              <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-green-800">Fallback Enabled</p>
              <p className="text-xs text-green-600">Student submissions are protected.</p>
            </div>
          </div>
        ) : (
          <div className="shrink-0 flex items-center gap-2.5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M3 3l18 18" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600">Fallback Disabled</p>
              <p className="text-xs text-gray-400">Online submission required.</p>
            </div>
          </div>
        )}
      </div>

      {/* Info bar */}
      <div className="flex flex-wrap gap-0 divide-x divide-gray-100 rounded-xl border border-gray-200 bg-white px-2 py-3 shadow-sm">
        <div className="px-4 py-1">
          <InfoCell
            label="Course"
            value1={assignment.course?.code ?? '—'}
            value2={assignment.course?.title}
            icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
          />
        </div>
        <div className="px-4 py-1">
          <InfoCell
            label="Assigned By"
            value1={lecturerName}
            value2="Lecturer"
            icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
          />
        </div>
        <div className="px-4 py-1">
          <InfoCell
            label="Due Date"
            value1={assignment.deadline_at ? new Date(assignment.deadline_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
            value2={assignment.deadline_at ? new Date(assignment.deadline_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + ' (Local time)' : undefined}
            icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
          />
        </div>
        <div className="px-4 py-1">
          <InfoCell
            label="Grace Period"
            value1={gracePeriodLabel(assignment.grace_period_minutes)}
            value2={graceEndLabel}
            icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
        </div>
        <div className="px-4 py-1">
          <InfoCell
            label="Students"
            value1={String(enrolledCount)}
            value2="Enrolled"
            icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
          />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard count={submittedNormally} label="Submitted Normally" sublabel="On time via website" accent="text-green-600" iconBg="bg-green-50"
          icon={<svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard count={preDeadlineCommitments} label="Pre-deadline Commitments" sublabel="Will upload later" accent="text-blue-600" iconBg="bg-blue-50"
          icon={<svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>}
        />
        <StatCard count={awaitingUpload} label="Awaiting Full Upload" sublabel="Committed, not yet uploaded" accent="text-blue-600" iconBg="bg-sky-50"
          icon={<svg className="h-5 w-5 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard count={fallbackVerified} label="Verified Fallback Submissions" sublabel="Matched successfully" accent="text-green-600" iconBg="bg-green-50"
          icon={<svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard count={mismatches} label="Mismatches" sublabel="Need review" accent="text-amber-600" iconBg="bg-amber-50"
          icon={<svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
        />
        <StatCard count={expired} label="Expired" sublabel="No submission" accent="text-red-600" iconBg="bg-red-50"
          icon={<svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>}
        />
      </div>

      {/* Main: table + right column */}
      <div className="flex gap-5 items-start">
        {/* Table */}
        <div className="flex-1 min-w-0">
          <SubmissionsTable rows={submissionRows} totalStudents={enrolledCount} />
        </div>

        {/* Right column */}
        <div className="w-64 shrink-0 space-y-4">
          {/* Assignment Policy */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-sm font-semibold text-gray-800">Assignment Policy</p>
              </div>
              <Link
                href={`/lecturer/assignments/${assignmentId}/settings`}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </Link>
            </div>
            <div className="divide-y divide-gray-50 px-4 py-1">
              {[
                { label: 'File Types', value: (assignment.allowed_file_types ?? []).join(', ') || '—' },
                { label: 'Max File Size', value: fileSizeLabel(assignment.max_file_size_bytes) },
                { label: 'Grace Period', value: gracePeriodLabel(assignment.grace_period_minutes) },
                {
                  label: 'Fallback',
                  value: assignment.fallback_enabled ? 'Enabled' : 'Disabled',
                  valueClass: assignment.fallback_enabled ? 'text-green-600' : 'text-gray-500',
                },
                { label: 'Late Submissions', value: gracePeriodDays(assignment.grace_period_minutes) > 0 ? 'Accepted via verified fallback' : 'Not accepted' },
                {
                  label: 'Assessment',
                  value: 'Manual review (with fallback match)',
                  // TODO: no assessment-mode field in the schema yet — this is static copy
                  // until a configurable assessment type is added to the assignments table
                },
              ].map(row => (
                <div key={row.label} className="flex items-baseline justify-between gap-2 py-2">
                  <span className="text-[11px] text-gray-400 shrink-0">{row.label}</span>
                  <span className={`text-[11px] font-medium text-right ${(row as { valueClass?: string }).valueClass ?? 'text-gray-700'}`}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Fallback Summary */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
              <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
              <p className="text-sm font-semibold text-gray-800">Fallback Summary</p>
            </div>
            <div className="space-y-2 p-4">
              {[
                {
                  count: totalFallbackCommitments,
                  label: 'Total Fallback Commitments',
                  sublabel: `${preDeadlineCommitments} before deadline, ${totalFallbackCommitments - preDeadlineCommitments} during grace period`,
                  color: 'bg-blue-500',
                },
                {
                  count: fallbackVerifiedCount,
                  label: 'Verified and Matched',
                  sublabel: 'Student work recovered successfully',
                  color: 'bg-green-500',
                },
                {
                  count: fallbackMismatches,
                  label: 'Mismatch Detected',
                  sublabel: 'Content differs from final submission',
                  color: 'bg-red-500',
                },
                {
                  count: pendingVerification,
                  label: 'Pending Verification',
                  sublabel: 'All fallback submissions processed',
                  color: 'bg-gray-400',
                },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-3">
                  <span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${item.color}`}>
                    {item.count}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">{item.label}</p>
                    <p className="text-[11px] text-gray-400">{item.sublabel}</p>
                  </div>
                </div>
              ))}
            </div>
            {/* TODO: no detailed fallback report screen exists yet */}
            <div className="border-t border-gray-100 px-4 py-3">
              <Link href="#" className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                View detailed fallback report
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Need Help */}
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <p className="text-sm font-semibold text-amber-800">Need Help?</p>
            </div>
            <p className="text-xs text-amber-700 leading-relaxed mb-3">
              Learn more about managing assignments, fallback matching, and troubleshooting.
            </p>
            <Link href="#" className="flex items-center gap-1 text-xs font-medium text-amber-700 hover:underline">
              View Help Center
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
