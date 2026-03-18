import React from "react";
import { useContextBudget } from "@/hooks/use-context-budget";
import { apiClient } from "@/lib/api-client";

const HEALTH_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  green: { bg: "bg-green-500/10", text: "text-green-500", border: "border-green-500/30" },
  yellow: { bg: "bg-yellow-500/10", text: "text-yellow-500", border: "border-yellow-500/30" },
  red: { bg: "bg-red-500/10", text: "text-red-500", border: "border-red-500/30" },
};

export function ContextTab(): React.JSX.Element {
  const { budget, loading, error, refresh } = useContextBudget();

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-danger)]">
        Failed to load context budget: {error}
      </div>
    );
  }

  if (loading || !budget) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
        Loading context budget...
      </div>
    );
  }

  const healthStyle = HEALTH_COLORS[budget.health] ?? HEALTH_COLORS.green;

  const handleQuickDisable = async (skillName: string): Promise<void> => {
    await apiClient.toggleSkill(skillName, false);
    refresh();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Context Management</h2>
        <button
          onClick={() => refresh()}
          className="text-xs px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity"
        >
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-center">
          <div className="text-xl font-bold">{budget.activeTokens.toLocaleString()}</div>
          <div className="text-[10px] text-[var(--color-text-muted)] uppercase">Active Tokens</div>
        </div>
        <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-center">
          <div className="text-xl font-bold">{budget.totalTokens.toLocaleString()}</div>
          <div className="text-[10px] text-[var(--color-text-muted)] uppercase">Total Tokens</div>
        </div>
        <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-center">
          <div className="text-xl font-bold">{budget.activeCount}</div>
          <div className="text-[10px] text-[var(--color-text-muted)] uppercase">Active Skills</div>
        </div>
        <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-center">
          <div className="text-xl font-bold">{budget.totalCount}</div>
          <div className="text-[10px] text-[var(--color-text-muted)] uppercase">Total Skills</div>
        </div>
      </div>

      {/* Health indicator */}
      <div className={`p-4 rounded-lg border ${healthStyle.bg} ${healthStyle.border}`}>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${
            budget.health === "green" ? "bg-green-500" :
            budget.health === "yellow" ? "bg-yellow-500" : "bg-red-500"
          }`} />
          <div>
            <div className={`text-sm font-medium ${healthStyle.text}`}>
              Session Health: {budget.health.charAt(0).toUpperCase() + budget.health.slice(1)}
            </div>
            <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {budget.healthMessage}
            </div>
          </div>
        </div>
        {budget.recommendations.length > 0 && (
          <div className="mt-3 space-y-1">
            {budget.recommendations.map((rec, i) => (
              <div key={i} className="text-xs text-[var(--color-text-muted)]">
                {rec}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Budget bar */}
      <div className="p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase">Token Budget</h3>
          <span className="text-xs text-[var(--color-text-muted)]">
            {budget.activeTokens.toLocaleString()} / 4,000 ({Math.round(budget.activeTokens / 40)}%)
          </span>
        </div>
        <div className="w-full h-3 rounded-full bg-[var(--color-border)] relative">
          <div
            className="h-full rounded-full absolute top-0 left-0 opacity-20"
            style={{ width: `${Math.min(Math.round(budget.totalTokens / 40), 100)}%`, background: "#6b7280" }}
          />
          <div
            className="h-full rounded-full absolute top-0 left-0 transition-all"
            style={{
              width: `${Math.min(Math.round(budget.activeTokens / 40), 100)}%`,
              background: budget.health === "red" ? "#ef4444" : budget.health === "yellow" ? "#f59e0b" : "#10b981",
            }}
          />
        </div>
      </div>

      {/* Breakdown */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase">
          Token Breakdown by Skill
        </h3>
        <div className="space-y-1">
          {budget.breakdown.map((item) => {
            const pct = budget.totalTokens > 0 ? Math.round((item.tokens / budget.totalTokens) * 100) : 0;
            return (
              <div
                key={item.name}
                className={`flex items-center gap-3 p-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] ${
                  !item.enabled ? "opacity-40" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium truncate">{item.name}</span>
                    <span className={`px-1 py-0.5 rounded text-[9px] ${
                      item.source === "custom" ? "bg-purple-500/10 text-purple-500" : "bg-blue-500/10 text-blue-500"
                    }`}>
                      {item.source}
                    </span>
                  </div>
                  <div className="w-full h-1 rounded-full bg-[var(--color-border)] mt-1">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: item.enabled ? "#3b82f6" : "#6b7280",
                      }}
                    />
                  </div>
                </div>
                <span className="text-[10px] text-[var(--color-text-muted)] shrink-0 w-16 text-right">
                  {item.tokens.toLocaleString()} tok
                </span>
                {item.enabled && (
                  <button
                    onClick={() => void handleQuickDisable(item.name)}
                    className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-red-500 hover:border-red-500/50 shrink-0"
                  >
                    Disable
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
