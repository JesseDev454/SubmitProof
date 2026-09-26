"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSubmissionFlow } from "@/features/submissions/SubmissionFlowContext";
import { useFileHasher, FileDropzone } from "@/features/submissions/useFileHasher";
import { getUploadIdempotencyKey, uploadSubmission, type FinalizedUpload } from "@/features/submissions/uploadSubmission";
import { createClient } from "@/lib/auth/client";

type Commitment = {
  provider: string
  file_sha256: string
  gateway_event_at: string | null
  webhook_received_at: string
}

type SubmissionPayload = {
  data: { commitments: Commitment[]; uploads: Array<{ id: string; verification_result: string; policy_result: string }> } | null
}

function resultLabel(value: string) {
  return value.replaceAll("_", " ")
}

export default function ResumeUploadPage() {
  const { assignment } = useSubmissionFlow();
  const [commitment, setCommitment] = useState<Commitment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState<"reserving" | "transferring" | "verifying" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FinalizedUpload | null>(null);

  const fileHasher = useFileHasher({
    maxSizeBytes: assignment.max_file_size_bytes,
    allowedTypes: assignment.allowed_file_types,
    onFileSelect: (file) => { setSelectedFile(file); setSelectedHash(null); setResult(null); setError(null); },
    onHashSuccess: setSelectedHash,
    onHashError: () => setSelectedFile(null),
    onClear: () => { setSelectedFile(null); setSelectedHash(null); setResult(null); setError(null); },
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`/api/assignments/${assignment.id}/my-submission`, { cache: "no-store" });
        const payload = await response.json() as SubmissionPayload | { error?: { message?: string } };
        if (!response.ok || !("data" in payload)) {
          throw new Error(("error" in payload && payload.error?.message) || `Could not load submission evidence (${response.status}).`);
        }
        const latest = payload.data?.commitments[payload.data.commitments.length - 1] ?? null;
        if (!latest) throw new Error("No recorded fallback commitment was found for this assignment.");
        if (!cancelled) setCommitment(latest);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Submission evidence could not be loaded.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [assignment.id]);

  const upload = async () => {
    if (!selectedFile || !selectedHash || !commitment) return;
    setIsUploading(true);
    setError(null);
    setResult(null);
    try {
      const supabase = createClient();
      const finalized = await uploadSubmission({
        assignmentId: assignment.id,
        file: selectedFile,
        kind: "fallback",
        idempotencyKey: getUploadIdempotencyKey(assignment.id, "fallback", selectedHash),
        transfer: async (path, token, file) => {
          const { error: storageError } = await supabase.storage
            .from("submission-files")
            .uploadToSignedUrl(path, token, file, { contentType: file.type, upsert: false });
          return { error: storageError };
        },
        onStage: setUploadStage,
      });
      setResult(finalized);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "The upload could not be verified.");
    } finally {
      setIsUploading(false);
      setUploadStage(null);
    }
  };

  return <div className="mx-auto flex max-w-3xl flex-col gap-6">
    <Link href={`/student/assignments/${assignment.id}`} className="w-fit text-sm font-semibold text-blue-700 hover:underline">← Assignment details</Link>
    <header>
      <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Fallback upload</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Upload the original file</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">Choose the same file you fingerprinted. SubmitProof compares the server-computed hash with every recorded commitment and reports verification separately from policy qualification.</p>
    </header>

    {isLoading ? <p role="status" className="rounded-xl bg-blue-50 p-4 text-sm text-blue-800">Loading recorded commitment…</p> : commitment && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-900">Recorded {commitment.provider} commitment</p>
      <p className="mt-1 text-xs text-slate-500">{commitment.gateway_event_at ? new Date(commitment.gateway_event_at).toLocaleString() : "Gateway time was not available"}</p>
      <p className="mt-3 break-all font-mono text-xs text-slate-600">{commitment.file_sha256}</p>
    </section>}

    <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
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
      {isUploading && <p role="status" aria-live="polite" className="mt-4 text-sm text-blue-700">{uploadStage === "reserving" ? "Preparing secure upload…" : uploadStage === "transferring" ? "Transferring file to private storage…" : "Verifying the uploaded file…"}</p>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <button type="button" onClick={() => void upload()} disabled={!selectedFile || !selectedHash || !commitment || isUploading || isLoading} className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
        {isUploading ? "Processing upload…" : "Upload and verify"}
      </button>
    </section>

    {result && <section role="status" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="font-bold text-slate-900">Upload recorded</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div><dt className="text-xs font-semibold uppercase text-slate-500">Verification</dt><dd className="mt-1 capitalize text-sm text-slate-900">{resultLabel(result.verificationResult)}</dd></div>
        <div><dt className="text-xs font-semibold uppercase text-slate-500">Policy</dt><dd className="mt-1 capitalize text-sm text-slate-900">{resultLabel(result.policyResult)}</dd></div>
      </dl>
      <Link href={`/student/assignments/${assignment.id}/receipt`} className="mt-5 inline-flex rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">View receipt</Link>
    </section>}
  </div>
}
