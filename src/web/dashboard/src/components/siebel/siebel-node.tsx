/**
 * SiebelNode — Custom React Flow node for Siebel objects.
 * Color-coded by type, shows name, project, property/child counts.
 */

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { SiebelNodeData } from "./siebel-graph-utils";
import { SIEBEL_TYPE_COLORS } from "@/lib/constants";

type SiebelNodeProps = NodeProps & { data: SiebelNodeData };

export const SiebelNode = memo(function SiebelNode({ data }: SiebelNodeProps) {
  const typeColor = SIEBEL_TYPE_COLORS[data.siebelType] || "#6b7280";

  return (
    <>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2" />
      <div
        className={`bg-surface border border-edge rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer min-w-[200px] ${
          data.isImpacted
            ? data.impactLevel === "direct"
              ? "ring-2 ring-red-500/60"
              : "ring-2 ring-orange-400/50"
            : ""
        } ${data.inactive ? "opacity-50" : ""}`}
      >
        <div className="p-2.5">
          <div className="flex items-center justify-between mb-1">
            <span
              className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded"
              style={{ background: `${typeColor}20`, color: typeColor }}
            >
              {data.siebelType.replace(/_/g, " ")}
            </span>
            {data.inactive && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-alt text-muted">
                inactive
              </span>
            )}
          </div>
          <div className="text-sm font-medium leading-tight line-clamp-2 mb-1">
            {data.label}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted">
            {data.project && <span>{data.project}</span>}
            <span>{data.propertyCount} props</span>
            {data.childCount > 0 && <span>{data.childCount} children</span>}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2" />
    </>
  );
});
