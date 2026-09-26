"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useSubmissionFlow } from "@/features/submissions/SubmissionFlowContext";
import { buildFallbackPayload, createCommitmentNonce } from "@/features/submissions/fallbackPayload";

type ApiResponse<T> = { data: T } | { error: { code?: string; message: string } };

class ApiResponseError extends Error {
  constructor(readonly code: string | undefined, message: string) {
    super(message);
  }
}

async function readResponse<T>(response: Response): Promise<T> {
  const payload = await response.json() as ApiResponse<T>;
  if (!response.ok || !("data" in payload)) {
    throw new ApiResponseError(
      "error" in payload ? payload.error.code : undefined,
      ("error" in payload && payload.error.message) || `Request failed (${response.status}).`,
    );
  }
  return payload.data;
}

export default function FallbackPage() {
  const router = useRouter();
  const { assignment, file, fileHash, commitmentToken, setCommitmentToken, nonce, setNonce } = useSubmissionFlow();
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenNeedsRotation, setTokenNeedsRotation] = useState(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [recorded, setRecorded] = useState(false);
  const simulatorAvailable = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_ENABLE_SIMULATED_SMS === "true";

  const requestToken = useCallback(async (rotate: boolean) => {
    setTokenError(null);
    setTokenNeedsRotation(false);
    if (rotate) setIsRotating(true);
    else setIsLoadingToken(true);
    try {
      const response = await fetch(`/api/assignments/${assignment.id}/fallback-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rotate }),
      });
      const issued = await readResponse<{ token: string }>(response);
      setCommitmentToken(issued.token);
      setNonce(createCommitmentNonce());
    } catch (error) {
      setTokenError(error instanceof Error ? error.message : "A fallback token could not be issued.");
      setTokenNeedsRotation(error instanceof ApiResponseError && error.code === "token_rotation_required");
    } finally {
      setIsLoadingToken(false);
      setIsRotating(false);
    }
  }, [assignment.id, setCommitmentToken, setNonce]);

  useEffect(() => {
    if (!file || !fileHash) {
      router.replace(`/student/assignments/${assignment.id}/submit`);
      return;
    }
  }, [assignment.id, file, fileHash, router]);

  const message = useMemo(() => {
    if (!commitmentToken || !nonce || !fileHash) return null;
    try {
      return buildFallbackPayload(commitmentToken, nonce, fileHash);
    } catch {
      return null;
    }
  }, [commitmentToken, fileHash, nonce]);

  const copyMessage = async () => {
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      setTokenError("Clipboard access was denied. Select and copy the message manually.");
    }
  };

  const simulateSms = async () => {
    if (!message) return;
    setIsSimulating(true);
    setSimulationError(null);
    try {
      const response = await fetch("/api/dev/simulate-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: message }),
      });
      await readResponse<{ outcome: "accepted" | "duplicate"; provider: "simulated" }>(response);
      setRecorded(true);
      router.push(`/student/assignments/${assignment.id}/fallback/confirmation`);
    } catch (error) {
      setSimulationError(error instanceof Error ? error.message : "The simulated commitment could not be recorded.");
    } finally {
      setIsSimulating(false);
    }
  };

  if (!file || !fileHash) return null;

  return <div className="mx-auto flex max-w-3xl flex-col gap-6">
    <Link href={`/student/assignments/${assignment.id}/submit`} className="w-fit text-sm font-semibold text-blue-700 hover:underline">← Back to file selection</Link>
    <header>
      <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Fallback commitment</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Record a fingerprint for later upload</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">SubmitProof records a hash of the selected file. The file itself is not sent in this message. The commitment counts only after the server records it.</p>
    </header>

    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="font-bold text-slate-900">Selected file</h2>
      <p className="mt-2 break-all text-sm text-slate-700">{file.name}</p>
      <p className="mt-1 break-all font-mono text-xs text-slate-500">SHA-256: {fileHash}</p>
    </section>

    {!commitmentToken && !tokenError && !isLoadingToken && <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-slate-600">A registered phone number is required. Request the one-time token when you are ready to prepare your fallback message.</p>
      <button type="button" onClick={() => void requestToken(false)} className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Request fallback token</button>
    </section>}
    {isLoadingToken && <p role="status" className="rounded-xl bg-blue-50 p-4 text-sm text-blue-800">Requesting a one-time fallback token…</p>}
    {tokenError && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p>{tokenError}</p>
      {tokenNeedsRotation && <><p className="mt-2 text-xs">If you have lost the token from this page, rotate it to issue a new one. Rotation revokes the earlier token.</p>
      <button type="button" onClick={() => void requestToken(true)} disabled={isRotating || isLoadingToken} className="mt-3 rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{isRotating ? "Rotating token…" : "Rotate token"}</button></>}
    </div>}

    {message && <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="font-bold text-slate-900">Commitment message</h2>
      <p className="mt-2 text-sm text-slate-600">Keep this message private. It contains your one-time assignment token.</p>
      <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-950 p-4 font-mono text-xs text-emerald-300">{message}</pre>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={() => void copyMessage()} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Copy commitment message</button>
        <button type="button" onClick={() => void requestToken(true)} disabled={isRotating || isSimulating} className="rounded-xl border border-amber-200 px-4 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-60">{isRotating ? "Rotating…" : "Rotate token"}</button>
        {simulatorAvailable && <button type="button" onClick={() => void simulateSms()} disabled={isSimulating || recorded} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{isSimulating ? "Recording commitment…" : recorded ? "Commitment recorded" : "Simulate SMS"}</button>}
      </div>
      {simulatorAvailable && <p className="mt-3 text-xs text-slate-500">Simulation is enabled for this environment; it records server time and marks the source as simulated.</p>}
      {!simulatorAvailable && <p className="mt-3 text-xs text-slate-500">SMS delivery is not connected in this environment. Copy this exact message; a live gateway integration is not available yet.</p>}
      {simulationError && <p role="alert" className="mt-3 text-sm text-rose-700">{simulationError}</p>}
    </section>}
  </div>
}
