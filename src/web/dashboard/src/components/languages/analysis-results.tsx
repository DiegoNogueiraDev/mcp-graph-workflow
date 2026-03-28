import { Cpu, AlertTriangle } from "lucide-react";
import type { TranslationAnalysis } from "@/lib/types";

interface AnalysisResultsProps {
  analysis: TranslationAnalysis | null;
}

function ScoreBar({ value, max = 100, label }: { value: number; max?: number; label: string }): React.JSX.Element {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const color = pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-muted">{label}</span>
        <span className="text-foreground font-medium">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function AnalysisResults({ analysis }: AnalysisResultsProps): React.JSX.Element | null {
  if (!analysis) return null;

  return (
    <div className="rounded-lg border border-edge bg-surface-alt">
      <div className="px-4 py-3 border-b border-edge flex items-center gap-2">
        <Cpu className="w-3.5 h-3.5 text-accent" />
        <h3 className="text-xs font-semibold text-foreground">Analysis Results</h3>
      </div>
      <div className="p-4 space-y-4">
        {/* Detected language + stats */}
        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-accent/10 text-accent">
            {analysis.detectedLanguage}
          </span>
          {analysis.detectedConfidence != null && (
            <span className="text-[10px] text-muted">
              {Math.round(analysis.detectedConfidence * 100)}% confidence
            </span>
          )}
          <span className="text-[10px] text-muted">
            {analysis.totalConstructs} constructs detected
          </span>
        </div>

        {/* Score bars */}
        <div className="grid grid-cols-2 gap-4">
          <ScoreBar value={analysis.complexityScore} label="Complexity" />
          <ScoreBar value={analysis.estimatedTranslatability} label="Translatability" />
        </div>

        {/* Constructs list */}
        {analysis.constructs.length > 0 && (
          <div>
            <p className="text-[10px] text-muted mb-2">Detected Constructs</p>
            <div className="flex flex-wrap gap-1.5">
              {analysis.constructs.map((c) => (
                <span
                  key={c.canonicalName}
                  className="px-1.5 py-0.5 text-[10px] rounded border border-edge bg-surface text-foreground"
                  title={`count: ${c.count}, confidence: ${Math.round(c.confidence * 100)}%`}
                >
                  {c.canonicalName} <span className="text-muted">x{c.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Ambiguous constructs warning */}
        {analysis.ambiguousConstructs && analysis.ambiguousConstructs.length > 0 && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-md border border-yellow-500/30 bg-yellow-500/5">
            <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] font-medium text-yellow-500">Ambiguous Constructs</p>
              <p className="text-[10px] text-muted mt-0.5">
                {analysis.ambiguousConstructs.join(", ")}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
