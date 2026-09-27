'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { fetchLecturerCourses, type CourseOption } from '@/features/assignments/fetchLecturerCourses'

const FILE_TYPES = [
  { mime: 'application/pdf', label: 'PDF' },
  { mime: 'image/png', label: 'PNG image' },
  { mime: 'image/jpeg', label: 'JPEG image' },
  { mime: 'text/plain', label: 'UTF-8 text' },
] as const
const SIZE_OPTIONS = [1, 5, 10, 25, 50]

async function responseError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null)
  return body?.error?.message ?? `Request failed (${response.status}).`
}

export default function CreateAssignmentPage() {
  const router = useRouter()
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [courseId, setCourseId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deadlineLocal, setDeadlineLocal] = useState('')
  const [mimeTypes, setMimeTypes] = useState<string[]>(['application/pdf'])
  const [maxSizeMb, setMaxSizeMb] = useState(10)
  const [graceMinutes, setGraceMinutes] = useState(0)
  const [fallbackEnabled, setFallbackEnabled] = useState(true)
  const [courseLoadError, setCourseLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedDraftUrl, setSavedDraftUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void fetchLecturerCourses()
      .then((loadedCourses) => { if (active) setCourses(loadedCourses) })
      .catch((caught: unknown) => {
        if (active) setCourseLoadError(caught instanceof Error ? caught.message : 'Courses could not be loaded.')
      })
    return () => { active = false }
  }, [])

  function toggleMimeType(mimeType: string) {
    setMimeTypes((current) => current.includes(mimeType)
      ? current.filter((value) => value !== mimeType)
      : [...current, mimeType])
  }

  async function save(status: 'draft' | 'published') {
    setError(null)
    setSavedDraftUrl(null)
    if (!title.trim() || !courseId) {
      setError('Enter an assignment title and choose a course.')
      return
    }
    if (status === 'published' && (!description.trim() || !deadlineLocal || mimeTypes.length === 0)) {
      setError('Add a description, future deadline, and at least one supported file type before publishing.')
      return
    }
    const deadline = deadlineLocal ? new Date(deadlineLocal) : new Date(Date.now() + 7 * 24 * 60 * 60_000)
    if (!Number.isFinite(deadline.getTime()) || (status === 'published' && deadline.getTime() <= Date.now())) {
      setError('The assignment deadline must be in the future.')
      return
    }

    setSaving(true)
    try {
      const createdResponse = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          title: title.trim(),
          description: description.trim(),
          policy: {
            deadlineAt: deadline.toISOString(),
            fallbackEnabled,
            gracePeriodMinutes: graceMinutes,
            allowedMimeTypes: mimeTypes,
            maxFileSizeBytes: maxSizeMb * 1024 * 1024,
          },
        }),
      })
      if (!createdResponse.ok) throw new Error(await responseError(createdResponse))
      const created = await createdResponse.json() as { data?: { id?: string } }
      const assignmentId = created.data?.id
      if (!assignmentId) throw new Error('The server did not return the saved draft.')
      const url = `/lecturer/assignments/${assignmentId}`
      setSavedDraftUrl(url)
      if (status === 'draft') {
        router.push(url)
        return
      }

      const publishResponse = await fetch(`/api/assignments/${assignmentId}/publish`, { method: 'POST' })
      if (!publishResponse.ok) {
        setError(`Draft saved, but publishing failed: ${await responseError(publishResponse)}`)
        return
      }
      router.push(url)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The assignment could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/lecturer/assignments" className="text-sm font-medium text-blue-700 hover:underline">← Back to assignments</Link>
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Create assignment</h1>
        <p className="mt-1 text-sm text-gray-600">The fallback rules are recorded as a versioned policy when this assignment is created.</p>
      </div>
      {courseLoadError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">Courses could not be loaded: {courseLoadError}</p>}
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}{savedDraftUrl && <p className="mt-2"><Link className="font-semibold underline" href={savedDraftUrl}>Open saved draft</Link></p>}</div>}

      <section className="space-y-5 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <label htmlFor="assignment-title" className="mb-1 block text-sm font-medium text-gray-700">Title</label>
          <input id="assignment-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="assignment-course" className="mb-1 block text-sm font-medium text-gray-700">Course</label>
          <select id="assignment-course" value={courseId} onChange={(event) => setCourseId(event.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
            <option value="">Choose a course</option>
            {courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}
          </select>
          {courses.length === 0 && <p className="mt-1 text-xs text-gray-500">No owned courses are available. Course setup is managed outside this phase.</p>}
        </div>
        <div>
          <label htmlFor="assignment-description" className="mb-1 block text-sm font-medium text-gray-700">Description</label>
          <textarea id="assignment-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={4} maxLength={10000} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="assignment-deadline" className="mb-1 block text-sm font-medium text-gray-700">Deadline</label>
            <input id="assignment-deadline" type="datetime-local" value={deadlineLocal} onChange={(event) => setDeadlineLocal(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <p className="mt-1 text-xs text-gray-500">A draft with no deadline uses a temporary deadline 7 days from creation.</p>
          </div>
          <div>
            <label htmlFor="assignment-size" className="mb-1 block text-sm font-medium text-gray-700">Maximum file size</label>
            <select id="assignment-size" value={maxSizeMb} onChange={(event) => setMaxSizeMb(Number(event.target.value))} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
              {SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size} MiB</option>)}
            </select>
          </div>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-gray-700">Allowed file types</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {FILE_TYPES.map((fileType) => (
              <label key={fileType.mime} className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={mimeTypes.includes(fileType.mime)} onChange={() => toggleMimeType(fileType.mime)} />
                {fileType.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="grace-minutes" className="mb-1 block text-sm font-medium text-gray-700">Fallback upload grace period (minutes)</label>
          <input id="grace-minutes" type="number" min={0} max={2147483647} value={graceMinutes} onChange={(event) => setGraceMinutes(Math.max(0, Number(event.target.value) || 0))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <label className="flex items-start gap-3 rounded-lg bg-blue-50 p-4 text-sm text-gray-800">
          <input type="checkbox" checked={fallbackEnabled} onChange={(event) => setFallbackEnabled(event.target.checked)} className="mt-0.5" />
          <span><strong>Enable connectivity fallback</strong><span className="mt-1 block text-xs text-gray-600">Students can record simulated fallback evidence in local/test environments and upload the file later.</span></span>
        </label>
      </section>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => void save('draft')} disabled={saving || courses.length === 0} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save as draft'}</button>
        <button type="button" onClick={() => void save('published')} disabled={saving || courses.length === 0} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Publish assignment'}</button>
      </div>
    </div>
  )
}
