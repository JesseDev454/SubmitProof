"use client";

import React, { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSubmissionFlow } from "@/features/submissions/SubmissionFlowContext";
import { submitNormally as submitNormallyHelper } from "@/features/submissions/submitNormally";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFileSizeMb(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${Math.round(mb * 10) / 10} MB` : `${Math.round(bytes / 1024)} KB`;
}

function truncateHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 16)}...${hash.slice(-8)}`;
}

function getDaysUntil(isoString: string): string {
  const diff = new Date(isoString).getTime() - Date.now();
  if (diff <= 0) return "past due";
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return `in ${days} day${days !== 1 ? "s" : ""}`;
}

async function computeSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isHashing, setIsHashing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const maxFileSizeStr = formatFileSizeMb(assignment.max_file_size_bytes);
  const allowedFormatsStr = assignment.allowed_file_types.length > 0 
    ? assignment.allowed_file_types.join(", ").toUpperCase().replace(/\./g, "") 
    : "ANY";

  // Cleanup object URLs or states if unmounted
  useEffect(() => {
    return () => {
      // Any cleanup if needed
    };
  }, []);

  const handleFile = async (selectedFile: File) => {
    setLocalError(null);
    setUploadError(null);

    // Validate size
    if (selectedFile.size > assignment.max_file_size_bytes) {
      setLocalError(`File size exceeds maximum allowed limit (${maxFileSizeStr}).`);
      return;
    }

    // Validate type (if restricted)
    if (assignment.allowed_file_types.length > 0) {
      const ext = "." + selectedFile.name.split(".").pop()?.toLowerCase();
      if (!assignment.allowed_file_types.some((allowed) => allowed.toLowerCase() === ext)) {
        setLocalError(`Invalid file format. Allowed: ${allowedFormatsStr}.`);
        return;
      }
    }

    setFile(selectedFile);
    setIsHashing(true);
    setFileHash(null);

    try {
      const hash = await computeSHA256(selectedFile);
      setFileHash(hash);
    } catch {
      setLocalError("Failed to generate file hash. Please try again.");
      setFile(null);
    } finally {
      setIsHashing(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setFileHash(null);
    setLocalError(null);
    setUploadProgress(0);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const copyHash = () => {
    if (fileHash) {
      navigator.clipboard.writeText(fileHash);
    }
  };

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

            {/* Error Message */}
            {localError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-600 flex items-start gap-2">
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{localError}</span>
              </div>
            )}
            {uploadError && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700 flex items-start gap-2">
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{uploadError}</span>
              </div>
            )}

            {!file ? (
              /* Dropzone */
              <div 
                className={`relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-colors
                  ${isDragging ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-slate-50 hover:bg-slate-100/50"}
                `}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
              >
                <div className="w-12 h-12 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 mb-4">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                </div>
                <div className="text-sm font-semibold text-slate-900 mb-1">Drag and drop your file here</div>
                <div className="text-xs text-slate-400 mb-4">or</div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 font-semibold py-2 px-6 rounded-full text-xs shadow-sm transition-colors"
                >
                  Choose File
                </button>
                <input
                  type="file"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={onFileSelect}
                  accept={assignment.allowed_file_types.join(",")}
                />
                
                <div className="flex items-center gap-4 mt-6 text-[11px] text-slate-400">
                  <span>Accepted formats: {allowedFormatsStr}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300" />
                  <span>Maximum size: {maxFileSizeStr}</span>
                </div>
              </div>
            ) : (
              /* Selected File State */
              <div className="border border-slate-200 rounded-xl p-4 bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate pr-4">{file.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {formatFileSizeMb(file.size)} &bull; {file.name.split(".").pop()?.toUpperCase()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 w-full sm:w-auto shrink-0 border-t border-slate-100 sm:border-0 pt-3 sm:pt-0 mt-3 sm:mt-0">
                  {isHashing ? (
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                      <svg className="w-4 h-4 animate-spin text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating hash...
                    </div>
                  ) : fileHash ? (
                    <div className="flex flex-col items-start sm:items-end">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 mb-0.5">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        SHA-256 generated
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono bg-slate-50 px-2 py-0.5 rounded">
                        {truncateHash(fileHash)}
                        <button onClick={copyHash} className="hover:text-slate-800 transition-colors" title="Copy to clipboard">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <button
                    onClick={handleRemoveFile}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors ml-auto sm:ml-0"
                    disabled={isUploading}
                    aria-label="Remove file"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

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
