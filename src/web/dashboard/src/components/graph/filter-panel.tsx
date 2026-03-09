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
}

export const FilterPanel = memo(function FilterPanel({
  statuses,
  types,
  direction,
  onStatusToggle,
  onTypeToggle,
  onDirectionChange,
  onClear,
}: FilterPanelProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-xs">
      <div className="flex items-center gap-1.5">
        <span className="font-medium text-[var(--color-text-muted)]">Status:</span>
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

      <div className="w-px h-4 bg-[var(--color-border)]" />

      <div className="flex items-center gap-1.5">
        <span className="font-medium text-[var(--color-text-muted)]">Type:</span>
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

      <div className="w-px h-4 bg-[var(--color-border)]" />

      <div className="flex items-center gap-1.5">
        <span className="font-medium text-[var(--color-text-muted)]">Layout:</span>
        <select
          value={direction}
          onChange={(e) => onDirectionChange(e.target.value as "TB" | "LR")}
          className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-1 py-0.5 text-xs"
        >
          <option value="TB">Top → Down</option>
          <option value="LR">Left → Right</option>
        </select>
      </div>

      <button
        onClick={onClear}
        className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] underline"
      >
        Clear
      </button>
    </div>
  );
});
