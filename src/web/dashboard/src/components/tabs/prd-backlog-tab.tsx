import { useState, useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { GraphDocument, GraphNode } from "@/lib/types";
import { STATUS_COLORS } from "@/lib/constants";
import { WorkflowNode } from "@/components/graph/workflow-node";
import { WorkflowEdge } from "@/components/graph/workflow-edge";
import { NodeDetailPanel } from "@/components/graph/node-detail-panel";
import { toFlowNodes, toFlowEdges, applyDagreLayout, type WorkflowNodeData, type WorkflowEdgeData } from "@/components/graph/graph-utils";
import { BacklogList } from "@/components/backlog/backlog-list";
import { useEffect } from "react";

const nodeTypes = { workflowNode: WorkflowNode };
const edgeTypes = { workflowEdge: WorkflowEdge };
const proOptions = { hideAttribution: true };

interface PrdBacklogTabProps {
  graph: GraphDocument;
}

const TOP_LEVEL_TYPES = new Set(["epic", "milestone", "requirement", "constraint"]);

export function PrdBacklogTab({ graph }: PrdBacklogTabProps): React.JSX.Element {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<WorkflowNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<WorkflowEdgeData>>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [showFullGraph, setShowFullGraph] = useState(false);

  useEffect(() => {
    // Show only top-level nodes by default to avoid DOM overload
    const filteredNodes = showFullGraph
      ? graph.nodes
      : graph.nodes.filter((n) => TOP_LEVEL_TYPES.has(n.type) || !n.parentId);
    const flowNodes = toFlowNodes(filteredNodes);
    const visibleIds = new Set(flowNodes.map((n) => n.id));
    const flowEdges = toFlowEdges(graph.edges, visibleIds);
    const layout = applyDagreLayout(flowNodes, flowEdges, "TB");
    setNodes(layout.nodes);
    setEdges(layout.edges);
  }, [graph, setNodes, setEdges, showFullGraph]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<WorkflowNodeData>) => {
      setSelectedNode(node.data.sourceNode);
    },
    [],
  );

  const handleBacklogClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
  }, []);

  // Progress stats
  const stats = useMemo(() => {
    const total = graph.nodes.length;
    const done = graph.nodes.filter((n) => n.status === "done").length;
    const inProgress = graph.nodes.filter((n) => n.status === "in_progress").length;
    const blocked = graph.nodes.filter((n) => n.status === "blocked").length;
    return { total, done, inProgress, blocked, pctDone: total ? Math.round((done / total) * 100) : 0 };
  }, [graph.nodes]);

  return (
    <div className="flex h-full">
      {/* Left: Workflow diagram */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="px-3 py-1.5 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] flex items-center gap-2 text-xs">
          <label className="flex items-center gap-1 cursor-pointer text-[var(--color-text-muted)]">
            <input
              type="checkbox"
              checked={showFullGraph}
              onChange={() => setShowFullGraph((v) => !v)}
              className="rounded"
            />
            Show all nodes ({graph.nodes.length})
          </label>
          {!showFullGraph && (
            <span className="text-[var(--color-text-muted)]">
              Showing {nodes.length} top-level nodes
            </span>
          )}
        </div>
        {graph.nodes.length > 0 ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesDraggable={false}
            nodesConnectable={false}
            fitView
            minZoom={0.1}
            maxZoom={2}
            proOptions={proOptions}
          >
            <Background gap={16} size={1} />
            <Controls showInteractive={false} />
          </ReactFlow>
        ) : (
          <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
            Import a PRD to see the workflow
          </div>
        )}
      </div>

      {/* Right: Backlog list */}
      <div className="w-96 border-l border-[var(--color-border)] flex flex-col overflow-hidden">
        {/* Progress bar */}
        <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <div className="flex justify-between text-sm mb-1">
            <span>{stats.done}/{stats.total} done ({stats.pctDone}%)</span>
            <span className="text-[var(--color-text-muted)]">
              {stats.inProgress} in progress, {stats.blocked} blocked
            </span>
          </div>
          <div className="h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden flex">
            <div
              className="h-full transition-all"
              style={{ width: `${stats.pctDone}%`, background: STATUS_COLORS.done }}
            />
            <div
              className="h-full transition-all"
              style={{
                width: `${stats.total ? Math.round((stats.inProgress / stats.total) * 100) : 0}%`,
                background: STATUS_COLORS.in_progress,
              }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <BacklogList graph={graph} onNodeClick={handleBacklogClick} />
        </div>
      </div>

      {/* Detail panel */}
      {selectedNode && (
        <NodeDetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
      )}
    </div>
  );
}
