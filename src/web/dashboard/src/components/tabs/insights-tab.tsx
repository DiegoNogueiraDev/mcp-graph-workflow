import { useInsights } from "@/hooks/use-insights";
import { HealthGauge } from "@/components/charts/health-gauge";
import { StatusDonut } from "@/components/charts/status-donut";
import { TypeBarChart } from "@/components/charts/type-bar-chart";
import { SprintBars } from "@/components/charts/sprint-bars";
import { KnowledgeBar } from "@/components/charts/knowledge-bar";
import { BottleneckCards } from "@/components/insights/bottleneck-cards";
import type { NodeType } from "@/lib/types";

export function InsightsTab(): React.JSX.Element {
  const { data, loading, error, refresh } = useInsights();

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-danger">
        Failed to load: {error}
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-full text-muted">
        Loading insights...
      </div>
    );
  }

  const { metrics, bottlenecks, stats, knowledgeStats, healthScore } = data;

  const typeData = Object.entries(stats.byType)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => ({ type: type as NodeType, count }));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 overflow-y-auto h-full">
      {/* Header + Refresh */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Project Insights</h2>
        <button
          type="button"
          onClick={refresh}
          className="text-xs px-3 py-1 rounded bg-surface-alt border border-edge hover:bg-surface-elevated transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Hero: Health Gauge + KPI Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 p-4 rounded-xl border border-edge shadow-sm hover:shadow-md transition-shadow bg-surface-alt flex items-center justify-center">
          <HealthGauge score={healthScore} />
        </div>
        <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard value={metrics.totalTasks} label="Total Tasks" />
          <KpiCard value={`${metrics.completionRate}%`} label="Completion" />
          <KpiCard value={metrics.velocity.tasksCompleted} label="Velocity" />
          <KpiCard value={stats.byStatus.blocked ?? 0} label="Blocked" accent={stats.byStatus.blocked > 0 ? "#ef4444" : undefined} />
        </div>
      </div>

      {/* Charts Row 1: Status Donut + Node Type Bars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Status Distribution">
          <StatusDonut data={metrics.statusDistribution} />
        </ChartCard>
        <ChartCard title="Node Types">
          <TypeBarChart data={typeData} />
        </ChartCard>
      </div>

      {/* Charts Row 2: Sprint Progress + Knowledge Coverage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Sprint Progress">
          <SprintBars data={metrics.sprintProgress} />
        </ChartCard>
        <ChartCard title="Knowledge Coverage">
          <KnowledgeBar data={knowledgeStats.bySource} />
        </ChartCard>
      </div>

      {/* Bottlenecks (full-width) */}
      <section>
        <h3 className="text-sm font-semibold mb-3">Bottlenecks</h3>
        <BottleneckCards bottlenecks={bottlenecks} />
      </section>
    </div>
  );
}

function KpiCard({ value, label, accent }: { value: string | number; label: string; accent?: string }): React.JSX.Element {
  return (
    <div className="p-3 rounded-xl border border-edge shadow-sm hover:shadow-md transition-shadow bg-surface-alt text-center">
      <div className="text-xl font-bold" style={accent ? { color: accent } : undefined}>{value}</div>
      <div className="text-[10px] text-muted uppercase">{label}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="p-4 rounded-xl border border-edge shadow-sm hover:shadow-md transition-shadow bg-surface-alt">
      <h3 className="text-xs font-semibold text-muted uppercase mb-2">{title}</h3>
      {children}
    </div>
  );
}
