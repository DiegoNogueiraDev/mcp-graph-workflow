import { memo } from "react";

export type TabId = "graph" | "prd-backlog" | "gitnexus" | "serena" | "insights" | "benchmark";

interface TabNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "graph", label: "Graph" },
  { id: "prd-backlog", label: "PRD & Backlog" },
  { id: "gitnexus", label: "GitNexus" },
  { id: "serena", label: "Serena" },
  { id: "insights", label: "Insights" },
  { id: "benchmark", label: "Benchmark" },
];

export const TabNav = memo(function TabNav({ activeTab, onTabChange }: TabNavProps) {
  return (
    <nav className="flex border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === tab.id
              ? "border-[var(--color-accent)] text-[var(--color-accent)]"
              : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
});
