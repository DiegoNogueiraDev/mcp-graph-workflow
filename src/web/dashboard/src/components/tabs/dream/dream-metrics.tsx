import React from "react";
import type { DreamMetrics as DreamMetricsType } from "@/lib/types";

interface DreamMetricsProps {
  metrics: DreamMetricsType | null;
}

const CARDS = [
  { key: "totalCycles" as const, label: "Total Cycles", format: (v: number) => v.toString() },
  { key: "totalPruned" as const, label: "Docs Pruned", format: (v: number) => v.toLocaleString() },
  { key: "totalMerged" as const, label: "Docs Merged", format: (v: number) => v.toLocaleString() },
  { key: "avgQualityImprovement" as const, label: "Avg Quality Delta", format: (v: number) => (v >= 0 ? "+" : "") + (v * 100).toFixed(1) + "%" },
];

export function DreamMetricsCards({ metrics }: DreamMetricsProps): React.JSX.Element {
  if (!metrics) return <></>;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {CARDS.map(({ key, label, format }) => (
        <div
          key={key}
          className="p-3 rounded-xl border border-edge shadow-sm hover:shadow-md transition-shadow bg-surface-alt text-center"
        >
          <div className="text-xl font-bold">{format(metrics[key])}</div>
          <div className="text-[10px] text-muted uppercase">{label}</div>
        </div>
      ))}
    </div>
  );
}
