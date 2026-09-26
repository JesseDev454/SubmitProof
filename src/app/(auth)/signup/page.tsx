import Link from "next/link";

export default function SignupUnavailablePage() {
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
    <section className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-xl font-bold text-slate-900">Account creation is unavailable</h1>
      <p className="mt-2 text-sm text-slate-600">SubmitProof accounts are provisioned by your institution during this release.</p>
      <Link href="/login" className="mt-5 inline-flex font-semibold text-blue-700 hover:underline">Return to sign in</Link>
    </section>
  </main>
}
