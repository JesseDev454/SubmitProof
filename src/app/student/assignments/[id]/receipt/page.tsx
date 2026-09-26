import React from "react";
import Link from "next/link";
import { createClient } from "@/lib/auth/server";
import { PrintButton } from "./PrintButton";

// ─── Types ───────────────────────────────────────────────────────────────────

type JsonMetadata = Record<string, string | number | boolean | null | undefined>;

interface ReceiptSubmission {
  id: string;
  status: string;
  file_hash?: string;
  uploaded_hash?: string;
  file_name: string;
  file_size: number;
  file_type?: string;
  storage_path?: string;
  matched_commitment_id?: string;
  uploaded_at?: string;
  created_at: string;
  policy_result?: string;
  verification_result?: string;
}

interface ReceiptAssignment {
  title: string;
  description?: string | null;
  deadline_at: string;
  course_code: string;
  course_name: string;
  lecturer_name: string;
}

interface ReceiptCommitment {
  id: string;
  committed_at: string;
  file_hash: string;
  commitment_token?: string;
}

interface AuditEvent {
  id: string;
  event_type: string;
  event_at: string;
  metadata_json?: JsonMetadata;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFileSizeMb(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${Math.round(mb * 10) / 10} MB` : `${Math.round(bytes / 1024)} KB`;
}

function truncateHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 16)}...${hash.slice(-8)}`;
}

function formatEventTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`;
  } catch {
    return iso;
  }
}

function getEventLabel(type: string): string {
  const map: Record<string, string> = {
    FILE_SELECTED: "File selected",
    LOCAL_HASH_GENERATED: "Local fingerprint generated",
    SMS_COMMITMENT_RECEIVED: "Fallback commitment sent",
    COMMITMENT_RECEIVED: "Commitment received",
    FILE_UPLOADED: "File uploaded later",
    HASH_VERIFICATION_PASSED: "Verification completed",
    HASH_VERIFICATION_FAILED: "Verification failed",
  };
  return map[type] || type;
}

function getEventDescription(type: string, metadata: JsonMetadata | null | undefined): string {
  const m = metadata || {};
  switch (type) {
    case "FILE_SELECTED":
      return `You selected "${m.fileName || 'file'}" (${m.fileSize !== undefined ? formatFileSizeMb(Number(m.fileSize)) : 'unknown size'}) for submission.`;
    case "LOCAL_HASH_GENERATED":
      return "A SHA-256 fingerprint was generated on your device.";
    case "SMS_COMMITMENT_RECEIVED":
      return "Your file fingerprint was securely sent to SubmitProof for timestamping (offline mode).";
    case "COMMITMENT_RECEIVED":
      return "SubmitProof received your commitment and recorded it on our secure ledger.";
    case "FILE_UPLOADED":
      return "You uploaded the full file when you were back online.";
    case "HASH_VERIFICATION_PASSED":
      return "The uploaded file matches your committed fingerprint exactly (SHA-256).";
    case "HASH_VERIFICATION_FAILED":
      return "The uploaded file did not match your committed fingerprint.";
    default:
      return (m.description ? String(m.description) : null) || "System event recorded.";
  }
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default async function SubmissionReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const notFound = false;

  let submission: ReceiptSubmission | null = null;
  let assignment: ReceiptAssignment | null = null;
  let commitment: ReceiptCommitment | null = null;
  let auditEvents: AuditEvent[] = [];

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Fetch submission
        try {
          const { data: subData } = await supabase
            .from("submissions")
            .select("*")
            .eq("assignment_id", id)
            .eq("student_id", user.id)
            .maybeSingle();
          submission = subData;
        } catch { /* ignore */ }

        if (submission) {
          // Fetch assignment + relations
          try {
            const { data: assignData } = await supabase
              .from("assignments")
              .select(`
                title,
                description,
                deadline_at,
                courses (code, name),
                profiles!assignments_created_by_fkey (full_name)
              `)
              .eq("id", id)
              .maybeSingle();

            if (assignData) {
              const courseRaw = Array.isArray(assignData.courses) ? assignData.courses[0] : assignData.courses;
              const profileRaw = Array.isArray(assignData.profiles) ? assignData.profiles[0] : assignData.profiles;
              assignment = {
                title: assignData.title,
                description: assignData.description,
                deadline_at: assignData.deadline_at,
                course_code: courseRaw?.code ?? "COURSE",
                course_name: courseRaw?.name ?? "Unknown Course",
                lecturer_name: profileRaw?.full_name ?? "Unknown Lecturer",
              };
            }
          } catch { /* ignore */ }

          // Fetch commitment
          if (submission.matched_commitment_id) {
            try {
              const { data: commData } = await supabase
                .from("commitments")
                .select("*")
                .eq("id", submission.matched_commitment_id)
                .maybeSingle();
              commitment = commData;
            } catch { /* ignore */ }
          }

          // Fetch audit events
          try {
            const { data: events } = await supabase
              .from("audit_events")
              .select("*")
              .eq("submission_id", submission.id)
              .order("event_at", { ascending: true });
            if (events) auditEvents = events;
          } catch { /* ignore */ }
        }
      }
    } catch { /* Supabase not configured */ }
  }

  // ── Dev-mode dummy data ─────────────────────────────────────────────────────
  if (!submission && !notFound) {
    // If no db, show the empty state per instructions
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-slate-900">No submission on record yet</h1>
        <p className="text-sm text-slate-500 max-w-xs">
          We couldn&apos;t find a submission for this assignment.
        </p>
        <Link
          href={`/student/assignments/${id}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Back to Assignment
        </Link>
      </div>
    );
  }

  // After the early return above, TypeScript needs explicit guards to narrow nullability
  if (!submission || !assignment) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 gap-4">
        <h1 className="text-xl font-bold text-slate-900">Could not load submission details</h1>
        <p className="text-sm text-slate-500 max-w-xs">
          The submission exists but some details couldn&apos;t be loaded. Please try again.
        </p>
        <Link
          href={`/student/assignments/${id}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Back to Assignment
        </Link>
      </div>
    );
  }

  // Derived values
  const isVerified = submission.policy_result === "VERIFIED" || submission.verification_result === "VERIFIED" || submission.status === "VERIFIED";
  const deadlineMs = new Date(assignment.deadline_at).getTime();
  const committedMs = commitment ? new Date(commitment.committed_at).getTime() : null;
  const isBeforeDeadline = committedMs && committedMs <= deadlineMs;

  const uploadedHash = submission.file_hash || submission.uploaded_hash || "";
  const committedHash = commitment?.file_hash || "";
  const matchResult = uploadedHash && committedHash ? uploadedHash === committedHash : false;

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto xl:mx-0">
      {/* ── Header Area ────────────────────────────────────────────────────── */}
      <Link
        href="/student/receipts"
        className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline w-fit print:hidden"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        Back to Receipts
      </Link>

      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Submission Receipt
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            This is your official submission record. Keep it for your records.
          </p>
        </div>
        <div className="hidden xl:block text-right shrink-0 max-w-[220px]">
          <span className="text-sm italic text-slate-600 block leading-snug">
            &ldquo;Proof today.<br />Peace of mind tomorrow.&rdquo;
          </span>
          <span className="text-xs text-slate-400 block mt-1">— SubmitProof</span>
        </div>
      </div>

      {/* ── Top Banner ─────────────────────────────────────────────────────── */}
      <div className={`rounded-2xl border p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm ${
        isVerified ? "bg-emerald-50 border-emerald-100" : "bg-amber-50 border-amber-100"
      }`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
            isVerified ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"
          }`}>
            {isVerified ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
          </div>
          <div>
            <h2 className={`font-bold text-lg mb-0.5 ${isVerified ? "text-emerald-950" : "text-amber-950"}`}>
              {isVerified ? "Verified pre-deadline commitment" : (submission.status === "MISMATCH" ? "Mismatch detected" : "Submitted")}
            </h2>
            <p className={`text-sm ${isVerified ? "text-emerald-800/80" : "text-amber-800/80"}`}>
              {isVerified 
                ? "Your submission was committed before the deadline and the uploaded file matches exactly." 
                : "The uploaded file does not match the committed fingerprint."}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          {matchResult && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold w-fit ml-auto">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              File match confirmed
            </div>
          )}
          {(submission.status === "VERIFIED" || submission.status === "COMPLETED") && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold w-fit ml-auto">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Submission complete
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* ── Left Column ──────────────────────────────────────────────────── */}
        <div className="xl:col-span-7 flex flex-col gap-5">
          
          {/* Submission Details Card */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center gap-2.5 mb-5 border-b border-slate-100 pb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
              </div>
              <h3 className="font-bold text-slate-900 text-base">Submission Details</h3>
            </div>

            <div className="flex flex-col gap-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-1 sm:gap-4 items-start">
                <div className="text-slate-500 font-medium">Assignment</div>
                <div className="text-slate-900">
                  <div className="font-bold">{assignment.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5 max-w-sm truncate">{assignment.description}</div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-1 sm:gap-4">
                <div className="text-slate-500 font-medium">Course</div>
                <div className="text-slate-900 font-medium">{assignment.course_code} — {assignment.course_name}</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-1 sm:gap-4">
                <div className="text-slate-500 font-medium">Lecturer</div>
                <div className="text-slate-900 font-medium">{assignment.lecturer_name}</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-1 sm:gap-4">
                <div className="text-slate-500 font-medium">Deadline</div>
                <div className="text-slate-900 font-medium">
                  {formatEventTime(assignment.deadline_at)} <span className="text-slate-500 font-normal">(Your local time)</span>
                </div>
              </div>

              {commitment && (
                <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-1 sm:gap-4 items-center">
                  <div className="text-slate-500 font-medium">Commitment Timestamp</div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-900 font-medium">{formatEventTime(commitment.committed_at)}</span>
                    {isBeforeDeadline ? (
                      <span className="inline-flex items-center px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5"></span>
                        Before deadline
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-bold rounded-full">
                        <span className="w-1.5 h-1.5 bg-rose-500 rounded-full mr-1.5"></span>
                        After deadline
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-1 sm:gap-4">
                <div className="text-slate-500 font-medium">File Upload Timestamp</div>
                <div className="text-slate-900 font-medium">{formatEventTime(submission.uploaded_at || submission.created_at)}</div>
              </div>

              {commitment && (
                <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-1 sm:gap-4 items-center mt-2">
                  <div className="text-slate-500 font-medium">Commitment ID</div>
                  <div className="flex items-center gap-2 text-slate-700 font-mono text-xs bg-slate-50 px-2.5 py-1.5 rounded-md border border-slate-200 w-fit">
                    <span>{commitment.commitment_token || commitment.id}</span>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* File & Verification Card */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                </div>
                <h3 className="font-bold text-slate-900 text-base">File & Verification</h3>
              </div>
              {submission.storage_path && (
                <Link href="#" className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full transition-colors print:hidden">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                  View file
                </Link>
              )}
            </div>

            <div className="flex flex-col gap-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-1 sm:gap-4">
                <div className="text-slate-500 font-medium">File name</div>
                <div className="text-slate-900 font-bold">{submission.file_name}</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-1 sm:gap-4">
                <div className="text-slate-500 font-medium">File size</div>
                <div className="text-slate-900 font-medium">{formatFileSizeMb(submission.file_size)} <span className="text-slate-500 font-normal">({submission.file_size} bytes)</span></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-1 sm:gap-4">
                <div className="text-slate-500 font-medium">File type</div>
                <div className="text-slate-900 font-medium">{submission.file_type}</div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-1 sm:gap-4 items-center">
                <div className="text-slate-500 font-medium">SHA-256 hash (uploaded)</div>
                <div className="flex items-center gap-2 font-mono text-slate-700 text-[11px] sm:text-xs">
                  {truncateHash(uploadedHash)}
                </div>
              </div>
              
              {committedHash && (
                <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-1 sm:gap-4 items-center">
                  <div className="text-slate-500 font-medium">SHA-256 hash (committed)</div>
                  <div className="flex items-center gap-2 font-mono text-slate-700 text-[11px] sm:text-xs">
                    {truncateHash(committedHash)}
                  </div>
                </div>
              )}

              {committedHash && (
                <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-1 sm:gap-4 items-center mt-1">
                  <div className="text-slate-500 font-medium">Hash match result</div>
                  <div>
                    {matchResult ? (
                      <div>
                        <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-sm">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Match confirmed
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">The uploaded file is identical to your committed file.</div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-1.5 text-rose-700 font-bold text-sm">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Mismatch
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">The uploaded file differs from your committed file.</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-1 sm:gap-4 items-center mt-2 pt-4 border-t border-slate-100">
                <div className="text-slate-500 font-medium">Submission status</div>
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    isVerified ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-700 border border-slate-200"
                  }`}>
                    {isVerified ? (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : null}
                    {submission.status || "Completed"}
                  </span>
                  {isVerified && (
                    <span className="text-[11px] text-slate-500">Committed before deadline and file match confirmed.</span>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ── Right Column ─────────────────────────────────────────────────── */}
        <div className="xl:col-span-5 flex flex-col gap-4">
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                </div>
                <h3 className="font-bold text-slate-900 text-base">Submission Timeline</h3>
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                {auditEvents.length > 0 ? `${auditEvents.length} of ${auditEvents.length} events` : "Event log"}
              </div>
            </div>

            {auditEvents.length > 0 ? (
              <ol className="flex flex-col relative pl-2">
                <div className="absolute top-2 bottom-4 left-[15px] w-0.5 bg-blue-100 -z-10" />
                {auditEvents.map((ev, idx) => (
                  <li key={ev.id || idx} className="flex items-start gap-4 z-10 mb-6 last:mb-0">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-[0_0_0_4px_white]">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-slate-900">{getEventLabel(ev.event_type)}</span>
                        <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium block mt-0.5">{formatEventTime(ev.event_at)}</span>
                      <span className="text-xs text-slate-600 leading-snug mt-1.5 block">
                        {getEventDescription(ev.event_type, ev.metadata_json)}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              // Empty state timeline
              <ol className="flex flex-col relative pl-2">
                <div className="absolute top-2 bottom-4 left-[15px] w-0.5 bg-blue-100 -z-10" />
                
                {commitment && (
                  <li className="flex items-start gap-4 z-10 mb-6">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-[0_0_0_4px_white]">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-slate-900">Commitment received</span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium block mt-0.5">{formatEventTime(commitment.committed_at)}</span>
                      <span className="text-xs text-slate-600 leading-snug mt-1.5 block">
                        SubmitProof received your commitment and recorded it.
                      </span>
                    </div>
                  </li>
                )}

                <li className="flex items-start gap-4 z-10 mb-6">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-[0_0_0_4px_white]">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-900">File uploaded</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium block mt-0.5">{formatEventTime(submission.uploaded_at || submission.created_at)}</span>
                    <span className="text-xs text-slate-600 leading-snug mt-1.5 block">
                      You selected &ldquo;{submission.file_name}&rdquo; ({formatFileSizeMb(submission.file_size)}) for submission.
                    </span>
                  </div>
                </li>

                <li className="flex items-start gap-4 z-10">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-[0_0_0_4px_white]">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-900">Verification completed</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium block mt-0.5">{formatEventTime(submission.uploaded_at || submission.created_at)}</span>
                    <span className="text-xs text-slate-600 leading-snug mt-1.5 block">
                      {isVerified ? "Your submission was verified against the ledger." : "Submission processed."}
                    </span>
                  </div>
                </li>
              </ol>
            )}
          </section>
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="mt-4 bg-blue-50 border border-blue-100 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-blue-900 text-sm">This receipt is a secure and tamper-evident record of your submission.</h3>
            <p className="text-xs text-blue-700/80 mt-0.5">
              You can download or print this receipt for your records. If you have any questions, contact your institution.
            </p>
          </div>
        </div>
        <PrintButton />
      </div>
    </div>
  );
}
