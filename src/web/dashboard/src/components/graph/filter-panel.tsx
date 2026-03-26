import { memo } from "react";
import type { NodeStatus, NodeType } from "@/lib/types";
import { ALL_STATUSES, ALL_TYPES, STATUS_COLORS, NODE_TYPE_COLORS } from "@/lib/constants";

interface FilterPanelProps {
  statuses: Set<string>;
  types: Set<string>;
  direction: "TB" | "LR";
  onStatusToggle: (status: NodeStatus) => void;
  onTypeToggle: (type: NodeType) => void;
  onDirectionChange: (dir: "TB" | "LR") => void;
  onClear: () => void;
  visibleNodeCount: number;
  totalNodeCount: number;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

export const FilterPanel = memo(function FilterPanel({
  statuses,
  types,
  direction,
  onStatusToggle,
  onTypeToggle,
  onDirectionChange,
  onClear,
  visibleNodeCount,
  totalNodeCount,
  onExpandAll,
  onCollapseAll,
}: FilterPanelProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-b border-edge bg-surface-alt text-xs">
      <div className="flex items-center gap-1.5">
        <span className="font-medium text-muted">Status:</span>
        {ALL_STATUSES.map((s) => (
          <label key={s} className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={statuses.has(s)}
              onChange={() => onStatusToggle(s)}
              className="w-3 h-3"
            />
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ background: STATUS_COLORS[s] }}
            />
            <span>{s.replace("_", " ")}</span>
          </label>
        ))}
      </div>

      <div className="w-px h-4 bg-edge" />

      <div className="flex items-center gap-1.5">
        <span className="font-medium text-muted">Type:</span>
        {ALL_TYPES.map((t) => (
          <label key={t} className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={types.has(t)}
              onChange={() => onTypeToggle(t)}
              className="w-3 h-3"
            />
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ background: NODE_TYPE_COLORS[t] }}
            />
            <span>{t.replace("_", " ")}</span>
          </label>
        ))}
      </div>

      <div className="w-px h-4 bg-edge" />

      <div className="flex items-center gap-1.5">
        <span className="font-medium text-muted">Layout:</span>
        <select
          value={direction}
          onChange={(e) => onDirectionChange(e.target.value as "TB" | "LR")}
          className="bg-surface border border-edge rounded px-1 py-0.5 text-xs"
        >
          <option value="TB">Top → Down</option>
          <option value="LR">Left → Right</option>
        </select>
      </div>

      <div className="w-px h-4 bg-edge" />

      <div className="flex items-center gap-1.5">
        <button
          onClick={onExpandAll}
          className="px-2 py-0.5 rounded border border-edge hover:bg-surface-elevated transition-colors"
          title={totalNodeCount > 100 ? `Warning: ${totalNodeCount} nodes — may be slow` : "Expand all nodes"}
        >
          Expand All
        </button>
        <button
          onClick={onCollapseAll}
          className="px-2 py-0.5 rounded border border-edge hover:bg-surface-elevated transition-colors"
        >
          Collapse All
        </button>
      </div>

      <div className="w-px h-4 bg-edge" />

      <span className="text-muted">
        Showing {visibleNodeCount} of {totalNodeCount}
      </span>

      <button
        onClick={onClear}
        className="text-muted hover:text-foreground underline"
      >
        Clear
      </button>
    </div>
  );
});
