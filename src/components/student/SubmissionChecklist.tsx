"use client";

import { useState } from "react";
import Link from "next/link";

interface ChecklistProps {
  assignmentId: string;
  allowedFileTypes: string[];
  maxFileSizeBytes: number;
  deadlineFormatted: string;
  hasExistingSubmission: boolean;
}

export function SubmissionChecklist({
  assignmentId,
  allowedFileTypes,
  maxFileSizeBytes,
  deadlineFormatted,
  hasExistingSubmission,
}: ChecklistProps) {
  const maxFileSizeMb = Math.round(maxFileSizeBytes / (1024 * 1024));
  const fileTypesStr = allowedFileTypes.length > 0 ? allowedFileTypes.join(", ") : "any format";

  const items = [
    "Read and understand the assignment requirements",
    "Prepare your code and report",
    `Ensure your file is one of: ${fileTypesStr} (max ${maxFileSizeMb} MB)`,
    `Start your submission before ${deadlineFormatted}`,
  ];

  const [checked, setChecked] = useState<boolean[]>(() => items.map(() => false));

  const checkedCount = checked.filter(Boolean).length;

  const toggle = (i: number) => {
    setChecked((prev) => {
      const next = [...prev];
      next[i] = !next[i];
      return next;
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      {/* Card Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h2 className="font-bold text-slate-900 text-base">Submission Checklist</h2>
        </div>
        <span className="text-sm font-medium text-slate-500">
          {checkedCount} / {items.length} completed
        </span>
      </div>

      {/* Checklist Items */}
      <div className="flex flex-col gap-3 mb-6">
        {items.map((label, i) => (
          <label
            key={i}
            className="flex items-start gap-3 cursor-pointer group"
            onClick={() => toggle(i)}
          >
            <div
              className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                checked[i]
                  ? "bg-blue-600 border-blue-600"
                  : "bg-white border-slate-300 group-hover:border-blue-400"
              }`}
            >
              {checked[i] && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span
              className={`text-sm leading-snug transition-colors ${
                checked[i] ? "text-slate-400 line-through" : "text-slate-700"
              }`}
            >
              {label}
            </span>
          </label>
        ))}
      </div>

      {/* CTA Button */}
      <Link
        href={`/student/assignments/${assignmentId}/submit`}
        className="w-full flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-3.5 px-5 rounded-xl text-sm shadow-md shadow-blue-500/20 transition-all"
      >
        {hasExistingSubmission ? (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.641 0-8.58-3.007-9.963-7.178Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
            View Submission
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
            </svg>
            Start Submission
          </>
        )}
      </Link>

      {/* Reassurance text */}
      <p className="mt-3 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
        </svg>
        Your submission will be securely recorded, even if you&apos;re offline.
      </p>
    </div>
  );
}
