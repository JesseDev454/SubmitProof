"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/auth/client";
import { loginSchema } from "@/lib/validation/auth";

export default function StudentLoginPage() {
  const router = useRouter();

  // Form State
  const [emailOrId, setEmailOrId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setFieldErrors({});

    // Client-side validation using Zod
    const validation = loginSchema.safeParse({
      email: emailOrId.trim(),
      password,
    });

    if (!validation.success) {
      const formattedErrors: { email?: string; password?: string } = {};
      for (const issue of validation.error.issues) {
        if (issue.path[0] === "email" && !formattedErrors.email) {
          formattedErrors.email = issue.message;
        }
        if (issue.path[0] === "password" && !formattedErrors.password) {
          formattedErrors.password = issue.message;
        }
      }
      setFieldErrors(formattedErrors);
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      // TODO: Treat "Student ID or Email" as email for now. Student-ID lookup needs a server-side resolve-ID-to-email step once that table exists.
      const { error } = await supabase.auth.signInWithPassword({
        email: validation.data.email,
        password: validation.data.password,
      });

      if (error) {
        setGeneralError(error.message);
        setLoading(false);
        return;
      }

      router.push("/student");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred during sign in.";
      setGeneralError(message);
      setLoading(false);
    }
  };

  const handleSchoolAccountSignIn = async () => {
    setGeneralError(null);
    setOauthLoading(true);

    try {
      const supabase = createClient();

      // TODO: The real OIDC provider gets configured in Supabase once institution SSO details exist.
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "azure" as const,
        options: {
          redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/student`,
        },
      });

      if (error) {
        setGeneralError(error.message);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "School single sign-on is not configured yet. Please use your credentials.";
      setGeneralError(message);
    } finally {
      setOauthLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFD] text-slate-800 antialiased flex flex-col justify-between selection:bg-blue-100 selection:text-blue-900">
      {/* Top Navigation */}
      <header className="w-full max-w-7xl mx-auto px-6 sm:px-10 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <svg
              className="w-5 h-5 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="currentColor" />
              <path d="m9 12 2 2 4-4" stroke="#2563EB" strokeWidth="2.5" fill="none" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-slate-900 text-lg leading-tight tracking-tight">
              SubmitProof
            </span>
            <span className="text-[11px] text-slate-500 leading-tight">
              Your work. Always counts.
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-6 sm:gap-8">
          <Link
            href="/about"
            className="hidden sm:inline-block text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            About
          </Link>
          <div className="relative py-1">
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-blue-600" />
            <Link
              href="/login"
              className="text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              For Students
            </Link>
          </div>
          <Link
            href="/help"
            className="hidden sm:inline-block text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            Help
          </Link>
          <Link
            href="/signup"
            className="text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50/80 hover:bg-blue-100/80 border border-blue-200/80 px-4 py-2 rounded-xl transition-all shadow-sm"
          >
            Create Account
          </Link>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 sm:px-10 py-6 sm:py-10 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
        {/* Left Column: Headline, Value Props & Preview Mock */}
        <div className="lg:col-span-7 flex flex-col justify-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
              FOR STUDENTS
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold text-slate-900 tracking-tight leading-[1.15] mb-4">
            Submit with confidence.
            <br />
            Even when you’re offline.
          </h1>

          <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-xl mb-8">
            SubmitProof protects your assignment deadlines during poor connectivity.
            Work offline, sync later, and get verifiable proof that your work was submitted.
          </p>

          {/* Three Feature Callouts */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {/* Feature 1 */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100/80 text-blue-600 flex items-center justify-center shrink-0">
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                  <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                  <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                  <line x1="12" y1="20" x2="12.01" y2="20" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Submit offline</h2>
                <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                  Keep working, even without internet.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100/80 text-emerald-600 flex items-center justify-center shrink-0">
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Auto-sync later</h2>
                <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                  Files upload securely when you&apos;re back online.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100/80 text-purple-600 flex items-center justify-center shrink-0">
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Get proof</h2>
                <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                  Receive a verified confirmation for every submission.
                </p>
              </div>
            </div>
          </div>

          {/* Small Preview Card Mock */}
          <div className="relative">
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xl shadow-slate-300/40 p-4 sm:p-5 text-xs select-none pointer-events-none">
              {/* Header inside mock */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-blue-600 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <span className="font-bold text-slate-900 text-xs">SubmitProof</span>
                  <span className="text-[9px] text-slate-400 hidden sm:inline">
                    Your work. Always counts.
                  </span>
                </div>

                <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-1 text-[11px] text-slate-400 w-52">
                  <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span>Search assignments, courses...</span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center relative text-slate-600">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-500 rounded-full" />
                  </div>
                  <div className="w-5 h-5 rounded-full bg-slate-300 overflow-hidden flex items-center justify-center font-bold text-[9px] text-slate-700">
                    TK
                  </div>
                  <span className="font-semibold text-slate-800 text-[11px] hidden sm:inline">
                    Taylor Kim
                  </span>
                </div>
              </div>

              {/* Mock Dashboard Body */}
              <div className="grid grid-cols-12 gap-3">
                {/* Mini Sidebar */}
                <div className="hidden sm:flex sm:col-span-3 flex-col gap-1 border-r border-slate-100 pr-2">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-50 text-blue-600 font-semibold text-[11px]">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    Dashboard
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 text-slate-500 text-[11px]">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Assignments
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 text-slate-500 text-[11px]">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Receipts
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 text-slate-500 text-[11px]">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    History
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 text-slate-500 text-[11px]">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Profile
                  </div>
                </div>

                {/* Main Mock Area */}
                <div className="col-span-12 sm:col-span-9 flex flex-col gap-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] text-slate-500">Good afternoon, Taylor 👋</p>
                      <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                        Student Dashboard
                      </h3>
                      <p className="text-[10px] text-slate-400">
                        Submit with confidence. Even when you&apos;re offline.
                      </p>
                    </div>
                    <div className="hidden sm:block text-right">
                      <span className="text-[9px] italic text-slate-400 block">
                        &ldquo;Different connections. Same opportunities.&rdquo;
                      </span>
                      <span className="text-[8px] text-slate-400">— SubmitProof</span>
                    </div>
                  </div>

                  {/* 4 Stat Cards */}
                  <div className="grid grid-cols-4 gap-1.5">
                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-1.5">
                      <div className="flex items-center gap-1 text-blue-600 mb-0.5">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="font-bold text-[11px] text-slate-900">5</span>
                      </div>
                      <span className="text-[8px] text-slate-500 block leading-tight">
                        Upcoming Assignments
                      </span>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-1.5">
                      <div className="flex items-center gap-1 text-emerald-600 mb-0.5">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
                        </svg>
                        <span className="font-bold text-[11px] text-slate-900">3</span>
                      </div>
                      <span className="text-[8px] text-slate-500 block leading-tight">
                        Fallback Committed
                      </span>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-1.5">
                      <div className="flex items-center gap-1 text-emerald-600 mb-0.5">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="font-bold text-[11px] text-slate-900">12</span>
                      </div>
                      <span className="text-[8px] text-slate-500 block leading-tight">
                        Verified
                      </span>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-1.5">
                      <div className="flex items-center gap-1 text-amber-500 mb-0.5">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="font-bold text-[11px] text-slate-900">2</span>
                      </div>
                      <span className="text-[8px] text-slate-500 block leading-tight">
                        Needs Attention
                      </span>
                    </div>
                  </div>

                  {/* Due Soon Box */}
                  <div className="border border-slate-100 rounded-lg p-2 bg-white">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-slate-800 text-[11px]">Due Soon</span>
                      <span className="text-[9px] text-blue-600 font-medium">View all assignments →</span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between p-1.5 rounded border border-slate-100 bg-slate-50/50">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-blue-100 text-blue-700 font-bold text-[9px] flex items-center justify-center">
                            CS
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800 text-[10px]">
                              Programming Assignment 3
                            </div>
                            <div className="text-[8px] text-slate-400">
                              CS101 • Due Apr 25, 2025 11:59 PM
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Fallback Enabled
                          </span>
                          <span className="text-[8px] font-semibold text-blue-600">• Ready</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-1.5 rounded border border-slate-100 bg-slate-50/50">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-purple-100 text-purple-700 font-bold text-[9px] flex items-center justify-center">
                            EN
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800 text-[10px]">
                              Research Essay Draft
                            </div>
                            <div className="text-[8px] text-slate-400">
                              ENG202 • Due Apr 26, 2025 11:59 PM
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Fallback Enabled
                          </span>
                          <span className="text-[8px] font-semibold text-amber-600">• In Progress</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Handwritten Annotations */}
            <div className="absolute -bottom-6 -left-2 flex items-center gap-1 pointer-events-none">
              <span className="text-slate-400 italic text-xs font-serif rotate-[-5deg]">
                A more reliable you.
              </span>
              <svg className="w-6 h-4 text-slate-300" viewBox="0 0 24 16" fill="none" stroke="currentColor">
                <path d="M2 14C8 14 16 10 20 2M20 2L16 4M20 2L22 6" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className="absolute -bottom-6 right-2 pointer-events-none">
              <span className="text-slate-400 italic text-xs font-serif rotate-[-3deg] block">
                Same effort. A fairer future.
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: White Login Card */}
        <div className="lg:col-span-5 w-full flex justify-center lg:justify-end">
          <div className="w-full max-w-[420px] bg-white rounded-3xl p-7 sm:p-9 shadow-xl shadow-slate-200/70 border border-slate-100 flex flex-col">
            {/* Header */}
            <div className="text-center mb-7">
              <h2 className="text-2xl sm:text-[28px] font-extrabold text-slate-900 tracking-tight">
                Welcome back
              </h2>
              <p className="text-sm text-slate-500 mt-1.5">
                Sign in to your student account
              </p>
            </div>

            {/* Inline Error Alert */}
            {generalError && (
              <div
                role="alert"
                className="mb-5 rounded-xl bg-red-50 border border-red-200/80 p-3.5 flex items-start gap-2.5 text-red-700 text-xs sm:text-sm animate-in fade-in duration-200"
              >
                <svg
                  className="w-5 h-5 text-red-500 shrink-0 mt-0.5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="flex-1 font-medium">{generalError}</div>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSignIn} noValidate className="flex flex-col gap-4">
              {/* Student ID or Email */}
              <div>
                <label
                  htmlFor="emailOrId"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Student ID or Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect width="20" height="16" x="2" y="4" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                  </div>
                  <input
                    id="emailOrId"
                    type="text"
                    value={emailOrId}
                    onChange={(e) => {
                      setEmailOrId(e.target.value);
                      if (fieldErrors.email) {
                        setFieldErrors((prev) => ({ ...prev, email: undefined }));
                      }
                    }}
                    placeholder="Enter your student ID or email"
                    className={`w-full rounded-xl border bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:outline-none focus:ring-2 ${
                      fieldErrors.email
                        ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                        : "border-slate-200 focus:border-blue-600 focus:ring-blue-600/20"
                    }`}
                  />
                </div>
                {fieldErrors.email && (
                  <p className="mt-1.5 text-xs text-red-600 font-medium">{fieldErrors.email}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="password"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) {
                        setFieldErrors((prev) => ({ ...prev, password: undefined }));
                      }
                    }}
                    placeholder="Enter your password"
                    className={`w-full rounded-xl border bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:outline-none focus:ring-2 ${
                      fieldErrors.password
                        ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                        : "border-slate-200 focus:border-blue-600 focus:ring-blue-600/20"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                        <line x1="2" y1="2" x2="22" y2="22" />
                      </svg>
                    ) : (
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="mt-1.5 text-xs text-red-600 font-medium">{fieldErrors.password}</p>
                )}
              </div>

              {/* Sign In Primary Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-400 text-white font-semibold py-3 px-4 rounded-xl text-sm shadow-md shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-slate-400 font-medium">or</span>
              </div>
            </div>

            {/* Secondary Continue with school account */}
            <button
              type="button"
              onClick={handleSchoolAccountSignIn}
              disabled={oauthLoading}
              className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-medium py-2.5 px-4 rounded-xl text-sm transition-all flex items-center justify-between group shadow-sm hover:border-slate-300 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21.42 10.922a1 1 0 0 0-.019-.838L12.83 3.18a2 2 0 0 0-1.66 0L2.6 10.084a1 1 0 0 0 0 1.832l8.57 6.908a2 2 0 0 0 1.66 0l8.57-6.908a1 1 0 0 0 .02-.994z" />
                    <path d="M6 13.5V17a6 3 0 0 0 12 0v-3.5" />
                  </svg>
                </div>
                <span>Continue with school account</span>
              </div>
              <svg
                className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Secure Academic Access Info Box */}
            <div className="mt-6 bg-[#F3F7FC] border border-blue-100/80 rounded-2xl p-3.5 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100/90 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 leading-snug">
                  Secure academic access
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  Your information is encrypted and protected. We never share your data with
                  third parties.
                </p>
              </div>
            </div>

            {/* Create a Student Account Footer Link */}
            <div className="mt-8 text-center">
              <span className="text-xs text-slate-500 block mb-1">New to SubmitProof?</span>
              <Link
                href="/signup"
                className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1 group"
              >
                <span>Create a student account</span>
                <span className="group-hover:translate-x-0.5 transition-transform">→</span>
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Subtle bottom spacing or footer note */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-center text-xs text-slate-400">
        <span>&copy; {new Date().getFullYear()} SubmitProof. All rights reserved.</span>
      </footer>
    </div>
  );
}
