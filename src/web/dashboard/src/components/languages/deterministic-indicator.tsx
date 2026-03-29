import { Download, Sparkles, CheckCircle2, Copy, Check } from "lucide-react";
import { useState, useCallback } from "react";
import type { TranslationAnalysis } from "@/lib/types";

interface DeterministicIndicatorProps {
  /** Analysis data to compute deterministic % from */
  analysis?: TranslationAnalysis | null;
  /** Direct override: deterministic percentage (0-100) */
  deterministicPct?: number;
  /** Direct override: total constructs count */
  totalConstructs?: number;
  /** Whether this is a project-level indicator */
  isProjectLevel?: boolean;
  /** Callback when "Ready to Download" is clicked */
  onDownload?: () => void;
  /** AI prompt text for non-deterministic constructs */
  aiPrompt?: string;
}

interface ComputedMetrics {
  percentage: number;
  ruleCount: number;
  aiCount: number;
  total: number;
  aiConstructs: string[];
}

function computeFromAnalysis(analysis: TranslationAnalysis): ComputedMetrics {
  const total = analysis.totalConstructs;
  if (total === 0) return { percentage: 100, ruleCount: 0, aiCount: 0, total: 0, aiConstructs: [] };

  const aiConstructs = analysis.ambiguousConstructs ?? [];
  const aiCount = aiConstructs.length;
  // Count unique construct names that are NOT ambiguous
  const allNames = analysis.constructs.map((c) => c.canonicalName);
  const ruleCount = allNames.filter((n) => !aiConstructs.includes(n)).length;
  const percentage = total > 0 ? Math.round(((total - aiCount) / total) * 100) : 100;

  return { percentage: Math.min(100, Math.max(0, percentage)), ruleCount, aiCount, total, aiConstructs };
}

function getColorClasses(pct: number): { border: string; bg: string; text: string; bar: string } {
  if (pct >= 90) return { border: "border-green-500/30", bg: "bg-green-500/5", text: "text-green-500", bar: "bg-green-500" };
  if (pct >= 50) return { border: "border-yellow-500/30", bg: "bg-yellow-500/5", text: "text-yellow-500", bar: "bg-yellow-500" };
  return { border: "border-red-500/30", bg: "bg-red-500/5", text: "text-red-500", bar: "bg-red-500" };
}

export function DeterministicIndicator({
  analysis,
  deterministicPct,
  totalConstructs,
  isProjectLevel,
  onDownload,
  aiPrompt,
}: DeterministicIndicatorProps): React.JSX.Element | null {
  const [copied, setCopied] = useState(false);

  const metrics: ComputedMetrics = analysis
    ? computeFromAnalysis(analysis)
    : {
        percentage: deterministicPct ?? 0,
        ruleCount: Math.round(((deterministicPct ?? 0) / 100) * (totalConstructs ?? 0)),
        aiCount: Math.round(((100 - (deterministicPct ?? 0)) / 100) * (totalConstructs ?? 0)),
        total: totalConstructs ?? 0,
        aiConstructs: [],
      };

  const colors = getColorClasses(metrics.percentage);
  const isFullyDeterministic = metrics.percentage === 100;
  const aiPct = 100 - metrics.percentage;

  const handleCopyPrompt = useCallback(() => {
    if (!aiPrompt) return;
    navigator.clipboard.writeText(aiPrompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [aiPrompt]);

  if (metrics.total === 0 && !deterministicPct) return null;

  return (
    <div className={`rounded-lg border ${colors.border} ${colors.bg} p-4 space-y-3`}>
      {/* Header: percentage + label */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`text-3xl font-bold ${colors.text}`}>
            {metrics.percentage}%
          </span>
          <div>
            <p className="text-xs font-semibold text-foreground">
              {isProjectLevel ? "Project " : ""}Deterministic Translation
            </p>
            <p className="text-[10px] text-muted">
              {metrics.ruleCount}/{metrics.total} constructs by rules
              {metrics.aiCount > 0 && ` · ${metrics.aiCount} need AI`}
            </p>
          </div>
        </div>
        {isFullyDeterministic && (
          <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-green-500/10 text-green-500 text-[10px] font-medium">
            <CheckCircle2 className="w-3 h-3" />
            No AI Required
          </span>
        )}
      </div>

      {/* Segmented bar */}
      <div
        className="h-2.5 rounded-full bg-surface overflow-hidden flex"
        role="progressbar"
        aria-valuenow={metrics.percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Deterministic translation: ${metrics.percentage}%`}
      >
        {metrics.percentage > 0 && (
          <div
            className={`h-full ${colors.bar} transition-all duration-500`}
            style={{ width: `${metrics.percentage}%` }}
          />
        )}
        {aiPct > 0 && (
          <div
            className="h-full bg-yellow-500/60 transition-all duration-500"
            style={{ width: `${aiPct}%` }}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px]">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${colors.bar}`} />
          <span className="text-muted">Rule-based ({metrics.ruleCount})</span>
        </div>
        {metrics.aiCount > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
            <span className="text-muted">AI-assisted ({metrics.aiCount})</span>
          </div>
        )}
      </div>

      {/* AI constructs list */}
      {metrics.aiConstructs.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {metrics.aiConstructs.map((c) => (
            <span
              key={c}
              className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded border border-yellow-500/30 bg-yellow-500/5 text-yellow-500"
            >
              <Sparkles className="w-2.5 h-2.5" />
              {c}
            </span>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1">
        {isFullyDeterministic && onDownload ? (
          <button
            onClick={onDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors w-full justify-center"
          >
            <Download className="w-3.5 h-3.5" />
            Ready to Download
          </button>
        ) : (
          <>
            {aiPrompt && (
              <button
                onClick={handleCopyPrompt}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : `Copy AI Prompt for ${metrics.aiCount} construct${metrics.aiCount !== 1 ? "s" : ""}`}
              </button>
            )}
            {onDownload && (
              <button
                onClick={onDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-edge text-foreground text-xs font-medium hover:bg-surface transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download Partial
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
