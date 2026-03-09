import { useState, useCallback } from "react";
import { apiClient } from "@/lib/api-client";

interface CaptureModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

interface CaptureResult {
  title?: string;
  description?: string;
  text: string;
  wordCount: number;
  capturedAt: string;
}

export function CaptureModal({ open, onClose, onImported }: CaptureModalProps): React.JSX.Element | null {
  const [url, setUrl] = useState("");
  const [selector, setSelector] = useState("");
  const [waitSelector, setWaitSelector] = useState("");
  const [status, setStatus] = useState<{ type: "info" | "success" | "error"; message: string } | null>(null);
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleCapture = useCallback(async () => {
    if (!url.trim()) {
      setStatus({ type: "error", message: "Please enter a URL" });
      return;
    }
    setSubmitting(true);
    setStatus({ type: "info", message: "Capturing page... This may take a few seconds." });
    setResult(null);

    try {
      const data = await apiClient.captureUrl(
        url.trim(),
        selector.trim() || undefined,
        waitSelector.trim() || undefined,
      ) as CaptureResult;
      setResult(data);
      setStatus({ type: "success", message: `Captured: ${data.wordCount} words` });
    } catch (err) {
      setStatus({ type: "error", message: `Capture failed: ${err instanceof Error ? err.message : "Unknown error"}` });
    } finally {
      setSubmitting(false);
    }
  }, [url, selector, waitSelector]);

  const handleImportCaptured = useCallback(async () => {
    if (!result) return;
    setStatus({ type: "info", message: "Importing captured content as PRD..." });

    try {
      const blob = new Blob([result.text], { type: "text/markdown" });
      const fileName = (result.title || "captured-page").replace(/[^a-zA-Z0-9-_]/g, "-") + ".md";
      const file = new File([blob], fileName, { type: "text/markdown" });
      await apiClient.importFile(file);
      setStatus({ type: "success", message: "Import completed!" });
      setTimeout(() => {
        onClose();
        onImported();
      }, 1000);
    } catch (err) {
      setStatus({ type: "error", message: `Import failed: ${err instanceof Error ? err.message : "Unknown error"}` });
    }
  }, [result, onClose, onImported]);

  const handleCopy = useCallback(async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.text);
    setStatus({ type: "success", message: "Copied to clipboard!" });
  }, [result]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[var(--color-bg)] rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Capture Web Page</h2>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-xl">&times;</button>
        </div>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs font-medium mb-1">URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/prd"
              className="w-full px-2 py-1.5 text-sm border border-[var(--color-border)] rounded bg-[var(--color-bg)]"
              onKeyDown={(e) => { if (e.key === "Enter") void handleCapture(); }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">CSS Selector (optional)</label>
            <input
              type="text"
              value={selector}
              onChange={(e) => setSelector(e.target.value)}
              placeholder="main, article, .content"
              className="w-full px-2 py-1.5 text-sm border border-[var(--color-border)] rounded bg-[var(--color-bg)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Wait for Selector (optional)</label>
            <input
              type="text"
              value={waitSelector}
              onChange={(e) => setWaitSelector(e.target.value)}
              placeholder=".loaded, #content"
              className="w-full px-2 py-1.5 text-sm border border-[var(--color-border)] rounded bg-[var(--color-bg)]"
            />
          </div>
        </div>

        {status && (
          <div className={`text-sm p-2 rounded mb-4 ${
            status.type === "success" ? "bg-green-500/10 text-green-500" :
            status.type === "error" ? "bg-red-500/10 text-red-500" :
            "bg-blue-500/10 text-blue-500"
          }`}>
            {status.message}
          </div>
        )}

        {result && (
          <div className="mb-4 p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
            <h3 className="text-sm font-medium mb-2">Extracted Content</h3>
            <div className="text-xs text-[var(--color-text-muted)] space-y-0.5 mb-2">
              <p><strong>Title:</strong> {result.title || "—"}</p>
              <p><strong>Words:</strong> {result.wordCount}</p>
              <p><strong>Captured:</strong> {new Date(result.capturedAt).toLocaleString()}</p>
            </div>
            <pre className="text-xs whitespace-pre-wrap max-h-40 overflow-y-auto p-2 bg-[var(--color-bg-tertiary)] rounded">
              {result.text.substring(0, 5000)}
              {result.text.length > 5000 && "\n\n... (truncated)"}
            </pre>
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleImportCaptured}
                className="px-3 py-1 text-xs bg-[var(--color-accent)] text-white rounded hover:bg-[var(--color-accent-light)]"
              >
                Import as PRD
              </button>
              <button
                onClick={handleCopy}
                className="px-3 py-1 text-xs border border-[var(--color-border)] rounded hover:bg-[var(--color-bg-tertiary)]"
              >
                Copy Text
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleCapture}
            disabled={submitting}
            className="px-3 py-1.5 text-sm bg-[var(--color-accent)] text-white rounded hover:bg-[var(--color-accent-light)] disabled:opacity-50"
          >
            {submitting ? "Capturing..." : "Capture"}
          </button>
        </div>
      </div>
    </div>
  );
}
