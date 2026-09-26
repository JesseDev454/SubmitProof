'use client'

import { useState } from 'react'

interface FallbackReviewActionsProps {
  submissionId: string
  qualifies: boolean
}

type ActionState = 'idle' | 'confirming' | 'loading' | 'accepted' | 'flagged' | 'error'

export default function FallbackReviewActions({ submissionId, qualifies }: FallbackReviewActionsProps) {
  const [state, setState] = useState<ActionState>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function postAction(endpoint: string, successState: 'accepted' | 'flagged') {
    setState('loading')
    setErrorMsg(null)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setErrorMsg(body?.error ?? `Server error (${res.status}) — endpoint may not be implemented yet.`)
        setState('error')
        return
      }
      setState(successState)
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Network error — the API endpoint may not be implemented yet.'
      )
      setState('error')
    }
  }

  function handleAccept() {
    if (!qualifies && state !== 'confirming') {
      // Show confirm step before accepting a non-qualifying submission
      setState('confirming')
      return
    }
    postAction(`/api/submissions/${submissionId}/accept`, 'accepted')
  }

  function handleFlag() {
    postAction(`/api/submissions/${submissionId}/flag-for-review`, 'flagged')
  }

  const resolved = state === 'accepted' || state === 'flagged'

  if (state === 'accepted') {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-500">
          <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-green-800">Submission accepted</p>
          <p className="text-xs text-green-600">This submission has been marked as accepted under the fallback policy.</p>
        </div>
      </div>
    )
  }

  if (state === 'flagged') {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500">
          <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-amber-800">Flagged for further review</p>
          <p className="text-xs text-amber-600">This submission has been queued for additional review.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Error banner */}
      {state === 'error' && errorMsg && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-red-700">{errorMsg}</p>
          </div>
          <button
            onClick={() => { setState('idle'); setErrorMsg(null) }}
            className="shrink-0 text-red-400 hover:text-red-600"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Inline confirm step for non-qualifying accept */}
      {state === 'confirming' && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
            <p className="text-xs font-semibold text-amber-800">
              This submission doesn&apos;t meet all fallback criteria — accept anyway?
            </p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => postAction(`/api/submissions/${submissionId}/accept`, 'accepted')}
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 transition-colors"
              >
                Yes, accept anyway
              </button>
              <button
                onClick={() => setState('idle')}
                className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <button
        onClick={handleAccept}
        disabled={state === 'loading' || resolved}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        {state === 'loading' ? 'Processing…' : 'Accept Submission'}
      </button>
      <button
        onClick={handleFlag}
        disabled={state === 'loading' || resolved}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
        </svg>
        Request Further Review
      </button>
    </div>
  )
}
