'use client'

import Link from 'next/link'

export interface NotFoundContentProps {
  primaryHref: string
  primaryLabel: string
  secondaryLinks?: Array<{ label: string; href: string }>
}

export default function NotFoundContent({
  primaryHref,
  primaryLabel,
  secondaryLinks,
}: NotFoundContentProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-8 py-20 px-4">
      {/* Illustration: Sad document + signpost */}
      <div className="relative w-72 h-64">
        {/* Cloud shapes */}
        <div className="absolute top-0 left-4 w-16 h-8 bg-blue-100 rounded-full opacity-60" />
        <div className="absolute top-12 right-8 w-20 h-10 bg-blue-50 rounded-full opacity-40" />

        {/* Signpost */}
        <div className="absolute top-24 right-12 flex flex-col items-center">
          <div className="flex flex-col items-center gap-1">
            <div className="w-1 h-12 bg-yellow-700" />
            <div className="px-2 py-1 bg-blue-400 text-white text-xs font-bold rounded">This way?</div>
          </div>
          <div className="mt-2">
            <div className="w-1 h-8 bg-yellow-700 ml-3" />
            <div className="px-2 py-1 bg-blue-300 text-white text-xs font-bold rounded ml-2">Another way?</div>
          </div>
        </div>

        {/* Sad document */}
        <div className="absolute bottom-0 left-0 flex flex-col items-center gap-2">
          <div className="w-32 h-40 bg-white border-4 border-blue-300 rounded-lg flex flex-col items-center justify-center shadow-md">
            <div className="text-5xl">😢</div>
          </div>
          {/* Document dashed outline */}
          <div className="w-32 h-40 border-2 border-dashed border-blue-200 rounded-lg absolute -top-2 -left-2 opacity-50" />
        </div>

        {/* Grass */}
        <div className="absolute bottom-0 left-0 right-0 flex gap-1 justify-center">
          <div className="w-2 h-3 bg-green-400 rounded-full" />
          <div className="w-2 h-3 bg-green-500 rounded-full" />
          <div className="w-2 h-3 bg-green-400 rounded-full" />
        </div>
      </div>

      {/* Content */}
      <div className="text-center space-y-3 max-w-md">
        <h1 className="text-4xl font-bold text-gray-900">Page not found</h1>
        <p className="text-lg text-gray-600">
          Looks like this page took a different path.
        </p>
        <p className="text-sm text-gray-500">
          The page you&apos;re looking for might have been moved, deleted, or the link might be incorrect. No worries — let&apos;s get you back on track.
        </p>
      </div>

      {/* Primary button */}
      <Link
        href={primaryHref}
        className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700 transition-colors"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
        </svg>
        {primaryLabel}
      </Link>

      {/* Secondary links */}
      {secondaryLinks && secondaryLinks.length > 0 && (
        <div className="flex flex-wrap gap-4 justify-center">
          {secondaryLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
            >
              {link.label === 'View Assignments' && (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
              {link.label === 'Contact Support' && (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              )}
              {link.label}
            </a>
          ))}
        </div>
      )}

      {/* Closing quote */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <p className="italic">
          &quot;Different connections.
          <br />
          Same opportunities.&quot;
        </p>
        <p className="font-semibold text-gray-700 mt-1">— SubmitProof</p>
      </div>
    </div>
  )
}

{/* TODO: Once student screens merge, add src/app/student/not-found.tsx following the same pattern as lecturer's,
    with primaryHref=/student and appropriate secondaryLinks for student context. */}
