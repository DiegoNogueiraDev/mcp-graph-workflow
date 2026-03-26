/**
 * GraphSection — SIF dependency graph visualization using React Flow.
 * Shows SiebelObjects as color-coded nodes, dependencies as edges.
 * Includes filter bar, detail panel, and impact analysis overlay.
 */

import { useState, useCallback, useMemo, useEffect, useDeferredValue } from "react";
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

import { SiebelNode } from "./siebel-node";
import { SiebelEdge } from "./siebel-edge";
import { SiebelDetailPanel } from "./siebel-detail-panel";
import {
  toSiebelFlowNodes,
  toSiebelFlowEdges,
  applySiebelDagreLayout,
  computeImpact,
  type SiebelObjectData,
  type SiebelDependencyData,
  type SiebelNodeData,
  type SiebelEdgeData,
} from "./siebel-graph-utils";
import { SIEBEL_TYPE_COLORS } from "@/lib/constants";

const nodeTypes = { siebelNode: SiebelNode };
const edgeTypes = { siebelEdge: SiebelEdge };
const proOptions = { hideAttribution: true };

interface GraphSectionProps {
  objects: SiebelObjectData[];
  dependencies: SiebelDependencyData[];
}

export function GraphSection({ objects, dependencies }: GraphSectionProps): React.JSX.Element {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<SiebelNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<SiebelEdgeData>>([]);
  const [selectedObject, setSelectedObject] = useState<SiebelObjectData | null>(null);
  const [direction, setDirection] = useState<"TB" | "LR">("TB");
  const [filterTypes, setFilterTypes] = useState<Set<string>>(new Set());
  const [showInactive, setShowInactive] = useState(false);
  const [impactTarget, setImpactTarget] = useState<{ type: string; name: string } | null>(null);

  const deferredFilterTypes = useDeferredValue(filterTypes);

  // Get unique object types
  const allTypes = useMemo(() => {
    const types = new Set<string>();
    for (const obj of objects) types.add(obj.type);
    return [...types].sort();
  }, [objects]);

  // Compute impact if target is set
  const impactedObjects = useMemo(() => {
    if (!impactTarget) return undefined;
    return computeImpact(dependencies, impactTarget.type, impactTarget.name);
  }, [dependencies, impactTarget]);

  // Convert to React Flow nodes/edges and apply layout
  useEffect(() => {
    if (objects.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const filters = {
      types: deferredFilterTypes,
      showInactive,
    };

    const flowNodes = toSiebelFlowNodes(objects, filters, impactedObjects);
    const visibleIds = new Set(flowNodes.map((n) => n.id));
    const flowEdges = toSiebelFlowEdges(dependencies, visibleIds);
    const { nodes: layoutedNodes, edges: layoutedEdges } = applySiebelDagreLayout(
      flowNodes,
      flowEdges,
      direction,
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [objects, dependencies, deferredFilterTypes, showInactive, direction, impactedObjects, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node<SiebelNodeData>) => {
      setSelectedObject(node.data.sourceObject);
    },
    [],
  );

  const handlePaneClick = useCallback(() => {
    setSelectedObject(null);
  }, []);

  const toggleType = useCallback((type: string) => {
    setFilterTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const handleShowImpact = useCallback((type: string, name: string) => {
    setImpactTarget({ type, name });
  }, []);

  const handleClearImpact = useCallback(() => {
    setImpactTarget(null);
  }, []);

  if (objects.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <svg
            className="w-12 h-12 mx-auto text-muted"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z"
            />
          </svg>
          <div>
            <p className="text-sm font-medium text-foreground">SIF Dependency Graph</p>
            <p className="text-xs text-muted mt-1">
              Upload a .sif file to visualize Siebel object relationships
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Filter bar */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-edge bg-surface-alt">
        {/* Type filters */}
        <div className="flex flex-wrap gap-1 flex-1">
          {allTypes.map((type) => {
            const color = SIEBEL_TYPE_COLORS[type] || "#6b7280";
            const active = filterTypes.size === 0 || filterTypes.has(type);
            return (
              <button
                key={type}
                onClick={() => toggleType(type)}
                aria-label={`Filter ${type}`}
                aria-pressed={filterTypes.has(type)}
                className="px-2 py-0.5 text-[10px] rounded-md border transition-colors cursor-pointer"
                style={{
                  borderColor: active ? color : "var(--color-border)",
                  backgroundColor: active ? `${color}15` : "transparent",
                  color: active ? color : "var(--color-text-muted)",
                  opacity: active ? 1 : 0.5,
                }}
              >
                {type.replace(/_/g, " ")}
              </button>
            );
          })}
        </div>

        {/* Direction toggle */}
        <div className="flex items-center gap-1 border-l border-edge pl-3">
          <button
            onClick={() => setDirection("TB")}
            aria-label="Top to bottom layout"
            className={`px-2 py-0.5 text-[10px] rounded cursor-pointer transition-colors ${
              direction === "TB" ? "bg-accent/10 text-accent" : "text-muted"
            }`}
          >
            TB
          </button>
          <button
            onClick={() => setDirection("LR")}
            aria-label="Left to right layout"
            className={`px-2 py-0.5 text-[10px] rounded cursor-pointer transition-colors ${
              direction === "LR" ? "bg-accent/10 text-accent" : "text-muted"
            }`}
          >
            LR
          </button>
        </div>

        {/* Show inactive toggle */}
        <label className="flex items-center gap-1.5 text-[10px] text-muted cursor-pointer border-l border-edge pl-3">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded"
          />
          Inactive
        </label>

        {/* Impact indicator */}
        {impactTarget && (
          <div className="flex items-center gap-1.5 border-l border-edge pl-3">
            <span className="text-[10px] text-orange-400">
              Impact: {impactTarget.name}
            </span>
            <button
              onClick={handleClearImpact}
              aria-label="Clear impact analysis"
              className="text-[10px] px-1.5 py-0.5 rounded bg-surface text-muted hover:text-foreground cursor-pointer transition-colors"
            >
              Clear
            </button>
          </div>
        )}

        {/* Node count */}
        <span className="text-[10px] text-muted">
          {nodes.length} nodes
        </span>
      </div>

      {/* Graph canvas + detail panel */}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            proOptions={proOptions}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.1}
            maxZoom={2}
          >
            <Background gap={16} size={1} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        {selectedObject && (
          <SiebelDetailPanel
            object={selectedObject}
            dependencies={dependencies}
            onClose={() => setSelectedObject(null)}
            onShowImpact={handleShowImpact}
            impactTarget={impactTarget}
          />
        )}
      </div>
    </div>
  );
}
