"use client";

import { useState } from "react";

export function ViewFileButton({ uploadId }: { uploadId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const openFile = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/uploads/${uploadId}/download`, { cache: "no-store" });
      const payload = await response.json() as { data?: { url: string }; error?: { message: string } };
      if (!response.ok || !payload.data?.url) throw new Error(payload.error?.message ?? "A secure file link could not be created.");
      window.location.assign(payload.data.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The file could not be opened.");
    } finally {
      setLoading(false);
    }
  };

  return <div>
    <button type="button" onClick={() => void openFile()} disabled={loading} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
      {loading ? "Opening…" : "View file"}
    </button>
    {error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
  </div>
}
