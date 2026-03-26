import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants";
import type { NodeStatus } from "@/lib/types";

interface StatusDonutProps {
  data: Array<{ status: NodeStatus; count: number; percentage: number }>;
  className?: string;
}

export function StatusDonut({ data, className }: StatusDonutProps): React.JSX.Element {
  const filtered = data.filter((d) => d.count > 0);

  if (filtered.length === 0) {
    return (
      <div className={`flex items-center justify-center text-sm text-muted ${className ?? ""}`}>
        No status data
      </div>
    );
  }

  const chartData = filtered.map((d) => ({
    name: STATUS_LABELS[d.status],
    value: d.count,
    fill: STATUS_COLORS[d.status],
  }));

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            strokeWidth={0}
          >
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: "var(--color-bg-secondary)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
