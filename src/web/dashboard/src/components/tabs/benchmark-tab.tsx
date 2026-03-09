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

  const { tokenEconomy, dependencyIntelligence, formulas } = data;

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
            value={tokenEconomy.avgTokensPerTask.toLocaleString()}
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
              Context Compression per Task
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
