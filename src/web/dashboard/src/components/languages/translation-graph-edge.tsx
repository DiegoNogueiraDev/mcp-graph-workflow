import { memo } from "react";
import { BaseEdge, getBezierPath } from "@xyflow/react";
import type { EdgeProps } from "@xyflow/react";

interface TranslationEdgeData {
  method: string;
  confidence: number;
  [key: string]: unknown;
}

const METHOD_COLORS: Record<string, string> = {
  rule: "#22c55e",
  ai: "#eab308",
};

const DEFAULT_STROKE = "#6b7280";

export const TranslationGraphEdge = memo(function TranslationGraphEdge(props: EdgeProps) {
  const {
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    data,
    markerEnd,
  } = props;

  const edgeData = data as TranslationEdgeData | undefined;
  const method = edgeData?.method ?? "unknown";
  const stroke = METHOD_COLORS[method] ?? DEFAULT_STROKE;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{ stroke, strokeWidth: 1.5, opacity: 0.7 }}
      />
      {method !== "unknown" && (
        <foreignObject
          x={labelX - 20}
          y={labelY - 8}
          width={40}
          height={16}
          className="pointer-events-none"
        >
          <div className="flex items-center justify-center">
            <span
              className="px-1.5 py-0.5 text-[8px] font-medium rounded bg-surface-alt border border-edge text-muted"
              style={{ color: stroke }}
            >
              {method}
            </span>
          </div>
        </foreignObject>
      )}
    </>
  );
});
