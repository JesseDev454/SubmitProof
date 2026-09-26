"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/auth/client";
import { loginSchema } from "@/lib/validation/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    const validation = loginSchema.safeParse({ email: email.trim(), password });
    if (!validation.success) {
      setErrorMessage(validation.error.issues[0]?.message ?? "Enter a valid email and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword(validation.data);
      if (error || !data.user) {
        setErrorMessage(error?.message ?? "Sign in could not be completed.");
        setIsSubmitting(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();
      if (profileError || !profile) {
        await supabase.auth.signOut();
        setErrorMessage("Your account role could not be loaded. Contact your institution administrator.");
        setIsSubmitting(false);
        return;
      }

      router.replace(profile.role === "lecturer" ? "/lecturer" : "/student");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Sign in could not be completed.");
      setIsSubmitting(false);
    }
  };

  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
    <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
      <div className="mb-7">
        <p className="text-sm font-bold text-blue-700">SubmitProof</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">Sign in</h1>
        <p className="mt-2 text-sm text-slate-600">Students and lecturers use their institution account. Your profile role determines which workspace opens.</p>
      </div>

      <form onSubmit={signIn} className="flex flex-col gap-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-slate-700">Email</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-slate-700">Password</label>
          <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
          <p className="mt-1.5 text-xs text-slate-500">Password recovery and institution SSO are not enabled yet.</p>
        </div>
        {errorMessage && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</p>}
        <button type="submit" disabled={isSubmitting} className="mt-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? "Signing in…" : "Sign in"}</button>
      </form>
      <p className="mt-6 text-center text-xs text-slate-500">Accounts are provisioned by your institution.</p>
    </section>
  </main>
}
