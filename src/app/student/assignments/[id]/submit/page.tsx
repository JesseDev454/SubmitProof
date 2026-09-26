"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSubmissionFlow } from "@/features/submissions/SubmissionFlowContext";
import { submitNormally as submitNormallyHelper } from "@/features/submissions/submitNormally";
import { useFileHasher, FileDropzone } from "@/features/submissions/useFileHasher";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDaysUntil(isoString: string): string {
  const diff = new Date(isoString).getTime() - Date.now();
  if (diff <= 0) return "past due";
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return `in ${days} day${days !== 1 ? "s" : ""}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SubmitAssignmentPage() {
  const router = useRouter();
  const {
    assignment,
    file,
    setFile,
    fileHash,
    setFileHash,
    uploadProgress,
    setUploadProgress,
    uploadError,
    setUploadError,
  } = useSubmissionFlow();

  const [isUploading, setIsUploading] = useState(false);

  const {
    isHashing,
    localError,
    isDragging,
    fileInputRef,
    onDragOver,
    onDragLeave,
    onDrop,
    onFileSelectChange,
    handleRemoveFile,
    allowedFormatsStr,
    maxFileSizeStr,
  } = useFileHasher({
    maxSizeBytes: assignment.max_file_size_bytes,
    allowedTypes: assignment.allowed_file_types,
    onFileSelect: (f) => {
      setFile(f);
      setFileHash(null);
      setUploadError(null);
    },
    onHashSuccess: (hash) => setFileHash(hash),
    onHashError: () => setFile(null),
    onClear: () => {
      setFile(null);
      setFileHash(null);
      setUploadProgress(0);
      setUploadError(null);
    },
  });

  const submitNormally = () => {
    if (!file || !fileHash) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    submitNormallyHelper({
      file,
      assignmentId: assignment.id,
      fileHash,
      onProgress: (percent) => setUploadProgress(percent),
      onSuccess: () => {
        setIsUploading(false);
        // TODO: route to submission receipt once it exists
        router.push("/student");
      },
      onError: (errorMsg) => {
        setIsUploading(false);
        setUploadError(errorMsg);
        router.push(`/student/assignments/${assignment.id}/fallback`);
      }
    });
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      {/* ── Back Link ──────────────────────────────────────────────────────── */}
      <Link
        href={`/student/assignments/${assignment.id}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline w-fit"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        Back to Assignments
      </Link>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
          Submit Assignment
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload and submit your work. Submit with confidence. Even when <strong>you&apos;re offline</strong>.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* ── Left Column (Main Form) ──────────────────────────────────────── */}
        <div className="xl:col-span-8 flex flex-col gap-5">
          {/* Assignment Recap Box */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 font-bold flex items-center justify-center shrink-0 text-sm">
              {assignment.course_code.replace(/[0-9]/g, "").slice(0, 2).toUpperCase() || "CS"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-medium text-slate-400 mb-0.5 tracking-wide">
                {assignment.course_code} — {assignment.course_name}
              </div>
              <h2 className="font-bold text-slate-900 text-lg truncate leading-snug mb-1">
                {assignment.title}
              </h2>
              <p className="text-xs text-slate-500 truncate">
                {assignment.description || "No description provided."}
              </p>
            </div>
            <div className="shrink-0 text-slate-300">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>

          {/* Upload Box */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <h3 className="font-bold text-slate-900 text-base">Upload Your File</h3>
            </div>
            
            <p className="text-sm text-slate-500 mb-4">Select your completed assignment file to submit.</p>

            {uploadError && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700 flex items-start gap-2">
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{uploadError}</span>
              </div>
            )}

            <FileDropzone
              file={file}
              fileHash={fileHash}
              isHashing={isHashing}
              isDragging={isDragging}
              localError={localError}
              allowedFormatsStr={allowedFormatsStr}
              maxFileSizeStr={maxFileSizeStr}
              fileInputRef={fileInputRef}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onFileSelectChange={onFileSelectChange}
              handleRemoveFile={handleRemoveFile}
              isUploading={isUploading}
              allowedTypes={assignment.allowed_file_types}
            />

            {/* Progress Bar (Visible when uploading) */}
            {isUploading && (
              <div className="mt-6 flex flex-col gap-2">
                <div className="flex justify-between items-end text-xs font-semibold text-slate-700">
                  <span>Uploading...</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-400 text-right">
                  Uploading your file securely to SubmitProof...
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-6">
              <button
                onClick={submitNormally}
                disabled={!file || !fileHash || isHashing || isUploading}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-3.5 px-5 rounded-xl text-sm shadow-sm transition-all"
              >
                {isUploading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Submitting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                    </svg>
                    Submit Normally
                  </>
                )}
              </button>
            </div>
            
            {/* Fallback Helper Link */}
            <div className="mt-4 text-center">
              {(!file || !fileHash) ? (
                <span className="text-xs text-slate-400">
                  If you can&apos;t submit due to connectivity issues, you can use fallback submission →
                </span>
              ) : (
                <Link
                  href={`/student/assignments/${assignment.id}/fallback`}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                >
                  If you can&apos;t submit due to connectivity issues, you can use fallback submission →
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* ── Right Column ─────────────────────────────────────────────────── */}
        <div className="xl:col-span-4 flex flex-col gap-4">
          {/* Assignment Details */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Assignment Details</h3>
            </div>
            
            <div className="flex items-start gap-3 mb-4">
               <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                </svg>
              </div>
              <div>
                <div className="text-[11px] text-slate-400 mb-0.5 font-medium">Due Date</div>
                <div className="text-sm font-bold text-slate-900 leading-snug">
                  {new Date(assignment.deadline_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {new Date(assignment.deadline_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} 
                  {" "}({getDaysUntil(assignment.deadline_at)})
                </div>
              </div>
            </div>

            {assignment.fallback_enabled ? (
              <div className="flex items-start gap-3 pt-4 border-t border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 leading-snug">Fallback Enabled</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    If you can&apos;t submit online, you can use fallback to submit later.
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          {/* Requirements */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Submission Requirements</h3>
            </div>

            <ul className="flex flex-col gap-3">
              {[
                `Accepted file types: ${allowedFormatsStr}`,
                `Maximum file size: ${maxFileSizeStr}`,
                "One file per submission",
                "File must be your own work",
                "Late submissions are not accepted"
              ].map((req, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-xs text-slate-600 leading-snug">{req}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Connectivity Info */}
          <section className="bg-blue-50 rounded-2xl border border-blue-100 p-5">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-blue-900 text-sm">Having connectivity issues?</h3>
                <p className="text-xs text-blue-700/80 mt-1 leading-relaxed">
                  Fallback submission is available if you can&apos;t submit online.
                </p>
              </div>
            </div>
            {/* TODO: Add real link once fallback informational page exists */}
            <Link
              href={`/student/assignments/${assignment.id}/fallback`}
              className="mt-2 flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-800 hover:underline pl-11"
            >
              Learn more about fallback →
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
