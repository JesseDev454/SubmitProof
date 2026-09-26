import { uploadWithProgress } from "./uploadWithProgress";

export interface SubmitNormallyArgs {
  file: File;
  assignmentId: string;
  fileHash: string;
  onProgress: (percent: number) => void;
  onSuccess: () => void;
  onError: (errorMsg: string) => void;
}

/**
 * Handles the normal XMLHttpRequest upload flow for submitting an assignment.
 * Wraps the upload in a Promise for easier consumption, calling progress/error
 * callbacks as it runs.
 */
export function submitNormally({
  file,
  assignmentId,
  fileHash,
  onProgress,
  onSuccess,
  onError,
}: SubmitNormallyArgs): void {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("assignmentId", assignmentId);
  formData.append("clientHash", fileHash);

  uploadWithProgress({
    url: "/api/submissions/normal",
    formData,
    onProgress,
    onSuccess: () => onSuccess(),
    onError: (msg) => {
      // Keep the original error suffix behavior for fallback routing
      if (msg.includes("Server error")) {
        onError(`${msg} Falling back...`);
      } else if (msg.includes("Network error")) {
        onError(`${msg} Falling back...`);
      } else if (msg.includes("Connection timed out")) {
        onError(`${msg} Falling back...`);
      } else {
        onError(`${msg} Falling back...`);
      }
    }
  });
}
