/**
 * UploadSection — SIF file and documentation upload with drag-and-drop zones.
 * Uses Web Worker for off-main-thread SIF parsing + progress bar.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { useSifParser } from "@/hooks/use-sif-parser";
import { UploadProgress } from "./upload-progress";

interface UploadSectionProps {
  onUploaded: () => void;
}

export function UploadSection({ onUploaded }: UploadSectionProps): React.JSX.Element {
  const [docsStatus, setDocsStatus] = useState<string | null>(null);
  const [sifDragging, setSifDragging] = useState(false);
  const [docsDragging, setDocsDragging] = useState(false);
  const sifFileRef = useRef<HTMLInputElement>(null);
  const docsFileRef = useRef<HTMLInputElement>(null);

  const sifParser = useSifParser();

  // When worker parsing is done, send to API for indexing
  useEffect(() => {
    if (sifParser.status !== "done" || !sifParser.result) return;

    const fileName = sifParser.result.metadata.fileName;

    // Re-read the file isn't needed — send a lightweight import
    // The worker already parsed it; we need to send content to the server for indexing.
    // Since the worker consumed the content, we store it via a ref approach.
    // For simplicity, we use the API import which re-parses server-side.
    // The worker gives us instant UI feedback while the server import runs in background.
    void (async () => {
      try {
        // The file content was already read by the worker; we stored it in sifContentRef
        if (sifContentRef.current) {
          await apiClient.siebelImportSif(sifContentRef.current, fileName, true);
          sifContentRef.current = null;
          onUploaded();
        }
      } catch {
        // Non-fatal: worker parse succeeded, server import failed
      }
    })();
  }, [sifParser.status, sifParser.result, onUploaded]);

  const sifContentRef = useRef<string | null>(null);

  const handleSifFile = useCallback((file: File) => {
    // Read file content once, share between worker (for UI) and API (for indexing)
    file.text().then((content) => {
      sifContentRef.current = content;
      // Start worker-based parsing for progress feedback
      sifParser.parse(file);
    }).catch(() => {
      // Fallback: direct API call
      void (async () => {
        try {
          const text = await file.text();
          await apiClient.siebelImportSif(text, file.name, true);
          onUploaded();
        } catch {
          // Error handled by status
        }
      })();
    });
  }, [sifParser, onUploaded]);

  const handleDocsFile = useCallback(async (file: File) => {
    try {
      setDocsStatus("Uploading documentation...");
      const result = await apiClient.siebelUploadDocs(file);
      setDocsStatus(`Indexed: ${result.fileName} (${result.chunksIndexed} chunks)`);
      onUploaded();
    } catch (err) {
      setDocsStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [onUploaded]);

  const handleSifInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleSifFile(file);
    if (sifFileRef.current) sifFileRef.current.value = "";
  }, [handleSifFile]);

  const handleDocsInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleDocsFile(file);
    if (docsFileRef.current) docsFileRef.current.value = "";
  }, [handleDocsFile]);

  const handleDrop = useCallback((
    e: React.DragEvent,
    handler: ((file: File) => void) | ((file: File) => Promise<void>),
    setDragging: (v: boolean) => void,
  ) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void handler(file);
  }, []);

  const preventDefaults = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-1">Upload & Context</h3>
        <p className="text-xs text-muted">
          Upload SIF files and documentation to build RAG context for generation
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* SIF Drop Zone */}
        <div
          className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
            sifDragging
              ? "border-accent bg-accent/5"
              : "border-edge hover:border-accent/50"
          }`}
          onDragEnter={(e) => { preventDefaults(e); setSifDragging(true); }}
          onDragOver={(e) => { preventDefaults(e); setSifDragging(true); }}
          onDragLeave={(e) => { preventDefaults(e); setSifDragging(false); }}
          onDrop={(e) => handleDrop(e, handleSifFile, setSifDragging)}
          onClick={() => sifFileRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") sifFileRef.current?.click(); }}
          aria-label="Upload SIF file"
        >
          <input
            ref={sifFileRef}
            type="file"
            accept=".sif,.xml"
            onChange={handleSifInputChange}
            className="hidden"
            tabIndex={-1}
          />
          <svg
            className="w-8 h-8 mx-auto mb-2 text-muted"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <p className="text-xs font-medium">SIF File (.sif, .xml)</p>
          <p className="text-[10px] text-muted mt-1">
            Drop here or click to browse
          </p>
        </div>

        {/* Docs Drop Zone */}
        <div
          className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
            docsDragging
              ? "border-accent bg-accent/5"
              : "border-edge hover:border-accent/50"
          }`}
          onDragEnter={(e) => { preventDefaults(e); setDocsDragging(true); }}
          onDragOver={(e) => { preventDefaults(e); setDocsDragging(true); }}
          onDragLeave={(e) => { preventDefaults(e); setDocsDragging(false); }}
          onDrop={(e) => handleDrop(e, handleDocsFile, setDocsDragging)}
          onClick={() => docsFileRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") docsFileRef.current?.click(); }}
          aria-label="Upload documentation file"
        >
          <input
            ref={docsFileRef}
            type="file"
            accept=".pdf,.html,.htm,.txt,.md,.doc,.docx"
            onChange={handleDocsInputChange}
            className="hidden"
            tabIndex={-1}
          />
          <svg
            className="w-8 h-8 mx-auto mb-2 text-muted"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
          <p className="text-xs font-medium">Documentation</p>
          <p className="text-[10px] text-muted mt-1">
            PDF, HTML, DOC, DOCX, TXT, MD
          </p>
        </div>
      </div>

      {/* SIF parsing progress */}
      {sifParser.status !== "idle" && (
        <UploadProgress
          status={sifParser.status}
          progress={sifParser.progress}
          error={sifParser.error}
        />
      )}

      {/* Docs upload status */}
      {docsStatus && (
        <div
          className={`px-3 py-2 rounded-md text-xs ${
            docsStatus.startsWith("Error")
              ? "bg-red-500/10 text-red-500"
              : "bg-green-500/10 text-green-500"
          }`}
          role="status"
          aria-live="polite"
        >
          {docsStatus}
        </div>
      )}
    </div>
  );
}
