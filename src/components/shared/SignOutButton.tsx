'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { createClient } from '@/lib/auth/client'

export default function SignOutButton({
  className = '',
  compactOnMobile = false,
}: {
  className?: string
  compactOnMobile?: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signOut() {
    setBusy(true)
    setError(null)
    try {
      const { error: signOutError } = await createClient().auth.signOut()
      if (signOutError) throw signOutError
      router.replace('/login')
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Please try again.')
      setBusy(false)
    }
  }

  return (
    <div className="relative flex flex-col items-end">
      <button
        type="button"
        aria-label={busy ? 'Signing out' : 'Sign out'}
        onClick={() => void signOut()}
        disabled={busy}
        className={className}
      >
        <svg aria-hidden="true" className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 17l5-5-5-5" />
          <path d="M15 12H3" />
          <path d="M12 3h6a2 2 0 012 2v14a2 2 0 01-2 2h-6" />
        </svg>
        <span className={compactOnMobile ? 'hidden sm:inline' : undefined}>{busy ? 'Signing out…' : 'Sign out'}</span>
      </button>
      {error && <p role="alert" className="absolute right-0 top-full z-50 mt-1 w-56 rounded-md bg-rose-50 p-2 text-xs text-rose-800 shadow">Could not sign out: {error}</p>}
    </div>
  )
}
