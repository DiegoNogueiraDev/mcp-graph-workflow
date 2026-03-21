import { memo } from "react";

export type TabId = "graph" | "prd-backlog" | "journey" | "gitnexus" | "memories" | "insights" | "skills" | "context" | "benchmark" | "logs";

interface TabNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "graph", label: "Graph" },
  { id: "prd-backlog", label: "PRD & Backlog" },
  { id: "journey", label: "Journey" },
  { id: "gitnexus", label: "Code Graph" },
  { id: "memories", label: "Memories" },
  { id: "insights", label: "Insights" },
  { id: "skills", label: "Skills" },
  { id: "context", label: "Context" },
  { id: "benchmark", label: "Benchmark" },
  { id: "logs", label: "Logs" },
];

export const TabNav = memo(function TabNav({ activeTab, onTabChange }: TabNavProps) {
  return (
    <nav
      className="flex overflow-x-auto border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
      role="tablist"
      aria-label="Dashboard sections"
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`panel-${tab.id}`}
          id={`tab-${tab.id}`}
          tabIndex={activeTab === tab.id ? 0 : -1}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
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
