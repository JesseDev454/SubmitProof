import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <h1 className="text-2xl font-bold text-slate-900">Forgot Password</h1>
      <p className="mt-2 text-slate-600">Coming soon</p>
      <Link
        href="/login"
        className="mt-6 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
      >
        ← Back to sign in
      </Link>
    </div>
  );
}
