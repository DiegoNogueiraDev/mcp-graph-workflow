import { memo } from "react";
import { CODE_SYMBOL_COLORS, CODE_RELATION_COLORS, CODE_RELATION_LABELS } from "@/lib/constants";

interface GraphFiltersPanelProps {
  visibleNodeKinds: Set<string>;
  visibleEdgeTypes: Set<string>;
  focusDepth: number | null;
  onToggleNodeKind: (kind: string) => void;
  onToggleEdgeType: (edgeType: string) => void;
  onSetFocusDepth: (depth: number | null) => void;
  symbolCounts: Record<string, number>;
  relationCounts: Record<string, number>;
}

const NODE_KINDS = Object.keys(CODE_SYMBOL_COLORS);
const EDGE_TYPES = Object.keys(CODE_RELATION_COLORS);
const FOCUS_DEPTH_OPTIONS: Array<{ label: string; value: number | null }> = [
  { label: "All", value: null },
  { label: "1 hop", value: 1 },
  { label: "2 hops", value: 2 },
  { label: "3 hops", value: 3 },
];

export const GraphFiltersPanel = memo(function GraphFiltersPanel({
  visibleNodeKinds,
  visibleEdgeTypes,
  focusDepth,
  onToggleNodeKind,
  onToggleEdgeType,
  onSetFocusDepth,
  symbolCounts,
  relationCounts,
}: GraphFiltersPanelProps) {
  return (
    <div className="p-4 overflow-y-auto flex-1 space-y-6">
      {/* NODE TYPES */}
      <section>
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
          Node Types
        </h4>
        <p className="text-[9px] text-[var(--color-text-muted)] mb-2">
          Toggle visibility of node types in the graph
        </p>
        <div className="space-y-1">
          {NODE_KINDS.map((kind) => {
            const color = CODE_SYMBOL_COLORS[kind];
            const visible = visibleNodeKinds.has(kind);
            const count = symbolCounts[kind] ?? 0;
            return (
              <button
                key={kind}
                onClick={() => onToggleNodeKind(kind)}
                className="w-full flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-[var(--color-bg-tertiary)] transition-colors"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: visible ? color : "#333" }}
                />
                <span className={visible ? "" : "text-[var(--color-text-muted)] line-through"}>
                  {kind.charAt(0).toUpperCase() + kind.slice(1)}
                </span>
                <span className="text-[9px] text-[var(--color-text-muted)] ml-auto">
                  {count}
                </span>
                <EyeIcon open={visible} />
              </button>
            );
          })}
        </div>
      </section>

      {/* EDGE TYPES */}
      <section>
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
          Edge Types
        </h4>
        <p className="text-[9px] text-[var(--color-text-muted)] mb-2">
          Toggle visibility of relationship types
        </p>
        <div className="space-y-1">
          {EDGE_TYPES.map((edgeType) => {
            const color = CODE_RELATION_COLORS[edgeType];
            const label = CODE_RELATION_LABELS[edgeType] ?? edgeType;
            const visible = visibleEdgeTypes.has(edgeType);
            const count = relationCounts[edgeType] ?? 0;
            return (
              <button
                key={edgeType}
                onClick={() => onToggleEdgeType(edgeType)}
                className="w-full flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-[var(--color-bg-tertiary)] transition-colors"
              >
                <span className="w-4 shrink-0 flex items-center">
                  <span
                    className="w-full h-0.5 rounded"
                    style={{ background: visible ? color : "#333" }}
                  />
                </span>
                <span className={visible ? "" : "text-[var(--color-text-muted)] line-through"}>
                  {label}
                </span>
                <span className="text-[9px] text-[var(--color-text-muted)] ml-auto">
                  {count}
                </span>
                <EyeIcon open={visible} />
              </button>
            );
          })}
        </div>
      </section>

      {/* FOCUS DEPTH */}
      <section>
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
          Focus Depth
        </h4>
        <p className="text-[9px] text-[var(--color-text-muted)] mb-2">
          Show nodes within N hops of selected node
        </p>
        <div className="flex gap-1">
          {FOCUS_DEPTH_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => onSetFocusDepth(opt.value)}
              className={`text-[10px] px-2.5 py-1 rounded transition-colors ${
                focusDepth === opt.value
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* COLOR LEGEND */}
      <section>
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
          Color Legend
        </h4>
        <div className="grid grid-cols-2 gap-1">
          {NODE_KINDS.map((kind) => (
            <div key={kind} className="flex items-center gap-1.5 text-[10px]">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: CODE_SYMBOL_COLORS[kind] }}
              />
              <span>{kind.charAt(0).toUpperCase() + kind.slice(1)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
});

function EyeIcon({ open }: { open: boolean }): React.JSX.Element {
  if (open) {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 text-[var(--color-text-muted)]"
      >
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-[var(--color-text-muted)] opacity-40"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
