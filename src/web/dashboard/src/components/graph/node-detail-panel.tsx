import { memo } from "react";
import type { GraphNode } from "@/lib/types";
import { STATUS_COLORS, NODE_TYPE_COLORS } from "@/lib/constants";

interface NodeDetailPanelProps {
  node: GraphNode | null;
  onClose: () => void;
}

export const NodeDetailPanel = memo(function NodeDetailPanel({ node, onClose }: NodeDetailPanelProps) {
  if (!node) return null;

  const typeColor = NODE_TYPE_COLORS[node.type] || "#6c757d";
  const statusColor = STATUS_COLORS[node.status] || "#9e9e9e";

  return (
    <div className="w-80 border-l border-[var(--color-border)] bg-[var(--color-bg-secondary)] overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold">Node Details</h3>
        <button
          onClick={onClose}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-lg leading-none"
        >
          &times;
        </button>
      </div>

      <h4 className="text-base font-semibold mb-3">{node.title}</h4>

      <div className="space-y-2 text-sm">
        <Row label="ID">
          <code className="text-xs bg-[var(--color-bg-tertiary)] px-1 rounded break-all">{node.id}</code>
        </Row>
        <Row label="Type">
          <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: `${typeColor}20`, color: typeColor }}>
            {node.type}
          </span>
        </Row>
        <Row label="Status">
          <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: `${statusColor}20`, color: statusColor }}>
            {node.status.replace("_", " ")}
          </span>
        </Row>
        <Row label="Priority">P{node.priority}</Row>
        {node.xpSize && <Row label="Size">{node.xpSize}</Row>}
        {node.estimateMinutes != null && <Row label="Estimate">{node.estimateMinutes}min</Row>}
        {node.sprint && <Row label="Sprint">{node.sprint}</Row>}

        {node.description && (
          <div className="pt-2 border-t border-[var(--color-border)]">
            <div className="text-xs font-medium text-[var(--color-text-muted)] mb-1">Description</div>
            <p className="text-xs whitespace-pre-wrap">{node.description}</p>
          </div>
        )}

        {node.acceptanceCriteria && node.acceptanceCriteria.length > 0 && (
          <div className="pt-2 border-t border-[var(--color-border)]">
            <div className="text-xs font-medium text-[var(--color-text-muted)] mb-1">
              Acceptance Criteria ({node.acceptanceCriteria.length})
            </div>
            <ul className="text-xs space-y-1 list-disc pl-4">
              {node.acceptanceCriteria.map((ac, i) => (
                <li key={i}>{ac}</li>
              ))}
            </ul>
          </div>
        )}

        {node.tags && node.tags.length > 0 && (
          <div className="pt-2 border-t border-[var(--color-border)]">
            <div className="text-xs font-medium text-[var(--color-text-muted)] mb-1">Tags</div>
            <div className="flex flex-wrap gap-1">
              {node.tags.map((tag) => (
                <span key={tag} className="text-[10px] bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 rounded">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {node.sourceRef && (
          <div className="pt-2 border-t border-[var(--color-border)]">
            <div className="text-xs font-medium text-[var(--color-text-muted)] mb-1">Source</div>
            <div className="text-xs">
              {node.sourceRef.file}
              {node.sourceRef.startLine != null && ` (L${node.sourceRef.startLine}–${node.sourceRef.endLine ?? "?"})`}
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)]">
          <div>Created: {new Date(node.createdAt).toLocaleString()}</div>
          <div>Updated: {new Date(node.updatedAt).toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
});

function Row({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-xs text-[var(--color-text-muted)] shrink-0">{label}</span>
      <div className="text-right">{children}</div>
    </div>
  );
}
