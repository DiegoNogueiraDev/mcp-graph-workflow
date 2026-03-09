import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { STATUS_COLORS } from "@/lib/constants";
import type { NodeStatus } from "@/lib/types";

interface Metrics {
  totalTasks: number;
  completionRate: number;
  velocity: { tasksCompleted: number; avgPointsPerTask?: number };
  statusDistribution: Array<{ status: NodeStatus; count: number; percentage: number }>;
  sprintProgress: Array<{ sprint: string; done: number; total: number; percentage: number }>;
}

interface Bottlenecks {
  blockedTasks: Array<{ title: string; blockerTitles: string[] }>;
  missingAcceptanceCriteria: Array<{ title: string }>;
  oversizedTasks: Array<{ title: string; estimateMinutes: number }>;
  criticalPath?: { path: string[]; titles: string[]; length: number };
}

export function InsightsTab(): React.JSX.Element {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [bottlenecks, setBottlenecks] = useState<Bottlenecks | null>(null);
  const [recommendations, setRecommendations] = useState<Array<{ phase: string; skill: string; reason: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [m, b, r] = await Promise.all([
          apiClient.getMetrics().catch(() => null) as Promise<Metrics | null>,
          apiClient.getBottlenecks().catch(() => null) as Promise<Bottlenecks | null>,
          apiClient.getRecommendations().catch(() => ({ recommendations: [] })),
        ]);
        setMetrics(m);
        setBottlenecks(b);
        setRecommendations(r.recommendations);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      }
    }
    void load();
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-danger)]">
        Failed to load: {error}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 overflow-y-auto h-full">
      {/* Metrics */}
      {metrics && (
        <section>
          <h3 className="text-sm font-semibold mb-3">Metrics</h3>
          <div className="grid grid-cols-4 gap-3 mb-4">
            <MetricCard value={metrics.totalTasks} label="Total Tasks" />
            <MetricCard value={`${metrics.completionRate}%`} label="Completion" />
            <MetricCard value={metrics.velocity.tasksCompleted} label="Completed" />
            <MetricCard value={metrics.velocity.avgPointsPerTask ?? "-"} label="Avg Points" />
          </div>

          {/* Status distribution bar */}
          {metrics.statusDistribution.length > 0 && (
            <div className="mb-4">
              <div className="h-3 rounded-full overflow-hidden flex bg-[var(--color-bg-tertiary)]">
                {metrics.statusDistribution
                  .filter((d) => d.count > 0)
                  .map((d) => (
                    <div
                      key={d.status}
                      className="h-full"
                      style={{ width: `${d.percentage}%`, background: STATUS_COLORS[d.status] }}
                      title={`${d.status}: ${d.count} (${d.percentage}%)`}
                    />
                  ))}
              </div>
              <div className="flex flex-wrap gap-3 mt-1.5">
                {metrics.statusDistribution
                  .filter((d) => d.count > 0)
                  .map((d) => (
                    <span key={d.status} className="flex items-center gap-1 text-xs">
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ background: STATUS_COLORS[d.status] }}
                      />
                      {d.status.replace("_", " ")} ({d.count})
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* Sprint progress */}
          {metrics.sprintProgress.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-[var(--color-text-muted)] mb-2">Sprint Progress</h4>
              <div className="space-y-1.5">
                {metrics.sprintProgress.map((s) => (
                  <div key={s.sprint} className="flex items-center gap-2 text-xs">
                    <span className="w-20 truncate">{s.sprint}</span>
                    <div className="flex-1 h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${s.percentage}%`, background: STATUS_COLORS.done }}
                      />
                    </div>
                    <span className="text-[var(--color-text-muted)] w-10 text-right">{s.done}/{s.total}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Bottlenecks */}
      {bottlenecks && (
        <section>
          <h3 className="text-sm font-semibold mb-3">Bottlenecks</h3>
          {bottlenecks.blockedTasks.length === 0 &&
            bottlenecks.missingAcceptanceCriteria.length === 0 &&
            bottlenecks.oversizedTasks.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">No bottlenecks detected.</p>
          ) : (
            <div className="space-y-3">
              {bottlenecks.blockedTasks.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-[var(--color-text-muted)] mb-1">
                    Blocked Tasks ({bottlenecks.blockedTasks.length})
                  </h4>
                  <div className="space-y-1">
                    {bottlenecks.blockedTasks.slice(0, 10).map((t, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs px-2 py-1 rounded bg-[var(--color-bg-secondary)]">
                        <span className="px-1 py-0.5 rounded text-[9px] font-medium" style={{ background: `${STATUS_COLORS.blocked}20`, color: STATUS_COLORS.blocked }}>
                          blocked
                        </span>
                        <span className="truncate">{t.title}</span>
                        <span className="text-[var(--color-text-muted)] truncate">by: {t.blockerTitles.join(", ")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {bottlenecks.missingAcceptanceCriteria.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-[var(--color-text-muted)] mb-1">
                    Missing AC ({bottlenecks.missingAcceptanceCriteria.length})
                  </h4>
                  <ul className="text-xs space-y-0.5 list-disc pl-4 text-[var(--color-text-muted)]">
                    {bottlenecks.missingAcceptanceCriteria.slice(0, 10).map((t, i) => (
                      <li key={i}>{t.title}</li>
                    ))}
                  </ul>
                </div>
              )}

              {bottlenecks.oversizedTasks.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-[var(--color-text-muted)] mb-1">
                    Oversized Tasks ({bottlenecks.oversizedTasks.length})
                  </h4>
                  <ul className="text-xs space-y-0.5 list-disc pl-4 text-[var(--color-text-muted)]">
                    {bottlenecks.oversizedTasks.map((t, i) => (
                      <li key={i}>{t.title} — {t.estimateMinutes}min</li>
                    ))}
                  </ul>
                </div>
              )}

              {bottlenecks.criticalPath && (
                <div>
                  <h4 className="text-xs font-medium text-[var(--color-text-muted)] mb-1">
                    Critical Path ({bottlenecks.criticalPath.length} nodes)
                  </h4>
                  <div className="text-xs px-2 py-1 rounded bg-[var(--color-bg-secondary)]">
                    {bottlenecks.criticalPath.titles.join(" → ")}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-3">Recommendations</h3>
          <div className="space-y-2">
            {recommendations.map((rec, i) => (
              <div key={i} className="px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-accent)]20 text-[var(--color-accent)] font-medium">
                    {rec.phase}
                  </span>
                  <span className="text-xs font-medium">{rec.skill}</span>
                </div>
                <p className="text-xs text-[var(--color-text-muted)]">{rec.reason}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MetricCard({ value, label }: { value: string | number; label: string }): React.JSX.Element {
  return (
    <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-center">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-[10px] text-[var(--color-text-muted)] uppercase">{label}</div>
    </div>
  );
}
