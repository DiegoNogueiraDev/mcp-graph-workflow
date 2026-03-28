import { RefreshCw, Trash2, BarChart3 } from "lucide-react";
import type { UseTranslationHistoryState, UseTranslationHistoryActions } from "@/hooks/use-translation-history";
import type { TranslationJobStatus } from "@/lib/types";

const STATUS_COLORS: Record<TranslationJobStatus, string> = {
  pending: "bg-yellow-500/10 text-yellow-500",
  analyzing: "bg-blue-500/10 text-blue-500",
  translating: "bg-blue-500/10 text-blue-500",
  validating: "bg-purple-500/10 text-purple-500",
  done: "bg-green-500/10 text-green-500",
  failed: "bg-red-500/10 text-red-500",
};

interface HistorySectionProps {
  state: UseTranslationHistoryState;
  actions: UseTranslationHistoryActions;
  showInsights?: boolean;
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-edge bg-surface-alt px-4 py-3">
      <p className="text-[10px] text-muted">{label}</p>
      <p className={`text-lg font-semibold ${accent ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}

export function HistorySection({ state, actions, showInsights }: HistorySectionProps): React.JSX.Element {
  const { jobs, stats, loading, error } = state;

  const handleDelete = (id: string): void => {
    if (window.confirm("Delete this translation job?")) {
      void actions.deleteJob(id);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-xs text-muted">Loading history...</div>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <p className="text-xs text-red-400">{error}</p>
        <button
          onClick={() => void actions.refresh()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-edge text-muted hover:text-foreground transition-colors"
        >
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Total Jobs" value={stats.totalJobs} />
          <StatCard label="Completed" value={stats.done} accent="text-green-500" />
          <StatCard label="Failed" value={stats.failed} accent={stats.failed > 0 ? "text-red-500" : "text-foreground"} />
          <StatCard label="Pending" value={stats.pending} accent={stats.pending > 0 ? "text-yellow-500" : "text-foreground"} />
          <StatCard label="Avg Confidence" value={`${Math.round(stats.avgConfidence * 100)}%`} />
        </div>
      )}

      {/* Insights: language pair distribution */}
      {showInsights && jobs.length > 0 && (
        <div className="rounded-lg border border-edge bg-surface-alt">
          <div className="px-4 py-3 border-b border-edge flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5 text-accent" />
            <h3 className="text-xs font-semibold text-foreground">Translation Pairs</h3>
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-2">
              {Object.entries(
                jobs.reduce<Record<string, number>>((acc, j) => {
                  const pair = `${j.sourceLanguage} → ${j.targetLanguage}`;
                  acc[pair] = (acc[pair] ?? 0) + 1;
                  return acc;
                }, {})
              ).sort(([, a], [, b]) => b - a).map(([pair, count]) => (
                <span key={pair} className="px-2 py-1 text-[10px] rounded-md border border-edge bg-surface">
                  <span className="font-medium text-foreground">{pair}</span>
                  <span className="text-muted ml-1.5">x{count}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Jobs table */}
      <div className="rounded-lg border border-edge bg-surface-alt">
        <div className="px-4 py-3 border-b border-edge flex items-center justify-between">
          <h3 className="text-xs font-semibold text-foreground">Translation Jobs ({jobs.length})</h3>
          <button
            onClick={() => void actions.refresh()}
            className="p-1 rounded text-muted hover:text-foreground transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {jobs.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-muted">
            No translation jobs yet. Start by translating some code in the Convert tab.
          </div>
        ) : (
          <div className="overflow-auto max-h-96">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface-alt">
                <tr className="border-b border-edge">
                  <th className="text-left px-4 py-2 font-medium text-muted">ID</th>
                  <th className="text-left px-4 py-2 font-medium text-muted">Languages</th>
                  <th className="text-left px-4 py-2 font-medium text-muted">Scope</th>
                  <th className="text-left px-4 py-2 font-medium text-muted">Status</th>
                  <th className="text-left px-4 py-2 font-medium text-muted">Confidence</th>
                  <th className="text-left px-4 py-2 font-medium text-muted">Created</th>
                  <th className="text-right px-4 py-2 font-medium text-muted"></th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-b border-edge/50 hover:bg-surface transition-colors">
                    <td className="px-4 py-1.5 font-mono text-muted">{job.id.slice(0, 8)}</td>
                    <td className="px-4 py-1.5">
                      <span className="text-foreground">{job.sourceLanguage}</span>
                      <span className="text-muted mx-1">→</span>
                      <span className="text-accent">{job.targetLanguage}</span>
                    </td>
                    <td className="px-4 py-1.5 text-muted">{job.scope}</td>
                    <td className="px-4 py-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[job.status]}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-1.5 text-muted">
                      {job.confidenceScore != null ? `${Math.round(job.confidenceScore * 100)}%` : "—"}
                    </td>
                    <td className="px-4 py-1.5 text-muted">
                      {new Date(job.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-1.5 text-right">
                      <button
                        onClick={() => handleDelete(job.id)}
                        className="p-1 rounded text-muted hover:text-red-400 transition-colors"
                        title="Delete job"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
