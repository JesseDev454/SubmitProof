'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function AssignmentLifecycleActions({
  assignmentId,
  status,
  archived,
}: {
  assignmentId: string
  status: 'draft' | 'published' | 'closed'
  archived: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: 'close' | 'archive') {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/assignments/${assignmentId}/${action}`, { method: 'POST' })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error?.message ?? `Request failed (${response.status}).`)
      }
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The assignment could not be updated.')
    } finally {
      setBusy(false)
    }
  }

  if (status === 'draft' || archived) return null
  return (
    <div className="space-y-2">
      {error && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-800">{error}</p>}
      {status === 'published' ? (
        <button type="button" disabled={busy} onClick={() => void run('close')} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50">
          {busy ? 'Closing…' : 'Close assignment'}
        </button>
      ) : (
        <button type="button" disabled={busy} onClick={() => void run('archive')} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50">
          {busy ? 'Archiving…' : 'Archive closed assignment'}
        </button>
      )}
    </div>
  )
}
