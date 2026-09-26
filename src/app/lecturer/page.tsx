import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/auth/server'
import { formatAuditEvent } from '@/features/audit/formatAuditEvent'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  const days = Math.floor(hrs / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function formatDeadline(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) + ' · ' + new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AssignmentRow {
  id: string
  title: string
  status: string
  deadline_at: string | null
  created_at: string
  course: { code: string; title: string } | null
  enrolledCount: number
  submissionCount: number
}

interface StatCounts {
  activeAssignments: number
  upcomingDeadlines: number
  normalSubmissions: number
  fallbackCommitments: number
  awaitingUpload: number
  hashMismatches: number
}

interface ActivityRow {
  id: string
  event_type: string
  created_at: string
  actor_name: string | null
  assignment_title: string | null
  course_code: string | null
}

interface DeadlineRow {
  id: string
  title: string
  deadline_at: string
  course: { code: string; title: string } | null
}

// ---------------------------------------------------------------------------
// Data fetching — every query is wrapped in try/catch
// ---------------------------------------------------------------------------

async function fetchDashboardData(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  // --- assignments (limit 5, for the table) ---
  let assignmentRows: AssignmentRow[] = []
  try {
    const { data } = await supabase
      .from('assignments')
      .select('id, title, status, deadline_at, created_at, course:courses(code, title)')
      .eq('created_by', userId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (data) {
      // Supabase returns joined rows as array or object depending on cardinality
      // Normalise to a plain object or null
      function normaliseCourse(raw: unknown): { code: string; title: string } | null {
        if (!raw) return null
        const obj = Array.isArray(raw) ? raw[0] : raw
        if (!obj || typeof obj !== 'object') return null
        const r = obj as Record<string, unknown>
        return { code: String(r.code ?? ''), title: String(r.title ?? '') }
      }

      // For each assignment, fetch enrolled count + submission count in parallel
      assignmentRows = await Promise.all(
        data.map(async (a) => {
          const course = normaliseCourse(a.course)
          let enrolledCount = 0
          let submissionCount = 0

          try {
            // We need the course id — fetch it separately if not on the join
            const courseObj = Array.isArray(a.course) ? a.course[0] : a.course
            const courseId = (courseObj as Record<string, unknown> | null)?.['id'] as string | undefined
            if (courseId) {
              const { count } = await supabase
                .from('enrollments')
                .select('id', { count: 'exact', head: true })
                .eq('course_id', courseId)
              enrolledCount = count ?? 0
            }
          } catch { /* table may not exist */ }

          try {
            const { count } = await supabase
              .from('submissions')
              .select('id', { count: 'exact', head: true })
              .eq('assignment_id', a.id)
            submissionCount = count ?? 0
          } catch { /* table may not exist */ }

          return {
            id: a.id,
            title: a.title,
            status: a.status ?? 'active',
            deadline_at: a.deadline_at ?? null,
            created_at: a.created_at,
            course,
            enrolledCount,
            submissionCount,
          }
        })
      )
    }
  } catch { /* assignments table may not exist */ }

  // --- stat counts ---
  const stats: StatCounts = {
    activeAssignments: 0,
    upcomingDeadlines: 0,
    normalSubmissions: 0,
    fallbackCommitments: 0,
    awaitingUpload: 0,
    hashMismatches: 0,
  }

  try {
    // All assignment ids for this lecturer
    const { data: allAssignments } = await supabase
      .from('assignments')
      .select('id, status, deadline_at')
      .eq('created_by', userId)

    if (allAssignments) {
      const now = new Date()
      const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      const assignmentIds = allAssignments.map(a => a.id)

      stats.activeAssignments = allAssignments.filter(
        a => !['closed', 'inactive'].includes((a.status ?? '').toLowerCase())
      ).length

      stats.upcomingDeadlines = allAssignments.filter(a => {
        if (!a.deadline_at) return false
        const d = new Date(a.deadline_at)
        return d >= now && d <= in7Days && !['closed'].includes((a.status ?? '').toLowerCase())
      }).length

      if (assignmentIds.length > 0) {
        try {
          const { data: subs } = await supabase
            .from('submissions')
            .select('id, submission_method, status, verification_result')
            .in('assignment_id', assignmentIds)

          if (subs) {
            stats.normalSubmissions = subs.filter(s => s.submission_method === 'normal').length
            stats.awaitingUpload += subs.filter(
              s => (s.status ?? '').toUpperCase() === 'AWAITING_FULL_UPLOAD'
            ).length
            stats.hashMismatches = subs.filter(s => {
              const vr = (s.verification_result ?? '').toLowerCase()
              return vr.includes('mismatch') || vr.includes('fail')
            }).length
          }
        } catch { /* submissions table may not exist */ }

        try {
          const { data: commitments } = await supabase
            .from('commitments')
            .select('id, status')
            .in('assignment_id', assignmentIds)

          if (commitments) {
            stats.fallbackCommitments = commitments.length
            stats.awaitingUpload += commitments.filter(
              c => (c.status ?? '').toUpperCase() === 'AWAITING_FULL_UPLOAD'
            ).length
          }
        } catch { /* commitments table may not exist */ }
      }
    }
  } catch { /* fallback to zeros */ }

  // --- recent activity (5 most recent audit events) ---
  let recentActivity: ActivityRow[] = []
  try {
    const { data: allAssignmentIds } = await supabase
      .from('assignments')
      .select('id')
      .eq('created_by', userId)

    const ids = (allAssignmentIds ?? []).map((a: { id: string }) => a.id)

    if (ids.length > 0) {
      const { data: events } = await supabase
        .from('audit_events')
        .select('id, event_type, created_at, actor_name, assignment_title, course_code')
        .in('assignment_id', ids)
        .order('created_at', { ascending: false })
        .limit(5)

      recentActivity = (events ?? []) as ActivityRow[]
    }
  } catch { /* audit_events table may not exist */ }

  // --- upcoming deadlines (top 2 nearest) ---
  let upcomingDeadlines: DeadlineRow[] = []
  try {
    const now = new Date().toISOString()
    const { data } = await supabase
      .from('assignments')
      .select('id, title, deadline_at, course:courses(code, title)')
      .eq('created_by', userId)
      .neq('status', 'closed')
      .gt('deadline_at', now)
      .order('deadline_at', { ascending: true })
      .limit(2)

    if (data) {
      upcomingDeadlines = data.map(d => {
        const raw = Array.isArray(d.course) ? d.course[0] : d.course
        const courseObj = raw as Record<string, unknown> | null
        return {
          id: d.id,
          title: d.title,
          deadline_at: d.deadline_at,
          course: courseObj ? { code: String(courseObj.code ?? ''), title: String(courseObj.title ?? '') } : null,
        }
      })
    }
  } catch { /* assignments/courses table may not exist */ }

  return { assignmentRows, stats, recentActivity, upcomingDeadlines }
}

// ---------------------------------------------------------------------------
// Activity icon per event type
// ---------------------------------------------------------------------------

function ActivityIcon({ eventType }: { eventType: string }) {
  const et = eventType.toUpperCase()

  if (et.includes('MISMATCH') || et.includes('FAIL')) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
        <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
    )
  }
  if (et.includes('VERIFIED') || et.includes('PASSED')) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
        <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    )
  }
  if (et.includes('COMMITMENT') || et.includes('SMS') || et.includes('FALLBACK')) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100">
        <svg className="h-4 w-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
        </svg>
      </div>
    )
  }
  if (et.includes('AWAITING') || et.includes('UPLOAD')) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
        <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      </div>
    )
  }
  // default: file / submission
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
      <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stat card component
