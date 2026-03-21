/**
 * Siebel Tab — SIF upload, documentation context, and SIF generation.
 * Marked as BETA feature.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { apiClient } from "@/lib/api-client";

// ── Types ────────────────────────────────────────────

interface SiebelObject {
  title: string;
  sourceType: string;
  siebelType?: string;
  siebelProject?: string;
  contentPreview: string;
}

interface SifTemplate {
  type: string;
  xmlTag: string;
  requiredAttrs: string[];
  optionalAttrs: string[];
  childTags: string[];
}

interface ValidationMessage {
  level: string;
  message: string;
  objectName?: string;
}

interface GenerationResult {
  sifContent: string;
  objects: Array<{ name: string; type: string }>;
  validation: {
    status: string;
    messages: ValidationMessage[];
    score: number;
  };
  metadata: {
    generatedAt: string;
    requestDescription: string;
    objectCount: number;
  };
}

// ── Main component ──────────────────────────────────

export function SiebelTab(): React.JSX.Element {
  const [objects, setObjects] = useState<SiebelObject[]>([]);
  const [templates, setTemplates] = useState<SifTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload state
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const sifFileRef = useRef<HTMLInputElement>(null);
  const docsFileRef = useRef<HTMLInputElement>(null);

  // Generation state
  const [genDescription, setGenDescription] = useState("");
  const [genTypes, setGenTypes] = useState<string[]>(["business_component"]);
  const [genProject, setGenProject] = useState("");
  const [genPrompt, setGenPrompt] = useState<string | null>(null);
  const [genXml, setGenXml] = useState("");
  const [genResult, setGenResult] = useState<GenerationResult | null>(null);
  const [genLoading, setGenLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [objResult, tmplResult] = await Promise.all([
        apiClient.siebelGetObjects({ limit: 100 }).catch(() => ({ objects: [], total: 0 })),
        apiClient.siebelGetTemplates().catch(() => ({ templates: [] })),
      ]);
      setObjects(objResult.objects);
      setTemplates(tmplResult.templates);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ── Upload handlers ──

  const handleSifUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadStatus("Importing SIF...");
      const text = await file.text();
      await apiClient.siebelImportSif(text, file.name, true);
      setUploadStatus(`SIF imported: ${file.name}`);
      void loadData();
    } catch (err) {
      setUploadStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (sifFileRef.current) sifFileRef.current.value = "";
  }, [loadData]);

  const handleDocsUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadStatus("Uploading documentation...");
      const result = await apiClient.siebelUploadDocs(file);
      setUploadStatus(`Indexed: ${result.fileName} (${result.chunksIndexed} chunks)`);
      void loadData();
    } catch (err) {
      setUploadStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (docsFileRef.current) docsFileRef.current.value = "";
  }, [loadData]);

  // ── Generation handlers ──

  const handlePrepare = useCallback(async () => {
    if (!genDescription.trim()) return;
    setGenLoading(true);
    setGenResult(null);
    try {
      const result = await apiClient.siebelPrepareGeneration({
        description: genDescription,
        objectTypes: genTypes,
        basedOnProject: genProject || undefined,
      });
      setGenPrompt(result.prompt);
    } catch (err) {
      setGenPrompt(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setGenLoading(false);
    }
  }, [genDescription, genTypes, genProject]);

  const handleFinalize = useCallback(async () => {
    if (!genXml.trim()) return;
    setGenLoading(true);
    try {
      const result = await apiClient.siebelFinalizeGeneration({
        generatedXml: genXml,
        description: genDescription,
        objectTypes: genTypes,
      });
      setGenResult(result);
      void loadData();
    } catch (err) {
      setGenResult({
        sifContent: "",
        objects: [],
        validation: { status: "invalid", messages: [{ level: "error", message: err instanceof Error ? err.message : String(err) }], score: 0 },
        metadata: { generatedAt: new Date().toISOString(), requestDescription: genDescription, objectCount: 0 },
      });
    } finally {
      setGenLoading(false);
    }
  }, [genXml, genDescription, genTypes, loadData]);

  const handleDownload = useCallback(() => {
    if (!genResult?.sifContent) return;
    const blob = new Blob([genResult.sifContent], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "generated.sif";
    a.click();
    URL.revokeObjectURL(url);
  }, [genResult]);

  const handleTypeToggle = useCallback((type: string) => {
    setGenTypes((prev) =>
      prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type],
    );
  }, []);

  // ── Render ──

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
        Loading Siebel...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-danger)]">
        {error}
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="p-4 space-y-6 max-w-6xl mx-auto">

        {/* ── Panel 1: Upload & Context ── */}
        <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <div className="px-4 py-3 border-b border-[var(--color-border)]">
            <h3 className="text-sm font-semibold">Upload & Context</h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Upload SIF files and documentation to build RAG context for generation
            </p>
          </div>
          <div className="p-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5">SIF File (.sif)</label>
              <input
                ref={sifFileRef}
                type="file"
                accept=".sif,.xml"
                onChange={handleSifUpload}
                className="block w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-[var(--color-accent)] file:text-white hover:file:opacity-90 cursor-pointer"
              />
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                Imports Siebel objects into the graph + knowledge store
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5">Documentation (PDF, HTML, DOC, DOCX, TXT, MD)</label>
              <input
                ref={docsFileRef}
                type="file"
                accept=".pdf,.html,.htm,.txt,.md,.doc,.docx"
                onChange={handleDocsUpload}
                className="block w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-[var(--color-accent)] file:text-white hover:file:opacity-90 cursor-pointer"
              />
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                Indexes documentation as context for SIF generation
              </p>
            </div>
          </div>
          {uploadStatus && (
            <div className={`px-4 py-2 text-xs border-t border-[var(--color-border)] ${
              uploadStatus.startsWith("Error") ? "text-red-500" : "text-green-500"
            }`}>
              {uploadStatus}
            </div>
          )}
        </section>

        {/* ── Panel 2: Siebel Objects ── */}
        <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <div className="px-4 py-3 border-b border-[var(--color-border)]">
            <h3 className="text-sm font-semibold">
              Indexed Siebel Objects
              <span className="ml-2 text-xs font-normal text-[var(--color-text-muted)]">
                {objects.length} objects
              </span>
            </h3>
          </div>
          {objects.length === 0 ? (
            <div className="p-4 text-xs text-[var(--color-text-muted)]">
              No Siebel objects indexed yet. Upload a .sif file above.
            </div>
          ) : (
            <div className="max-h-64 overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[var(--color-bg-secondary)]">
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="text-left px-4 py-2 font-medium">Name</th>
                    <th className="text-left px-4 py-2 font-medium">Type</th>
                    <th className="text-left px-4 py-2 font-medium">Project</th>
                    <th className="text-left px-4 py-2 font-medium">Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {objects.map((obj, i) => (
                    <tr key={i} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-primary)]">
                      <td className="px-4 py-1.5 font-mono">{obj.title}</td>
                      <td className="px-4 py-1.5">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                          {obj.siebelType ?? obj.sourceType}
                        </span>
                      </td>
                      <td className="px-4 py-1.5 text-[var(--color-text-muted)]">{obj.siebelProject ?? "-"}</td>
                      <td className="px-4 py-1.5 text-[var(--color-text-muted)] truncate max-w-xs">{obj.contentPreview}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Panel 3: SIF Generation ── */}
        <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <div className="px-4 py-3 border-b border-[var(--color-border)]">
            <h3 className="text-sm font-semibold">SIF Generation</h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Describe what you need, generate context for the LLM, then validate the output
            </p>
          </div>
          <div className="p-4 space-y-4">
            {/* Description */}
            <div>
              <label className="block text-xs font-medium mb-1">Description</label>
              <textarea
                value={genDescription}
                onChange={(e) => setGenDescription(e.target.value)}
                placeholder="e.g., Create a Business Component for Service Requests with fields: SR Number, Status, Priority"
                rows={3}
                className="w-full px-3 py-2 text-xs rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              />
            </div>

            {/* Object types */}
            <div>
              <label className="block text-xs font-medium mb-1.5">Object Types</label>
              <div className="flex flex-wrap gap-1.5">
                {templates.map((t) => (
                  <button
                    key={t.type}
                    onClick={() => handleTypeToggle(t.type)}
                    className={`px-2 py-1 text-[10px] rounded-md border transition-colors ${
                      genTypes.includes(t.type)
                        ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]"
                        : "bg-transparent text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-[var(--color-accent)]"
                    }`}
                  >
                    {t.type.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>

            {/* Project */}
            <div>
              <label className="block text-xs font-medium mb-1">Base Project (optional)</label>
              <input
                value={genProject}
                onChange={(e) => setGenProject(e.target.value)}
                placeholder="e.g., Account (SSE)"
                className="w-full px-3 py-1.5 text-xs rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              />
            </div>

            {/* Prepare button */}
            <button
              onClick={handlePrepare}
              disabled={!genDescription.trim() || genLoading}
              className="px-4 py-1.5 text-xs font-medium rounded-md bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {genLoading ? "Generating Context..." : "Generate Context & Prompt"}
            </button>

            {/* Prompt output */}
            {genPrompt && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium">Generated Prompt (copy to LLM)</label>
                  <button
                    onClick={() => navigator.clipboard.writeText(genPrompt)}
                    className="text-[10px] px-2 py-0.5 rounded bg-[var(--color-bg-primary)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)]"
                  >
                    Copy
                  </button>
                </div>
                <pre className="text-[10px] p-3 rounded-md bg-[var(--color-bg-primary)] border border-[var(--color-border)] max-h-48 overflow-auto whitespace-pre-wrap text-[var(--color-text-muted)]">
                  {genPrompt.slice(0, 3000)}
                  {genPrompt.length > 3000 && "\n\n... (truncated for display)"}
                </pre>
              </div>
            )}

            {/* LLM output input */}
            {genPrompt && (
              <div>
                <label className="block text-xs font-medium mb-1">Paste LLM-generated SIF XML</label>
                <textarea
                  value={genXml}
                  onChange={(e) => setGenXml(e.target.value)}
                  placeholder='Paste the XML output from the LLM here (starting with <?xml version="1.0"...)'
                  rows={8}
                  className="w-full px-3 py-2 text-xs font-mono rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                />
                <button
                  onClick={handleFinalize}
                  disabled={!genXml.trim() || genLoading}
                  className="mt-2 px-4 py-1.5 text-xs font-medium rounded-md bg-green-600 text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {genLoading ? "Validating..." : "Validate & Finalize"}
                </button>
              </div>
            )}

            {/* Validation result */}
            {genResult && (
              <div className={`rounded-md border p-4 space-y-2 ${
                genResult.validation.status === "valid"
                  ? "border-green-500/30 bg-green-500/5"
                  : genResult.validation.status === "warnings"
                    ? "border-yellow-500/30 bg-yellow-500/5"
                    : "border-red-500/30 bg-red-500/5"
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${
                      genResult.validation.status === "valid" ? "text-green-500"
                        : genResult.validation.status === "warnings" ? "text-yellow-500"
                          : "text-red-500"
                    }`}>
                      {genResult.validation.status === "valid" ? "Valid" : genResult.validation.status === "warnings" ? "Warnings" : "Invalid"}
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      Score: {genResult.validation.score}/100
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {genResult.metadata.objectCount} objects
                    </span>
                  </div>
                  {genResult.validation.status !== "invalid" && (
                    <button
                      onClick={handleDownload}
                      className="px-3 py-1 text-xs font-medium rounded-md bg-[var(--color-accent)] text-white hover:opacity-90"
                    >
                      Download SIF
                    </button>
                  )}
                </div>

                {genResult.objects.length > 0 && (
                  <div className="text-xs text-[var(--color-text-muted)]">
                    Objects: {genResult.objects.map((o) => `${o.type}:${o.name}`).join(", ")}
                  </div>
                )}

                {genResult.validation.messages.length > 0 && (
                  <ul className="space-y-0.5">
                    {genResult.validation.messages.map((msg, i) => (
                      <li key={i} className={`text-[10px] ${
                        msg.level === "error" ? "text-red-500"
                          : msg.level === "warning" ? "text-yellow-600"
                            : "text-[var(--color-text-muted)]"
                      }`}>
                        [{msg.level}] {msg.message}
                        {msg.objectName && ` (${msg.objectName})`}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
