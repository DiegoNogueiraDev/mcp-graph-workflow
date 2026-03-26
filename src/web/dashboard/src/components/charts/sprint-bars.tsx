import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface SprintBarsProps {
  data: Array<{ sprint: string; done: number; total: number; percentage: number }>;
  className?: string;
}

export function SprintBars({ data, className }: SprintBarsProps): React.JSX.Element {
  if (data.length === 0) {
    return (
      <div className={`flex items-center justify-center text-sm text-muted ${className ?? ""}`}>
        No sprint data
      </div>
    );
  }

  const chartData = data.map((s) => ({
    sprint: s.sprint,
    done: s.done,
    remaining: s.total - s.done,
  }));

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
          <XAxis dataKey="sprint" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: "var(--color-bg-secondary)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="done" stackId="a" fill="#4caf50" radius={[0, 0, 0, 0]} name="Done" />
          <Bar dataKey="remaining" stackId="a" fill="#2196f3" radius={[4, 4, 0, 0]} name="Remaining" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