// ---------------------------------------------------------------------------

function StatCard({
  icon,
  count,
  label,
  sublabel,
  accent,
}: {
  icon: React.ReactNode
  count: number
  label: string
  sublabel: string
  accent: string
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}>
          {icon}
        </div>
        <div>
          <p className="text-xl font-bold text-gray-900">{count}</p>
          <p className="text-sm font-medium text-gray-700">{label}</p>
          <p className="text-xs text-gray-400">{sublabel}</p>
        </div>
      </div>
      <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Course badge
// ---------------------------------------------------------------------------

const BADGE_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-purple-100 text-purple-700',
  'bg-amber-100 text-amber-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
]

function courseBadgeColor(code: string) {
  let hash = 0
  for (let i = 0; i < code.length; i++) hash = code.charCodeAt(i) + ((hash << 5) - hash)
  return BADGE_COLORS[Math.abs(hash) % BADGE_COLORS.length]
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function LecturerDashboardPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const userId = session.user.id

  let fullName = session.user.email ?? 'Lecturer'
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single()
    if (profile?.full_name) fullName = profile.full_name
  } catch { /* profile table may not exist */ }

  const { assignmentRows, stats, recentActivity, upcomingDeadlines } =
    await fetchDashboardData(supabase, userId)

  const firstName = fullName.split(' ')[0]

  return (
    <div className="space-y-6">
      {/* Top bar: greeting + quote */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">
            {greeting()}, {fullName} 👋
          </p>
          <h1 className="mt-0.5 text-3xl font-bold text-gray-900">Lecturer Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage assignments, track submissions, and ensure academic integrity.
          </p>
        </div>
        <blockquote className="hidden max-w-[200px] rounded-xl bg-white p-4 shadow-sm border border-gray-200 text-right xl:block">
          <p className="text-sm italic text-gray-700">&ldquo;Fair assessment builds brighter futures.&rdquo;</p>
          <footer className="mt-1 text-xs text-gray-400">— SubmitProof</footer>
        </blockquote>
      </div>

      {/* Stat cards — 3 cols on md, 2 on sm */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={
            <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
          count={stats.activeAssignments}
          label="Active Assignments"
          sublabel={`Across ${Math.max(new Set(assignmentRows.map(a => a.course?.code)).size, 0)} courses`}
          accent="bg-blue-50"
        />
        <StatCard
          icon={
            <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
          count={stats.upcomingDeadlines}
          label="Upcoming Deadlines"
          sublabel="Next 7 days"
          accent="bg-blue-50"
        />
        <StatCard
          icon={
            <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          count={stats.normalSubmissions}
          label="Normal Submissions"
          sublabel="Successfully uploaded"
          accent="bg-green-50"
        />
        <StatCard
          icon={
            <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
          }
          count={stats.fallbackCommitments}
          label="Fallback Commitments"
          sublabel="Offline submissions"
          accent="bg-sky-50"
        />
        <StatCard
          icon={
            <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          }
          count={stats.awaitingUpload}
          label="Awaiting Upload"
          sublabel="Students yet to upload"
          accent="bg-amber-50"
        />
        <StatCard
          icon={
            <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
          count={stats.hashMismatches}
          label="Hash Mismatches"
          sublabel="Needs review"
          accent="bg-red-50"
        />
      </div>

      {/* Main content: assignments table + right column */}
      <div className="flex gap-6">
        {/* Left: Active Assignments table */}
        <div className="flex-1 min-w-0 rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h2 className="text-sm font-semibold text-gray-800">Active Assignments</h2>
            </div>
            <Link href="/lecturer/assignments" className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
              View all assignments
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>

          {assignmentRows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <svg className="h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm text-gray-500">No assignments yet</p>
              <Link
                href="/lecturer/assignments/new"
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                Create your first assignment
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-400">Course</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-400">Assignment</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-400">Due Date</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-400">Submissions</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-400">Status</th>
                    <th className="px-2 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {assignmentRows.map(a => {
                    const isOpen = !['closed', 'inactive'].includes((a.status ?? '').toLowerCase())
                    const pct = a.enrolledCount > 0
                      ? Math.round((a.submissionCount / a.enrolledCount) * 100)
                      : 0
                    const courseCode = a.course?.code ?? '??'
                    return (
                      <tr key={a.id} className="group border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        {/* Course badge */}
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${courseBadgeColor(courseCode)}`}>
                              {courseCode.slice(0, 2).toUpperCase()}
                            </span>
                            <div>
                              <p className="font-medium text-gray-800 text-xs">{courseCode}</p>
                              <p className="text-[11px] text-gray-400 leading-tight max-w-[90px] truncate">{a.course?.title}</p>
                            </div>
                          </div>
                        </td>
                        {/* Assignment title */}
                        <td className="px-5 py-3">
                          <p className="font-medium text-gray-800 text-xs leading-snug max-w-[140px]">{a.title}</p>
                        </td>
                        {/* Due date */}
                        <td className="px-5 py-3">
                          {a.deadline_at ? (
                            <div className="flex items-center gap-1.5">
                              <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <div>
                                <p className="text-xs text-gray-700">
                                  {new Date(a.deadline_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                                <p className="text-[11px] text-gray-400">
                                  {new Date(a.deadline_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        {/* Submissions: X / Y + progress bar */}
                        <td className="px-5 py-3">
                          <p className="text-xs font-medium text-gray-800">
                            {a.submissionCount} / {a.enrolledCount}
                          </p>
                          <div className="mt-1 h-1.5 w-16 rounded-full bg-gray-100">
                            <div
                              className="h-1.5 rounded-full bg-blue-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </td>
                        {/* Status */}
                        <td className="px-5 py-3">
                          {isOpen ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-700">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                              Open
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-500">
                              Closed
                            </span>
                          )}
                        </td>
                        {/* Chevron */}
                        <td className="px-3 py-3">
                          <Link href={`/lecturer/assignments/${a.id}`} className="flex items-center justify-center text-gray-300 group-hover:text-gray-500">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="flex w-72 shrink-0 flex-col gap-4">
          {/* Recent Activity */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="text-sm font-semibold text-gray-800">Recent Activity</h2>
              </div>
              <Link href="/lecturer/reviews" className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
                View all activity
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>

            {recentActivity.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">No recent activity</div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {recentActivity.map(event => (
                  <li key={event.id} className="flex items-start gap-3 px-4 py-3">
                    <ActivityIcon eventType={event.event_type} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 leading-snug">
                        <span className="font-semibold">{event.actor_name ?? 'Someone'}</span>{' '}
                        {formatAuditEvent(event.event_type)}
                      </p>
                      {(event.course_code || event.assignment_title) && (
                        <p className="mt-0.5 text-[11px] text-gray-400 truncate">
                          {[event.course_code, event.assignment_title].filter(Boolean).join(' – ')}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-[11px] text-gray-400 whitespace-nowrap">
                      {relativeTime(event.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Upcoming Deadlines */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h2 className="text-sm font-semibold text-gray-800">Upcoming Deadlines</h2>
              </div>
              {/* TODO: no calendar screen exists yet */}
              <Link href="#" className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
                View calendar
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>

            {upcomingDeadlines.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">No upcoming deadlines</div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {upcomingDeadlines.map(d => {
                  const code = d.course?.code ?? '??'
                  return (
                    <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${courseBadgeColor(code)}`}>
                        {code.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{d.title}</p>
                        <p className="text-[11px] text-gray-400 truncate">
                          {d.course?.code} – {d.course?.title}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 text-[11px] text-gray-500">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {new Date(d.deadline_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        <p className="text-[11px] text-gray-400">
                          {new Date(d.deadline_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="border-t border-gray-100 px-4 py-3">
              <Link
                href="#"
                className="flex items-center justify-center gap-2 w-full rounded-lg border border-gray-200 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                View all deadlines
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom banner */}
      <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100">
          <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">Support academic integrity, anywhere.</p>
          <p className="text-sm text-gray-400">Offline submissions, secure verification, and complete transparency.</p>
        </div>
        <Link
          href="/lecturer/assignments/new"
          className="shrink-0 flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          Create New Assignment
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </Link>
      </div>
    </div>
  )
}
