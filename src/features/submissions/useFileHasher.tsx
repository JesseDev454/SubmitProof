import React, { useState, useRef } from "react";
import { isAllowedFileType } from "./fileType";

function formatFileSizeMb(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${Math.round(mb * 10) / 10} MB` : `${Math.round(bytes / 1024)} KB`;
}

function truncateHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 16)}...${hash.slice(-8)}`;
}

export interface UseFileHasherArgs {
  maxSizeBytes: number;
  allowedTypes: string[];
  onFileSelect: (file: File) => void;
  onHashSuccess: (hash: string) => void;
  onHashError: (error: string) => void;
  onClear: () => void;
}

export function useFileHasher({
  maxSizeBytes,
  allowedTypes,
  onFileSelect,
  onHashSuccess,
  onHashError,
  onClear,
}: UseFileHasherArgs) {
  const [isHashing, setIsHashing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allowedFormatsStr = allowedTypes.length > 0 
    ? allowedTypes.join(", ").toUpperCase().replace(/\./g, "") 
    : "ANY";
  const maxFileSizeStr = formatFileSizeMb(maxSizeBytes);

  const handleFile = async (selectedFile: File) => {
    setLocalError(null);

    if (selectedFile.size > maxSizeBytes) {
      setLocalError(`File size exceeds maximum allowed limit (${maxFileSizeStr}).`);
      return;
    }

    if (!isAllowedFileType(selectedFile, allowedTypes)) {
      setLocalError(`Invalid file format. Allowed: ${allowedFormatsStr}.`);
      return;
    }

    onFileSelect(selectedFile);
    setIsHashing(true);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
      onHashSuccess(hash);
    } catch {
      setLocalError("Failed to generate file hash. Please try again.");
      onHashError("Failed to generate file hash.");
      onClear();
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

  const onFileSelectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setLocalError(null);
    onClear();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return {
    isHashing,
    localError,
    setLocalError,
    isDragging,
    fileInputRef,
    onDragOver,
    onDragLeave,
    onDrop,
    onFileSelectChange,
    handleRemoveFile,
    allowedFormatsStr,
    maxFileSizeStr,
  };
}

export interface FileDropzoneProps {
  file: File | null;
  fileHash: string | null;
  isHashing: boolean;
  isDragging: boolean;
  localError: string | null;
  allowedFormatsStr: string;
  maxFileSizeStr: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelectChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveFile: () => void;
  isUploading?: boolean;
  allowedTypes: string[];
}

export function FileDropzone({
  file,
  fileHash,
  isHashing,
  isDragging,
  localError,
  allowedFormatsStr,
  maxFileSizeStr,
  fileInputRef,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelectChange,
  handleRemoveFile,
  isUploading = false,
  allowedTypes,
}: FileDropzoneProps) {
  const copyHash = () => {
    if (fileHash) {
      navigator.clipboard.writeText(fileHash);
    }
  };

  return (
    <>
      {localError && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-600 flex items-start gap-2">
          <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{localError}</span>
        </div>
      )}

      {!file ? (
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
            onChange={onFileSelectChange}
            accept={allowedTypes.join(",")}
          />
          
          <div className="flex items-center gap-4 mt-6 text-[11px] text-slate-400">
            <span>Accepted formats: {allowedFormatsStr}</span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span>Maximum size: {maxFileSizeStr}</span>
          </div>
        </div>
      ) : (
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
    </>
  );
}
