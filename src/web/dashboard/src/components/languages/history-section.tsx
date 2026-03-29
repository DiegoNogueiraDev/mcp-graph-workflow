import { useState } from "react";
import { RefreshCw, Trash2, BarChart3, ChevronDown, ChevronRight, Inbox } from "lucide-react";
import type { UseTranslationHistoryState, UseTranslationHistoryActions } from "@/hooks/use-translation-history";
import type { TranslationJob, TranslationJobStatus } from "@/lib/types";

const STATUS_COLORS: Record<TranslationJobStatus, string> = {
  pending: "bg-yellow-500/10 text-yellow-500",
  analyzing: "bg-blue-500/10 text-blue-500",
  translating: "bg-indigo-500/10 text-indigo-500",
  validating: "bg-purple-500/10 text-purple-500",
  done: "bg-green-500/10 text-green-500",
  failed: "bg-red-500/10 text-red-500",
};

function relativeDate(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

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

function SkeletonRow(): React.JSX.Element {
  return (
    <tr className="border-b border-edge/50">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-4 py-2">
          <div className="h-3 rounded bg-surface animate-pulse" style={{ width: `${40 + Math.random() * 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

function ExpandedJobDetails({ job }: { job: TranslationJob }): React.JSX.Element {
  return (
    <tr>
      <td colSpan={7} className="px-4 py-3 bg-surface/50">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {job.sourceCode && (
            <div>
              <p className="text-[10px] font-medium text-muted mb-1">Source Code</p>
              <pre className="text-[10px] p-2 rounded-md bg-surface border border-edge max-h-40 overflow-auto whitespace-pre-wrap font-mono text-foreground">
                {job.sourceCode.slice(0, 500)}{job.sourceCode.length > 500 ? "\n..." : ""}
              </pre>
            </div>
          )}
          {job.targetCode && (
            <div>
              <p className="text-[10px] font-medium text-muted mb-1">Translated Code</p>
              <pre className="text-[10px] p-2 rounded-md bg-surface border border-green-500/20 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-foreground">
                {job.targetCode.slice(0, 500)}{job.targetCode.length > 500 ? "\n..." : ""}
              </pre>
            </div>
          )}
          {!job.sourceCode && !job.targetCode && (
            <p className="text-[10px] text-muted col-span-2">No code details available for this job.</p>
          )}
        </div>
      </td>
    </tr>
  );
}

export function HistorySection({ state, actions, showInsights }: HistorySectionProps): React.JSX.Element {
  const { jobs, stats, loading, error } = state;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = (id: string): void => {
    if (deletingId === id) {
      // Second click = confirm
      setDeletingId(null);
      void actions.deleteJob(id);
    } else {
      // First click = show confirm state
      setDeletingId(id);
      // Auto-dismiss after 3s
      setTimeout(() => setDeletingId((prev) => prev === id ? null : prev), 3000);
    }
  };

  const toggleExpand = (id: string): void => {
    setExpandedId((prev) => prev === id ? null : id);
  };

  if (loading && jobs.length === 0) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-edge bg-surface-alt px-4 py-3 animate-pulse">
              <div className="h-2 w-16 rounded bg-surface mb-2" />
              <div className="h-5 w-10 rounded bg-surface" />
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-edge bg-surface-alt">
          <div className="px-4 py-3 border-b border-edge">
            <div className="h-3 w-32 rounded bg-surface animate-pulse" />
          </div>
          <table className="w-full"><tbody><SkeletonRow /><SkeletonRow /><SkeletonRow /></tbody></table>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <p className="text-xs text-red-400">{error}</p>
        <button
          onClick={() => void actions.refresh()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-edge text-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard label="Total Jobs" value={stats.totalJobs} />
          <StatCard label="Completed" value={stats.done} accent="text-green-500" />
          <StatCard label="Failed" value={stats.failed} accent={stats.failed > 0 ? "text-red-500" : "text-foreground"} />
          <StatCard label="Pending" value={stats.pending} accent={stats.pending > 0 ? "text-yellow-500" : "text-foreground"} />
          <StatCard label="Avg Confidence" value={`${Math.round(stats.avgConfidence * 100)}%`} />
        </div>
      )}

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
                <span key={pair} className="px-2 py-1 text-[10px] rounded-md border border-edge bg-surface cursor-pointer hover:border-accent/50 transition-colors">
                  <span className="font-medium text-foreground">{pair}</span>
                  <span className="text-muted ml-1.5">x{count}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-edge bg-surface-alt">
        <div className="px-4 py-3 border-b border-edge flex items-center justify-between">
          <h3 className="text-xs font-semibold text-foreground">Translation Jobs ({jobs.length})</h3>
          <button
            onClick={() => void actions.refresh()}
            className="p-1 rounded text-muted hover:text-foreground transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {jobs.length === 0 ? (
          <div className="px-4 py-12 flex flex-col items-center justify-center gap-3 text-center">
            <Inbox className="w-8 h-8 text-muted/40" />
            <div>
              <p className="text-xs text-muted">No translation jobs yet</p>
              <p className="text-[10px] text-muted/60 mt-1">Start by translating some code in the Convert tab</p>
            </div>
          </div>
        ) : (
          <div className="overflow-auto max-h-96">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface-alt shadow-sm">
                <tr className="border-b border-edge">
                  <th className="text-left px-4 py-2 font-medium text-muted w-6"></th>
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
                  <>
                    <tr
                      key={job.id}
                      onClick={() => toggleExpand(job.id)}
                      className="border-b border-edge/50 hover:bg-surface transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-1.5 text-muted">
                        {expandedId === job.id
                          ? <ChevronDown className="w-3 h-3" />
                          : <ChevronRight className="w-3 h-3" />
                        }
                      </td>
                      <td className="px-4 py-1.5 font-mono text-muted" title={job.id}>{job.id.slice(0, 8)}</td>
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
                      <td className="px-4 py-1.5 text-muted" title={new Date(job.createdAt).toLocaleString()}>
                        {relativeDate(job.createdAt)}
                      </td>
                      <td className="px-4 py-1.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleDelete(job.id)}
                          className={`px-2 py-0.5 rounded text-[10px] transition-all cursor-pointer ${
                            deletingId === job.id
                              ? "bg-red-500/10 text-red-400 font-medium border border-red-500/30"
                              : "text-muted hover:text-red-400"
                          }`}
                          title={deletingId === job.id ? "Click again to confirm" : "Delete job"}
                        >
                          {deletingId === job.id ? "Confirm?" : <Trash2 className="w-3 h-3" />}
                        </button>
                      </td>
                    </tr>
                    {expandedId === job.id && <ExpandedJobDetails key={`${job.id}-details`} job={job} />}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
