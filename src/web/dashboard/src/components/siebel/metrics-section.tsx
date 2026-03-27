/**
 * Siebel Metrics Section — repository statistics, type distribution, script coverage, locked objects.
 */

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";

interface MetricsData {
  totalObjects: number;
  totalSifs: number;
  typeDistribution: Record<string, number>;
  projectDistribution: Record<string, number>;
  scriptCoverage: { scriptableObjects: number; withScripts: number; percentage: number };
  lockedObjects: Array<{ name: string; type: string; lockedBy: string }>;
}

export function MetricsSection(): React.JSX.Element {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadMetrics();
  }, []);

  async function loadMetrics(): Promise<void> {
    setLoading(true);
    setError("");
    try {
      const data = await apiClient.siebelGetMetrics();
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="p-4 text-zinc-400">Loading metrics...</div>;
  if (error) return <div className="p-4 text-red-400">{error}</div>;
  if (!metrics) return <div className="p-4 text-zinc-500">No metrics available. Import SIF files first.</div>;

  const typeEntries = Object.entries(metrics.typeDistribution).sort((a, b) => b[1] - a[1]);
  const projectEntries = Object.entries(metrics.projectDistribution).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg bg-zinc-800 p-3 text-center">
          <div className="text-2xl font-bold text-blue-400">{metrics.totalObjects}</div>
          <div className="text-xs text-zinc-400">Total Objects</div>
        </div>
        <div className="rounded-lg bg-zinc-800 p-3 text-center">
          <div className="text-2xl font-bold text-green-400">{metrics.totalSifs}</div>
          <div className="text-xs text-zinc-400">SIF Files</div>
        </div>
        <div className="rounded-lg bg-zinc-800 p-3 text-center">
          <div className="text-2xl font-bold text-yellow-400">{metrics.scriptCoverage.percentage}%</div>
          <div className="text-xs text-zinc-400">Script Coverage</div>
        </div>
        <div className="rounded-lg bg-zinc-800 p-3 text-center">
          <div className="text-2xl font-bold text-red-400">{metrics.lockedObjects.length}</div>
          <div className="text-xs text-zinc-400">Locked Objects</div>
        </div>
      </div>

      {/* Type Distribution */}
      <div className="rounded-lg bg-zinc-800 p-4">
        <h3 className="mb-2 text-sm font-semibold text-zinc-300">Type Distribution</h3>
        <div className="space-y-1">
          {typeEntries.map(([type, count]) => (
            <div key={type} className="flex items-center gap-2">
              <span className="w-40 truncate text-xs text-zinc-400">{type}</span>
              <div className="flex-1 h-4 rounded bg-zinc-700">
                <div
                  className="h-4 rounded bg-blue-500"
                  style={{ width: `${(count / metrics.totalObjects) * 100}%` }}
                />
              </div>
              <span className="w-8 text-right text-xs text-zinc-400">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Project Distribution */}
      {projectEntries.length > 0 && (
        <div className="rounded-lg bg-zinc-800 p-4">
          <h3 className="mb-2 text-sm font-semibold text-zinc-300">Project Distribution</h3>
          <div className="space-y-1">
            {projectEntries.slice(0, 10).map(([project, count]) => (
              <div key={project} className="flex justify-between text-xs">
                <span className="text-zinc-400">{project}</span>
                <span className="text-zinc-300">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Locked Objects */}
      {metrics.lockedObjects.length > 0 && (
        <div className="rounded-lg bg-zinc-800 p-4">
          <h3 className="mb-2 text-sm font-semibold text-red-400">Locked Objects</h3>
          <div className="space-y-1">
            {metrics.lockedObjects.map((obj) => (
              <div key={obj.name} className="flex justify-between text-xs">
                <span className="text-zinc-300">{obj.name} <span className="text-zinc-500">({obj.type})</span></span>
                <span className="text-yellow-400">by {obj.lockedBy}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
