"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSubmissionFlow } from "@/features/submissions/SubmissionFlowContext";

type Commitment = {
  provider: string
  file_sha256: string
  gateway_event_at: string | null
  webhook_received_at: string
}

type SubmissionResponse = {
  data: { commitments: Commitment[] } | null
}

export default function FallbackConfirmationPage() {
  const { assignment, file } = useSubmissionFlow();
  const [commitment, setCommitment] = useState<Commitment | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [checkError, setCheckError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    const check = async () => {
      try {
        const response = await fetch(`/api/assignments/${assignment.id}/my-submission`, { cache: "no-store" });
        const payload = await response.json() as SubmissionResponse | { error?: { message?: string } };
        if (!response.ok) {
          const message = "error" in payload ? payload.error?.message : undefined;
          throw new Error(message || `Could not check the submission (${response.status}).`);
        }
        if ("data" in payload) {
          const latest = payload.data?.commitments?.[payload.data.commitments.length - 1] ?? null;
          if (latest) {
            if (!cancelled) {
              setCommitment(latest);
              setIsChecking(false);
              setCheckError(null);
            }
            return;
          }
        }
        setCheckError(null);
      } catch (error) {
        if (!cancelled) setCheckError(error instanceof Error ? error.message : "Could not check the submission.");
      }

      attempts += 1;
      if (attempts >= 10) {
        if (!cancelled) setIsChecking(false);
        return;
      }
      timeout = setTimeout(check, 3000);
    };

    void check();
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [assignment.id]);

  const recordedAt = commitment?.gateway_event_at ?? commitment?.webhook_received_at ?? null;

  return <div className="mx-auto flex max-w-3xl flex-col gap-6">
    <Link href="/student" className="w-fit text-sm font-semibold text-blue-700 hover:underline">← Student dashboard</Link>
    <header className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
      <p className="text-xs font-bold uppercase tracking-wide text-blue-700">{assignment.title}</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
        {commitment ? "Commitment recorded" : isChecking ? "Checking for recorded commitment" : "No commitment recorded"}
      </h1>
      <p role="status" aria-live="polite" className="mt-3 text-sm leading-6 text-slate-600">
        {commitment
          ? `The server recorded this ${commitment.provider === "simulated" ? "simulated " : ""}fallback commitment. Keep the original file and upload it to complete your submission.`
          : isChecking
            ? "SubmitProof is checking for a server record. This screen will only confirm proof returned by the API."
            : "No commitment is present in your submission record. You can retry from the fallback screen while the original file is still selected."}
      </p>
      {checkError && <p role="alert" className="mt-3 text-sm text-rose-700">{checkError}</p>}
    </header>

    {commitment && <section aria-label="Recorded commitment details" className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <dl className="grid gap-5 sm:grid-cols-2">
        <div><dt className="text-xs font-semibold uppercase text-slate-500">Evidence source</dt><dd className="mt-1 capitalize text-sm text-slate-900">{commitment.provider}</dd></div>
        <div><dt className="text-xs font-semibold uppercase text-slate-500">Server timestamp</dt><dd className="mt-1 text-sm text-slate-900">{recordedAt ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(recordedAt)) : "Not provided by the gateway"}</dd></div>
        <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase text-slate-500">Committed SHA-256</dt><dd className="mt-1 break-all font-mono text-xs text-slate-700">{commitment.file_sha256}</dd></div>
      </dl>
      <p className="mt-5 text-xs leading-5 text-slate-500">A commitment does not mean the uploaded file has been verified or that it qualifies under the assignment policy. Those results appear after upload.</p>
    </section>}

    <div className="flex flex-wrap gap-3">
      {commitment && <Link href={`/student/assignments/${assignment.id}/resume`} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">Upload original file</Link>}
      {!commitment && file && <Link href={`/student/assignments/${assignment.id}/fallback`} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Retry fallback step</Link>}
      <Link href={`/student/assignments/${assignment.id}`} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Assignment details</Link>
    </div>
  </div>
}
