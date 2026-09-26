"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

export interface AssignmentContextData {
  id: string;
  title: string;
  course_code: string;
  course_name: string;
  deadline_at: string;
  allowed_file_types: string[];
  max_file_size_bytes: number;
  fallback_enabled: boolean;
  grace_period_minutes: number;
  assignment_status: "draft" | "published" | "closed";
  description?: string | null;
}

interface SubmissionFlowState {
  assignment: AssignmentContextData;
  file: File | null;
  setFile: (file: File | null) => void;
  fileHash: string | null;
  setFileHash: (hash: string | null) => void;
  uploadProgress: number;
  setUploadProgress: (progress: number) => void;
  uploadError: string | null;
  setUploadError: (error: string | null) => void;
  commitmentToken: string | null;
  setCommitmentToken: (token: string | null) => void;
  nonce: string | null;
  setNonce: (nonce: string | null) => void;
}

const SubmissionFlowContext = createContext<SubmissionFlowState | null>(null);

export function SubmissionFlowProvider({
  assignment,
  children,
}: {
  assignment: AssignmentContextData;
  children: ReactNode;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [commitmentToken, setCommitmentToken] = useState<string | null>(null);
  const [nonce, setNonce] = useState<string | null>(null);

  return (
    <SubmissionFlowContext.Provider
      value={{
        assignment,
        file,
        setFile,
        fileHash,
        setFileHash,
        uploadProgress,
        setUploadProgress,
        uploadError,
        setUploadError,
        commitmentToken,
        setCommitmentToken,
        nonce,
        setNonce,
      }}
    >
      {children}
    </SubmissionFlowContext.Provider>
  );
}

export function useSubmissionFlow() {
  const context = useContext(SubmissionFlowContext);
  if (!context) {
    throw new Error("useSubmissionFlow must be used within a SubmissionFlowProvider");
  }
  return context;
}
