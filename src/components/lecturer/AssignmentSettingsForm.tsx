'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { parseGracePeriodMinutes } from '@/features/assignments/assignmentEditor'

const FILE_TYPES = [
  { mime: 'application/pdf', label: 'PDF' },
  { mime: 'image/png', label: 'PNG image' },
  { mime: 'image/jpeg', label: 'JPEG image' },
  { mime: 'text/plain', label: 'UTF-8 text' },
] as const

export type AssignmentSettingsInput = {
  id: string
  title: string
  description: string | null
  policy: {
    deadlineAt: string
    fallbackEnabled: boolean
    gracePeriodMinutes: number
    allowedMimeTypes: string[]
    maxFileSizeBytes: number
  }
}

export default function AssignmentSettingsForm({ initial }: { initial: AssignmentSettingsInput }) {
  const router = useRouter()
  const [title, setTitle] = useState(initial.title)
  const [description, setDescription] = useState(initial.description ?? '')
  const [deadlineLocal, setDeadlineLocal] = useState(() => {
    const deadline = new Date(initial.policy.deadlineAt)
    return new Date(deadline.getTime() - deadline.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
  })
  const [fallbackEnabled, setFallbackEnabled] = useState(initial.policy.fallbackEnabled)
  const [graceInput, setGraceInput] = useState(String(initial.policy.gracePeriodMinutes))
  const [allowedMimeTypes, setAllowedMimeTypes] = useState(initial.policy.allowedMimeTypes)
  const [maxSizeMb, setMaxSizeMb] = useState(initial.policy.maxFileSizeBytes / 1024 / 1024)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function toggleMimeType(mimeType: string) {
    setAllowedMimeTypes((current) => current.includes(mimeType)
      ? current.filter((value) => value !== mimeType)
      : [...current, mimeType])
  }

  async function save() {
    setError(null)
    setMessage(null)
    const gracePeriodMinutes = parseGracePeriodMinutes(graceInput)
    if (gracePeriodMinutes === null) {
      setError('Enter a whole number of grace minutes from 0 to 2147483647.')
      document.getElementById('settings-grace')?.focus()
      return
    }
    setSaving(true)
    try {
      const response = await fetch(`/api/assignments/${initial.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          policy: {
            deadlineAt: new Date(deadlineLocal).toISOString(),
            fallbackEnabled,
            gracePeriodMinutes,
            allowedMimeTypes,
            maxFileSizeBytes: maxSizeMb * 1024 * 1024,
          },
        }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error?.message ?? `Request failed (${response.status}).`)
      }
      setMessage('Draft settings saved. A new policy version was recorded if the policy changed.')
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The settings could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href={`/lecturer/assignments/${initial.id}`} className="text-sm font-medium text-blue-700 hover:underline">← Back to assignment</Link>
      <h1 className="text-3xl font-bold text-gray-900">Draft settings</h1>
      {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <section className="space-y-5 rounded-xl border border-gray-200 bg-white p-6">
        <div><label htmlFor="settings-title" className="mb-1 block text-sm font-medium">Title</label><input id="settings-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-500" /></div>
        <div><label htmlFor="settings-description" className="mb-1 block text-sm font-medium">Description</label><textarea id="settings-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={4} maxLength={10000} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-500" /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="settings-deadline" className="mb-1 block text-sm font-medium">Deadline</label><input id="settings-deadline" type="datetime-local" value={deadlineLocal} onChange={(event) => setDeadlineLocal(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900" /></div>
          <div><label htmlFor="settings-size" className="mb-1 block text-sm font-medium">Maximum size</label><select id="settings-size" value={maxSizeMb} onChange={(event) => setMaxSizeMb(Number(event.target.value))} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900">{[1, 5, 10, 25, 50].map((size) => <option key={size} value={size}>{size} MiB</option>)}</select></div>
        </div>
        <fieldset><legend className="mb-2 text-sm font-medium">Allowed file types</legend><div className="grid gap-2 sm:grid-cols-2">{FILE_TYPES.map((fileType) => <label key={fileType.mime} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allowedMimeTypes.includes(fileType.mime)} onChange={() => toggleMimeType(fileType.mime)} />{fileType.label}</label>)}</div></fieldset>
        <div><label htmlFor="settings-grace" className="mb-1 block text-sm font-medium">Fallback grace period (minutes)</label><input id="settings-grace" type="number" min={0} max={2147483647} step={1} inputMode="numeric" value={graceInput} onChange={(event) => setGraceInput(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900" /><p className="mt-1 text-xs text-gray-600">0 allows no upload after the deadline. A longer period gives students time to upload the committed file.</p></div>
        <label className="flex items-start gap-3 rounded-lg bg-blue-50 p-4 text-sm"><input type="checkbox" checked={fallbackEnabled} onChange={(event) => setFallbackEnabled(event.target.checked)} className="mt-0.5" /><span><strong>Enable connectivity fallback</strong><span className="mt-1 block text-xs text-gray-600">This policy is editable only while the assignment remains a draft.</span></span></label>
      </section>
      <button type="button" onClick={() => void save()} disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save draft settings'}</button>
    </div>
  )
}
