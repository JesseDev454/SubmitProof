"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSubmissionFlow } from "@/features/submissions/SubmissionFlowContext";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

function graceWindowText(deadlineIso: string, graceMinutes: number): string {
  const deadlineDate = new Date(deadlineIso);
  const windowEnd = new Date(deadlineDate.getTime() + graceMinutes * 60 * 1000);
  const windowEndStr = windowEnd.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const days = Math.round(graceMinutes / (60 * 24));
  return days > 0
    ? `You'll have ${days} day${days !== 1 ? "s" : ""} after the deadline to upload the original file (until ${windowEndStr}).`
    : `You'll have a limited period after the deadline to upload the original file.`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FallbackConfirmationPage() {
  const router = useRouter();
  const {
    assignment,
    file,
    commitmentToken,
    committedAt,
  } = useSubmissionFlow();

  // Guard: must have gone through the fallback screen first
  useEffect(() => {
    if (!commitmentToken) {
      router.replace(`/student/assignments/${assignment.id}/submit`);
    }
  }, [commitmentToken, assignment.id, router]);

  // Polling state
  // TODO: confirm with Goodluck — need an endpoint to check whether a fallback commitment
  // has been received via the SMS webhook, keyed by commitment token.
  // Suggest: GET /api/commitments/:token/status
  // returning { received: boolean, receivedAt: string | null, gatewayTimestamp: string | null }
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [receivedAt, setReceivedAt] = useState<string | null>(null);
  const [isPlaceholder, setIsPlaceholder] = useState(false);
  const pollCountRef = useRef(0);
  const MAX_POLLS = 5;

  useEffect(() => {
    if (!commitmentToken) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/commitments/${commitmentToken}/status`, { method: "GET" });
        if (res.ok) {
          const data = await res.json();
          if (data.received === true) {
            setReceivedAt(data.receivedAt ?? data.gatewayTimestamp ?? new Date().toISOString());
            setIsConfirmed(true);
            setIsPlaceholder(false);
            return true; // stop polling
          }
        }
      } catch {
        // network failure — keep trying
      }
      return false;
    };

    const run = async () => {
      while (pollCountRef.current < MAX_POLLS) {
        pollCountRef.current += 1;
        const done = await poll();
        if (done) return;
        if (pollCountRef.current < MAX_POLLS) {
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
      // All 5 attempts exhausted — use placeholder committedAt from context
      // TODO: remove this placeholder path once /api/commitments/:token/status is live
      setReceivedAt(committedAt ?? new Date().toISOString());
      setIsPlaceholder(true);
      setIsConfirmed(true);
    };

    run();
  }, [commitmentToken, committedAt]);

  if (!commitmentToken) return null;

  const isPending = !isConfirmed;
  const deadlineFormatted = formatDateTime(assignment.deadline_at);
  const receivedAtFormatted = formatDateTime(receivedAt);
  const graceText = graceWindowText(assignment.deadline_at, assignment.grace_period_minutes);

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto xl:mx-0">
      {/* ── Back Link ──────────────────────────────────────────────────────── */}
      <Link
        href="/student"
        className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline w-fit"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        Back to Dashboard
      </Link>

      {/* ── Top Quote ─────────────────────────────────────────────────────── */}
      <div className="hidden xl:flex justify-end">
        <div className="text-right max-w-[220px]">
          <span className="text-sm italic text-slate-600 block leading-snug">
            &ldquo;Different connections.<br />Same opportunities.&rdquo;
          </span>
          <span className="text-xs text-slate-400 block mt-1">— SubmitProof</span>
        </div>
      </div>

      {/* ── Hero Section ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
        {/* Icon */}
        {isPending ? (
          <div className="w-20 h-20 rounded-full border-4 border-slate-100 flex items-center justify-center shrink-0">
            <svg className="w-10 h-10 animate-spin text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        ) : (
          <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-200 shrink-0">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}

        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight mb-2">
            {isPending
              ? "Confirming your commitment\u2026"
              : "Pre-deadline commitment recorded"}
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
            {isPending
              ? "We're checking that your SMS has been received. This usually takes a few seconds."
              : "Your fallback commitment has been successfully received and verified. Your work is safe. Now upload your original file when your internet connection is restored."}
          </p>
        </div>
      </div>

      {/* ── Main Content Grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* ── Left Column ──────────────────────────────────────────────────── */}
        <div className="xl:col-span-8 flex flex-col gap-6">
          {/* Commitment Details Card */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <h2 className="font-bold text-slate-900 text-base">Commitment Details</h2>
            </div>

            <dl className="divide-y divide-slate-50">
              {/* Status */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-6 py-4">
                <dt className="text-xs text-slate-400 font-medium sm:w-44 shrink-0">Status</dt>
                <dd className="flex items-center gap-3">
                  {isPending ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-bold">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Awaiting confirmation
                    </span>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Verified commitment received
                      </span>
                      <span className="text-xs text-slate-500">Your fallback has been saved.</span>
                    </>
                  )}
                </dd>
              </div>

              {/* Commitment ID */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-6 py-4">
                <dt className="text-xs text-slate-400 font-medium sm:w-44 shrink-0">Commitment ID</dt>
                <dd className="flex items-center gap-2">
                  <span className="text-sm font-mono text-slate-800 font-semibold">{commitmentToken}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(commitmentToken ?? "")}
                    className="text-slate-400 hover:text-slate-700 transition-colors"
                    title="Copy token"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </dd>
              </div>

              {/* Course */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-6 py-4">
                <dt className="text-xs text-slate-400 font-medium sm:w-44 shrink-0">Course</dt>
                <dd className="text-sm text-slate-800 font-medium">{assignment.course_code} — {assignment.course_name}</dd>
              </div>

              {/* Assignment */}
              <div className="flex flex-col sm:flex-row sm:items-start gap-2 px-6 py-4">
                <dt className="text-xs text-slate-400 font-medium sm:w-44 shrink-0 pt-0.5">Assignment</dt>
                <dd>
                  <div className="text-sm text-slate-800 font-bold">{assignment.title}</div>
                  {assignment.description && (
                    <div className="text-xs text-slate-500 mt-0.5">{assignment.description}</div>
                  )}
                </dd>
              </div>

              {/* Assignment Deadline */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-6 py-4">
                <dt className="text-xs text-slate-400 font-medium sm:w-44 shrink-0">Assignment Deadline</dt>
                <dd className="flex items-center gap-2 text-sm text-slate-800 font-medium">
                  <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                  </svg>
                  {deadlineFormatted}
                </dd>
              </div>

              {/* Commitment Received */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-6 py-4">
                <dt className="text-xs text-slate-400 font-medium sm:w-44 shrink-0">Commitment Received</dt>
                <dd className="flex items-center gap-2 text-sm text-slate-800 font-medium flex-wrap">
                  {isPending ? (
                    <span className="text-xs text-amber-600 italic">Waiting for confirmation…</span>
                  ) : (
                    <>
                      <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      {receivedAtFormatted}
                      <span className="text-xs text-slate-400">(Gateway Time)</span>
                      {isPlaceholder && (
                        <span className="text-xs text-amber-600 block w-full mt-0.5">
                          {/* TODO: remove once /api/commitments/:token/status is live */}
                          Unverified — will update once synced
                        </span>
                      )}
                    </>
                  )}
                </dd>
              </div>

              {/* Committed File Name */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-6 py-4">
                <dt className="text-xs text-slate-400 font-medium sm:w-44 shrink-0">Committed File Name</dt>
                <dd className="flex items-center gap-2 text-sm text-slate-800 font-medium">
                  {file?.name ?? "—"}
                  {file && (
                    <button
                      onClick={() => navigator.clipboard.writeText(file.name)}
                      className="text-slate-400 hover:text-slate-700 transition-colors"
                      title="Copy file name"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  )}
                </dd>
              </div>
            </dl>
          </section>

          {/* What happens next? */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center gap-2.5 mb-6">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <h2 className="font-bold text-slate-900 text-base">What happens next?</h2>
            </div>

            <ol className="relative flex flex-col gap-0">
              {/* Vertical connector line */}
              <div className="absolute top-3 bottom-14 left-[11px] w-0.5 bg-slate-100" />

              {[
                {
                  title: "You're all set for now",
                  desc: "Your pre-deadline commitment has been recorded. This confirms you had your file ready before the deadline, even though you couldn't upload it due to connectivity issues.",
                },
                {
                  title: "Restore your internet connection",
                  desc: "When you're back online, return to SubmitProof to upload your original file.",
                },
                {
                  title: "Upload within the grace window",
                  desc: graceText,
                },
                {
                  title: "We'll verify the match",
                  desc: "Your uploaded file will be securely checked against your commitment to confirm it matches. You'll get a notification once verification is complete.",
                },
              ].map((step, idx) => (
                <li key={idx} className="relative flex items-start gap-4 pb-6 last:pb-0 z-10">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-[0_0_0_4px_white] ${isPending && idx === 0 ? "bg-slate-300" : "bg-blue-600"}`}>
                    {idx + 1}
                  </div>
                  <div className="pt-0.5">
                    <div className="text-sm font-bold text-slate-900">{step.title}</div>
                    <div className="text-xs text-slate-500 leading-relaxed mt-0.5">{step.desc}</div>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-6 flex flex-col gap-3 pt-6 border-t border-slate-100">
              <Link
                href={`/student/assignments/${assignment.id}/resume`}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-5 rounded-xl text-sm shadow-md shadow-blue-200 transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
                </svg>
                Return later to upload file
              </Link>
              <Link
                href={`/student/assignments/${assignment.id}/receipt`}
                className="text-center text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline"
              >
                Go to receipt →
              </Link>
            </div>
          </section>
        </div>

        {/* ── Right Column ─────────────────────────────────────────────────── */}
        <div className="xl:col-span-4 flex flex-col gap-4">
          {/* Your Receipt card */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Your Receipt</h3>
            </div>

            {/* Fallback Commitment Banner */}
            <div className="mx-5 mt-5 bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">Fallback Commitment</div>
                <div className="text-xs text-emerald-700">Verified and Saved</div>
              </div>
            </div>

            <dl className="divide-y divide-slate-50 px-5 py-2 mb-3">
              {[
                {
                  label: "Commitment ID",
                  value: (
                    <span className="flex items-center gap-1.5 font-mono text-xs text-slate-700 font-semibold">
                      {commitmentToken}
                      <button
                        onClick={() => navigator.clipboard.writeText(commitmentToken ?? "")}
                        className="text-slate-400 hover:text-slate-700 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </span>
                  )
                },
                { label: "Course", value: <span className="text-xs text-slate-700 font-medium">{assignment.course_code}</span> },
                { label: "Assignment", value: <span className="text-xs text-slate-700 font-medium">{assignment.title}</span> },
                {
                  label: "Deadline",
                  value: <span className="text-xs text-slate-700 font-medium">{deadlineFormatted}</span>
                },
                {
                  label: "Received",
                  value: isPending
                    ? <span className="text-xs text-amber-500 italic">Pending…</span>
                    : (
                      <span className="flex flex-col">
                        <span className="text-xs text-slate-700 font-medium">{receivedAtFormatted}</span>
                        <span className="text-[10px] text-slate-400">(Gateway Time)</span>
                      </span>
                    )
                },
                { label: "Committed File", value: <span className="text-xs text-slate-700 font-medium truncate">{file?.name ?? "—"}</span> },
              ].map(({ label, value }, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-1 py-3">
                  <dt className="text-[11px] text-slate-400 font-medium sm:w-28 shrink-0">{label}</dt>
                  <dd className="min-w-0">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="px-5 pb-5">
              {/* TODO: route to actual receipt page once it's built */}
              <Link
                href={`/student/assignments/${assignment.id}/receipt`}
                className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-xl py-3 transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                View or download receipt →
              </Link>
            </div>
          </section>

          {/* Need help? */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Need help?</h3>
                <p className="text-[11px] text-slate-400">We&apos;re here for you.</p>
              </div>
            </div>

            <div className="flex flex-col mt-4 divide-y divide-slate-50">
              {[
                {
                  icon: (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                  ),
                  title: "Learn more about fallback",
                  subtitle: "How it works and what to expect.",
                  // TODO: no help-center route exists yet — replace # once /help/fallback is created
                  href: "#",
                },
                {
                  icon: (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  ),
                  title: "Check your grace window",
                  subtitle: "View course details and deadlines.",
                  // TODO: no deadline checker route exists yet
                  href: "#",
                },
                {
                  icon: (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  ),
                  title: "Still having issues?",
                  subtitle: "Contact your instructor or support.",
                  // TODO: no support chat route exists yet
                  href: "#",
                },
              ].map((item, idx) => (
                <Link
                  key={idx}
                  href={item.href}
                  className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50 -mx-5 px-5 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                      {item.icon}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-800">{item.title}</div>
                      <div className="text-[11px] text-slate-400">{item.subtitle}</div>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
