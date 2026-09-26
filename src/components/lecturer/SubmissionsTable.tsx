'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Types (shared between server page and this client component)
// ---------------------------------------------------------------------------

export interface SubmissionRow {
  submissionId: string | null   // null = commitment-only / expired, no submission yet
  studentName: string
  studentDisplayId: string       // e.g. "S1234567" or truncated user id
  studentInitials: string
  submittedAt: string | null     // ISO string or null
  status: 'Submitted' | 'Committed' | 'Awaiting Upload' | 'Fallback Verified' | 'Mismatch' | 'Expired'
  method: string                 // "Online Upload" | "Fallback (Pre-deadline)" | "Fallback (Grace Period)" | "Offline Fallback" | "—"
  assignmentId: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PAGE_SIZE = 8

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    '\n' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

// ---------------------------------------------------------------------------
// Status pill
// ---------------------------------------------------------------------------

function StatusPill({ status }: { status: SubmissionRow['status'] }) {
  const config: Record<SubmissionRow['status'], { bg: string; text: string; icon: React.ReactNode }> = {
    'Submitted': {
      bg: 'bg-green-50 text-green-700',
      text: 'Submitted',
      icon: (
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
    'Committed': {
      bg: 'bg-blue-50 text-blue-700',
      text: 'Committed',
      icon: (
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
        </svg>
      ),
    },
    'Awaiting Upload': {
      bg: 'bg-amber-50 text-amber-700',
      text: 'Awaiting Upload',
      icon: (
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    'Fallback Verified': {
      bg: 'bg-green-50 text-green-700',
      text: 'Fallback Verified',
      icon: (
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
        </svg>
      ),
    },
    'Mismatch': {
      bg: 'bg-amber-50 text-amber-700',
      text: 'Mismatch',
      icon: (
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    'Expired': {
      bg: 'bg-red-50 text-red-600',
      text: 'Expired',
      icon: (
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
    },
  }
  const c = config[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${c.bg}`}>
      {c.icon}
      {c.text}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Initials avatar
// ---------------------------------------------------------------------------

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-purple-100 text-purple-700',
  'bg-amber-100 text-amber-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
]

function avatarColor(initials: string) {
  let h = 0
  for (let i = 0; i < initials.length; i++) h = initials.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

// ---------------------------------------------------------------------------
// SubmissionsTable — client component
// ---------------------------------------------------------------------------

const STATUS_OPTIONS: SubmissionRow['status'][] = [
  'Submitted', 'Committed', 'Awaiting Upload', 'Fallback Verified', 'Mismatch', 'Expired',
]

export default function SubmissionsTable({
  rows,
  totalStudents,
}: {
  rows: SubmissionRow[]
  totalStudents: number
}) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('All Statuses')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return rows.filter(r => {
      const matchesSearch =
        !q ||
        r.studentName.toLowerCase().includes(q) ||
        r.studentDisplayId.toLowerCase().includes(q)
      const matchesStatus =
        statusFilter === 'All Statuses' || r.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [rows, search, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function handleSearch(v: string) {
    setSearch(v)
    setPage(1)
  }
  function handleStatus(v: string) {
    setStatusFilter(v)
    setPage(1)
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Table header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <h2 className="text-sm font-semibold text-gray-800">
            Student Submissions ({totalStudents})
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <svg className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              placeholder="Search students..."
              value={search}
              onChange={e => handleSearch(e.target.value)}
              className="w-44 rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-3 text-xs text-gray-700 outline-none placeholder:text-gray-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
            />
          </div>
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => handleStatus(e.target.value)}
            className="rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-3 pr-7 text-xs text-gray-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
          >
            <option>All Statuses</option>
            {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-50">
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-400">Student</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-400">Submission Date</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-400">Status</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-400">Submission Method</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-sm text-gray-400">
                  {rows.length === 0 ? 'No submissions yet' : 'No results match your search'}
                </td>
              </tr>
            ) : (
              pageRows.map((row, idx) => {
                const dateLines = row.submittedAt ? formatDate(row.submittedAt).split('\n') : null
                return (
                  <tr key={`${row.submissionId ?? row.studentDisplayId}-${idx}`} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    {/* Student */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarColor(row.studentInitials)}`}>
                          {row.studentInitials}
                        </span>
                        <div>
                          <p className="text-xs font-semibold text-gray-800">{row.studentName}</p>
                          <p className="text-[11px] text-gray-400">{row.studentDisplayId}</p>
                        </div>
                      </div>
                    </td>
                    {/* Date */}
                    <td className="px-5 py-3">
                      {dateLines ? (
                        <div>
                          <p className="text-xs text-gray-700">{dateLines[0]}</p>
                          <p className="text-[11px] text-gray-400">{dateLines[1]}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    {/* Status */}
                    <td className="px-5 py-3">
                      <StatusPill status={row.status} />
                    </td>
                    {/* Method */}
                    <td className="px-5 py-3">
                      <span className="text-xs text-gray-600">{row.method}</span>
                    </td>
                    {/* Actions */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {row.submissionId ? (
                          <Link
                            href={`/lecturer/assignments/${row.assignmentId}/submissions/${row.submissionId}`}
                            className="text-xs font-medium text-blue-600 hover:underline"
                          >
                            View
                          </Link>
                        ) : (
                          <span className="text-xs text-gray-300">View</span>
                        )}
                        <button className="text-gray-300 hover:text-gray-500">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h.01M12 12h.01M19 12h.01" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer: showing + pagination */}
      <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
        <p className="text-xs text-gray-400">
          Showing {filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {totalStudents} students
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-100 disabled:opacity-40"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                  n === safePage
                    ? 'bg-blue-600 text-white'
                    : 'border border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-100 disabled:opacity-40"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
