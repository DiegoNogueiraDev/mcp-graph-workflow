import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

interface TranslationNodeData {
  label: string;
  language?: string;
  status: string;
  confidence?: number;
  side: "source" | "target";
  [key: string]: unknown;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500",
  analyzing: "bg-blue-500",
  translating: "bg-indigo-500",
  validating: "bg-purple-500",
  done: "bg-green-500",
  failed: "bg-red-500",
};

const SIDE_STYLES = {
  source: {
    container: "bg-blue-500/10 border-blue-500/30 text-blue-400",
    badge: "bg-blue-500/20 text-blue-400",
  },
  target: {
    container: "bg-green-500/10 border-green-500/30 text-green-400",
    badge: "bg-green-500/20 text-green-400",
  },
} as const;

export const TranslationGraphNode = memo(function TranslationGraphNode({ data }: NodeProps) {
  const nodeData = data as TranslationNodeData;
  const side = nodeData.side ?? "source";
  const styles = SIDE_STYLES[side];
  const statusColor = STATUS_COLORS[nodeData.status] ?? "bg-gray-500";

  return (
    <div className={`px-3 py-2 rounded-lg border text-xs ${styles.container}`}>
      {/* Source handle on left */}
      {side === "target" && (
        <Handle type="target" position={Position.Left} className="!bg-green-500 !w-2 !h-2" />
      )}

      <div className="flex items-center gap-1.5">
        {/* Status dot */}
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusColor}`} />

        {/* Label */}
        <span className="font-medium truncate max-w-[120px]">{nodeData.label}</span>
      </div>

      {/* Language badge + confidence */}
      <div className="flex items-center gap-1.5 mt-1">
        {nodeData.language && (
          <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded ${styles.badge}`}>
            {nodeData.language}
          </span>
        )}
        {nodeData.confidence != null && (
          <span className="text-[9px] text-muted">
            {Math.round(nodeData.confidence * 100)}%
          </span>
        )}
      </div>

      {/* Target handle on right */}
      {side === "source" && (
        <Handle type="source" position={Position.Right} className="!bg-blue-500 !w-2 !h-2" />
      )}
    </div>
  );
});
