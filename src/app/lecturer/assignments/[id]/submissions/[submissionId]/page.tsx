import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/auth/server'
import { formatAuditEvent } from '@/features/audit/formatAuditEvent'

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

function relativeToDeadline(iso: string | null, deadlineIso: string | null): string {
  if (!iso || !deadlineIso) return ''
  const diffMs = new Date(iso).getTime() - new Date(deadlineIso).getTime()
  const absDays = Math.round(Math.abs(diffMs) / (1000 * 60 * 60 * 24))
  if (absDays === 0) return 'On the deadline'
  if (diffMs < 0) return `${absDays} day${absDays === 1 ? '' : 's'} before deadline`
  return `${absDays} day${absDays === 1 ? '' : 's'} after deadline`
}

function truncateHash(hash: string | null, len = 16): string {
  if (!hash) return '—'
  return hash.length > len ? hash.slice(0, len) + '…' : hash
}

function fileSizeLabel(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} bytes`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB (${bytes.toLocaleString()} bytes)`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB (${bytes.toLocaleString()} bytes)`
}

function initials(name: string): string {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

function gracePeriodDaysLabel(minutes: number | null): string {
  if (!minutes || minutes === 0) return 'no grace period'
  const days = Math.round(minutes / (60 * 24))
  return `${days} day${days === 1 ? '' : 's'}`
}

// ---------------------------------------------------------------------------
// Audit icon (standalone component to avoid returning JSX from a plain fn)
// ---------------------------------------------------------------------------

type AuditIconKey = 'commitment' | 'message' | 'upload' | 'verified' | 'mismatch' | 'info'

function getAuditIconKey(eventType: string): { iconKey: AuditIconKey; bg: string } {
  const et = eventType.toUpperCase()
  if (et.includes('COMMITMENT') || et.includes('SMS')) return { iconKey: 'commitment', bg: 'bg-blue-100' }
  if (et.includes('DELIVERED') || et.includes('GATEWAY')) return { iconKey: 'message', bg: 'bg-indigo-100' }
  if (et.includes('UPLOAD') || et.includes('FILE')) return { iconKey: 'upload', bg: 'bg-sky-100' }
  if (et.includes('VERIFICATION') || et.includes('HASH') || et.includes('VERIFIED')) return { iconKey: 'verified', bg: 'bg-green-100' }
  if (et.includes('MISMATCH') || et.includes('FAIL')) return { iconKey: 'mismatch', bg: 'bg-red-100' }
  return { iconKey: 'info', bg: 'bg-gray-100' }
}

function AuditIcon({ iconKey }: { iconKey: AuditIconKey }) {
  if (iconKey === 'commitment') {
    return (
      <svg className="h-3.5 w-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    )
  }
  if (iconKey === 'message') {
    return (
      <svg className="h-3.5 w-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    )
  }
  if (iconKey === 'upload') {
    return (
      <svg className="h-3.5 w-3.5 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    )
  }
  if (iconKey === 'verified') {
    return (
      <svg className="h-3.5 w-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }
  if (iconKey === 'mismatch') {
    return (
      <svg className="h-3.5 w-3.5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M6 18h12a2 2 0 002-2V8a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    )
  }
  return (
    <svg className="h-3.5 w-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function CopyBtn() {
  return (
    <button title="Copy" className="shrink-0 text-gray-400 hover:text-blue-500">
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    </button>
  )
}


// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function SubmissionDetailsPage({
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

  // ── Fetch submission ───────────────────────────────────────────────────────

  let sub: Sub | null = null

  try {
    // Using a single string literal so Supabase's TS generics resolve correctly
    const selectStr = 'id, assignment_id, student_id, submission_method, status, verification_result, created_at, uploaded_at, file_name, file_type, file_size_bytes, uploaded_file_hash, student:profiles!student_id(full_name, email, student_id), assignment:assignments(id, title, description, deadline_at, grace_period_minutes, fallback_enabled, created_by, course:courses(code, title))'

    const { data } = await supabase
      .from('submissions')
      .select(selectStr)
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
        student: s ? {
          full_name: s.full_name as string | null,
          email: s.email as string | null,
          student_id: s.student_id as string | null,
        } : null,
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
          ← Back to Submissions
        </Link>
      </div>
    )
  }

  // ── Lecturer profile ──────────────────────────────────────────────────────
  let lecturerName = session.user.email ?? 'Lecturer'
  let lecturerDept = ''
  try {
    const { data: lp } = await supabase
      .from('profiles')
      .select('full_name, department')
      .eq('id', lecturerId)
      .single()
    if (lp?.full_name) lecturerName = lp.full_name
    if (lp?.department) lecturerDept = lp.department
  } catch { /* profile table may not exist */ }

  // ── Commitment ────────────────────────────────────────────────────────────
  interface Commitment {
    id: string
    commitment_id: string | null
    file_hash: string | null
    created_at: string | null
    status: string | null
    provider_metadata_json: Record<string, unknown> | null
  }
  let commitment: Commitment | null = null
  try {
    const { data } = await supabase
      .from('commitments')
      .select('id, commitment_id, file_hash, created_at, status, provider_metadata_json')
      .eq('assignment_id', assignmentId)
      .eq('student_id', sub.student_id)
      .single()
    if (data) {
      commitment = {
        ...data,
        provider_metadata_json: data.provider_metadata_json as Record<string, unknown> | null,
      }
    }
  } catch { /* commitments table may not exist */ }

  // ── Audit events ──────────────────────────────────────────────────────────
  interface AuditEvt {
    id: string
    event_type: string
    event_at: string | null
    created_at: string | null
    metadata_json: Record<string, unknown> | null
    status: string | null
  }
  let auditEvents: AuditEvt[] = []
  try {
    const { data } = await supabase
      .from('audit_events')
      .select('id, event_type, event_at, created_at, metadata_json, status')
      .eq('submission_id', submissionId)
      .order('event_at', { ascending: true })
    if (data) {
      auditEvents = data.map(e => ({
        ...e,
        metadata_json: e.metadata_json as Record<string, unknown> | null,
      }))
    }
  } catch { /* audit_events table may not exist */ }

  // Synthesise milestones from timestamps if no real events recorded
  if (auditEvents.length === 0) {
    if (commitment?.created_at) {
      auditEvents.push({
        id: 'syn-commitment',
        event_type: 'SMS_COMMITMENT_RECEIVED',
        event_at: commitment.created_at,
        created_at: commitment.created_at,
        metadata_json: null,
        // TODO: event.status field may not be in schema yet
        status: 'success',
      })
    }
    const uploadTs = sub.uploaded_at ?? sub.created_at
    if (uploadTs) {
      auditEvents.push({
        id: 'syn-upload',
        event_type: 'FILE_UPLOADED',
        event_at: uploadTs,
        created_at: uploadTs,
        metadata_json: null,
        status: 'success',
      })
    }
  }

  // ── Hash comparison (direct, not trusting stored boolean) ─────────────────
  const uploadedHash = sub.uploaded_file_hash
  const commitmentHash = commitment?.file_hash ?? null
  const hashesMatch: boolean | null = uploadedHash && commitmentHash
    ? uploadedHash.toLowerCase() === commitmentHash.toLowerCase()
    : null

  // ── Badge variant ─────────────────────────────────────────────────────────
  type BadgeV = 'verified' | 'mismatch' | 'pending' | 'normal'
  let badgeV: BadgeV = 'normal'
  const vr = (sub.verification_result ?? '').toLowerCase()
  if (hashesMatch === true || vr.includes('pass') || vr.includes('match')) badgeV = 'verified'
  else if (hashesMatch === false || vr.includes('fail') || vr.includes('mismatch')) badgeV = 'mismatch'
  else if (commitment && !uploadedHash) badgeV = 'pending'

  const badgeCfg = {
    verified: { border: 'border-green-200 bg-green-50', iconBg: 'bg-green-500', title: 'Verified Match', subtitle: "The submitted file matches the student's commitment.", tc: 'text-green-800', sc: 'text-green-600' },
    mismatch: { border: 'border-red-200 bg-red-50',    iconBg: 'bg-red-500',   title: 'Mismatch Detected', subtitle: 'The uploaded file differs from the committed version.', tc: 'text-red-800', sc: 'text-red-600' },
    pending:  { border: 'border-amber-200 bg-amber-50', iconBg: 'bg-amber-500', title: 'Pending Verification', subtitle: 'Awaiting file upload for hash comparison.', tc: 'text-amber-800', sc: 'text-amber-600' },
    normal:   { border: 'border-blue-200 bg-blue-50',   iconBg: 'bg-blue-500',  title: 'Submitted', subtitle: 'Submitted online — no fallback commitment involved.', tc: 'text-blue-800', sc: 'text-blue-600' },
  }
  const badge = badgeCfg[badgeV]

  const pillCfg = {
    verified: { bg: 'bg-green-100 text-green-700', label: 'Verified Match', sub: 'Matched and accepted' },
    mismatch: { bg: 'bg-red-100 text-red-600',     label: 'Mismatch',        sub: 'Review required' },
    pending:  { bg: 'bg-amber-100 text-amber-700', label: 'Awaiting Upload', sub: 'Awaiting upload' },
    normal:   { bg: 'bg-blue-100 text-blue-700',   label: 'Submitted',       sub: 'Submitted normally' },
  }
  const pill = pillCfg[badgeV]

  // ── Student display id ────────────────────────────────────────────────────
  // TODO: no confirmed student-facing display ID field in schema — truncated user id fallback
  const studentDisplayId = sub.student?.student_id
    ? String(sub.student.student_id)
    : `S${sub.student_id.replace(/-/g, '').slice(0, 7).toUpperCase()}`

  const studentName = sub.student?.full_name ?? 'Unknown Student'
  const studentInitials = initials(studentName)

  // ── SMS gateway metadata ──────────────────────────────────────────────────
  // TODO: webhook handler should store provider_metadata_json with:
  //   { gateway: string, gateway_time: ISO string, message_id: string, delivery_status: string }
  const gwMeta = commitment?.provider_metadata_json ?? {}
  const gwName       = gwMeta.gateway         ? String(gwMeta.gateway)         : null
  const gwTime       = gwMeta.gateway_time    ? String(gwMeta.gateway_time)    : null
  const gwMessageId  = gwMeta.message_id      ? String(gwMeta.message_id)      : null
  const gwStatus     = gwMeta.delivery_status ? String(gwMeta.delivery_status) : null

  const resultSummary = {
    verified: "The submitted file matches the student's committed version.",
    mismatch: 'The uploaded file hash does not match the original commitment.',
    pending:  'The student has committed but has not yet uploaded the file.',
    normal:   'The student submitted their work online — no fallback commitment was required.',
  }[badgeV]

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Back link */}
      <Link
        href={`/lecturer/assignments/${assignmentId}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Submissions
      </Link>

      {/* Heading */}
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          {sub.assignment?.course && (
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {sub.assignment.course.code} – {sub.assignment.course.title.toUpperCase()}
            </p>
          )}
          <h1 className="text-3xl font-bold text-gray-900">Submission Details</h1>
          <p className="mt-0.5 text-lg font-semibold text-gray-700">{sub.assignment?.title}</p>
          <p className="mt-1 text-sm text-gray-400">
            View the complete submission record, verification result, and audit trail for this student.
          </p>
        </div>
        <div className={`shrink-0 flex items-center gap-3 rounded-xl border px-4 py-3 ${badge.border}`}>
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${badge.iconBg}`}>
            {badgeV === 'mismatch' ? (
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : badgeV === 'pending' ? (
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <div>
            <p className={`text-sm font-semibold ${badge.tc}`}>{badge.title}</p>
            <p className={`text-xs ${badge.sc}`}>{badge.subtitle}</p>
          </div>
        </div>
      </div>

      {/* Info row */}
      <div className="flex flex-wrap divide-x divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 px-5 py-4 flex-1 min-w-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
            {studentInitials}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-gray-400">Student</p>
            <p className="text-sm font-semibold text-gray-900 truncate">{studentName}</p>
            <p className="text-[11px] text-gray-400 truncate">{sub.student?.email ?? '—'}</p>
            <p className="text-[11px] text-gray-400">ID: {studentDisplayId}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-5 py-4 flex-1 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50">
            <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-gray-400">Assignment</p>
            <p className="text-sm font-semibold text-gray-900 truncate">{sub.assignment?.title ?? '—'}</p>
            {sub.assignment?.description && (
              <p className="text-[11px] text-gray-400 truncate">{sub.assignment.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 px-5 py-4 flex-1 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50">
            <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-gray-400">Deadline</p>
            <p className="text-sm font-semibold text-gray-900">{fmtDate(sub.assignment?.deadline_at ?? null)}</p>
            <p className="text-[11px] text-gray-400">
              {sub.assignment?.deadline_at
                ? new Date(sub.assignment.deadline_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + ' (UTC-7)'
                : '—'}
            </p>
            <p className="text-[11px] text-gray-400">Your local time</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-5 py-4 flex-1 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50">
            <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-gray-400">Submitted to</p>
            <p className="text-sm font-semibold text-gray-900 truncate">{lecturerName}</p>
            {lecturerDept && <p className="text-[11px] text-gray-400">{lecturerDept}</p>}
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-5 items-start">

        {/* LEFT */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* Submission Result */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full ${badge.iconBg}`}>
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Submission Result</p>
                <p className="text-xs text-gray-400">{resultSummary}</p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Status + commitment time + upload time */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="mb-1.5 text-xs text-gray-400">Status</p>
                  <span className={`inline-block rounded-lg px-3 py-1.5 text-sm font-semibold ${pill.bg}`}>
                    {pill.label}
                  </span>
                  <p className="mt-1 text-[11px] text-gray-400">{pill.sub}</p>
                </div>
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-xs text-gray-400">Commitment Time</p>
                  </div>
                  {commitment ? (
                    <>
                      <p className="text-sm font-medium text-gray-800">{fmt(commitment.created_at)}</p>
                      <p className="text-[11px] text-gray-400">{relativeToDeadline(commitment.created_at, sub.assignment?.deadline_at ?? null)}</p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-400">No commitment</p>
                  )}
                </div>
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <p className="text-xs text-gray-400">Upload Time</p>
                  </div>
                  {(sub.uploaded_at ?? sub.created_at) ? (
                    <>
                      <p className="text-sm font-medium text-gray-800">{fmt(sub.uploaded_at ?? sub.created_at)}</p>
                      <p className="text-[11px] text-gray-400">{relativeToDeadline(sub.uploaded_at ?? sub.created_at, sub.assignment?.deadline_at ?? null)}</p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-400">Not yet uploaded</p>
                  )}
                </div>
              </div>

              {/* Hash comparison box — only when commitment exists */}
              {commitment ? (
                <div className="grid grid-cols-2 gap-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="space-y-3">
                    <div>
                      <div className="mb-1 flex items-center gap-1.5">
                        <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-xs font-medium text-gray-600">Commitment ID</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-xs font-medium text-blue-700 break-all">
                          {commitment.commitment_id ?? commitment.id}
                        </p>
                        <CopyBtn />
                      </div>
                    </div>
                    <div>
                      <p className="mb-1 text-[11px] text-gray-400">Original Commitment Hash</p>
                      <p className="font-mono text-[11px] text-gray-600 break-all">{commitmentHash ?? '—'}</p>
                      <CopyBtn />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="mb-1 text-xs font-medium text-gray-600">Uploaded File Hash</p>
                      {uploadedHash
                        ? <p className="font-mono text-[11px] text-gray-600 break-all">{uploadedHash}</p>
                        : <p className="text-xs text-gray-400">Not yet uploaded</p>
                      }
                    </div>
                    {hashesMatch !== null && (
                      <div className={`flex items-start gap-2 rounded-lg border p-2.5 ${hashesMatch ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                        <svg className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${hashesMatch ? 'text-green-600' : 'text-red-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          {hashesMatch
                            ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            : <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          }
                        </svg>
                        <div>
                          <p className={`text-xs font-semibold ${hashesMatch ? 'text-green-800' : 'text-red-700'}`}>
                            {hashesMatch ? 'Hashes match' : 'Hashes differ'}
                          </p>
                          <p className={`text-[11px] ${hashesMatch ? 'text-green-600' : 'text-red-500'}`}>
                            {hashesMatch
                              ? 'The uploaded file is identical to the committed version.'
                              : 'Content differs from the original commitment.'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                  <p className="text-xs text-blue-700">
                    This student submitted directly online — no SMS commitment was made, so there is no hash comparison to perform.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Audit Trail */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50">
                <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Audit Trail</p>
                <p className="text-xs text-gray-400">Complete timeline of actions for this submission.</p>
              </div>
            </div>
            <div className="p-5">
              {auditEvents.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-400">No audit events recorded yet.</p>
              ) : (
                <ol className="space-y-0">
                  {auditEvents.map((evt, idx) => {
                    const { iconKey, bg } = getAuditIconKey(evt.event_type)
                    const friendlyLabel = formatAuditEvent(evt.event_type)
                    const isLast = idx === auditEvents.length - 1
                    const ts = evt.event_at ?? evt.created_at
                    // TODO: event.status may not be in schema yet — defaulting to 'success' for logged events
                    const evtStatus = (evt.status ?? 'success').toLowerCase()
                    const succeeded = evtStatus !== 'failed' && evtStatus !== 'error'

                    const evtMeta = evt.metadata_json ?? {}
                    const descParts: string[] = []
                    if (evtMeta.commitment_id) descParts.push(`Commitment ID: ${String(evtMeta.commitment_id)}`)
                    if (evtMeta.file_hash) descParts.push(`Hash: ${truncateHash(String(evtMeta.file_hash), 24)}…`)
                    if (evtMeta.file_name) {
                      const sz = evtMeta.file_size_bytes ? ` (${fileSizeLabel(Number(evtMeta.file_size_bytes))})` : ''
                      descParts.push(`File: ${String(evtMeta.file_name)}${sz}`)
                    }
                    if (evtMeta.upload_hash) descParts.push(`Upload hash: ${truncateHash(String(evtMeta.upload_hash), 24)}…`)
                    if (evtMeta.phone) descParts.push(`Delivered to ${String(evtMeta.phone)}`)
                    if (evtMeta.message_id) descParts.push(`Message ID: ${truncateHash(String(evtMeta.message_id), 20)}`)
                    if (evtMeta.detail && descParts.length === 0) descParts.push(String(evtMeta.detail))

                    const friendlyTitle =
                      evt.event_type === 'SMS_COMMITMENT_RECEIVED' ? 'Commitment received via SMS' :
                      evt.event_type === 'SMS_COMMITMENT_CONFIRMED' ? 'SMS delivered to student' :
                      evt.event_type === 'FILE_UPLOADED' ? 'File uploaded by student' :
                      evt.event_type === 'HASH_VERIFICATION_PASSED' ? 'Automatic verification completed' :
                      evt.event_type === 'HASH_VERIFICATION_FAILED' ? 'Verification failed — hash mismatch' :
                      friendlyLabel.charAt(0).toUpperCase() + friendlyLabel.slice(1)

                    return (
                      <li key={evt.id} className="relative flex gap-4">
                        {!isLast && (
                          <div className="absolute left-3.5 top-8 bottom-0 w-px bg-gray-100" />
                        )}
                        <div className={`relative z-10 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${bg}`}>
                          <AuditIcon iconKey={iconKey} />
                        </div>
                        <div className="flex-1 pb-5 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[11px] text-gray-400">{ts ? fmt(ts) : '—'}</p>
                              <p className="mt-0.5 text-sm font-semibold text-gray-800">{friendlyTitle}</p>
                              {descParts.map((d, i) => (
                                <p key={i} className="text-[11px] text-gray-400 truncate">{d}</p>
                              ))}
                            </div>
                            <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${succeeded ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                              <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                {succeeded
                                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  : <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                }
                              </svg>
                              {succeeded ? 'Success' : 'Failed'}
                            </span>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="w-64 shrink-0 space-y-4">

          {/* File Details */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
              <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm font-semibold text-gray-800">File Details</p>
            </div>
            <div className="divide-y divide-gray-50 px-4 py-1">
              {([
                ['File Name', sub.file_name ?? '—'],
                ['File Type', sub.file_type ?? '—'],
                ['File Size', fileSizeLabel(sub.file_size_bytes)],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-2 py-2">
                  <span className="text-[11px] text-gray-400 shrink-0">{label}</span>
                  <span className="text-[11px] font-medium text-gray-700 text-right truncate max-w-36">{value}</span>
                </div>
              ))}
              <div className="py-2">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] text-gray-400">SHA-256 Hash</span>
                  <CopyBtn />
                </div>
                <p className="font-mono text-[10px] text-gray-600 break-all leading-relaxed">
                  {uploadedHash ? truncateHash(uploadedHash, 36) : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* SMS Gateway */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
              <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <p className="text-sm font-semibold text-gray-800">SMS Gateway Information</p>
            </div>
            {!commitment ? (
              <p className="px-4 py-4 text-xs text-gray-400">
                No SMS commitment — student submitted online.
              </p>
            ) : (
              <div className="divide-y divide-gray-50 px-4 py-1">
                <div className="flex items-baseline justify-between gap-2 py-2">
                  <span className="text-[11px] text-gray-400 shrink-0">Gateway</span>
                  <span className="text-[11px] font-medium text-gray-700 text-right">
                    {gwName ?? <em className="text-gray-400 not-italic">Not available yet</em>}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2 py-2">
                  <span className="text-[11px] text-gray-400 shrink-0">Gateway Time</span>
                  <span className="text-[11px] font-medium text-gray-700 text-right">
                    {gwTime ? fmt(gwTime) : <em className="text-gray-400 not-italic">Not available yet</em>}
                  </span>
                </div>
                <div className="py-2">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[11px] text-gray-400">Message ID</span>
                    {gwMessageId && <CopyBtn />}
                  </div>
                  <p className="font-mono text-[10px] text-gray-600 break-all">
                    {gwMessageId ?? <em className="text-gray-400 not-italic text-[11px]">Not available yet</em>}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2 py-2">
                  <span className="text-[11px] text-gray-400 shrink-0">Status</span>
                  {gwStatus ? (
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${gwStatus.toLowerCase() === 'delivered' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {gwStatus}
                    </span>
                  ) : (
                    <em className="text-[11px] text-gray-400 not-italic">Not available yet</em>
                  )}
                </div>
                {!gwName && !gwTime && !gwMessageId && !gwStatus && (
                  <p className="py-2 text-[11px] text-gray-400">
                    {/* TODO: webhook handler should populate provider_metadata_json with:
                        { gateway, gateway_time (ISO), message_id, delivery_status } */}
                    SMS details appear once the webhook handler stores them in provider_metadata_json.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Fallback Policy */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
              <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
              <p className="text-sm font-semibold text-gray-800">Fallback Policy</p>
            </div>
            <div className="p-4 space-y-3">
              {sub.assignment?.fallback_enabled ? (
                <div className="flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2.5">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <p className="text-xs font-semibold text-green-800">Enabled for this assignment</p>
                    <p className="text-[11px] text-green-600">
                      Students can submit offline and upload within{' '}
                      {gracePeriodDaysLabel(sub.assignment.grace_period_minutes)} after the deadline.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728M3 3l18 18" />
                  </svg>
                  <div>
                    <p className="text-xs font-semibold text-gray-600">Disabled for this assignment</p>
                    <p className="text-[11px] text-gray-400">Students must be online to submit.</p>
                  </div>
                </div>
              )}
              <Link
                href={`/lecturer/assignments/${assignmentId}/settings`}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
              >
                View assignment fallback settings
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
