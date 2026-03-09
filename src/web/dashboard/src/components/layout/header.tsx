import { memo } from "react";
import { useTheme } from "@/providers/theme-provider";
import type { GraphStats } from "@/lib/types";

interface HeaderProps {
  stats: GraphStats | null;
  onImport: () => void;
  onCapture: () => void;
}

export const Header = memo(function Header({ stats, onImport, onCapture }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();

  const done = stats?.byStatus?.done ?? 0;
  const total = stats?.totalNodes ?? 0;

  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-[var(--color-accent)]">
          mcp-graph
        </h1>
        {total > 0 && (
          <span className="text-sm text-[var(--color-text-muted)]">
            {done}/{total} done
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onImport}
          className="px-3 py-1.5 text-sm bg-[var(--color-accent)] text-white rounded hover:bg-[var(--color-accent-light)] transition-colors"
        >
          Import PRD
        </button>
        <button
          onClick={onCapture}
          className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded hover:bg-[var(--color-bg-tertiary)] transition-colors"
        >
          Capture
        </button>
        <button
          onClick={toggleTheme}
          className="px-2 py-1.5 text-sm border border-[var(--color-border)] rounded hover:bg-[var(--color-bg-tertiary)] transition-colors"
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? "☀" : "☾"}
        </button>
      </div>
    </header>
  );
});
