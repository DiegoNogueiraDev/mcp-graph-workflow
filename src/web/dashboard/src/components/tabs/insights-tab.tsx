import { RefreshCw, AlertCircle } from "lucide-react";
import { useInsights } from "@/hooks/use-insights";
import { HealthGauge } from "@/components/charts/health-gauge";
import { StatusDonut } from "@/components/charts/status-donut";
import { TypeBarChart } from "@/components/charts/type-bar-chart";
import { SprintBars } from "@/components/charts/sprint-bars";
import { KnowledgeBar } from "@/components/charts/knowledge-bar";
import { BottleneckCards } from "@/components/insights/bottleneck-cards";
import type { NodeType } from "@/lib/types";

const KPI_TOOLTIPS: Record<string, string> = {
  "Total Tasks": "Number of task and subtask nodes in the graph",
  "Completion": "Percentage of tasks with status 'done'",
  "Velocity": "Tasks completed in the current sprint",
  "Blocked": "Tasks with status 'blocked' that need attention",
};

function InsightsSkeleton(): React.JSX.Element {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-5 w-36 rounded bg-surface animate-pulse" />
        <div className="h-7 w-20 rounded bg-surface animate-pulse" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 h-40 rounded-xl border border-edge bg-surface-alt animate-pulse" />
        <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl border border-edge bg-surface-alt animate-pulse" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-48 rounded-xl border border-edge bg-surface-alt animate-pulse" />
        <div className="h-48 rounded-xl border border-edge bg-surface-alt animate-pulse" />
      </div>
    </div>
  );
}

export function InsightsTab(): React.JSX.Element {
  const { data, loading, error, refresh } = useInsights();

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Failed to load insights</p>
          <p className="text-xs text-muted mt-1">{error}</p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md border border-edge text-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  if (loading || !data) {
    return <InsightsSkeleton />;
  }

  const { metrics, bottlenecks, stats, knowledgeStats, healthScore } = data;

  const typeData = Object.entries(stats.byType)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => ({ type: type as NodeType, count }));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Project Insights</h2>
        <button
          type="button"
          onClick={refresh}
          className="flex items-center gap-1.5 text-xs px-3 py-1 rounded bg-surface-alt border border-edge hover:bg-surface-elevated transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 p-4 rounded-xl border border-edge bg-surface-alt flex items-center justify-center">
          <HealthGauge score={healthScore} />
        </div>
        <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard value={metrics.totalTasks} label="Total Tasks" />
          <KpiCard value={`${metrics.completionRate}%`} label="Completion" />
          <KpiCard value={metrics.velocity.tasksCompleted} label="Velocity" />
          <KpiCard value={stats.byStatus.blocked ?? 0} label="Blocked" accent={stats.byStatus.blocked > 0 ? "#ef4444" : undefined} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Status Distribution">
          <StatusDonut data={metrics.statusDistribution} />
        </ChartCard>
        <ChartCard title="Node Types">
          <TypeBarChart data={typeData} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Sprint Progress">
          <SprintBars data={metrics.sprintProgress} />
        </ChartCard>
        <ChartCard title="Knowledge Coverage">
          <KnowledgeBar data={knowledgeStats.bySource} />
        </ChartCard>
      </div>

      <section>
        <h3 className="text-sm font-semibold mb-3">Bottlenecks</h3>
        <BottleneckCards bottlenecks={bottlenecks} />
      </section>
    </div>
  );
}

function KpiCard({ value, label, accent }: { value: string | number; label: string; accent?: string }): React.JSX.Element {
  const tooltip = KPI_TOOLTIPS[label];
  return (
    <div className="p-3 rounded-xl border border-edge bg-surface-alt text-center" title={tooltip}>
      <div className="text-xl font-bold" style={accent ? { color: accent } : undefined}>{value}</div>
      <div className="text-[10px] text-muted uppercase">{label}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="p-4 rounded-xl border border-edge bg-surface-alt">
      <h3 className="text-xs font-semibold text-muted uppercase mb-2">{title}</h3>
      {children}
    </div>
  );
}
