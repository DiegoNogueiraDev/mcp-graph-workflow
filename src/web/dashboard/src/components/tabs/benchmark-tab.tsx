import { useState } from "react";
import { useBenchmark } from "@/hooks/use-benchmark";

export function BenchmarkTab(): React.JSX.Element {
  const { data, loading, error } = useBenchmark();
  const [showLayers, setShowLayers] = useState(false);

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="h-5 w-40 rounded bg-surface animate-pulse" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl border border-edge bg-surface-alt animate-pulse" />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-6 rounded bg-surface animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Failed to load benchmark</p>
          <p className="text-xs text-muted mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return <div />;

  const { tokenEconomy, layeredCompression, dependencyIntelligence, toolTokenUsage } = data;
  const savingsPercent = layeredCompression?.avgTotalRealSavingsPercent ?? tokenEconomy.avgCompressionPercent;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 overflow-y-auto h-full">
      {/* Hero: Token Savings */}
      <section>
        <h3 className="text-sm font-semibold mb-3">Token Savings</h3>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="p-4 rounded-xl border border-edge shadow-sm bg-surface-alt text-center" data-testid="metric-card">
            <div className="text-3xl font-bold text-accent">{savingsPercent}%</div>
            <div className="text-[10px] text-muted uppercase mt-1">compression rate</div>
          </div>
          <MetricCard
            value={tokenEconomy.totalTokensSaved.toLocaleString()}
            label={`tokens saved (${tokenEconomy.sampleSize} tasks)`}
          />
          <MetricCard
            value={tokenEconomy.avgTokensSavedPerTask.toLocaleString()}
            label="avg saved / task"
          />
        </div>
      </section>

      {/* Cost Comparison */}
      <section>
        <h3 className="text-sm font-semibold mb-3">Cost Impact</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <CostCompareCard
            label="Opus"
            before={tokenEconomy.costSavings.opusCostPerTaskUncompressed}
            after={tokenEconomy.costSavings.opusCostPerTask}
            totalSaved={tokenEconomy.costSavings.opusTotalSaved}
          />
          <CostCompareCard
            label="Sonnet"
            before={tokenEconomy.costSavings.sonnetCostPerTaskUncompressed}
            after={tokenEconomy.costSavings.sonnetCostPerTask}
            totalSaved={tokenEconomy.costSavings.sonnetTotalSaved}
          />
        </div>
      </section>

      {/* Compression per Task */}
      {tokenEconomy.perTaskMetrics.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-3">Compression per Task</h3>
          <div className="space-y-1.5" data-testid="compression-bars">
            {tokenEconomy.perTaskMetrics.slice(0, 15).map((m) => (
              <div key={m.id} className="flex items-center gap-2 text-xs">
                <span className="w-32 truncate" title={m.title}>{m.title}</span>
                <div className="flex-1 h-3 bg-surface-elevated rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${Math.min(m.compressionPercent, 100)}%` }}
                  />
                </div>
                <span className="text-muted w-28 text-right">
                  {m.compressionPercent}% ({m.estimatedTokens.toLocaleString()} tok)
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Compression Layers (collapsible) */}
      {layeredCompression && layeredCompression.avgLayer1SavingsPercent != null && (
        <section>
          <button
            type="button"
            className="text-sm font-semibold mb-3 flex items-center gap-1 hover:text-accent transition-colors"
            onClick={() => setShowLayers(!showLayers)}
          >
            <span className="text-xs">{showLayers ? "\u25BC" : "\u25B6"}</span>
            How compression works
          </button>
          {showLayers && (
            <div className="space-y-3">
              <div className="grid grid-cols-5 gap-3 mb-2">
                <MetricCard value={`${layeredCompression.avgLayer1SavingsPercent}%`} label="Field cleanup" />
                <MetricCard value={`${layeredCompression.avgLayer2SavingsPercent}%`} label="Desc summary" />
                <MetricCard value={`${layeredCompression.avgLayer3SavingsPercent}%`} label="Default omit" />
                <MetricCard value={`${layeredCompression.avgLayer4SavingsPercent}%`} label="Key shorten" />
                <MetricCard value={`${layeredCompression.avgTotalRealSavingsPercent}%`} label="Total saved" />
              </div>
              {(() => {
                const maxTokens = Math.max(layeredCompression.avgNaiveNeighborhoodTokens, 1);
                const bars = [
                  { label: "Original context", tokens: layeredCompression.avgNaiveNeighborhoodTokens, color: "#ef4444" },
                  { label: "Field cleanup", tokens: layeredCompression.avgCompactContextTokens, color: "#f97316" },
                  { label: "Desc summary", tokens: layeredCompression.avgNeighborTruncatedTokens, color: "#eab308" },
                  { label: "Default omit", tokens: layeredCompression.avgDefaultOmittedTokens, color: "#22c55e" },
                  { label: "Key shorten", tokens: layeredCompression.avgShortKeysTokens, color: "#3b82f6" },
                  { label: "Minimal context", tokens: layeredCompression.avgSummaryTierTokens, color: "#8b5cf6" },
                ];
                return (
                  <div className="space-y-1.5" data-testid="waterfall-bars">
                    {bars.map((bar) => (
                      <div key={bar.label} className="flex items-center gap-2 text-xs">
                        <span className="w-32 truncate" title={bar.label}>{bar.label}</span>
                        <div className="flex-1 h-3 bg-surface-elevated rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min((bar.tokens / maxTokens) * 100, 100)}%`,
                              backgroundColor: bar.color,
                            }}
                          />
                        </div>
                        <span className="text-muted w-20 text-right">
                          {bar.tokens.toLocaleString()} tok
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </section>
      )}

      {/* Tool Token Usage */}
      {toolTokenUsage && toolTokenUsage.totalCalls > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-3">Token Usage per Tool</h3>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <MetricCard value={toolTokenUsage.totalCalls.toLocaleString()} label="Total calls" />
            <MetricCard value={toolTokenUsage.totalInputTokens.toLocaleString()} label="Input tokens" />
            <MetricCard value={toolTokenUsage.totalOutputTokens.toLocaleString()} label="Output tokens" />
          </div>

          {toolTokenUsage.perTool.length > 0 && (() => {
            const maxTokens = Math.max(...toolTokenUsage.perTool.map((t) => t.totalTokens), 1);
            return (
              <div className="space-y-1.5" data-testid="tool-token-bars">
                {toolTokenUsage.perTool.slice(0, 15).map((t) => (
                  <div key={t.toolName} className="flex items-center gap-2 text-xs">
                    <span className="w-32 truncate font-mono" title={t.toolName}>{t.toolName}</span>
                    <div className="flex-1 h-3 bg-surface-elevated rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${Math.min((t.totalTokens / maxTokens) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-muted w-32 text-right">
                      {t.callCount} calls, {t.totalTokens.toLocaleString()} tok
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}
        </section>
      )}

      {/* Graph Integrity */}
      <section>
        <h3 className="text-sm font-semibold mb-3">Graph Integrity</h3>
        <div className="grid grid-cols-3 gap-3">
          <MetricCard value={dependencyIntelligence.inferredDeps} label="Auto-inferred deps" />
          <MetricCard value={`${dependencyIntelligence.blockedTasks}/${tokenEconomy.totalNodes}`} label="Blocked tasks" />
          <MetricCard value={dependencyIntelligence.cycles} label="Cycles detected" />
        </div>
      </section>
    </div>
  );
}

function MetricCard({ value, label }: { value: string | number; label: string }): React.JSX.Element {
  return (
    <div className="p-3 rounded-xl border border-edge shadow-sm hover:shadow-md transition-shadow bg-surface-alt text-center" data-testid="metric-card">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-[10px] text-muted uppercase">{label}</div>
    </div>
  );
}

function CostCompareCard({
  label,
  before,
  after,
  totalSaved,
}: {
  label: string;
  before: number;
  after: number;
  totalSaved: number;
}): React.JSX.Element {
  const pctSaved = before > 0 ? Math.round(((before - after) / before) * 100) : 0;
  return (
    <div className="p-4 rounded-xl border border-edge shadow-sm bg-surface-alt" data-testid="metric-card">
      <div className="text-xs font-medium text-muted mb-2">{label}</div>
      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-sm text-muted line-through">${before.toFixed(3)}</span>
        <span className="text-xl font-bold">${after.toFixed(3)}</span>
        <span className="text-xs text-accent">-{pctSaved}%</span>
      </div>
      <div className="text-[10px] text-muted uppercase">per task &middot; ${totalSaved.toFixed(2)} total saved</div>
    </div>
  );
}
