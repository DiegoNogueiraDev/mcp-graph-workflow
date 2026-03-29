import { useState } from "react";
import { Play, CheckCircle, RotateCcw, Copy, Check, Loader2, Download } from "lucide-react";
import type { UseTranslationState } from "@/hooks/use-translation";
import type { TranslationScope } from "@/lib/types";

const LANGUAGES = [
  "python", "javascript", "typescript", "java", "csharp", "go",
  "rust", "ruby", "php", "swift", "kotlin", "scala", "cpp",
];

const SCOPES: TranslationScope[] = ["snippet", "function", "module"];

interface TranslationFormProps {
  sourceCode: string;
  setSourceCode: (v: string) => void;
  targetLanguage: string;
  setTargetLanguage: (v: string) => void;
  scope: TranslationScope;
  setScope: (v: TranslationScope) => void;
  generatedCode: string;
  setGeneratedCode: (v: string) => void;
  translation: UseTranslationState;
  onAnalyze: () => void;
  onFinalize: () => void;
  onReset: () => void;
}

export function TranslationForm({
  sourceCode, setSourceCode,
  targetLanguage, setTargetLanguage,
  scope, setScope,
  generatedCode, setGeneratedCode,
  translation, onAnalyze, onFinalize, onReset,
}: TranslationFormProps): React.JSX.Element | null {
  const { phase, prepareResult, error, loading } = translation;
  const isIdle = phase === "idle" || phase === "error";
  const isPrepared = phase === "prepared";
  const isDone = phase === "done";

  const [copied, setCopied] = useState(false);
  const copyPrompt = (): void => {
    if (prepareResult?.prompt) {
      void navigator.clipboard.writeText(prepareResult.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-4">
      {/* Source code input */}
      <div className="rounded-lg border border-edge bg-surface-alt">
        <div className="px-4 py-3 border-b border-edge">
          <h3 className="text-xs font-semibold text-foreground">Source Code</h3>
          <p className="text-[10px] text-muted mt-0.5">Paste the code you want to translate</p>
        </div>
        <div className="p-4 relative">
          {/* Visual lock overlay during processing */}
          {!isIdle && !isPrepared && !isDone && (
            <div className="absolute inset-0 bg-surface/20 backdrop-blur-[1px] rounded-lg z-10 pointer-events-none" />
          )}
          <textarea
            value={sourceCode}
            onChange={(e) => setSourceCode(e.target.value)}
            placeholder="// Paste your code here..."
            rows={10}
            disabled={!isIdle}
            className="w-full px-3 py-2 text-xs rounded-md border border-edge bg-surface text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent font-mono disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-surface/50"
          />

          {/* Controls row */}
          <div className="flex items-center gap-3 mt-3">
            <div className="flex-1 grid grid-cols-3 gap-3">
              {/* Detected source language (read-only after analysis, editable before) */}
              {translation.analysis?.detectedLanguage ? (
                <div className="px-3 py-1.5 text-xs rounded-md border border-edge bg-surface/50 text-muted flex items-center gap-1.5">
                  <span className="text-[10px] text-muted/70">from:</span>
                  <span className="text-foreground font-medium">{translation.analysis.detectedLanguage}</span>
                </div>
              ) : (
                <div className="px-3 py-1.5 text-xs rounded-md border border-edge/50 bg-surface/30 text-muted/50 flex items-center gap-1.5">
                  <span className="text-[10px]">from: auto-detect</span>
                </div>
              )}

              {/* Target language selector */}
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                disabled={!isIdle}
                className="px-3 py-1.5 text-xs rounded-md border border-edge bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>

              <div className="flex gap-1">
                {SCOPES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setScope(s)}
                    disabled={!isIdle}
                    className={`flex-1 px-2 py-1.5 text-[10px] font-medium rounded-md border transition-colors disabled:opacity-50 ${
                      scope === s
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-edge bg-surface text-muted hover:text-foreground"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            {isIdle && (
              <button
                onClick={onAnalyze}
                disabled={!sourceCode.trim() || loading}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-md bg-accent text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                {loading ? "Analyzing..." : "Analyze"}
              </button>
            )}

            {(isPrepared || isDone) && (
              <button
                onClick={onReset}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-md border border-edge text-muted hover:text-foreground transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                New
              </button>
            )}

            {isDone && translation.finalizeResult?.job?.targetCode && (
              <button
                onClick={() => {
                  const code = translation.finalizeResult?.job?.targetCode;
                  if (!code) return;
                  const blob = new Blob([code], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `translated.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-green-500/30 text-green-500 text-xs font-medium hover:bg-green-500/5 transition-colors"
              >
                <Download className="w-3 h-3" />
                Download
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-3 rounded-lg border border-red-500/30 bg-red-500/5 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Prompt + Generated code (phase: prepared) */}
      {isPrepared && prepareResult && (
        <div className="rounded-lg border border-edge bg-surface-alt">
          <div className="px-4 py-3 border-b border-edge flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold text-foreground">AI Prompt</h3>
              <p className="text-[10px] text-muted mt-0.5">Copy this prompt, generate the code with AI, then paste the result below</p>
            </div>
            <button
              onClick={copyPrompt}
              className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded border transition-all duration-200 ${
                copied
                  ? "border-green-500/30 text-green-500 bg-green-500/5"
                  : "border-edge text-muted hover:text-foreground"
              }`}
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <div className="p-4 space-y-3">
            <pre className="text-[10px] p-3 rounded-md bg-surface border border-edge max-h-48 overflow-auto whitespace-pre-wrap text-muted font-mono">
              {prepareResult.prompt.length > 3000
                ? prepareResult.prompt.slice(0, 3000) + "\n\n... (truncated, use Copy for full prompt)"
                : prepareResult.prompt}
            </pre>

            <textarea
              value={generatedCode}
              onChange={(e) => setGeneratedCode(e.target.value)}
              placeholder="// Paste the AI-generated code here..."
              rows={8}
              className="w-full px-3 py-2 text-xs rounded-md border border-edge bg-surface text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent font-mono"
            />

            <button
              onClick={onFinalize}
              disabled={!generatedCode.trim() || loading}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-md bg-green-600 text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
              {loading ? "Finalizing..." : "Finalize Translation"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
