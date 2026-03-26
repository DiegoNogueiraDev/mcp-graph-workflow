/**
 * GenerationSection — Two-phase SIF generation workflow (prepare + finalize).
 */

import type { SifTemplate } from "@/hooks/use-siebel-data";
import type { useSiebelGeneration } from "@/hooks/use-siebel-generation";

interface GenerationSectionProps {
  templates: SifTemplate[];
  gen: ReturnType<typeof useSiebelGeneration>;
}

export function GenerationSection({ templates, gen }: GenerationSectionProps): React.JSX.Element {
  return (
    <div className="h-full overflow-auto">
      <div className="p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold mb-1">SIF Generation</h3>
          <p className="text-xs text-muted">
            Describe what you need, generate context for the LLM, then validate the output
          </p>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium mb-1" htmlFor="gen-description">
            Description
          </label>
          <textarea
            id="gen-description"
            value={gen.description}
            onChange={(e) => gen.setDescription(e.target.value)}
            placeholder="e.g., Create a Business Component for Service Requests with fields: SR Number, Status, Priority"
            rows={3}
            className="w-full px-3 py-2 text-xs rounded-md border border-edge bg-surface text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        {/* Object types */}
        <div>
          <label className="block text-xs font-medium mb-1.5">Object Types</label>
          <div className="flex flex-wrap gap-1.5">
            {templates.map((t) => (
              <button
                key={t.type}
                onClick={() => gen.toggleType(t.type)}
                aria-label={`Toggle ${t.type}`}
                aria-pressed={gen.selectedTypes.includes(t.type)}
                className={`px-2 py-1 text-[10px] rounded-md border transition-colors cursor-pointer ${
                  gen.selectedTypes.includes(t.type)
                    ? "bg-accent text-white border-accent"
                    : "bg-transparent text-muted border-edge hover:border-accent"
                }`}
              >
                {t.type.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>

        {/* Base Project */}
        <div>
          <label className="block text-xs font-medium mb-1" htmlFor="gen-project">
            Base Project (optional)
          </label>
          <input
            id="gen-project"
            value={gen.project}
            onChange={(e) => gen.setProject(e.target.value)}
            placeholder="e.g., Account (SSE)"
            className="w-full px-3 py-1.5 text-xs rounded-md border border-edge bg-surface text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        {/* Prepare button */}
        <button
          onClick={gen.prepare}
          disabled={!gen.description.trim() || gen.loading}
          className="px-4 py-1.5 text-xs font-medium rounded-md bg-accent text-white hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer disabled:cursor-not-allowed"
        >
          {gen.loading && !gen.prompt ? "Generating Context..." : "Generate Context & Prompt"}
        </button>

        {/* Prompt output */}
        {gen.prompt && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium">Generated Prompt (copy to LLM)</label>
              <button
                onClick={() => navigator.clipboard.writeText(gen.prompt ?? "")}
                aria-label="Copy prompt to clipboard"
                className="text-[10px] px-2 py-0.5 rounded bg-surface text-muted hover:text-foreground border border-edge cursor-pointer transition-colors"
              >
                Copy
              </button>
            </div>
            <pre className="text-[10px] p-3 rounded-md bg-surface border border-edge max-h-48 overflow-auto whitespace-pre-wrap text-muted">
              {gen.prompt.slice(0, 3000)}
              {gen.prompt.length > 3000 && "\n\n... (truncated for display)"}
            </pre>
          </div>
        )}

        {/* LLM XML input */}
        {gen.prompt && (
          <div>
            <label className="block text-xs font-medium mb-1" htmlFor="gen-xml">
              Paste LLM-generated SIF XML
            </label>
            <textarea
              id="gen-xml"
              value={gen.xml}
              onChange={(e) => gen.setXml(e.target.value)}
              placeholder='Paste the XML output from the LLM here (starting with <?xml version="1.0"...)'
              rows={8}
              className="w-full px-3 py-2 text-xs font-mono rounded-md border border-edge bg-surface text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <button
              onClick={gen.finalize}
              disabled={!gen.xml.trim() || gen.loading}
              className="mt-2 px-4 py-1.5 text-xs font-medium rounded-md bg-green-600 text-white hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer disabled:cursor-not-allowed"
            >
              {gen.loading ? "Validating..." : "Validate & Finalize"}
            </button>
          </div>
        )}

        {/* Validation result */}
        {gen.result && (
          <div
            className={`rounded-md border p-4 space-y-2 ${
              gen.result.validation.status === "valid"
                ? "border-green-500/30 bg-green-500/5"
                : gen.result.validation.status === "warnings"
                  ? "border-yellow-500/30 bg-yellow-500/5"
                  : "border-red-500/30 bg-red-500/5"
            }`}
            role="status"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-bold ${
                    gen.result.validation.status === "valid"
                      ? "text-green-500"
                      : gen.result.validation.status === "warnings"
                        ? "text-yellow-500"
                        : "text-red-500"
                  }`}
                >
                  {gen.result.validation.status === "valid"
                    ? "Valid"
                    : gen.result.validation.status === "warnings"
                      ? "Warnings"
                      : "Invalid"}
                </span>
                <span className="text-xs text-muted">
                  Score: {gen.result.validation.score}/100
                </span>
                <span className="text-xs text-muted">
                  {gen.result.metadata.objectCount} objects
                </span>
              </div>
              {gen.result.validation.status !== "invalid" && (
                <button
                  onClick={gen.download}
                  aria-label="Download generated SIF file"
                  className="px-3 py-1 text-xs font-medium rounded-md bg-accent text-white hover:opacity-90 cursor-pointer transition-opacity"
                >
                  Download SIF
                </button>
              )}
            </div>

            {gen.result.objects.length > 0 && (
              <div className="text-xs text-muted">
                Objects: {gen.result.objects.map((o) => `${o.type}:${o.name}`).join(", ")}
              </div>
            )}

            {gen.result.validation.messages.length > 0 && (
              <ul className="space-y-0.5">
                {gen.result.validation.messages.map((msg, i) => (
                  <li
                    key={i}
                    className={`text-[10px] ${
                      msg.level === "error"
                        ? "text-red-500"
                        : msg.level === "warning"
                          ? "text-yellow-600"
                          : "text-muted"
                    }`}
                  >
                    [{msg.level}] {msg.message}
                    {msg.objectName && ` (${msg.objectName})`}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
