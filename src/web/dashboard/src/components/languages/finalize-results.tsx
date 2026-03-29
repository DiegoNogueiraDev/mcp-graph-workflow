import { Shield, AlertTriangle, Eye, FileCode2 } from "lucide-react";
import type { TranslationFinalizeResult } from "@/lib/types";
import { DeterministicIndicator } from "./deterministic-indicator";

interface FinalizeResultsProps {
  result: TranslationFinalizeResult | null;
}

function ConfidenceBadge({ score }: { score: number }): React.JSX.Element {
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? "bg-green-500/10 text-green-500" : pct >= 50 ? "bg-yellow-500/10 text-yellow-500" : "bg-red-500/10 text-red-500";

  return (
    <span className={`px-2 py-0.5 text-xs font-semibold rounded ${color}`}>
      {pct}%
    </span>
  );
}

const SEVERITY_COLORS: Record<string, string> = {
  high: "bg-red-500/10 text-red-500",
  medium: "bg-yellow-500/10 text-yellow-500",
  low: "bg-blue-500/10 text-blue-500",
};

export function FinalizeResults({ result }: FinalizeResultsProps): React.JSX.Element | null {
  if (!result) return null;

  const { evidence } = result;

  return (
    <div className="rounded-lg border border-green-500/30 bg-surface-alt">
      <div className="px-4 py-3 border-b border-edge flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-green-500" />
          <h3 className="text-xs font-semibold text-foreground">Translation Evidence</h3>
        </div>
        <ConfidenceBadge score={evidence.confidenceScore} />
      </div>
      <div className="p-4 space-y-4">
        {/* Deterministic indicator from evidence */}
        <DeterministicIndicator
          deterministicPct={Math.round(evidence.confidenceScore * 100)}
          totalConstructs={evidence.translatedConstructs.length + evidence.risks.length}
        />

        {/* Translated constructs */}
        {evidence.translatedConstructs.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <FileCode2 className="w-3 h-3 text-muted" />
              <p className="text-[10px] text-muted font-medium">Translated Constructs</p>
            </div>
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-edge">
                  <th className="text-left px-2 py-1 font-medium text-muted">Source</th>
                  <th className="text-left px-2 py-1 font-medium text-muted">Target</th>
                  <th className="text-left px-2 py-1 font-medium text-muted">Method</th>
                </tr>
              </thead>
              <tbody>
                {evidence.translatedConstructs.map((c, i) => (
                  <tr key={i} className="border-b border-edge/50">
                    <td className="px-2 py-1 font-mono text-foreground">{c.source}</td>
                    <td className="px-2 py-1 font-mono text-accent">{c.target}</td>
                    <td className="px-2 py-1 text-muted">{c.method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Risks */}
        {evidence.risks.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-3 h-3 text-yellow-500" />
              <p className="text-[10px] text-muted font-medium">Risks ({evidence.risks.length})</p>
            </div>
            <div className="space-y-1.5">
              {evidence.risks.map((r, i) => (
                <div key={i} className="flex items-start gap-2 px-2 py-1.5 rounded border border-edge/50 bg-surface">
                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${SEVERITY_COLORS[r.severity] ?? "bg-surface text-muted"}`}>
                    {r.severity}
                  </span>
                  <div>
                    <span className="text-[10px] font-medium text-foreground">{r.construct}</span>
                    <span className="text-[10px] text-muted ml-1">{r.message}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Human review points */}
        {evidence.humanReviewPoints.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Eye className="w-3 h-3 text-muted" />
              <p className="text-[10px] text-muted font-medium">Human Review Points</p>
            </div>
            <ul className="space-y-1 text-[10px] text-muted list-disc list-inside">
              {evidence.humanReviewPoints.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Diff */}
        {evidence.diff && (
          <div>
            <p className="text-[10px] text-muted font-medium mb-2">Diff</p>
            <pre className="text-[10px] p-3 rounded-md bg-surface border border-edge max-h-64 overflow-auto whitespace-pre-wrap text-muted font-mono">
              {evidence.diff}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
