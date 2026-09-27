'use client'

import { useState } from 'react'

export default function DownloadEvidenceButton({ uploadId }: { uploadId: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function openFile() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/uploads/${uploadId}/download`)
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error?.message ?? `Request failed (${response.status}).`)
      if (typeof body?.data?.url !== 'string') throw new Error('The server did not return a secure download link.')
      window.location.assign(body.data.url)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The file could not be opened.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="space-y-1">
    <button type="button" onClick={() => void openFile()} disabled={busy} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50">{busy ? 'Preparing link…' : 'View file'}</button>
    {error && <p role="alert" className="max-w-xs text-xs text-red-700">{error}</p>}
  </div>
}
