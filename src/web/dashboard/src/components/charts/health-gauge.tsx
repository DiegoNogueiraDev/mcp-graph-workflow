import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from "recharts";

interface HealthGaugeProps {
  score: number;
  className?: string;
}

function getColor(score: number): string {
  if (score <= 40) return "#ef4444";
  if (score <= 70) return "#f59e0b";
  return "#22c55e";
}

export function HealthGauge({ score, className }: HealthGaugeProps): React.JSX.Element {
  const color = getColor(score);
  const data = [{ value: score, fill: color }];

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={180}>
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="70%"
          outerRadius="100%"
          startAngle={180}
          endAngle={0}
          data={data}
          barSize={12}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar
            dataKey="value"
            cornerRadius={6}
            background={{ fill: "var(--color-bg-tertiary, #1e1e2e)" }}
            angleAxisId={0}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="text-center -mt-20">
        <span className="text-3xl font-bold" style={{ color }}>{score}</span>
        <p className="text-[10px] text-[var(--color-text-muted)] uppercase mt-0.5">Health Score</p>
      </div>
    </div>
  );
}
