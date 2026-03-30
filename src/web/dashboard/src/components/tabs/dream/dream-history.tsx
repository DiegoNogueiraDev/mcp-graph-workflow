import React from "react";
import type { DreamCycleResult } from "@/lib/types";

interface DreamHistoryProps {
  cycles: DreamCycleResult[];
}

const STATUS_COLORS: Record<string, string> = {
  completed: "text-green-500",
  running: "text-blue-500",
  failed: "text-red-500",
  cancelled: "text-yellow-500",
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function DreamHistory({ cycles }: DreamHistoryProps): React.JSX.Element {
  if (cycles.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted">
        No dream cycles yet
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted uppercase text-[10px]">
            <th className="text-left p-2">Date</th>
            <th className="text-left p-2">Status</th>
            <th className="text-right p-2">Pruned</th>
            <th className="text-right p-2">Merged</th>
            <th className="text-right p-2">Duration</th>
          </tr>
        </thead>
        <tbody>
          {cycles.map((cycle) => {
            const totalMs = cycle.phases.nrem.durationMs + cycle.phases.rem.durationMs + cycle.phases.wakeReady.durationMs;
            return (
              <tr key={cycle.id} className="border-t border-edge hover:bg-surface-alt/50 transition-colors">
                <td className="p-2">{formatDate(cycle.startedAt)}</td>
                <td className={`p-2 font-medium ${STATUS_COLORS[cycle.status] ?? "text-muted"}`}>
                  {cycle.status}
                </td>
                <td className="p-2 text-right">{cycle.summary.totalPruned}</td>
                <td className="p-2 text-right">{cycle.summary.totalMerged}</td>
                <td className="p-2 text-right">{formatDuration(totalMs)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
