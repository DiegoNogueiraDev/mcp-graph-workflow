import { useState } from "react";
import type { Bottlenecks } from "@/lib/types";

interface BottleneckCardsProps {
  bottlenecks: Bottlenecks;
  className?: string;
}

interface CategoryConfig {
  key: keyof Pick<Bottlenecks, "blockedTasks" | "missingAcceptanceCriteria" | "oversizedTasks">;
  label: string;
  color: string;
  bgColor: string;
}

const CATEGORIES: CategoryConfig[] = [
  { key: "blockedTasks", label: "Blocked", color: "#ef4444", bgColor: "#ef444420" },
  { key: "missingAcceptanceCriteria", label: "Missing AC", color: "#f59e0b", bgColor: "#f59e0b20" },
  { key: "oversizedTasks", label: "Oversized", color: "#8b5cf6", bgColor: "#8b5cf620" },
];

export function BottleneckCards({ bottlenecks, className }: BottleneckCardsProps): React.JSX.Element {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const hasCriticalPath = bottlenecks.criticalPath && bottlenecks.criticalPath.length > 0;

  const totalIssues =
    bottlenecks.blockedTasks.length +
    bottlenecks.missingAcceptanceCriteria.length +
    bottlenecks.oversizedTasks.length +
    (hasCriticalPath ? 1 : 0);

  if (totalIssues === 0) {
    return (
      <div className={`p-4 rounded-xl border border-edge shadow-sm hover:shadow-md transition-shadow bg-surface-alt text-center ${className ?? ""}`}>
        <span className="text-2xl">&#10003;</span>
        <p className="text-sm text-muted mt-1">No bottlenecks detected</p>
      </div>
    );
  }

  const toggle = (key: string): void => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => {
          const count = bottlenecks[cat.key].length;
          if (count === 0) return null;
          return (
            <span
              key={cat.key}
              className="px-2 py-1 rounded-full text-xs font-medium"
              style={{ background: cat.bgColor, color: cat.color }}
            >
              {cat.label}: {count}
            </span>
          );
        })}
        {hasCriticalPath && (
          <span className="px-2 py-1 rounded-full text-xs font-medium" style={{ background: "#06b6d420", color: "#06b6d4" }}>
            Critical Path: {bottlenecks.criticalPath!.length} nodes
          </span>
        )}
      </div>

      {/* Blocked Tasks */}
      {bottlenecks.blockedTasks.length > 0 && (
        <CollapsibleSection
          title={`Blocked Tasks (${bottlenecks.blockedTasks.length})`}
          color="#ef4444"
          isOpen={expanded["blocked"] ?? false}
          onToggle={() => toggle("blocked")}
        >
          <div className="space-y-1.5">
            {bottlenecks.blockedTasks.slice(0, 15).map((t, i) => (
              <div key={i} className="flex items-start gap-2 text-xs px-2 py-1.5 rounded bg-surface-elevated">
                <span className="shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
                <div>
                  <span className="font-medium">{t.title}</span>
                  <span className="text-muted ml-1">blocked by: {t.blockerTitles.join(", ")}</span>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Missing AC */}
      {bottlenecks.missingAcceptanceCriteria.length > 0 && (
        <CollapsibleSection
          title={`Missing Acceptance Criteria (${bottlenecks.missingAcceptanceCriteria.length})`}
          color="#f59e0b"
          isOpen={expanded["missingAC"] ?? false}
          onToggle={() => toggle("missingAC")}
        >
          <div className="space-y-1">
            {bottlenecks.missingAcceptanceCriteria.slice(0, 15).map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-xs px-2 py-1 rounded bg-surface-elevated">
                <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
                <span>{t.title}</span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Oversized Tasks */}
      {bottlenecks.oversizedTasks.length > 0 && (
        <CollapsibleSection
          title={`Oversized Tasks (${bottlenecks.oversizedTasks.length})`}
          color="#8b5cf6"
          isOpen={expanded["oversized"] ?? false}
          onToggle={() => toggle("oversized")}
        >
          <div className="space-y-1">
            {bottlenecks.oversizedTasks.slice(0, 15).map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-xs px-2 py-1 rounded bg-surface-elevated">
                <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[#8b5cf6]" />
                <span>{t.title}</span>
                <span className="text-muted ml-auto">{t.estimateMinutes}min</span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Critical Path */}
      {hasCriticalPath && (
        <CollapsibleSection
          title={`Critical Path (${bottlenecks.criticalPath!.length} nodes)`}
          color="#06b6d4"
          isOpen={expanded["criticalPath"] ?? false}
          onToggle={() => toggle("criticalPath")}
        >
          <div className="flex flex-wrap items-center gap-1 text-xs px-2 py-2">
            {bottlenecks.criticalPath!.titles.map((title, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="px-2 py-0.5 rounded bg-[#06b6d420] text-[#06b6d4] font-medium">{title}</span>
                {i < bottlenecks.criticalPath!.titles.length - 1 && (
                  <span className="text-muted">&rarr;</span>
                )}
              </span>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

function CollapsibleSection({
  title,
  color,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  color: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="rounded-xl border border-edge shadow-sm hover:shadow-md transition-shadow bg-surface-alt overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-surface-elevated transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
          {title}
        </span>
        <span className="text-muted">{isOpen ? "\u25B2" : "\u25BC"}</span>
      </button>
      {isOpen && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}
