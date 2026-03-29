import { Download, FileCode, Tag } from "lucide-react";

interface CodePreviewPanelProps {
  sourceCode: string;
  targetCode?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  isDeterministic?: boolean;
  onDownload?: () => void;
}

function LanguageBadge({ language }: { language: string }): React.JSX.Element {
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-accent/10 text-accent">
      <FileCode className="w-3 h-3" />
      {language}
    </span>
  );
}

function MethodTag({ deterministic }: { deterministic: boolean }): React.JSX.Element {
  const label = deterministic ? "Deterministic" : "AI-Generated";
  const color = deterministic
    ? "bg-green-500/10 text-green-400 border-green-500/30"
    : "bg-yellow-500/10 text-yellow-400 border-yellow-500/30";

  return (
    <span className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded border ${color}`}>
      <Tag className="w-3 h-3" />
      {label}
    </span>
  );
}

export function CodePreviewPanel({
  sourceCode,
  targetCode,
  sourceLanguage,
  targetLanguage,
  isDeterministic,
  onDownload,
}: CodePreviewPanelProps): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Source panel */}
      <div className="rounded-lg border border-edge bg-surface-alt overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-edge">
          <h4 className="text-xs font-semibold text-foreground">Source</h4>
          {sourceLanguage && <LanguageBadge language={sourceLanguage} />}
        </div>
        <pre className="font-mono text-[10px] bg-surface p-3 rounded-md border border-edge m-2 max-h-96 overflow-auto text-foreground whitespace-pre-wrap">
          {sourceCode}
        </pre>
      </div>

      {/* Target panel */}
      <div className="rounded-lg border border-edge bg-surface-alt overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-edge">
          <h4 className="text-xs font-semibold text-foreground">Translated</h4>
          {targetLanguage && <LanguageBadge language={targetLanguage} />}
          {isDeterministic != null && <MethodTag deterministic={isDeterministic} />}
          {onDownload && (
            <button
              onClick={onDownload}
              className="ml-auto flex items-center gap-1 px-2 py-1 text-[10px] rounded-md border border-edge text-muted hover:text-foreground transition-colors cursor-pointer"
              title="Download translated code"
            >
              <Download className="w-3 h-3" />
              Download
            </button>
          )}
        </div>
        {targetCode ? (
          <pre className="font-mono text-[10px] bg-surface p-3 rounded-md border border-edge m-2 max-h-96 overflow-auto text-foreground whitespace-pre-wrap">
            {targetCode}
          </pre>
        ) : (
          <div className="flex items-center justify-center py-12 m-2">
            <p className="text-xs text-muted">Awaiting translation...</p>
          </div>
        )}
      </div>
    </div>
  );
}
