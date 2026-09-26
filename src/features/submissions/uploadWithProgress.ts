export interface UploadWithProgressArgs {
  url: string;
  formData: FormData;
  onProgress: (percent: number) => void;
  onSuccess: (responseBody?: string) => void;
  onError: (errorMsg: string) => void;
}

export function uploadWithProgress({
  url,
  formData,
  onProgress,
  onSuccess,
  onError,
}: UploadWithProgressArgs): void {
  const xhr = new XMLHttpRequest();
  xhr.open("POST", url, true);
  
  xhr.timeout = 15000;

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const percentComplete = (e.loaded / e.total) * 100;
      onProgress(percentComplete);
    }
  };

  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      onSuccess(xhr.responseText);
    } else {
      onError(`Server error (${xhr.status}).`);
    }
  };

  xhr.onerror = () => {
    onError("Network error during submission.");
  };

  xhr.ontimeout = () => {
    onError("Connection timed out.");
  };

  xhr.send(formData);
}
