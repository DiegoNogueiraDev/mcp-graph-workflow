import { useState, useRef, useCallback } from "react";
import { apiClient } from "@/lib/api-client";

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export function ImportModal({ open, onClose, onImported }: ImportModalProps): React.JSX.Element | null {
  const [file, setFile] = useState<File | null>(null);
  const [force, setForce] = useState(false);
  const [status, setStatus] = useState<{ type: "info" | "success" | "error"; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) {
      setFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!file) return;
    setSubmitting(true);
    setStatus({ type: "info", message: "Uploading and processing..." });
    try {
      const result = await apiClient.importFile(file, force);
      setStatus({ type: "success", message: `Imported ${result.nodesCreated} nodes and ${result.edgesCreated} edges.` });
      setTimeout(() => {
        onClose();
        onImported();
        setFile(null);
        setStatus(null);
      }, 1500);
    } catch (err) {
      setStatus({ type: "error", message: err instanceof Error ? err.message : "Import failed" });
    } finally {
      setSubmitting(false);
    }
  }, [file, force, onClose, onImported]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Import PRD</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground text-xl">&times;</button>
        </div>

        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors mb-4 ${
            dragOver ? "border-accent bg-accent10" : "border-edge"
          }`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".md,.txt,.pdf,.html,.htm"
            className="hidden"
            onChange={(e) => { if (e.target.files?.length) setFile(e.target.files[0]); }}
          />
          <p className="text-sm text-muted">
            {file
              ? `Selected: ${file.name} (${formatSize(file.size)})`
              : "Drag & drop a file here\nor click to select"}
          </p>
        </div>

        <label className="flex items-center gap-2 mb-4 text-sm">
          <input
            type="checkbox"
            checked={force}
            onChange={(e) => setForce(e.target.checked)}
          />
          Force re-import (overwrite existing)
        </label>

        {status && (
          <div className={`text-sm p-2 rounded mb-4 ${
            status.type === "success" ? "bg-green-500/10 text-green-500" :
            status.type === "error" ? "bg-red-500/10 text-red-500" :
            "bg-blue-500/10 text-blue-500"
          }`}>
            {status.message}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm border border-edge rounded hover:bg-surface-elevated"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!file || submitting}
            className="px-3 py-1.5 text-sm bg-accent text-white rounded hover:bg-accent-light disabled:opacity-50"
          >
            {submitting ? "Importing..." : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}
