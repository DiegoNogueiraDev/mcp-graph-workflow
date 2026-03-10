import { useState, useCallback, useMemo, useEffect, useDeferredValue, useRef } from "react";
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

import type { GraphDocument, GraphNode, NodeStatus, NodeType } from "@/lib/types";
import { filterTopLevelNodes } from "@/lib/graph-filters";
import { WorkflowNode } from "./workflow-node";
import { WorkflowEdge } from "./workflow-edge";
import { FilterPanel } from "./filter-panel";
import { NodeDetailPanel } from "./node-detail-panel";
import { NodeTable } from "./node-table";
import { toFlowNodes, toFlowEdges, applyDagreLayout, shouldSkipLayout, type WorkflowNodeData, type WorkflowEdgeData } from "./graph-utils";

const nodeTypes = { workflowNode: WorkflowNode };
const edgeTypes = { workflowEdge: WorkflowEdge };
const proOptions = { hideAttribution: true };

interface WorkflowGraphProps {
  graph: GraphDocument;
}

export function WorkflowGraph({ graph }: WorkflowGraphProps): React.JSX.Element {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<WorkflowNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<WorkflowEdgeData>>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [direction, setDirection] = useState<"TB" | "LR">("TB");
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(new Set());
  const [filterTypes, setFilterTypes] = useState<Set<string>>(new Set());
  const [showFullGraph, setShowFullGraph] = useState(false);

  // Defer filter values so checkbox updates are visually immediate
  const deferredStatuses = useDeferredValue(filterStatuses);
  const deferredTypes = useDeferredValue(filterTypes);
  const deferredDirection = useDeferredValue(direction);

  // Track previous layout node IDs to skip redundant Dagre runs
  const prevLayoutIdsRef = useRef<string[] | null>(null);

  const applyLayout = useCallback(
    (statuses: Set<string>, types: Set<string>, dir: "TB" | "LR") => {
      const baseNodes = filterTopLevelNodes(graph.nodes, showFullGraph);
      const filters = { statuses, types };
      const flowNodes = toFlowNodes(baseNodes, filters);
      const nextIds = flowNodes.map((n) => n.id);

      // Skip Dagre if visible node IDs haven't changed
      if (shouldSkipLayout(prevLayoutIdsRef.current, nextIds) && dir === deferredDirection) {
        return;
      }
      prevLayoutIdsRef.current = nextIds;

      const visibleIds = new Set(nextIds);
      const flowEdges = toFlowEdges(graph.edges, visibleIds);
      const layout = applyDagreLayout(flowNodes, flowEdges, dir);
      setNodes(layout.nodes);
      setEdges(layout.edges);
    },
    [graph, setNodes, setEdges, deferredDirection, showFullGraph],
  );

  useEffect(() => {
    applyLayout(deferredStatuses, deferredTypes, deferredDirection);
  }, [graph, applyLayout, deferredStatuses, deferredTypes, deferredDirection]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<WorkflowNodeData>) => {
      setSelectedNode(node.data.sourceNode);
    },
    [],
  );

  const handleTableNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
  }, []);

  const toggleStatus = useCallback((status: NodeStatus) => {
    setFilterStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }, []);

  const toggleType = useCallback((type: NodeType) => {
    setFilterTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilterStatuses(new Set());
    setFilterTypes(new Set());
  }, []);

  const visibleNodes = useMemo(() => {
    const base = filterTopLevelNodes(graph.nodes, showFullGraph);
    return base.filter((n) => {
      if (filterStatuses.size && !filterStatuses.has(n.status)) return false;
      if (filterTypes.size && !filterTypes.has(n.type)) return false;
      return true;
    });
  }, [graph.nodes, filterStatuses, filterTypes, showFullGraph]);

  return (
    <div className="flex flex-col h-full">
      <FilterPanel
        statuses={filterStatuses}
        types={filterTypes}
        direction={direction}
        onStatusToggle={toggleStatus}
        onTypeToggle={toggleType}
        onDirectionChange={setDirection}
        onClear={clearFilters}
        showFullGraph={showFullGraph}
        totalNodeCount={graph.nodes.length}
        onShowFullGraphChange={setShowFullGraph}
      />

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 relative">
          {graph.nodes.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
              <div className="text-center">
                <p className="text-lg mb-2">No nodes in graph</p>
                <p className="text-sm">Import a PRD to get started</p>
              </div>
            </div>
          ) : (
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
          )}
        </div>

        {selectedNode && (
          <NodeDetailPanel
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>

      <NodeTable nodes={visibleNodes} onNodeClick={handleTableNodeClick} />
    </div>
  );
}
