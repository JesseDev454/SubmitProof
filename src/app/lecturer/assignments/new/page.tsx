'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { draftSchema, publishSchema } from '@/lib/validation/assignment'
import { fetchLecturerCourses, type CourseOption } from '@/features/assignments/fetchLecturerCourses'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FILE_SIZE_OPTIONS = [
  { label: '10 MB', value: 10 },
  { label: '25 MB', value: 25 },
  { label: '50 MB', value: 50 },
  { label: '100 MB', value: 100 },
]

const GRACE_PERIOD_OPTIONS = [
  { label: '0 days (no grace)', value: 0 },
  { label: '3 days', value: 3 },
  { label: '7 days', value: 7 },
  { label: '14 days', value: 14 },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDeadlinePreview(date: string, time: string): string {
  if (!date || !time) return '—'
  try {
    const d = new Date(`${date}T${time}`)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  } catch {
    return '—'
  }
}

function gracePeriodLabel(days: number): string {
  if (days === 0) return 'No grace period'
  return `${days} day${days === 1 ? '' : 's'} after deadline`
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-gray-100 px-5 py-4">
        <span className="text-blue-600">{icon}</span>
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-sm font-medium text-gray-700">
      {children}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${props.className ?? ''}`}
    />
  )
}

function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${props.className ?? ''}`}
    >
      {children}
    </select>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`}
      />
    </button>
  )
}

// ---------------------------------------------------------------------------
// Preview panel row
// ---------------------------------------------------------------------------

function PreviewRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 text-gray-400">{icon}</span>
      <span className="w-20 shrink-0 text-xs text-gray-400">{label}</span>
      <span className="text-xs font-medium text-gray-800">{value || '—'}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CreateAssignmentPage() {
  const router = useRouter()

  // Form state
  const [title, setTitle] = useState('')
  const [courseId, setCourseId] = useState('')
  const [description, setDescription] = useState('')
  const [deadlineDate, setDeadlineDate] = useState('')
  const [deadlineTime, setDeadlineTime] = useState('')
  const [allowedFileTypes, setAllowedFileTypes] = useState('')
  const [maxFileSizeMb, setMaxFileSizeMb] = useState(50)
  const [gracePeriodDays, setGracePeriodDays] = useState(0)
  const [fallbackEnabled, setFallbackEnabled] = useState(true)

  // UI state
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [coursesLoading, setCoursesLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  // Load courses on mount
  useEffect(() => {
    fetchLecturerCourses().then(data => {
      setCourses(data)
      setCoursesLoading(false)
    })
  }, [])

  // Derived: course label for preview
  const selectedCourse = courses.find(c => c.id === courseId)
  const courseLabelForPreview = selectedCourse
    ? `${selectedCourse.code} – ${selectedCourse.title}`
    : courseId ? courseId : '—'

  // Derived: "Ready to Publish" vs "Missing required fields"
  const isReady = Boolean(title && courseId && description && deadlineDate && deadlineTime && allowedFileTypes)

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  async function handleSubmit(status: 'draft' | 'published') {
    setSubmitError(null)
    setValidationErrors({})

    const formValues = {
      title,
      course_id: courseId,
      description,
      deadline_date: deadlineDate,
      deadline_time: deadlineTime,
      allowed_file_types: allowedFileTypes,
      max_file_size_mb: maxFileSizeMb,
      grace_period_days: gracePeriodDays,
      fallback_enabled: fallbackEnabled,
      status,
    }

    // Validate
    const schema = status === 'published' ? publishSchema : draftSchema
    const parsed = schema.safeParse(formValues)
    if (!parsed.success) {
      const errors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as string
        if (!errors[key]) errors[key] = issue.message
      }
      setValidationErrors(errors)
      return
    }

    // Build API payload
    let deadline_at: string | undefined
    if (deadlineDate && deadlineTime) {
      deadline_at = new Date(`${deadlineDate}T${deadlineTime}`).toISOString()
    }

    const payload = {
      title,
      course_id: courseId,
      description,
      deadline_at,
      allowed_file_types: allowedFileTypes
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
      max_file_size_bytes: maxFileSizeMb * 1024 * 1024,
      grace_period_minutes: gracePeriodDays * 24 * 60,
      fallback_enabled: fallbackEnabled,
      status,
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setSubmitError(body?.error ?? `Server error (${res.status}) — the API endpoint may not be implemented yet.`)
        return
      }

      const data = await res.json()
      router.push(`/lecturer/assignments/${data.id}`)
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Network error — the /api/assignments endpoint may not be implemented yet.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Create Assignment</h1>
        <p className="mt-1 text-sm text-gray-500">
          Set up a new assignment with secure submission and offline support.
        </p>
      </div>

      {/* Error banner */}
      {submitError && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm text-red-700">{submitError}</p>
          <button onClick={() => setSubmitError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Two-column layout */}
      <div className="flex gap-6 items-start">
        {/* ---- LEFT: form ---- */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Basic Information */}
          <SectionCard
            title="Basic Information"
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
          >
            <div className="space-y-4">
              {/* Title + Course */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label required>Title</Label>
                  <Input
                    placeholder="Lab 5 – Sorting Algorithms"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                  />
                  {validationErrors.title && (
                    <p className="mt-1 text-xs text-red-500">{validationErrors.title}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">A clear and descriptive title for your assignment.</p>
                </div>
                <div>
                  <Label required>Course</Label>
                  {coursesLoading ? (
                    <div className="flex h-9 items-center rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-400">
                      Loading courses…
                    </div>
                  ) : (
                    <Select value={courseId} onChange={e => setCourseId(e.target.value)}>
                      <option value="">
                        {courses.length === 0 ? 'No courses found' : 'Select a course'}
                      </option>
                      {courses.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.code} – {c.title}
                        </option>
                      ))}
                    </Select>
                  )}
                  {validationErrors.course_id && (
                    <p className="mt-1 text-xs text-red-500">{validationErrors.course_id}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">Select the course for this assignment.</p>
                </div>
              </div>

              {/* Description */}
              <div>
                <Label required>Description</Label>
                {/* TODO: rich-text formatting not implemented — this is a plain textarea.
                    The toolbar icons below are decorative placeholders only. */}
                <textarea
                  rows={5}
                  placeholder="In this assignment, you will implement and compare sorting algorithms…"
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
                      className="flex h-6 w-6 items-center justify-center rounded text-xs font-bold text-gray-500 hover:bg-gray-200"
                      style={{
                        fontStyle: btn.italic ? 'italic' : undefined,
                        textDecoration: btn.underline ? 'underline' : undefined,
                      }}
                    >
                      {btn.label}
                    </button>
                  ))}
                  <div className="mx-1 h-4 w-px bg-gray-300" />
                  {/* Unordered list icon */}
                  <button type="button" title="Bullet list" className="flex h-6 w-6 items-center justify-center rounded text-gray-500 hover:bg-gray-200">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                  {/* Ordered list icon */}
                  <button type="button" title="Numbered list" className="flex h-6 w-6 items-center justify-center rounded text-gray-500 hover:bg-gray-200">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l4 4-4 4M4 6h.01M4 12h.01M4 18h.01M9 17l4-4" />
                    </svg>
                  </button>
                  {/* Link icon */}
                  <button type="button" title="Insert link" className="flex h-6 w-6 items-center justify-center rounded text-gray-500 hover:bg-gray-200">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </button>
                </div>
                {validationErrors.description && (
                  <p className="mt-1 text-xs text-red-500">{validationErrors.description}</p>
                )}
                <p className="mt-1 text-xs text-gray-400">Provide detailed instructions, expectations, and any relevant information.</p>
              </div>

              {/* Deadline + Allowed File Types */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label required>Deadline</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-500">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </span>
                      <Input
                        type="date"
                        value={deadlineDate}
                        onChange={e => setDeadlineDate(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                    <div className="relative flex-1">
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-500">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </span>
                      <Input
                        type="time"
                        value={deadlineTime}
                        onChange={e => setDeadlineTime(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  {(validationErrors.deadline_date || validationErrors.deadline_time) && (
                    <p className="mt-1 text-xs text-red-500">
                      {validationErrors.deadline_date ?? validationErrors.deadline_time}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">Students in your local time zone.</p>
                </div>
                <div>
                  <Label required>Allowed File Types</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-500">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </span>
                    <Input
                      placeholder=".pdf, .docx, .zip, .py"
                      value={allowedFileTypes}
                      onChange={e => setAllowedFileTypes(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  {validationErrors.allowed_file_types && (
                    <p className="mt-1 text-xs text-red-500">{validationErrors.allowed_file_types}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">Enter file extensions separated by commas.</p>
                </div>
              </div>

              {/* File Size + Grace Period */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label required>File Size Limit</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-500">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </span>
                    <Select
                      value={maxFileSizeMb}
                      onChange={e => setMaxFileSizeMb(Number(e.target.value))}
                      className="pl-8"
                    >
                      {FILE_SIZE_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </Select>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">Maximum size per file.</p>
                </div>
                <div>
                  <Label required>Allowed Grace Period</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-500">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </span>
                    <Select
                      value={gracePeriodDays}
                      onChange={e => setGracePeriodDays(Number(e.target.value))}
                      className="pl-8"
                    >
                      {GRACE_PERIOD_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </Select>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">Students can still upload within this period if needed.</p>
                </div>
              </div>

              {/* Fallback toggle */}
              <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100">
                      <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Enable Connectivity Fallback</p>
                      <p className="text-xs text-green-700">
                        Allow students to submit offline and sync when they&apos;re back online.
                      </p>
                    </div>
                  </div>
                  <Toggle checked={fallbackEnabled} onChange={setFallbackEnabled} />
                </div>
                <p className="mt-2 pl-11 text-xs text-gray-500">
                  Recommended for better accessibility and a more inclusive experience.
                </p>
              </div>

              {/* Additional Resources */}
              {/* TODO: This section is visual-only. Persisting resources requires a
                  `resources` field on the assignments table — flagged as an open
                  question for Goodluck before this can be wired up. */}
              <div>
                <p className="mb-1 text-sm font-semibold text-gray-800">
                  Additional Resources <span className="font-normal text-gray-400">(Optional)</span>
                </p>
                <p className="mb-3 text-xs text-gray-400">
                  Attach files or links to help students complete the assignment.
                </p>
                <div className="flex gap-3">
                  {/* Drop zone — visual only */}
                  <div className="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer">
                    <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <p className="text-xs text-blue-600">
                      Drag and drop files here, or <span className="underline">browse</span>
                    </p>
                    <p className="text-[11px] text-gray-400">Support for PDF, DOCX, ZIP and more (max 50 MB each).</p>
                  </div>
                  {/* Add Link — visual only */}
                  <button
                    type="button"
                    className="flex shrink-0 items-center gap-2 self-stretch rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-blue-600 hover:bg-gray-50 transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    Add Link
                  </button>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit('draft')}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Save as Draft
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit('published')}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              {submitting ? 'Saving…' : 'Publish Assignment'}
            </button>
          </div>
          <p className="text-center text-xs text-gray-400">
            Students will be able to see and submit this assignment once it&apos;s published.
          </p>
        </div>

        {/* ---- RIGHT: live preview ---- */}
        <div className="w-72 shrink-0 space-y-4">

          {/* Ready to publish badge */}
          {isReady ? (
            <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-500">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-green-800">Ready to Publish</p>
                <p className="text-xs text-green-600">All required fields are completed.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-800">Missing required fields</p>
                <p className="text-xs text-amber-600">Fill in all required fields to publish.</p>
              </div>
            </div>
          )}

          {/* Assignment Policy Summary */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
              <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-gray-800">Assignment Policy Summary</p>
                <p className="text-xs text-gray-400">Review the key details for this assignment.</p>
              </div>
            </div>
            <div className="divide-y divide-gray-50 px-4">
              <PreviewRow
                icon={<svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                label="Title"
                value={title || '—'}
              />
              <PreviewRow
                icon={<svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
                label="Course"
                value={courseLabelForPreview}
              />
              <PreviewRow
                icon={<svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                label="Deadline"
                value={formatDeadlinePreview(deadlineDate, deadlineTime)}
              />
              <PreviewRow
                icon={<svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                label="Grace Period"
                value={gracePeriodLabel(gracePeriodDays)}
              />
            </div>
          </div>

          {/* Submission Rules */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
              <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-gray-800">Submission Rules</p>
                <p className="text-xs text-gray-400">These settings control what students can submit.</p>
              </div>
            </div>
            <div className="divide-y divide-gray-50 px-4">
              <PreviewRow
                icon={<svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                label="Allowed File Types"
                value={allowedFileTypes || '—'}
              />
              <PreviewRow
                icon={<svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                label="File Size Limit"
                value={`${maxFileSizeMb} MB per file`}
              />
            </div>
          </div>

          {/* Fallback Policy */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
              <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-gray-800">Fallback Policy</p>
                <p className="text-xs text-gray-400">Ensure no work is lost, even without internet.</p>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {fallbackEnabled ? (
                <div className="flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2.5">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <p className="text-xs font-semibold text-green-800">Connectivity fallback is enabled</p>
                    <p className="text-xs text-green-600">Students can submit offline and sync when they&apos;re back online.</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M3 3l18 18" />
                  </svg>
                  <div>
                    <p className="text-xs font-semibold text-gray-600">Fallback disabled</p>
                    <p className="text-xs text-gray-400">Students must be online to submit.</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3 py-1">
                <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-xs font-semibold text-gray-700">Grace Period</p>
                  <p className="text-xs text-gray-500">
                    {gracePeriodDays > 0
                      ? `${gracePeriodDays} day${gracePeriodDays === 1 ? '' : 's'} — gives students extra time to upload after the deadline if needed.`
                      : 'No grace period configured.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Good to know */}
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-semibold text-blue-800">Good to know</p>
            </div>
            <p className="text-xs text-blue-700 leading-relaxed">
              Students will receive notifications about this assignment once it&apos;s published.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
