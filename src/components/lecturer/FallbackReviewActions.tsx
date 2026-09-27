'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function FallbackReviewActions({
  submissionId,
  qualifies,
  currentDecision,
}: {
  submissionId: string
  qualifies: boolean
  currentDecision: string | null
}) {
  const router = useRouter()
  const [decision, setDecision] = useState<'accepted' | 'flagged' | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function submit(nextDecision: 'accepted' | 'flagged') {
    if (nextDecision === 'accepted' && !qualifies && !reason.trim()) {
      setError('Add a reason when accepting evidence that does not qualify under the saved policy.')
      return
    }
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch(`/api/submissions/${submissionId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: nextDecision, ...(reason.trim() ? { reason: reason.trim() } : {}) }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error?.message ?? `Request failed (${response.status}).`)
      }
      setSuccess(nextDecision === 'accepted' ? 'Lecturer decision recorded: accepted.' : 'Lecturer decision recorded: flagged for review.')
      setDecision(null)
      setReason('')
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The review decision could not be recorded.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
      <div><h2 className="font-semibold text-gray-900">Lecturer review</h2><p className="mt-1 text-xs text-gray-500">This human decision is stored separately from the file verification and fallback policy results.</p></div>
      {currentDecision && <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">Latest decision: <strong className="capitalize">{currentDecision}</strong>{currentDecision === 'flagged' ? ' — this item may be accepted after further review.' : ''}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {success && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{success}</p>}
      {currentDecision !== 'accepted' && (
        <>
          <label htmlFor="review-reason" className="block text-sm font-medium text-gray-700">Reason {qualifies ? '(optional)' : '(required when accepting non-qualifying evidence)'}</label>
          <textarea id="review-reason" rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          {decision && <p className="text-xs text-gray-600">Confirm: record this submission as <strong>{decision}</strong>? The original evidence results will remain unchanged.</p>}
          <div className="flex flex-wrap gap-2">
            {!decision ? <>
              <button type="button" onClick={() => setDecision('accepted')} disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Accept submission</button>
              <button type="button" onClick={() => setDecision('flagged')} disabled={busy} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50">Flag for review</button>
            </> : <>
              <button type="button" onClick={() => void submit(decision)} disabled={busy || (decision === 'accepted' && !qualifies && !reason.trim())} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Recording…' : `Confirm ${decision}`}</button>
              <button type="button" onClick={() => { setDecision(null); setError(null) }} disabled={busy} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700">Cancel</button>
            </>}
          </div>
        </>
      )}
    </section>
  )
}
