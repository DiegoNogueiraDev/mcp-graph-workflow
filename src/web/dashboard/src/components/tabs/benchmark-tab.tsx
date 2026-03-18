import { useBenchmark } from "@/hooks/use-benchmark";

export function BenchmarkTab(): React.JSX.Element {
  const { data, loading, error } = useBenchmark();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
        Loading benchmark data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-danger)]">
        Failed to load: {error}
      </div>
    );
  }

  if (!data) return <div />;

  const { tokenEconomy, layeredCompression, dependencyIntelligence, toolTokenUsage, formulas } = data;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 overflow-y-auto h-full">
      {/* Token Economy */}
      <section>
        <h3 className="text-sm font-semibold mb-3">Token Economy</h3>
        <div className="grid grid-cols-4 gap-3 mb-4">
          <MetricCard
            value={`${tokenEconomy.avgCompressionPercent}%`}
            label="Avg Compress"
          />
          <MetricCard
            value={tokenEconomy.sampleSize > 0 ? Math.round(tokenEconomy.totalTokensSaved / tokenEconomy.sampleSize).toLocaleString() : "0"}
            label="Tokens Saved/Task"
          />
          <MetricCard
            value={tokenEconomy.totalNodes}
            label="Nodes"
          />
          <MetricCard
            value={tokenEconomy.totalEdges}
            label="Edges"
          />
        </div>

        {/* Compression bars per task */}
        {tokenEconomy.perTaskMetrics.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-[var(--color-text-muted)] mb-2">
              Context Compression per Task (vs Full Graph)
            </h4>
            <div className="space-y-1.5" data-testid="compression-bars">
              {tokenEconomy.perTaskMetrics.slice(0, 15).map((m) => (
                <div key={m.id} className="flex items-center gap-2 text-xs">
                  <span className="w-32 truncate" title={m.title}>{m.title}</span>
                  <div className="flex-1 h-3 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--color-accent)]"
                      style={{ width: `${Math.min(m.compressionPercent, 100)}%` }}
                    />
                  </div>
                  <span className="text-[var(--color-text-muted)] w-24 text-right">
                    {m.compressionPercent}% ({m.estimatedTokens} tok)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Real Token Savings (Per-Layer) */}
      {layeredCompression && (
        <section>
          <h3 className="text-sm font-semibold mb-3">Real Token Savings (Per-Layer)</h3>
          <div className="grid grid-cols-5 gap-3 mb-4">
            <MetricCard
              value={`${layeredCompression.avgLayer1SavingsPercent}%`}
              label="L1: Field Strip"
            />
            <MetricCard
              value={`${layeredCompression.avgLayer2SavingsPercent}%`}
              label="L2: Desc Truncate"
            />
            <MetricCard
              value={`${layeredCompression.avgLayer3SavingsPercent}%`}
              label="L3: Default Omit"
            />
            <MetricCard
              value={`${layeredCompression.avgLayer4SavingsPercent}%`}
              label="L4: Short Keys"
            />
            <MetricCard
              value={`${layeredCompression.avgTotalRealSavingsPercent}%`}
              label="Total Real Savings"
            />
          </div>

          {/* Waterfall bars */}
          {(() => {
            const maxTokens = Math.max(layeredCompression.avgNaiveNeighborhoodTokens, 1);
            const bars = [
              { label: "Naive Neighborhood", tokens: layeredCompression.avgNaiveNeighborhoodTokens, color: "#ef4444" },
              { label: "L1: Field Stripping", tokens: layeredCompression.avgCompactContextTokens, color: "#f97316" },
              { label: "L2: Desc Truncation", tokens: layeredCompression.avgNeighborTruncatedTokens, color: "#eab308" },
              { label: "L3: Default Omission", tokens: layeredCompression.avgDefaultOmittedTokens, color: "#22c55e" },
              { label: "L4: Short Keys", tokens: layeredCompression.avgShortKeysTokens, color: "#3b82f6" },
              { label: "Summary Tier", tokens: layeredCompression.avgSummaryTierTokens, color: "#8b5cf6" },
            ];
            return (
              <div className="space-y-1.5" data-testid="waterfall-bars">
                {bars.map((bar) => (
                  <div key={bar.label} className="flex items-center gap-2 text-xs">
                    <span className="w-40 truncate" title={bar.label}>{bar.label}</span>
                    <div className="flex-1 h-3 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min((bar.tokens / maxTokens) * 100, 100)}%`,
                          backgroundColor: bar.color,
                        }}
                      />
                    </div>
                    <span className="text-[var(--color-text-muted)] w-20 text-right">
                      {bar.tokens.toLocaleString()} tok
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}
        </section>
      )}

      {/* Dependency Intelligence */}
      <section>
        <h3 className="text-sm font-semibold mb-3">Dependency Intelligence</h3>
        <div className="grid grid-cols-3 gap-3">
          <MetricCard
            value={dependencyIntelligence.inferredDeps}
            label="Auto Inferred"
          />
          <MetricCard
            value={`${dependencyIntelligence.blockedTasks}/${tokenEconomy.totalNodes}`}
            label="Blocked Detected"
          />
          <MetricCard
            value={dependencyIntelligence.cycles}
            label="Cycles Detected"
          />
        </div>
      </section>

      {/* Formulas & Justification */}
      <section>
        <h3 className="text-sm font-semibold mb-3">Formulas & Justification</h3>
        <div className="px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-xs space-y-1" data-testid="formulas-section">
          {Object.entries(formulas).map(([key, formula]) => (
            <div key={key} className="flex gap-2">
              <span className="text-[var(--color-text-muted)] font-mono w-40 shrink-0">{key}:</span>
              <span>{formula}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Tool Token Usage */}
      {toolTokenUsage && toolTokenUsage.totalCalls > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-3">Tool Token Usage</h3>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <MetricCard
              value={toolTokenUsage.totalCalls.toLocaleString()}
              label="Total Calls"
            />
            <MetricCard
              value={toolTokenUsage.totalInputTokens.toLocaleString()}
              label="Total Input Tokens"
            />
            <MetricCard
              value={toolTokenUsage.totalOutputTokens.toLocaleString()}
              label="Total Output Tokens"
            />
          </div>

          {toolTokenUsage.perTool.length > 0 && (() => {
            const maxTokens = Math.max(...toolTokenUsage.perTool.map((t) => t.totalTokens), 1);
            return (
              <div>
                <h4 className="text-xs font-medium text-[var(--color-text-muted)] mb-2">
                  Token Usage per Tool
                </h4>
                <div className="space-y-1.5" data-testid="tool-token-bars">
                  {toolTokenUsage.perTool.slice(0, 15).map((t) => (
                    <div key={t.toolName} className="flex items-center gap-2 text-xs">
                      <span className="w-32 truncate font-mono" title={t.toolName}>{t.toolName}</span>
                      <div className="flex-1 h-3 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--color-accent)]"
                          style={{ width: `${Math.min((t.totalTokens / maxTokens) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-[var(--color-text-muted)] w-32 text-right">
                        {t.callCount} calls, {t.totalTokens.toLocaleString()} tok
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </section>
      )}

      {/* Cost Savings */}
      <section>
        <h3 className="text-sm font-semibold mb-3">Cost Savings per Task</h3>
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            value={`$${tokenEconomy.costSavings.opusPerTask.toFixed(3)}`}
            label="Opus Input"
          />
          <MetricCard
            value={`$${tokenEconomy.costSavings.sonnetPerTask.toFixed(3)}`}
            label="Sonnet Input"
          />
        </div>
      </section>
    </div>
  );
}

function MetricCard({ value, label }: { value: string | number; label: string }): React.JSX.Element {
  return (
    <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-center" data-testid="metric-card">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-[10px] text-[var(--color-text-muted)] uppercase">{label}</div>
    </div>
  );
}
