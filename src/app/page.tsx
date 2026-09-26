import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-lg font-bold text-gray-900">SubmitProof</span>
        </div>

        <div className="flex items-center gap-8">
          <div className="relative group">
            <button className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900">
              Product
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </button>
            {/* TODO: Implement product dropdown */}
          </div>
          <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900">
            For Students
          </a>
          <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900">
            For Lecturers
          </a>
          <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900">
            Security
          </a>
          <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900">
            Help
          </a>
        </div>

        <div className="flex items-center gap-4">
          <button className="text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          <Link href="/login" className="text-sm font-medium text-blue-600 hover:text-blue-700">
            Sign In
          </Link>
          <Link href="/signup" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex-1 px-6 py-16 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16 items-start">
            {/* Left side: Content */}
            <div className="space-y-8">
              <div className="inline-block rounded-full bg-blue-50 px-3 py-1">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                  OFFLINE SUBMISSIONS, ONLINE CONFIDENCE
                </p>
              </div>

              <div>
                <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-4">
                  Protect your assignment deadlines —{' '}
                  <span className="text-blue-600">even when you're offline.</span>
                </h1>
                <p className="text-lg text-gray-600 leading-relaxed">
                  SubmitProof lets you commit your work during poor connectivity and get a tamper-evident receipt.
                  When you're back online, we verify and match your submission — so your hard work always counts.
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                <Link
                  href="/signup"
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700 transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                  Get Started
                </Link>
                <a
                  href="#"
                  className="flex items-center gap-2 rounded-lg border border-gray-300 px-6 py-3 text-base font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  title="TODO: Demo request form not yet implemented"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Request a Demo
                </a>
              </div>

              <div className="flex flex-wrap gap-6">
                <div className="flex items-start gap-2">
                  <svg className="h-5 w-5 shrink-0 text-green-600 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">Free for students</span>
                </div>
                <div className="flex items-start gap-2">
                  <svg className="h-5 w-5 shrink-0 text-green-600 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">Trusted by educators</span>
                </div>
                <div className="flex items-start gap-2">
                  <svg className="h-5 w-5 shrink-0 text-green-600 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">Secure & tamper-evident</span>
                </div>
              </div>
            </div>

            {/* Right side: Mock dashboard preview */}
            <div className="relative">
              <div className="rounded-2xl border border-gray-200 bg-linear-to-b from-gray-50 to-white p-6 shadow-lg">
                {/* Mock browser chrome */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-red-400" />
                    <div className="h-3 w-3 rounded-full bg-yellow-400" />
                    <div className="h-3 w-3 rounded-full bg-green-400" />
                  </div>
                </div>

                {/* Mock dashboard content */}
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-600">
                        <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                        </svg>
                      </div>
                      <span className="text-xs font-semibold text-gray-700">SubmitProof</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-xs text-gray-500">Online</span>
                    </div>
                  </div>

                  {/* Sidebar */}
                  <div className="flex gap-4">
                    <div className="w-24 space-y-2">
                      <div className="h-2 w-full rounded bg-gray-200" />
                      <div className="h-2 w-16 rounded bg-blue-200" />
                      <div className="h-2 w-12 rounded bg-gray-100" />
                      <div className="h-2 w-14 rounded bg-gray-100" />
                    </div>

                    {/* Main content */}
                    <div className="flex-1 space-y-3">
                      <div className="h-3 w-32 rounded bg-gray-300" />
                      <div className="grid grid-cols-3 gap-2">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="space-y-1 rounded border border-gray-200 p-2">
                            <div className="h-2 w-12 rounded bg-gray-200" />
                            <div className="h-4 w-8 rounded bg-blue-100" />
                            <div className="h-1.5 w-16 rounded bg-gray-100" />
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2 mt-4">
                        <div className="h-2 w-full rounded bg-gray-200" />
                        <div className="h-2 w-4/5 rounded bg-gray-200" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quote callout */}
                <div className="absolute -bottom-8 -right-4 max-w-xs rounded-lg bg-white p-3 shadow-md border border-gray-100">
                  <p className="text-xs text-gray-600 italic">
                    "Different connections. Same opportunities."
                  </p>
                  <p className="text-xs font-semibold text-gray-900 mt-1">— SubmitProof</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Two-column card row */}
      <section className="px-6 py-16 bg-gray-50">
        <div className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* For Students */}
          <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                  <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C6.228 6.228 2 10.456 2 15.5c0 5.046 4.228 9.25 10 9.25s10-4.204 10-9.25C22 10.456 17.772 6.253 12 6.253z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900">For Students</h3>
                <p className="mt-2 text-sm text-gray-600">
                  Submit with confidence, anywhere. Commit your assignments during poor connectivity, get a secure receipt, and let SubmitProof handle the rest.
                </p>
              </div>
              <svg className="h-5 w-5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>

          {/* For Lecturers */}
          <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
                  <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 12H9m6 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900">For Lecturers</h3>
                <p className="mt-2 text-sm text-gray-600">
                  Fair, transparent, and reliable. Support your students with a secure, verifiable submission process designed for real-world connectivity challenges.
                </p>
              </div>
              <svg className="h-5 w-5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* Three-icon feature row */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Commit Offline */}
            <div className="text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-blue-100 mx-auto">
                <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900">Commit Offline</h3>
              <p className="mt-2 text-sm text-gray-600">
                Submit your work during poor or no internet connection. SubmitProof saves your assignments securely on your device.
              </p>
            </div>

            {/* Verify Later */}
            <div className="text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-green-100 mx-auto">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900">Verify Later</h3>
              <p className="mt-2 text-sm text-gray-600">
                When you're back online, we automatically match your file to confirm it's the same submission — no surprises.
              </p>
            </div>

            {/* Tamper-Evident Receipts */}
            <div className="text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-purple-100 mx-auto">
                <svg className="h-8 w-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900">Tamper-Evident Receipts</h3>
              <p className="mt-2 text-sm text-gray-600">
                Get a secure, time-stamped receipt as proof of your original submission. Transparent and verifiable.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom stats bar */}
      <section className="px-6 py-12 border-t border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-7xl">
          <p className="mb-8 text-center text-sm text-gray-600">
            Trusted by students and educators at institutions worldwide.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-center">
            {/* Stats */}
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">250K+</p>
              <p className="mt-1 text-sm text-gray-600">Students supported</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">1,200+</p>
              <p className="mt-1 text-sm text-gray-600">Lecturers and staff</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">99.9%</p>
              <p className="mt-1 text-sm text-gray-600">Submission integrity</p>
            </div>

            {/* Institution logos placeholder */}
            <div className="flex items-center justify-center gap-3">
              {['Riverside\nUniversity', 'Maplewood\nCollege', 'Northfield\nUniversity', 'Cedar Hill\nInstitute'].map((name, i) => (
                <div key={i} className="flex h-10 w-10 items-center justify-center rounded border border-gray-300 bg-white text-xs font-bold text-gray-400">
                  {name.split('\n')[0][0]}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-gray-200">
        <div className="mx-auto max-w-7xl text-center text-xs text-gray-500">
          <p>© 2025 SubmitProof. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
