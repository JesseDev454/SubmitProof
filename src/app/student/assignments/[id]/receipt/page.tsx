import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/auth/server";
import { loadStudentAssignment } from "@/lib/student/data";
import { PrintButton } from "./PrintButton";
import { ViewFileButton } from "./ViewFileButton";

function label(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ") : "Not recorded";
}

function formatTime(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function SubmissionReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: assignmentId } = await params;
  const [assignment, supabase] = await Promise.all([loadStudentAssignment(assignmentId), createClient()]);
  if (!assignment) notFound();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: submission, error: submissionError } = await supabase
    .from("submissions")
    .select("id, workflow_status, created_at, updated_at")
    .eq("assignment_id", assignmentId)
    .eq("student_id", user.id)
    .maybeSingle();
  if (submissionError) throw submissionError;
  if (!submission) return <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 text-center">
    <h1 className="text-xl font-bold text-slate-900">No submission recorded</h1>
    <p className="text-sm text-slate-500">A receipt appears after the server records a commitment or upload.</p>
    <Link href={`/student/assignments/${assignmentId}`} className="font-semibold text-blue-700 hover:underline">Back to assignment</Link>
  </div>;

  const [commitmentsResult, uploadsResult, auditResult] = await Promise.all([
    supabase.from("commitments").select("id, file_sha256, provider, gateway_event_at, webhook_received_at, processed_at, policy_version_id").eq("submission_id", submission.id).order("created_at"),
    supabase.from("submission_uploads").select("id, server_sha256, matched_commitment_id, verification_result, policy_result, uploaded_at, finalized_at, policy_version_id").eq("submission_id", submission.id).order("uploaded_at"),
    supabase.from("audit_events").select("id, event_type, source, event_at, metadata").eq("submission_id", submission.id).order("event_at"),
  ]);
  if (commitmentsResult.error) throw commitmentsResult.error;
  if (uploadsResult.error) throw uploadsResult.error;
  if (auditResult.error) throw auditResult.error;

  const commitments = commitmentsResult.data ?? [];
  const uploads = uploadsResult.data ?? [];
  const latestUpload = uploads[uploads.length - 1] ?? null;
  const matchedCommitment = latestUpload?.matched_commitment_id
    ? commitments.find((commitment) => commitment.id === latestUpload.matched_commitment_id) ?? null
    : null;

  return <article className="mx-auto flex max-w-4xl flex-col gap-6 print:max-w-none">
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <Link href={`/student/assignments/${assignmentId}`} className="text-sm font-semibold text-blue-700 hover:underline">← Assignment details</Link>
      <div className="flex items-center gap-2">
        {latestUpload && <ViewFileButton uploadId={latestUpload.id} />}
        <PrintButton />
      </div>
    </div>

    <header className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8 print:border-0 print:shadow-none">
      <p className="text-xs font-bold uppercase tracking-wide text-blue-700">{assignment.course_code} · {assignment.course_name}</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Submission receipt</h1>
      <p className="mt-2 text-lg font-semibold text-slate-800">{assignment.title}</p>
      <p className="mt-1 text-sm text-slate-500">Receipt generated from server-recorded evidence.</p>
    </header>

    <section aria-labelledby="results-heading" className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm print:break-inside-avoid">
      <h2 id="results-heading" className="font-bold text-slate-900">Submission results</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-3">
        <div><dt className="text-xs font-semibold uppercase text-slate-500">Workflow</dt><dd className="mt-1 capitalize text-sm text-slate-900">{label(submission.workflow_status)}</dd></div>
        <div><dt className="text-xs font-semibold uppercase text-slate-500">Hash verification</dt><dd className="mt-1 capitalize text-sm text-slate-900">{label(latestUpload?.verification_result)}</dd></div>
        <div><dt className="text-xs font-semibold uppercase text-slate-500">Policy qualification</dt><dd className="mt-1 capitalize text-sm text-slate-900">{label(latestUpload?.policy_result)}</dd></div>
      </dl>
      <p className="mt-4 text-xs leading-5 text-slate-500">Verification compares file fingerprints. Policy qualification uses the commitment and storage receipt times against the applicable policy version. These are separate results.</p>
    </section>

    {latestUpload && <section aria-labelledby="upload-heading" className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm print:break-inside-avoid">
      <h2 id="upload-heading" className="font-bold text-slate-900">Latest upload evidence</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div><dt className="text-xs font-semibold uppercase text-slate-500">Storage receipt time</dt><dd className="mt-1 text-sm text-slate-900">{formatTime(latestUpload.uploaded_at)}</dd></div>
        <div><dt className="text-xs font-semibold uppercase text-slate-500">Verification finalized</dt><dd className="mt-1 text-sm text-slate-900">{formatTime(latestUpload.finalized_at)}</dd></div>
        <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase text-slate-500">Server-computed SHA-256</dt><dd className="mt-1 break-all font-mono text-xs text-slate-700">{latestUpload.server_sha256}</dd></div>
      </dl>
    </section>}

    {commitments.length > 0 && <section aria-labelledby="commitment-heading" className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm print:break-inside-avoid">
      <h2 id="commitment-heading" className="font-bold text-slate-900">Fallback commitments</h2>
      <ul className="mt-4 divide-y divide-slate-100">
        {commitments.map((commitment) => <li key={commitment.id} className="py-4 first:pt-0 last:pb-0">
          <div className="flex flex-wrap justify-between gap-2 text-sm"><span className="font-semibold capitalize text-slate-900">{commitment.provider} evidence</span><span className="text-slate-500">Gateway: {formatTime(commitment.gateway_event_at)}</span></div>
          <p className="mt-1 text-xs text-slate-500">Received by server: {formatTime(commitment.webhook_received_at)}</p>
          <p className="mt-2 break-all font-mono text-xs text-slate-600">SHA-256: {commitment.file_sha256}</p>
          {matchedCommitment?.id === commitment.id && <p className="mt-1 text-xs font-semibold text-blue-700">Matched by the latest upload</p>}
        </li>)}
      </ul>
    </section>}

    <section aria-labelledby="audit-heading" className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm print:break-inside-avoid">
      <h2 id="audit-heading" className="font-bold text-slate-900">Evidence history</h2>
      {auditResult.data?.length ? <ol className="mt-4 space-y-3">
        {auditResult.data.map((event) => <li key={event.id} className="flex flex-wrap justify-between gap-2 border-l-2 border-blue-200 pl-3 text-sm">
          <span className="font-medium capitalize text-slate-800">{event.event_type.replaceAll(".", " ").replaceAll("_", " ")}</span>
          <span className="text-xs text-slate-500">{formatTime(event.event_at)} · {event.source}</span>
        </li>)}
      </ol> : <p className="mt-3 text-sm text-slate-500">No audit events are recorded for this submission.</p>}
    </section>
  </article>
}
