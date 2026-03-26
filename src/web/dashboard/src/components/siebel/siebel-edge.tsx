/**
 * SiebelEdge — Custom React Flow edge with relation type label.
 */

import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import type { SiebelEdgeData } from "./siebel-graph-utils";

type SiebelEdgeProps = EdgeProps & { data?: SiebelEdgeData };

export const SiebelEdge = memo(function SiebelEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  data,
}: SiebelEdgeProps) {
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
      <BaseEdge id={id} path={edgePath} style={style} />
      {data?.relationType && (
        <EdgeLabelRenderer>
          <div
            className="absolute text-[9px] px-1 py-0.5 rounded bg-surface border border-edge text-muted pointer-events-none"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {data.relationType.replace(/_/g, " ")}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});
