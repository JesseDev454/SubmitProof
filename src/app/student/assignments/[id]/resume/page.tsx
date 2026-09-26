"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSubmissionFlow } from "@/features/submissions/SubmissionFlowContext";
import { useFileHasher, FileDropzone } from "@/features/submissions/useFileHasher";
import { uploadWithProgress } from "@/features/submissions/uploadWithProgress";

// TODO: confirm with Goodluck — need an endpoint returning the current student's most recent unresolved commitment for this assignment: 
// { commitmentToken, fileHash, fileName, committedAt, status }

function truncateHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 16)}...${hash.slice(-8)}`;
}

type CommitmentData = {
  commitmentToken: string;
  fileHash: string;
  fileName: string;
  committedAt: string;
  status: string;
};

export default function ResumeUploadPage() {
  const router = useRouter();
  const { assignment, commitmentToken: ctxToken, fileHash: ctxHash, file: ctxFile, committedAt: ctxCommittedAt } = useSubmissionFlow();

  const [commitment, setCommitment] = useState<CommitmentData | null>(null);
  const [isLoadingCommitment, setIsLoadingCommitment] = useState(true);

  // Upload/Verification state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [verificationResult, setVerificationResult] = useState<"idle" | "verifying" | "match" | "mismatch" | "error">("idle");
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [mismatchReason, setMismatchReason] = useState<string | null>(null);

  // File Picker
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedHash, setSelectedHash] = useState<string | null>(null);

  const fileHasher = useFileHasher({
    maxSizeBytes: assignment.max_file_size_bytes,
    allowedTypes: assignment.allowed_file_types,
    onFileSelect: (f) => {
      setSelectedFile(f);
      setSelectedHash(null);
      setVerificationResult("idle");
      setNetworkError(null);
      setMismatchReason(null);
    },
    onHashSuccess: (hash) => {
      setSelectedHash(hash);
    },
    onHashError: () => {
      setSelectedFile(null);
    },
    onClear: () => {
      setSelectedFile(null);
      setSelectedHash(null);
      setVerificationResult("idle");
      setNetworkError(null);
      setMismatchReason(null);
      setUploadProgress(0);
    },
  });

  // Fetch commitment
  useEffect(() => {
    const fetchCommitment = async () => {
      try {
        const res = await fetch(`/api/assignments/${assignment.id}/my-commitment`);
        if (!res.ok) throw new Error("Not found");
        const data = await res.json();
        setCommitment(data);
      } catch {
        // Fallback to Context
        if (ctxToken && ctxHash && ctxFile) {
          setCommitment({
            commitmentToken: ctxToken,
            fileHash: ctxHash,
            fileName: ctxFile.name,
            committedAt: ctxCommittedAt || new Date().toISOString(),
            status: "Fallback Committed",
          });
        }
      } finally {
        setIsLoadingCommitment(false);
      }
    };
    fetchCommitment();
  }, [assignment.id, ctxToken, ctxHash, ctxFile, ctxCommittedAt]);

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash).catch(() => {});
  };

  const handleUpload = () => {
    if (!selectedFile || !commitment || !selectedHash) return;

    setIsUploading(true);
    setUploadProgress(0);
    setVerificationResult("verifying");
    setNetworkError(null);
    setMismatchReason(null);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("commitmentToken", commitment.commitmentToken);

    uploadWithProgress({
      url: `/api/submissions/${assignment.id}/upload`,
      formData,
      onProgress: (percent) => setUploadProgress(percent),
      onSuccess: (responseBody) => {
        setIsUploading(false);
        try {
          const result = responseBody ? JSON.parse(responseBody) : { verified: true };
          if (result.verified) {
            setVerificationResult("match");
            // Delay redirect slightly for visual feedback
            setTimeout(() => {
              router.push(`/student/assignments/${assignment.id}/receipt`);
            }, 800);
          } else {
            setVerificationResult("mismatch");
            setMismatchReason(result.reason || "The uploaded file does not match the committed fingerprint.");
          }
        } catch {
          // If endpoint isn't returning JSON yet
          setNetworkError("Invalid server response.");
          setVerificationResult("error");
        }
      },
      onError: (msg) => {
        setIsUploading(false);
        setNetworkError("Couldn't reach the server — check your connection and try again. (" + msg + ")");
        setVerificationResult("error");
      }
    });
  };

  if (isLoadingCommitment) {
    return (
      <div className="flex justify-center py-20">
        <svg className="w-8 h-8 animate-spin text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  if (!commitment) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900">We couldn&apos;t find an earlier commitment for this assignment</h2>
        <Link href={`/student/assignments/${assignment.id}`} className="text-blue-600 font-medium hover:underline">
          Return to assignment
        </Link>
      </div>
    );
  }

  const isHashMismatch = selectedHash && commitment.fileHash && selectedHash !== commitment.fileHash;

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <Link
        href={`/student/assignments/${assignment.id}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline w-fit"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        Back to Dashboard
      </Link>

      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Student Resume Upload
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Upload the same file you committed earlier to complete your submission.
          </p>
        </div>
        <div className="hidden xl:block text-right shrink-0 max-w-[220px]">
          <span className="text-sm italic text-slate-600 block leading-snug">
            &ldquo;Different connections.<br />Same opportunities.&rdquo;
          </span>
          <span className="text-xs text-slate-400 block mt-1">— SubmitProof</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column */}
        <div className="xl:col-span-8 flex flex-col gap-5">
          {/* Your Earlier Commitment Card */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-base">Your Earlier Commitment</h2>
                <p className="text-xs text-slate-500">This file was recorded while you were offline.</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-4 flex items-center gap-4">
               <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 font-bold flex items-center justify-center shrink-0 text-sm">
                 {assignment.course_code.replace(/[0-9]/g, "").slice(0, 2).toUpperCase()}
               </div>
               <div className="flex-1 min-w-0">
                 <div className="text-[11px] font-medium text-slate-400 mb-0.5 tracking-wide">
                   {assignment.course_code} — {assignment.course_name}
                 </div>
                 <h3 className="font-bold text-slate-900 text-sm truncate leading-snug">
                   {assignment.title}
                 </h3>
                 <p className="text-xs text-slate-500 truncate mt-0.5">
                   Submit your draft (PDF or DOCX)
                 </p>
               </div>
            </div>

            <div className="grid grid-cols-[1fr_2fr] sm:grid-cols-[160px_1fr] gap-y-3 gap-x-4 text-sm">
              <div className="text-slate-500 flex items-center gap-2 text-xs">
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                Committed on
              </div>
              <div className="text-slate-900 font-medium">
                {new Date(commitment.committedAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}
              </div>

              <div className="text-slate-500 flex items-center gap-2 text-xs">
                 <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
                File name (recorded)
              </div>
              <div className="text-slate-900 font-medium truncate">{commitment.fileName}</div>

              <div className="text-slate-500 flex items-center gap-2 text-xs">
                 <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                File hash (SHA-256)
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-700 text-xs bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{truncateHash(commitment.fileHash)}</span>
                <button onClick={() => copyHash(commitment.fileHash)} className="text-slate-400 hover:text-slate-600 transition-colors" title="Copy full hash">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>

              <div className="text-slate-500 flex items-center gap-2 text-xs pt-2">
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
                </svg>
                Status
              </div>
              <div className="flex items-center gap-3 pt-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                  </svg>
                  Fallback Committed
                </span>
                <span className="text-xs text-slate-500">Saved offline, ready to verify</span>
              </div>
            </div>
          </section>

          {/* Upload Your File Card */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
             <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-base">Upload Your File</h2>
                <p className="text-xs text-slate-500">Select the same file you committed earlier. We&apos;ll compare it to verify your submission.</p>
              </div>
            </div>

            <FileDropzone
              file={selectedFile}
              fileHash={selectedHash}
              isHashing={fileHasher.isHashing}
              isDragging={fileHasher.isDragging}
              localError={fileHasher.localError}
              allowedFormatsStr={fileHasher.allowedFormatsStr}
              maxFileSizeStr={fileHasher.maxFileSizeStr}
              fileInputRef={fileHasher.fileInputRef}
              onDragOver={fileHasher.onDragOver}
              onDragLeave={fileHasher.onDragLeave}
              onDrop={fileHasher.onDrop}
              onFileSelectChange={fileHasher.onFileSelectChange}
              handleRemoveFile={fileHasher.handleRemoveFile}
              isUploading={isUploading}
              allowedTypes={assignment.allowed_file_types}
            />

            {isHashMismatch && !isUploading && verificationResult === "idle" && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700 flex items-start gap-2">
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>This doesn&apos;t match your committed file&apos;s fingerprint — double check you selected the right file.</span>
              </div>
            )}

            {networkError && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-600 flex items-start gap-2">
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{networkError}</span>
              </div>
            )}

            <div className="mt-6">
              <button
                onClick={handleUpload}
                disabled={!selectedFile || !selectedHash || fileHasher.isHashing || isUploading}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-3.5 px-5 rounded-xl text-sm shadow-sm transition-all"
              >
                {isUploading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading... {Math.round(uploadProgress)}%
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                    </svg>
                    Upload and verify
                  </>
                )}
              </button>
              <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                Your file is securely uploaded and only used for verification.
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Verification Process */}
        <div className="xl:col-span-4 flex flex-col gap-4">
           {/* Important Box */}
           <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
             <div className="flex items-center gap-3 mb-4">
               <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.82 1.508-2.316a7.5 7.5 0 1 0-7.516 0c.85.496 1.508 1.333 1.508 2.316V18" />
                  </svg>
               </div>
               <h3 className="font-bold text-slate-900 text-sm">Important</h3>
             </div>
             <h4 className="font-bold text-slate-900 text-sm mb-2">Upload the exact same file</h4>
             <p className="text-xs text-slate-500 mb-4">
               To successfully verify your submission, please upload the exact same file you committed while offline.
             </p>
             <ul className="flex flex-col gap-3 mb-5">
               <li className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-xs text-slate-600 leading-snug">Use the same file (no edits).</span>
               </li>
               <li className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-xs text-slate-600 leading-snug">Keep the same file name.</span>
               </li>
               <li className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-xs text-slate-600 leading-snug">If the file is different, it won&apos;t match the recorded hash.</span>
               </li>
             </ul>
             
             <div className="pt-4 border-t border-slate-100">
               <div className="flex items-center gap-2 mb-1">
                 <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                   <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                 </svg>
                 <span className="text-xs font-bold text-slate-900">Need help?</span>
               </div>
               <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                 If you&apos;re having trouble, check the file name and make sure you&apos;re uploading the original file you committed.
               </p>
               <Link href="#" className="text-xs font-semibold text-blue-600 hover:underline">
                 Learn more about verification →
               </Link>
             </div>
           </section>

           {/* Verification Process Tracker */}
           <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
             <div className="flex items-center gap-3 mb-4">
               <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
               </div>
               <h3 className="font-bold text-slate-900 text-sm">Verification Process</h3>
             </div>
             <p className="text-xs text-slate-500 mb-5">
               We&apos;ll check your file against the recorded commitment to make sure it&apos;s an exact match.
             </p>

             <ol className="flex flex-col gap-6 relative pl-1">
               <div className="absolute top-4 bottom-4 left-[15px] w-[2px] bg-slate-100 -z-10" />
               
               {/* Step 1: Awaiting upload */}
               <li className="flex items-start gap-4 z-10">
                 <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold shadow-[0_0_0_4px_white] ${
                   verificationResult === "idle" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"
                 }`}>
                   1
                 </div>
                 <div className="pt-1">
                   <span className={`text-sm font-bold block ${verificationResult === "idle" ? "text-blue-700" : "text-slate-600"}`}>Awaiting upload</span>
                   <span className="text-[11px] text-slate-500 mt-0.5 block">Select your file and click &ldquo;Upload and verify.&rdquo;</span>
                 </div>
               </li>

               {/* Step 2: Verifying */}
               <li className="flex items-start gap-4 z-10">
                 <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold shadow-[0_0_0_4px_white] ${
                   verificationResult === "verifying" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"
                 }`}>
                   {verificationResult === "verifying" ? (
                     <svg className="w-3.5 h-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                     </svg>
                   ) : "2"}
                 </div>
                 <div className="pt-1">
                   <span className={`text-sm font-bold block ${verificationResult === "verifying" ? "text-blue-700" : "text-slate-600"}`}>Verifying...</span>
                   <span className="text-[11px] text-slate-500 mt-0.5 block">We&apos;re checking the file name and hash.</span>
                 </div>
               </li>

               {/* Step 3: Match / Mismatch */}
               <li className="flex items-start gap-4 z-10">
                 <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold shadow-[0_0_0_4px_white] ${
                   verificationResult === "match" ? "bg-emerald-600 text-white" :
                   verificationResult === "mismatch" ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-400"
                 }`}>
                   {verificationResult === "match" ? (
                     <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                     </svg>
                   ) : verificationResult === "mismatch" ? (
                     <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                       <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                     </svg>
                   ) : "3"}
                 </div>
                 <div className="pt-1">
                   {verificationResult === "mismatch" ? (
                     <>
                       <span className="text-sm font-bold block text-rose-600">File mismatch</span>
                       <span className="text-[11px] text-rose-500/80 mt-0.5 block leading-relaxed">
                         {mismatchReason}
                       </span>
                     </>
                   ) : verificationResult === "match" ? (
                     <>
                       <span className="text-sm font-bold block text-emerald-700">File match</span>
                       <span className="text-[11px] text-emerald-600/80 mt-0.5 block">Your submission will be marked as complete.</span>
                     </>
                   ) : (
                     <>
                       <span className="text-sm font-bold block text-slate-600">File match</span>
                       <span className="text-[11px] text-slate-500 mt-0.5 block">Your submission will be marked as complete.</span>
                     </>
                   )}
                 </div>
               </li>
             </ol>
           </section>
        </div>
      </div>
    </div>
  );
}
