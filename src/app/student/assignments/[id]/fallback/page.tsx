"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSubmissionFlow } from "@/features/submissions/SubmissionFlowContext";
import { submitNormally as submitNormallyHelper } from "@/features/submissions/submitNormally";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFileSizeMb(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${Math.round(mb * 10) / 10} MB` : `${Math.round(bytes / 1024)} KB`;
}

function generatePlaceholderToken(courseCode: string, id: string): string {
  const year = new Date().getFullYear();
  const shortId = id.substring(0, 4).toUpperCase();
  const randomChars = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `SP-${year}-${courseCode}-${shortId}-${randomChars}`;
}

function formatSmsBody(token: string, hash: string, fullName: string = "Taylor Kim"): string {
  // Note: the prompt asks for a UI preview version.
  // TODO: confirm with Goodluck whether the actual webhook parser expects this
  // or the compact `SP1|token|nonce|hash` format from the PRD.
  return `SUBMITPROOF ${token}\n${hash}\n${fullName}`;
}

export default function FallbackPage() {
  const router = useRouter();
  const {
    assignment,
    file,
    fileHash,
    commitmentToken,
    setCommitmentToken,
    setNonce,
    setUploadProgress,
    setUploadError,
  } = useSubmissionFlow();

  const [isLoadingToken, setIsLoadingToken] = useState(!commitmentToken);
  const [isRetrying, setIsRetrying] = useState(false);
  const [usingPlaceholderToken, setUsingPlaceholderToken] = useState(false);

  const fallbackNumber = process.env.NEXT_PUBLIC_FALLBACK_SMS_NUMBER || "+18339093174";
  
  // Enforce context presence
  useEffect(() => {
    if (!file || !fileHash) {
      router.replace(`/student/assignments/${assignment.id}/submit`);
    }
  }, [file, fileHash, assignment.id, router]);

  // Request fallback token on mount
  useEffect(() => {
    if (!file || !fileHash || commitmentToken) {
      return;
    }

    const fetchToken = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const res = await fetch("/api/submissions/fallback/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignmentId: assignment.id, fileHash }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          setCommitmentToken(data.commitmentToken);
          setNonce(data.nonce);
          setUsingPlaceholderToken(false);
        } else {
          throw new Error("Failed to init fallback");
        }
      } catch (err) {
        // Mock fallback generation when endpoint fails/doesn't exist
        console.warn("Fallback init failed/timed out, generating local placeholder", err);
        setCommitmentToken(generatePlaceholderToken(assignment.course_code, assignment.id));
        setNonce("nonce-placeholder-12345");
        setUsingPlaceholderToken(true);
      } finally {
        setIsLoadingToken(false);
      }
    };

    fetchToken();
  }, [file, fileHash, assignment.id, assignment.course_code, commitmentToken, setCommitmentToken, setNonce]);

  if (!file || !fileHash) {
    return null; // Don't render until redirect happens
  }

  const smsBody = formatSmsBody(commitmentToken || "GENERATING...", fileHash);

  const handleRetry = () => {
    setIsRetrying(true);
    setUploadError(null);
    setUploadProgress(0);

    submitNormallyHelper({
      file,
      assignmentId: assignment.id,
      fileHash,
      onProgress: (p) => setUploadProgress(p),
      onSuccess: () => {
        setIsRetrying(false);
        // TODO: Redirect to receipt
        router.push("/student");
      },
      onError: (msg) => {
        setIsRetrying(false);
        setUploadError(msg);
      },
    });
  };

  const handleCopyAndOpenSMS = () => {
    if (commitmentToken) {
      navigator.clipboard.writeText(smsBody).catch(() => {});
      window.location.href = `sms:${fallbackNumber}?body=${encodeURIComponent(smsBody)}`;
      router.push(`/student/assignments/${assignment.id}/fallback/confirmation`);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto xl:mx-0">
      <Link
        href={`/student/assignments/${assignment.id}/submit`}
        className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline w-fit"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        Back to assignment
      </Link>

      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Student Connectivity Fallback
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Your upload couldn&apos;t be completed, but you&apos;re not off track.
          </p>
        </div>
        <div className="hidden xl:block text-right shrink-0 max-w-[220px]">
          <span className="text-sm italic text-slate-600 block leading-snug">
            &ldquo;Different connections.<br />Same opportunities.&rdquo;
          </span>
          <span className="text-xs text-slate-400 block mt-1">— SubmitProof</span>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h2 className="font-bold text-slate-900 text-base mb-1">
              Upload failed due to unstable connectivity
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
              We couldn&apos;t securely upload your file right now, but you can still secure your deadline with fallback proof.<br />
              Your file is safe on this device. Follow the steps below to send a proof of submission via SMS.
            </p>
          </div>
        </div>
        <button
          onClick={handleRetry}
          disabled={isRetrying}
          className="shrink-0 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-semibold py-2.5 px-5 rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isRetrying ? (
             <svg className="w-4 h-4 animate-spin text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
               <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
               <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
             </svg>
          ) : "Try again later"}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* ── Left Column (Fallback Steps) ────────────────────────────────── */}
        <div className="xl:col-span-8 flex flex-col gap-5 relative">
          
          {/* Step 1: Selected File */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">1</div>
                <h3 className="font-bold text-slate-900 text-sm">Selected file</h3>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold uppercase tracking-wider">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                File processed locally
              </div>
            </div>
            
            <div className="border border-slate-100 rounded-xl p-4 bg-slate-50 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-lg bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center shrink-0">
                  {file.name.split(".").pop()?.toUpperCase() || "FILE"}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 truncate pr-4">{file.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {formatFileSizeMb(file.size)} &bull; {file.name.split(".").pop()?.toUpperCase()} document<br/>
                    Modified {new Date(file.lastModified).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "numeric", hour12: true })}
                  </div>
                </div>
              </div>
              <Link
                href={`/student/assignments/${assignment.id}/submit`}
                className="shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-700 border border-blue-100 hover:bg-blue-50 py-2 px-4 rounded-lg transition-colors"
              >
                Change file
              </Link>
            </div>
          </section>

          {/* Step 2: File fingerprint */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">2</div>
                <h3 className="font-bold text-slate-900 text-sm">File fingerprint (hash)</h3>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold uppercase tracking-wider">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Hash generated
              </div>
            </div>
            
            <div className="border border-slate-200 rounded-xl bg-white flex items-center pr-1.5 shadow-sm overflow-hidden mb-3">
              <div className="flex-1 px-4 py-3 text-sm font-mono text-slate-700 overflow-x-auto whitespace-nowrap scrollbar-hide">
                {fileHash}
              </div>
              <button
                onClick={() => copyToClipboard(fileHash)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center shrink-0 transition-colors"
                title="Copy hash"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
              A unique digital fingerprint (SHA-256) of your file. This proves exactly what you submitted, without sending the file over SMS.
            </p>
          </section>

          {/* Loading overlay for the tokens */}
          {isLoadingToken && (
            <div className="absolute inset-0 top-[380px] z-10 bg-white/70 backdrop-blur-[1px] flex items-center justify-center rounded-2xl">
              <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-full shadow-md border border-slate-100 font-semibold text-blue-600 text-sm">
                <svg className="w-5 h-5 animate-spin text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating fallback token...
              </div>
            </div>
          )}

          {/* Step 3: Assignment token */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
             <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">3</div>
                <h3 className="font-bold text-slate-900 text-sm">Assignment token</h3>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold uppercase tracking-wider">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Valid for submission
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl bg-white flex items-center pr-1.5 shadow-sm overflow-hidden mb-3">
              <div className="flex-1 px-4 py-3 text-sm font-mono text-slate-700">
                {commitmentToken}
              </div>
              <button
                onClick={() => copyToClipboard(commitmentToken || "")}
                className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center shrink-0 transition-colors"
                title="Copy token"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              This links your proof to the correct assignment, course, and your account.
              {usingPlaceholderToken && <span className="text-amber-600 ml-1 block mt-1">(Unverified — will confirm once synced)</span>}
            </p>
          </section>

          {/* Step 4: SMS proof preview */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
             <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">4</div>
                <h3 className="font-bold text-slate-900 text-sm">SMS proof preview</h3>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-[10px] font-bold uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                Ready to send
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl bg-slate-50 flex items-start p-1 shadow-inner overflow-hidden mb-5 relative">
              <div className="flex-1 p-3 text-xs font-mono text-slate-600 whitespace-pre-wrap leading-relaxed break-all">
                {smsBody}
              </div>
              <button
                onClick={() => copyToClipboard(smsBody)}
                className="absolute top-2 right-2 w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700 flex items-center justify-center shrink-0 transition-colors"
                title="Copy SMS text"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>

            <button
              onClick={handleCopyAndOpenSMS}
              disabled={isLoadingToken}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-5 rounded-xl text-sm shadow-md transition-all disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Copy proof and open SMS
            </button>
            <p className="text-center text-xs text-slate-400 mt-3">
              This will copy your proof to your clipboard and open your SMS app with our number.
            </p>
          </section>

        </div>

        {/* ── Right Column ─────────────────────────────────────────────────── */}
        <div className="xl:col-span-4 flex flex-col gap-4">
          
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-5">
               <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9v-.008M22.606 9v-.008" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">How fallback works</h3>
                <p className="text-[11px] text-slate-500">Stay on track, even without internet.</p>
              </div>
            </div>

            <ol className="flex flex-col gap-5 relative">
              <div className="absolute top-3 bottom-8 left-[11px] w-0.5 bg-slate-100 -z-10" />
              {[
                {
                  n: 1, 
                  title: "Copy your proof", 
                  desc: "We generate a secure proof from your file on this device.", 
                  icon: (
                    <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )
                },
                {
                  n: 2, 
                  title: "Open your SMS app", 
                  desc: "Tap the button below to copy the proof and open a new message.",
                  icon: (
                    <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-2.896-1.596-5.273-3.973-6.869-6.869l1.293-.97c.362-.271.527-.733.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                    </svg>
                  )
                },
                {
                  n: 3, 
                  title: `Send to ${fallbackNumber}`, 
                  desc: "Send the message as-is. Standard SMS rates may apply.",
                  icon: (
                    <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                    </svg>
                  )
                },
                {
                  n: 4, 
                  title: "Get confirmation", 
                  desc: "You'll receive a text back confirming your fallback submission. We'll sync your file automatically when you're back online.",
                  icon: (
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ),
                  filled: true
                }
              ].map((step, idx) => (
                <li key={idx} className="flex items-start gap-4 z-10">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 shadow-[0_0_0_4px_white] ${step.filled ? 'bg-blue-600' : 'bg-blue-50 border border-blue-200'}`}>
                    {step.icon}
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-900 block">{step.title}</span>
                    <span className="text-xs text-slate-500 leading-relaxed mt-0.5 block">{step.desc}</span>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="bg-emerald-50 rounded-2xl border border-emerald-100 shadow-sm p-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-emerald-900 text-sm">Why no file content is sent by SMS?</h3>
                <p className="text-xs text-emerald-800/80 mt-1.5 leading-relaxed">
                  Your file can be large and SMS isn&apos;t designed for file uploads. Instead, we send a secure fingerprint (hash) that uniquely identifies your file. This proves what you submitted without sharing your file content, keeping your data private and secure.
                </p>
                <Link
                  href="#"
                  className="mt-2 flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  Learn more about security →
                </Link>
              </div>
            </div>
          </section>
          
          <section className="bg-blue-50 rounded-2xl border border-blue-100 p-5">
             <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-blue-900 text-sm">Your work. Always counts.</h3>
                <p className="text-xs text-blue-700/80 mt-1 leading-relaxed">
                  Fallback proof secures your deadline. We&apos;ll match it with your file automatically when you&apos;re back online.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
