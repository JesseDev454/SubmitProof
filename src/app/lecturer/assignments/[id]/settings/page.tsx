import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/auth/server'
import { formatAuditEvent } from '@/features/audit/formatAuditEvent'
import AssignmentSettingsForm from '@/components/lecturer/AssignmentSettingsForm'

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

function fileSizeLabel(bytes: number | null): string {
  if (!bytes) return '—'
  const mb = bytes / (1024 * 1024)
  return `${Math.round(mb)} MB`
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AssignmentSettingsPage({
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

  interface Assignment {
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
  }

  let assignment: Assignment | null = null

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

  // ── Check if commitments exist ────────────────────────────────────────────
  let commitmentsExist = false
  try {
    const { count } = await supabase
      .from('commitments')
      .select('id', { count: 'exact', head: true })
      .eq('assignment_id', assignmentId)
    commitmentsExist = (count ?? 0) > 0
  } catch { /* commitments table may not exist */ }

  // ── Fetch audit/policy-change history ─────────────────────────────────────

  interface AuditEvent {
    id: string
    event_type: string
    created_at: string | null
    actor_id: string | null
    metadata_json: Record<string, unknown> | null
    actor: { full_name: string | null; email: string | null } | null
  }

  let auditEvents: AuditEvent[] = []
  try {
    const { data } = await supabase
      .from('audit_events')
      .select('id, event_type, created_at, actor_id, metadata_json, actor:profiles!actor_id(full_name, email)')
      .eq('assignment_id', assignmentId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (data) {
      auditEvents = data.map((row: unknown) => {
        const r = row as Record<string, unknown> | null
        const actorRaw = r?.actor
        const actor = Array.isArray(actorRaw) ? actorRaw[0] : actorRaw
        const a = actor as Record<string, unknown> | null
        return {
          id: String(r?.id ?? ''),
          event_type: String(r?.event_type ?? ''),
          created_at: r?.created_at as string | null,
          actor_id: r?.actor_id as string | null,
          metadata_json: r?.metadata_json as Record<string, unknown> | null,
          actor: {
            full_name: a?.full_name as string | null ?? null,
            email: a?.email as string | null ?? null,
          },
        }
      })
    }
  } catch { /* audit_events table may not exist */ }

  // ── Fetch submission count ────────────────────────────────────────────────
  let submissionCount = 0
  try {
    const { count } = await supabase
      .from('submissions')
      .select('id', { count: 'exact', head: true })
      .eq('assignment_id', assignmentId)
    submissionCount = count ?? 0
  } catch { /* submissions table may not exist */ }

  // ── Derive enrollment count from course ────────────────────────────────────
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

  // ── Derived values ────────────────────────────────────────────────────────
  const courseCode = assignment.course?.code ?? '??'
  const courseTitle = assignment.course?.title ?? ''

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
        Back to Assignment
      </Link>

      {/* Heading */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{assignment.title}</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage settings, requirements, and policies for this assignment.
        </p>
      </div>

      {/* Top info bar */}
      <div className="flex flex-wrap divide-x divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Course */}
        <div className="flex items-center gap-3 px-5 py-3 flex-1 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50">
            <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-gray-400">Course</p>
            <p className="text-sm font-semibold text-gray-900 truncate">{courseCode}</p>
            <p className="text-[11px] text-gray-400 truncate">{courseTitle}</p>
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
            <p className="text-sm font-semibold text-gray-900">{formatDate(assignment.deadline_at)}</p>
            {assignment.deadline_at && (
              <p className="text-[11px] text-gray-400">
                {new Date(assignment.deadline_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} (Local time)
              </p>
            )}
          </div>
        </div>
        {/* Submissions */}
        <div className="flex items-center gap-3 px-5 py-3 flex-1 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50">
            <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-gray-400">Submissions</p>
            <p className="text-sm font-semibold text-gray-900">{submissionCount} / {enrolledCount}</p>
            <p className="text-[11px] text-gray-400">students submitted</p>
          </div>
        </div>
        {/* Fallback Policy */}
        <div className="flex items-center gap-3 px-5 py-3 flex-1 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50">
            <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-gray-400">Fallback Policy</p>
            <p className="text-sm font-semibold text-gray-900">
              {assignment.fallback_enabled ? '✓ Enabled' : '✗ Disabled'}
            </p>
            <p className="text-[11px] text-gray-400">
              {assignment.fallback_enabled ? 'Commits saved offline' : 'Online only'}
            </p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <AssignmentSettingsForm
        assignmentId={assignmentId}
        assignment={assignment}
        commitmentsExist={commitmentsExist}
        auditEvents={auditEvents}
      />
    </div>
  )
}
