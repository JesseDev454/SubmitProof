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

  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/api/submissions/normal", true);
  
  // Timeout to prevent hanging connections
  xhr.timeout = 15000;

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const percentComplete = (e.loaded / e.total) * 100;
      onProgress(percentComplete);
    }
  };

  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      onSuccess();
    } else {
      onError(`Server error (${xhr.status}). Falling back...`);
    }
  };

  xhr.onerror = () => {
    onError("Network error during submission. Falling back...");
  };

  xhr.ontimeout = () => {
    onError("Connection timed out. Falling back...");
  };

  xhr.send(formData);
}
