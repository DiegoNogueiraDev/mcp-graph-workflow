import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const SOURCE_COLORS: Record<string, string> = {
  upload: "#2196f3",
  memory: "#8b5cf6",
  serena: "#8b5cf6",
  code_context: "#10b981",
  docs: "#f59e0b",
  web_capture: "#06b6d4",
};

interface KnowledgeBarProps {
  data: Record<string, number>;
  className?: string;
}

export function KnowledgeBar({ data, className }: KnowledgeBarProps): React.JSX.Element {
  const entries = Object.entries(data)
    .filter(([, count]) => count > 0)
    .map(([source, count]) => ({ source: source.replace("_", " "), count, fill: SOURCE_COLORS[source] ?? "#9e9e9e" }));

  if (entries.length === 0) {
    return (
      <div className={`flex items-center justify-center text-sm text-muted ${className ?? ""}`}>
        No knowledge data
      </div>
    );
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={entries} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="source" tick={{ fontSize: 11 }} width={90} />
          <Tooltip
            contentStyle={{ background: "var(--color-bg-secondary)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
            {entries.map((entry) => (
              <Cell key={entry.source} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
