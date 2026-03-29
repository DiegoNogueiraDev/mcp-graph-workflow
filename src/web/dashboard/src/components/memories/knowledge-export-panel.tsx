import { useState, useCallback } from "react";
import { apiClient } from "@/lib/api-client";

export function KnowledgeExportPanel(): React.JSX.Element {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<{ newDocuments: number; existingDocuments: number; newMemories: number; existingMemories: number; sourceTypes: string[] } | null>(null);
  const [importResult, setImportResult] = useState<{ documentsImported: number; documentsSkipped: number; memoriesImported: number } | null>(null);
  const [pendingPackage, setPendingPackage] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    try {
      setExporting(true);
      setError(null);
      const res = await apiClient.knowledgeExport();
      // Download as JSON
      const blob = new Blob([JSON.stringify(res.package, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `knowledge-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }, []);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setError(null);
      setImportResult(null);
      const text = await file.text();
      const pkg = JSON.parse(text);
      setPendingPackage(pkg);

      // Preview
      const res = await apiClient.knowledgePreview(pkg);
      setPreview(res.preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid package file");
      setPendingPackage(null);
      setPreview(null);
    }
  }, []);

  const handleConfirmImport = useCallback(async () => {
    if (!pendingPackage) return;

    try {
      setImporting(true);
      setError(null);
      const res = await apiClient.knowledgeImport(pendingPackage);
      setImportResult(res.result);
      setPreview(null);
      setPendingPackage(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }, [pendingPackage]);

  const handleCancel = useCallback(() => {
    setPendingPackage(null);
    setPreview(null);
    setImportResult(null);
  }, []);

  return (
    <div className="space-y-6">
      {/* Export */}
      <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
        <h3 className="text-sm font-semibold text-zinc-200 mb-2">Export Knowledge Package</h3>
        <p className="text-xs text-zinc-400 mb-3">Download all knowledge documents, memories, and relations as a portable JSON package.</p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 text-sm disabled:opacity-50"
        >
          {exporting ? "Exporting..." : "Export Package"}
        </button>
      </div>

      {/* Import */}
      <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
        <h3 className="text-sm font-semibold text-zinc-200 mb-2">Import Knowledge Package</h3>
        <p className="text-xs text-zinc-400 mb-3">Upload a knowledge package JSON to import documents and memories.</p>
        <input
          type="file"
          accept=".json"
          onChange={handleFileUpload}
          className="block w-full text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:bg-zinc-700 file:text-zinc-200 hover:file:bg-zinc-600"
        />

        {/* Preview */}
        {preview && (
          <div className="mt-4 p-3 bg-zinc-900 rounded-md border border-zinc-600">
            <h4 className="text-xs font-semibold text-zinc-300 mb-2">Import Preview</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-green-400">{preview.newDocuments}</span> new documents</div>
              <div><span className="text-yellow-400">{preview.existingDocuments}</span> existing (skip)</div>
              <div><span className="text-green-400">{preview.newMemories}</span> new memories</div>
              <div><span className="text-yellow-400">{preview.existingMemories}</span> existing (skip)</div>
            </div>
            <div className="text-xs text-zinc-500 mt-2">Sources: {preview.sourceTypes.join(", ")}</div>
            <div className="flex gap-2 mt-3">
              <button onClick={handleConfirmImport} disabled={importing} className="px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-500 text-xs disabled:opacity-50">
                {importing ? "Importing..." : "Confirm Import"}
              </button>
              <button onClick={handleCancel} className="px-3 py-1.5 bg-zinc-700 text-zinc-300 rounded-md hover:bg-zinc-600 text-xs">Cancel</button>
            </div>
          </div>
        )}

        {/* Result */}
        {importResult && (
          <div className="mt-4 p-3 bg-green-900/20 rounded-md border border-green-700/50">
            <h4 className="text-xs font-semibold text-green-400 mb-1">Import Complete</h4>
            <div className="text-xs text-zinc-300">
              {importResult.documentsImported} docs imported, {importResult.documentsSkipped} skipped, {importResult.memoriesImported} memories imported
            </div>
          </div>
        )}
      </div>

      {error && <div className="text-red-400 text-sm p-2">{error}</div>}
    </div>
  );
}
