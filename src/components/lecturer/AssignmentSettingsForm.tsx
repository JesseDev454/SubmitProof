'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatAuditEvent } from '@/features/audit/formatAuditEvent'

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

interface AuditEvent {
  id: string
  event_type: string
  created_at: string | null
  actor_id: string | null
  metadata_json: Record<string, unknown> | null
  actor: { full_name: string | null; email: string | null } | null
}

interface AssignmentSettingsFormProps {
  assignmentId: string
  assignment: Assignment
  commitmentsExist: boolean
  auditEvents: AuditEvent[]
}

type ActionState = 'idle' | 'saving' | 'archiving' | 'confirming-archive' | 'error'

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

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function AssignmentSettingsForm({
  assignmentId,
  assignment,
  commitmentsExist,
  auditEvents,
}: AssignmentSettingsFormProps) {
  const router = useRouter()

  // ── State ─────────────────────────────────────────────────────────────────

  const [state, setState] = useState<ActionState>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Form state
  const [description, setDescription] = useState(assignment.description ?? '')
  const [gracePeriodDays, setGracePeriodDays] = useState(
    assignment.grace_period_minutes
      ? Math.round(assignment.grace_period_minutes / (60 * 24))
      : 0
  )
  const [allowedFileTypes, setAllowedFileTypes] = useState(
    assignment.allowed_file_types?.join(', ') ?? ''
  )
  const [maxFileSizeMb, setMaxFileSizeMb] = useState(
    assignment.max_file_size_bytes
      ? Math.round(assignment.max_file_size_bytes / (1024 * 1024))
      : 50
  )
  const [fallbackEnabled, setFallbackEnabled] = useState(assignment.fallback_enabled)

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleSave() {
    setState('saving')
    setErrorMsg(null)

    // Build only-changed-fields payload
    const payload: Record<string, unknown> = {}

    if (description !== assignment.description) payload.description = description
    if (gracePeriodDays !== (assignment.grace_period_minutes ? Math.round(assignment.grace_period_minutes / (60 * 24)) : 0)) {
      payload.grace_period_minutes = gracePeriodDays * 24 * 60
    }
    if (allowedFileTypes !== (assignment.allowed_file_types?.join(', ') ?? '')) {
      payload.allowed_file_types = allowedFileTypes
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    }
    if (maxFileSizeMb !== (assignment.max_file_size_bytes ? Math.round(assignment.max_file_size_bytes / (1024 * 1024)) : 50)) {
      payload.max_file_size_bytes = maxFileSizeMb * 1024 * 1024
    }

    // Only include fallback_enabled if it was actually editable (commitments don't exist)
    if (!commitmentsExist && fallbackEnabled !== assignment.fallback_enabled) {
      payload.fallback_enabled = fallbackEnabled
    }

    try {
      const res = await fetch(`/api/assignments/${assignmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setErrorMsg(body?.error ?? `Server error (${res.status}) — the API endpoint may not be implemented yet.`)
        setState('error')
        return
      }

      setState('idle')
      // TODO: Show confirmation toast/banner instead of hard redirect
      router.push(`/lecturer/assignments/${assignmentId}`)
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Network error — the /api/assignments PATCH endpoint may not be implemented yet.'
      )
      setState('error')
    }
  }

  async function handleArchive() {
    if (state !== 'confirming-archive') {
      // Show confirm step
      setState('confirming-archive')
      return
    }

    setState('archiving')
    setErrorMsg(null)

    try {
      const res = await fetch(`/api/assignments/${assignmentId}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setErrorMsg(body?.error ?? `Server error (${res.status}) — the API endpoint may not be implemented yet.`)
        setState('error')
        return
      }

      router.push('/lecturer/assignments')
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Network error — the /api/assignments/:id/archive endpoint may not be implemented yet.'
      )
      setState('error')
    }
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const hasChanges = description !== assignment.description ||
    gracePeriodDays !== (assignment.grace_period_minutes ? Math.round(assignment.grace_period_minutes / (60 * 24)) : 0) ||
    allowedFileTypes !== (assignment.allowed_file_types?.join(', ') ?? '') ||
    maxFileSizeMb !== (assignment.max_file_size_bytes ? Math.round(assignment.max_file_size_bytes / (1024 * 1024)) : 50) ||
    (!commitmentsExist && fallbackEnabled !== assignment.fallback_enabled)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Error banner */}
      {state === 'error' && errorMsg && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm text-red-700">{errorMsg}</p>
          <button
            onClick={() => { setState('idle'); setErrorMsg(null) }}
            className="ml-auto shrink-0 text-red-400 hover:text-red-600"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex gap-5 items-start">
        {/* LEFT: form */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* Assignment Description */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm font-semibold text-gray-800">Assignment Description</p>
              </div>
              {/* TODO: "Preview as Student" button — no student preview mode wired yet */}
              <button
                type="button"
                className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
                disabled
                title="Student preview mode not yet implemented"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Preview as Student
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                {/* TODO: rich-text formatting not implemented — this is a plain textarea. */}
                <textarea
                  rows={6}
                  placeholder="Update the instructions and details for this assignment..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full rounded-t-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none"
                />
                {/* Decorative toolbar */}
                <div className="flex items-center gap-1 rounded-b-lg border border-t-0 border-gray-300 bg-gray-50 px-2 py-1.5">
                  {[
                    { label: 'B', title: 'Bold' },
                    { label: 'I', title: 'Italic', italic: true },
                    { label: 'U', title: 'Underline', underline: true },
                  ].map(btn => (
                    <button
                      key={btn.label}
                      type="button"
                      title={btn.title}
                      disabled
                      className="flex h-6 w-6 items-center justify-center rounded text-xs font-bold text-gray-500 hover:bg-gray-200 disabled:opacity-50"
                      style={{
                        fontStyle: btn.italic ? 'italic' : undefined,
                        textDecoration: btn.underline ? 'underline' : undefined,
                      }}
                    >
                      {btn.label}
                    </button>
                  ))}
                  <div className="mx-1 h-4 w-px bg-gray-300" />
                  <button type="button" title="Bullet list" disabled className="flex h-6 w-6 items-center justify-center rounded text-gray-500 hover:bg-gray-200 disabled:opacity-50">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                  <button type="button" title="Numbered list" disabled className="flex h-6 w-6 items-center justify-center rounded text-gray-500 hover:bg-gray-200 disabled:opacity-50">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l4 4-4 4M4 6h.01M4 12h.01M4 18h.01M9 17l4-4" />
                    </svg>
                  </button>
                  <button type="button" title="Insert link" disabled className="flex h-6 w-6 items-center justify-center rounded text-gray-500 hover:bg-gray-200 disabled:opacity-50">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-gray-400">{description.length} / 5000 characters</p>
            </div>
          </div>

          {/* Fallback Policy */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
              <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
              <p className="text-sm font-semibold text-gray-800">Fallback Policy</p>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-500">Configure offline submission settings for this assignment.</p>

              {/* Warning banner if commitments exist */}
              {commitmentsExist && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-xs font-semibold text-red-700">
                      Fallback policy cannot be quietly changed
                    </p>
                    <p className="text-[11px] text-red-600 leading-relaxed">
                      This assignment already has student commitments. Disabling or significantly changing the fallback policy may result in students and instructors being out of sync. All changes are recorded in the audit log below.
                    </p>
                    <a href="#" className="text-[11px] font-medium text-red-600 hover:underline" title="TODO: Learn more link">
                      Learn more
                    </a>
                  </div>
                </div>
              )}

              {/* Fallback enabled toggle */}
              <div className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800">
                    Enable Connectivity Fallback
                  </p>
                  <p className="text-xs text-gray-500">
                    Allow students to commit work offline and sync when they reconnect.
                  </p>
                </div>
                <div className="shrink-0 flex items-center">
                  <button
                    type="button"
                    onClick={() => !commitmentsExist && setFallbackEnabled(!fallbackEnabled)}
                    disabled={commitmentsExist}
                    title={commitmentsExist ? 'Cannot change: commitments already exist' : ''}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      fallbackEnabled ? 'bg-green-500' : 'bg-gray-300'
                    } ${commitmentsExist ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        fallbackEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Grace Period */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
              <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-semibold text-gray-800">Grace Period</p>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-gray-500">Allow late submissions within a short window.</p>

              {/* TODO: Grace period changes are less destructive than disabling fallback entirely per the PRD.
                  This is editable regardless of commitment state. Assumption: grace period changes don't
                  break existing commitments as noted in the PRD. */}

              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Days</label>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={gracePeriodDays}
                    onChange={e => setGracePeriodDays(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-700 mb-1">Display</p>
                  <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                    <p className="text-sm text-gray-700 font-medium">{gracePeriodLabel(gracePeriodDays * 24 * 60)}</p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-400">
                Students can still upload files during this period if they miss the deadline.
              </p>
            </div>
          </div>

          {/* File Rules */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
              <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm font-semibold text-gray-800">File Rules</p>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-500">Specify allowed file types and size limits.</p>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Allowed file types</label>
                <input
                  type="text"
                  placeholder=".pdf, .docx, .zip, .py"
                  value={allowedFileTypes}
                  onChange={e => setAllowedFileTypes(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <p className="text-xs text-gray-400 mt-1">Comma-separated (e.g. .pdf, .docx, .zip)</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Max file size</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={maxFileSizeMb}
                    onChange={e => setMaxFileSizeMb(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                  <span className="text-sm font-medium text-gray-600">MB</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">Maximum 500 MB per file</p>
              </div>
            </div>
          </div>

          {/* Audit / Policy Change Log */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm font-semibold text-gray-800">Audit / Policy Change Log</p>
              </div>
              <a
                href="#"
                className="text-xs font-medium text-blue-600 hover:underline"
                title="TODO: Full history view not yet implemented"
              >
                View Full History
              </a>
            </div>

            {auditEvents.length === 0 ? (
              <div className="p-5 text-center">
                <p className="text-xs text-gray-400">No policy changes recorded yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-gray-100 bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Date & Time</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Changed By</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Change</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {auditEvents.map(event => (
                      <tr key={event.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-600">
                          {formatDateTime(event.created_at)}
                        </td>
                        <td className="px-4 py-2 text-gray-600">
                          {event.actor?.full_name || event.actor?.email || 'Unknown'}
                        </td>
                        <td className="px-4 py-2 text-gray-600 capitalize">
                          {formatAuditEvent(event.event_type)}
                        </td>
                        <td className="px-4 py-2 text-gray-500">
                          {event.metadata_json
                            ? JSON.stringify(event.metadata_json)
                              .slice(0, 50)
                              .replace(/[{}]/g, '')
                              .replace(/"/g, '')
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Close Assignment card */}
        <div className="w-72 shrink-0 space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
              <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-gray-800">Close Assignment</p>
                <p className="text-[11px] text-gray-400">Manually close this assignment to prevent further submissions.</p>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                <p className="text-xs font-semibold text-amber-800">⚠ This action cannot be undone.</p>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  Students will no longer be able to upload or sync files, even during the grace period.
                </p>
              </div>

              {/* Archive confirm step */}
              {state === 'confirming-archive' && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-600">Are you sure? This cannot be reversed.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleArchive()}
                      disabled={state !== 'confirming-archive'}
                      className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
                    >
                      Yes, close now
                    </button>
                    <button
                      onClick={() => setState('idle')}
                      className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {state !== 'confirming-archive' && (
                <button
                  onClick={() => handleArchive()}
                  className="w-full rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors"
                >
                  Close Assignment Now
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
        <div className="text-xs text-gray-400">
          {hasChanges ? 'You have unsaved changes' : 'All changes saved'}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => router.push(`/lecturer/assignments/${assignmentId}`)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || state === 'saving'}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {state === 'saving' ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
