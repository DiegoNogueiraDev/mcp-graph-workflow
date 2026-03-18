import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { NODE_TYPE_COLORS } from "@/lib/constants";
import type { NodeType } from "@/lib/types";

interface TypeBarChartProps {
  data: Array<{ type: NodeType; count: number }>;
  className?: string;
}

export function TypeBarChart({ data, className }: TypeBarChartProps): React.JSX.Element {
  const filtered = data.filter((d) => d.count > 0);

  if (filtered.length === 0) {
    return (
      <div className={`flex items-center justify-center text-sm text-[var(--color-text-muted)] ${className ?? ""}`}>
        No node types
      </div>
    );
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={filtered} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="type"
            tick={{ fontSize: 11 }}
            width={100}
            tickFormatter={(v: string) => v.replace("_", " ")}
          />
          <Tooltip
            contentStyle={{ background: "var(--color-bg-secondary)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
            {filtered.map((entry) => (
              <Cell key={entry.type} fill={NODE_TYPE_COLORS[entry.type]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
