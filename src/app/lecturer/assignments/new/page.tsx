'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { parseGracePeriodMinutes, validateCreateAssignment } from '@/features/assignments/assignmentEditor'
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
  const [graceInput, setGraceInput] = useState('0')
  const [fallbackEnabled, setFallbackEnabled] = useState(true)
  const [coursesLoading, setCoursesLoading] = useState(true)
  const [courseReloadKey, setCourseReloadKey] = useState(0)
  const [courseLoadError, setCourseLoadError] = useState<string | null>(null)
  const [savingAction, setSavingAction] = useState<'draft' | 'published' | null>(null)
  const [savingStep, setSavingStep] = useState<'saving' | 'publishing' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [validationField, setValidationField] = useState<string | null>(null)
  const [savedDraftUrl, setSavedDraftUrl] = useState<string | null>(null)
  const [savedDraftId, setSavedDraftId] = useState<string | null>(null)
  const saving = savingAction !== null

  useEffect(() => {
    let active = true
    void fetchLecturerCourses()
      .then((loadedCourses) => { if (active) setCourses(loadedCourses) })
      .catch((caught: unknown) => {
        if (active) setCourseLoadError(caught instanceof Error ? caught.message : 'Courses could not be loaded.')
      })
      .finally(() => { if (active) setCoursesLoading(false) })
    return () => { active = false }
  }, [courseReloadKey])

  function reloadCourses() {
    setCoursesLoading(true)
    setCourseLoadError(null)
    setCourses([])
    setCourseReloadKey((key) => key + 1)
  }

  function toggleMimeType(mimeType: string) {
    setMimeTypes((current) => current.includes(mimeType)
      ? current.filter((value) => value !== mimeType)
      : [...current, mimeType])
    clearValidation('assignment-file-types')
  }

  function clearValidation(field: string) {
    if (validationField === field) {
      setValidationField(null)
      setError(null)
    }
  }

  async function publishDraft(assignmentId: string) {
    const publishResponse = await fetch(`/api/assignments/${assignmentId}/publish`, { method: 'POST' })
    if (!publishResponse.ok) throw new Error(await responseError(publishResponse))
    router.push(`/lecturer/assignments/${assignmentId}`)
  }

  async function retryPublish() {
    if (!savedDraftId) return
    setError(null)
    setSavingAction('published')
    setSavingStep('publishing')
    try {
      await publishDraft(savedDraftId)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The saved draft could not be published.')
    } finally {
      setSavingAction(null)
      setSavingStep(null)
    }
  }

  async function save(status: 'draft' | 'published') {
    setError(null)
    setValidationField(null)
    if (savedDraftId) {
      if (status === 'published') await retryPublish()
      else router.push(`/lecturer/assignments/${savedDraftId}`)
      return
    }
    const validation = validateCreateAssignment({ title, courseId, description, deadlineLocal, mimeTypes, graceInput }, status, new Date())
    if (validation) {
      setError(validation.message)
      setValidationField(validation.field)
      requestAnimationFrame(() => document.getElementById(validation.field)?.focus())
      return
    }
    const graceMinutes = parseGracePeriodMinutes(graceInput)
    if (graceMinutes === null) return
    const deadline = deadlineLocal ? new Date(deadlineLocal) : new Date(Date.now() + 7 * 24 * 60 * 60_000)

    setSavingAction(status)
    setSavingStep('saving')
    let draftSaved = false
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
      draftSaved = true
      setSavedDraftUrl(url)
      setSavedDraftId(assignmentId)
      if (status === 'draft') {
        router.push(url)
        return
      }

      setSavingStep('publishing')
      await publishDraft(assignmentId)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'The assignment could not be saved.'
      setError(draftSaved ? `Draft saved, but publishing failed: ${message}` : message)
    } finally {
      setSavingAction(null)
      setSavingStep(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/lecturer/assignments" className="text-sm font-medium text-blue-700 hover:underline">← Back to assignments</Link>
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Create assignment</h1>
        <p className="mt-1 text-sm text-gray-600">To publish now, choose a future deadline and at least one file type. A description is optional.</p>
      </div>
      {coursesLoading && <p role="status" aria-live="polite" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">Loading courses linked to your lecturer account…</p>}
      {courseLoadError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><p>Courses could not be loaded: {courseLoadError}</p><button type="button" onClick={reloadCourses} className="mt-2 font-semibold underline">Try loading courses again</button></div>}
      {!coursesLoading && !courseLoadError && courses.length === 0 && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">No course is linked to this lecturer account yet. Ask your institution administrator to assign a course, then reload this page.</p>}
      {error && <div id="assignment-error" role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><p>{error}</p>{savedDraftUrl && <><p className="mt-2">Open the saved draft to change its details. Retrying publishes the already saved version.</p><div className="mt-2 flex flex-wrap items-center gap-4"><Link className="font-semibold underline" href={savedDraftUrl}>Open saved draft</Link>{savedDraftId && <button type="button" disabled={saving} onClick={() => void retryPublish()} className="font-semibold underline disabled:cursor-wait disabled:opacity-60">{saving ? 'Publishing…' : 'Retry publishing'}</button>}</div></>}</div>}

      <section className="space-y-5 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <label htmlFor="assignment-title" className="mb-1 block text-sm font-medium text-gray-700">Title</label>
          <input id="assignment-title" value={title} onChange={(event) => { setTitle(event.target.value); clearValidation('assignment-title') }} aria-invalid={validationField === 'assignment-title'} aria-describedby={validationField === 'assignment-title' ? 'assignment-error' : undefined} placeholder="For example: Research Methods Essay" maxLength={200} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 placeholder:opacity-100" />
          {validationField === 'assignment-title' && <p className="mt-1 text-sm text-red-700">{error}</p>}
        </div>
        <div>
          <label htmlFor="assignment-course" className="mb-1 block text-sm font-medium text-gray-700">Course</label>
          <select id="assignment-course" value={courseId} onChange={(event) => { setCourseId(event.target.value); clearValidation('assignment-course') }} aria-invalid={validationField === 'assignment-course'} aria-describedby={validationField === 'assignment-course' ? 'assignment-error' : undefined} disabled={coursesLoading || Boolean(courseLoadError) || courses.length === 0} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-600">
            <option value="">Choose a course</option>
            {courses.map((course) => <option key={course.id} value={course.id} className="text-gray-900">{course.code} · {course.title}</option>)}
          </select>
          {validationField === 'assignment-course' && <p className="mt-1 text-sm text-red-700">{error}</p>}
        </div>
        <div>
          <label htmlFor="assignment-description" className="mb-1 block text-sm font-medium text-gray-700">Description <span className="text-gray-500">(optional)</span></label>
          <textarea id="assignment-description" value={description} onChange={(event) => { setDescription(event.target.value); clearValidation('assignment-description') }} aria-invalid={validationField === 'assignment-description'} aria-describedby={validationField === 'assignment-description' ? 'assignment-error' : undefined} placeholder="Describe the task and submission requirements." rows={4} maxLength={10000} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 placeholder:opacity-100" />
          {validationField === 'assignment-description' && <p className="mt-1 text-sm text-red-700">{error}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="assignment-deadline" className="mb-1 block text-sm font-medium text-gray-700">Deadline <span className="text-gray-500">(required to publish)</span></label>
            <input id="assignment-deadline" type="datetime-local" value={deadlineLocal} onChange={(event) => { setDeadlineLocal(event.target.value); clearValidation('assignment-deadline') }} aria-invalid={validationField === 'assignment-deadline'} aria-describedby={validationField === 'assignment-deadline' ? 'assignment-error' : undefined} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
            {validationField === 'assignment-deadline' && <p className="mt-1 text-sm text-red-700">{error}</p>}
            <p className="mt-1 text-xs text-gray-500">A draft with no deadline uses a temporary deadline 7 days from creation.</p>
          </div>
          <div>
            <label htmlFor="assignment-size" className="mb-1 block text-sm font-medium text-gray-700">Maximum file size</label>
            <select id="assignment-size" value={maxSizeMb} onChange={(event) => setMaxSizeMb(Number(event.target.value))} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
              {SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size} MiB</option>)}
            </select>
          </div>
        </div>
        <fieldset id="assignment-file-types" tabIndex={-1} aria-describedby={validationField === 'assignment-file-types' ? 'assignment-error' : undefined}>
          <legend className="mb-2 text-sm font-medium text-gray-700">Allowed file types</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {FILE_TYPES.map((fileType) => (
              <label key={fileType.mime} className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={mimeTypes.includes(fileType.mime)} onChange={() => toggleMimeType(fileType.mime)} />
                {fileType.label}
              </label>
            ))}
          </div>
          {validationField === 'assignment-file-types' && <p className="mt-1 text-sm text-red-700">{error}</p>}
        </fieldset>
        <div>
          <label htmlFor="grace-minutes" className="mb-1 block text-sm font-medium text-gray-700">Fallback upload grace period (minutes)</label>
          <input id="grace-minutes" type="number" min={0} max={2147483647} step={1} inputMode="numeric" value={graceInput} onChange={(event) => { setGraceInput(event.target.value); clearValidation('grace-minutes') }} aria-invalid={validationField === 'grace-minutes'} aria-describedby={validationField === 'grace-minutes' ? 'assignment-error grace-help' : 'grace-help'} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
          {validationField === 'grace-minutes' && <p className="mt-1 text-sm text-red-700">{error}</p>}
          <p id="grace-help" className="mt-1 text-xs text-gray-600">0 means the file must arrive before the deadline. Enter a larger number to allow upload after the deadline.</p>
        </div>
        <label className="flex items-start gap-3 rounded-lg bg-blue-50 p-4 text-sm text-gray-800">
          <input type="checkbox" checked={fallbackEnabled} onChange={(event) => setFallbackEnabled(event.target.checked)} className="mt-0.5" />
          <span><strong>Enable connectivity fallback</strong><span className="mt-1 block text-xs text-gray-600">Students can send a file fingerprint by configured SMS or local simulator, then upload the original file when online again.</span></span>
        </label>
      </section>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => void save('draft')} disabled={saving || coursesLoading || Boolean(courseLoadError) || courses.length === 0} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500">{savingAction === 'draft' ? 'Saving draft…' : savedDraftId ? 'Open saved draft' : 'Save as draft'}</button>
        <button type="button" onClick={() => void save('published')} disabled={saving || coursesLoading || Boolean(courseLoadError) || courses.length === 0} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-400">{savingAction === 'published' ? (savingStep === 'publishing' ? 'Publishing…' : 'Saving draft…') : savedDraftId ? 'Retry publishing saved draft' : 'Publish assignment'}</button>
        {saving && <p role="status" aria-live="polite" className="self-center text-sm text-gray-600">{savingAction === 'published' && savingStep === 'publishing' ? 'Publishing your saved assignment…' : 'Saving the assignment…'}</p>}
      </div>
    </div>
  )
}
