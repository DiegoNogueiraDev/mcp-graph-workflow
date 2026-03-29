import { ArrowLeft, FileCode, Copy, Check } from "lucide-react";
import { useState, useCallback } from "react";
import type { TranslationProjectFile } from "@/lib/types";
import { AnalysisResults } from "./analysis-results";
import { DeterministicIndicator } from "./deterministic-indicator";

interface ProjectFileDetailProps {
  file: TranslationProjectFile;
  prompt?: string;
  onBack: () => void;
  onFinalize: (generatedCode: string) => void;
  loading?: boolean;
}

export function ProjectFileDetail({
  file,
  prompt,
  onBack,
  onFinalize,
  loading,
}: ProjectFileDetailProps): React.JSX.Element {
  const [generatedCode, setGeneratedCode] = useState("");
  const [promptCopied, setPromptCopied] = useState(false);

  const isDone = file.status === "done";

  const handleCopyPrompt = useCallback(() => {
    if (!prompt) return;
    navigator.clipboard.writeText(prompt).then(() => {
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2000);
    });
  }, [prompt]);

  const handleFinalize = useCallback(() => {
    if (generatedCode.trim()) {
      onFinalize(generatedCode.trim());
    }
  }, [generatedCode, onFinalize]);

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to project
      </button>

      {/* File path breadcrumb */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-edge bg-surface-alt">
        <FileCode className="w-4 h-4 text-accent shrink-0" />
        <span className="text-xs font-mono text-foreground truncate">{file.filePath}</span>
      </div>

      {/* Analysis results (if available) */}
      {file.analysis && <AnalysisResults analysis={file.analysis} />}

      {/* Deterministic indicator for this file */}
      <DeterministicIndicator analysis={file.analysis} aiPrompt={prompt} />

      {/* AI Prompt section */}
      {prompt && (
        <div className="rounded-lg border border-edge bg-surface-alt">
          <div className="px-4 py-3 border-b border-edge flex items-center justify-between">
            <h3 className="text-xs font-semibold text-foreground">AI Prompt</h3>
            <button
              onClick={handleCopyPrompt}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-muted hover:text-foreground hover:bg-surface transition-colors"
            >
              {promptCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {promptCopied ? "Copied!" : "Copy"}
            </button>
          </div>
          <pre className="p-4 text-[11px] text-foreground/80 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed max-h-60 overflow-y-auto">
            {prompt}
          </pre>
        </div>
      )}

      {/* Done state: success message */}
      {isDone && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-green-500/30 bg-green-500/5">
          <Check className="w-4 h-4 text-green-500 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-green-500">Translation Complete</p>
            {file.confidenceScore != null && (
              <p className="text-[10px] text-muted mt-0.5">
                Confidence: {Math.round(file.confidenceScore * 100)}%
              </p>
            )}
          </div>
        </div>
      )}

      {/* Finalize section (not shown when done) */}
      {!isDone && (
        <div className="rounded-lg border border-edge bg-surface-alt">
          <div className="px-4 py-3 border-b border-edge">
            <h3 className="text-xs font-semibold text-foreground">Generated Code</h3>
            <p className="text-[10px] text-muted mt-0.5">
              Paste the AI-generated translation below to finalize this file.
            </p>
          </div>
          <div className="p-4 space-y-3">
            <textarea
              value={generatedCode}
              onChange={(e) => setGeneratedCode(e.target.value)}
              placeholder="Paste generated code here..."
              className="w-full h-48 px-3 py-2 rounded-md border border-edge bg-surface text-xs font-mono text-foreground placeholder:text-muted/50 resize-y focus:outline-none focus:ring-1 focus:ring-accent/50"
            />
            <button
              onClick={handleFinalize}
              disabled={loading || !generatedCode.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Finalize Translation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
