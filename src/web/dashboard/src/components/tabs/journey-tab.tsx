import { useState, useCallback, useEffect, useMemo, memo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { apiClient } from "@/lib/api-client";
import type { JourneyMap, JourneyMapFull, JourneyScreen, JourneyEdge as JEdge, JourneyField } from "@/lib/types";

// ── Constants ────────────────────────────────────────────

const SCREEN_TYPE_COLORS: Record<string, string> = {
  landing: "#2196f3",
  form: "#ff9800",
  selection: "#4caf50",
  listing: "#9c27b0",
  comparison: "#e91e63",
  detail: "#00bcd4",
  map: "#009688",
  calculator: "#ffc107",
  confirmation: "#3f51b5",
  success: "#4caf50",
  dashboard: "#607d8b",
  page: "#757575",
};

const EDGE_TYPE_COLORS: Record<string, string> = {
  navigation: "#6c757d",
  form_submit: "#2196f3",
  redirect: "#ff9800",
  back: "#9e9e9e",
};

const NODE_WIDTH = 280;
const NODE_HEIGHT = 220;

// ── Journey Screen Node ──────────────────────────────────

interface JourneyNodeData {
  screen: JourneyScreen;
  screenshotUrl?: string;
  onSelect: (screen: JourneyScreen) => void;
  [key: string]: unknown;
}

const JourneyScreenNode = memo(function JourneyScreenNode({ data }: NodeProps & { data: JourneyNodeData }) {
  const { screen, screenshotUrl, onSelect } = data;
  const typeColor = SCREEN_TYPE_COLORS[screen.screenType] ?? "#757575";

  return (
    <>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2" />
      <div
        className="bg-surface border-2 rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer overflow-hidden"
        style={{ borderColor: typeColor, width: NODE_WIDTH }}
        onClick={() => onSelect(screen)}
      >
        {/* Screenshot preview */}
        <div className="relative w-full bg-surface-elevated" style={{ height: 140 }}>
          {screenshotUrl ? (
            <img
              src={screenshotUrl}
              alt={screen.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted text-xs">
              No screenshot
            </div>
          )}
          <span
            className="absolute top-1.5 left-1.5 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded text-white"
            style={{ background: typeColor }}
          >
            {screen.screenType}
          </span>
        </div>
        {/* Title & info */}
        <div className="p-2">
          <div className="text-sm font-semibold leading-tight line-clamp-1">{screen.title}</div>
          {screen.url && (
            <div className="text-[10px] text-muted truncate mt-0.5">
              {screen.url}
            </div>
          )}
          <div className="flex items-center gap-2 mt-1">
            {screen.fields && screen.fields.length > 0 && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-surface-elevated text-muted">
                {screen.fields.length} fields
              </span>
            )}
            {screen.ctas && screen.ctas.length > 0 && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-surface-elevated text-muted">
                {screen.ctas.length} CTAs
              </span>
            )}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2" />
    </>
  );
});

const nodeTypes = { journeyScreen: JourneyScreenNode };

// ── Layout utility ───────────────────────────────────────

function layoutScreens(
  screens: JourneyScreen[],
  edges: JEdge[],
): Array<Node<JourneyNodeData>> {
  // Simple layered layout based on topological ordering
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const s of screens) {
    adjacency.set(s.id, []);
    inDegree.set(s.id, 0);
  }
  for (const e of edges) {
    adjacency.get(e.from)?.push(e.to);
    inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
  }

  // BFS layers
  const layers: string[][] = [];
  const queue: string[] = [];
  const visited = new Set<string>();

  for (const s of screens) {
    if ((inDegree.get(s.id) ?? 0) === 0) {
      queue.push(s.id);
    }
  }

  while (queue.length > 0) {
    const layer = [...queue];
    layers.push(layer);
    queue.length = 0;
    for (const id of layer) {
      visited.add(id);
      for (const next of adjacency.get(id) ?? []) {
        if (!visited.has(next)) {
          const remaining = (inDegree.get(next) ?? 1) - 1;
          inDegree.set(next, remaining);
          if (remaining <= 0 && !visited.has(next)) {
            queue.push(next);
          }
        }
      }
    }
  }

  // Place unvisited nodes in the last layer
  for (const s of screens) {
    if (!visited.has(s.id)) {
      if (layers.length === 0) layers.push([]);
      layers[layers.length - 1].push(s.id);
    }
  }

  // Position nodes
  const screenMap = new Map(screens.map((s) => [s.id, s]));
  const GAP_X = NODE_WIDTH + 60;
  const GAP_Y = NODE_HEIGHT + 80;
  const nodes: Array<Node<JourneyNodeData>> = [];

  for (let y = 0; y < layers.length; y++) {
    const layer = layers[y];
    const totalWidth = layer.length * GAP_X;
    const startX = -totalWidth / 2 + GAP_X / 2;

    for (let x = 0; x < layer.length; x++) {
      const screen = screenMap.get(layer[x]);
      if (!screen) continue;
      nodes.push({
        id: screen.id,
        type: "journeyScreen",
        position: {
          x: screen.positionX !== 0 ? screen.positionX : startX + x * GAP_X,
          y: screen.positionY !== 0 ? screen.positionY : y * GAP_Y,
        },
        data: {
          screen,
          screenshotUrl: screen.screenshot
            ? `/api/v1/journey/screenshots/_/${screen.screenshot}`
            : undefined,
          onSelect: () => {},
        },
      });
    }
  }

  return nodes;
}

function toFlowEdges(edges: JEdge[]): Array<Edge> {
  return edges.map((e) => ({
    id: e.id,
    source: e.from,
    target: e.to,
    label: e.label ?? "",
    type: "smoothstep",
    animated: e.type === "form_submit",
    style: { stroke: EDGE_TYPE_COLORS[e.type] ?? "#6c757d", strokeWidth: 2 },
    labelStyle: { fontSize: 10, fill: "var(--color-text-muted)" },
    labelBgStyle: { fill: "var(--color-bg)", fillOpacity: 0.8 },
  }));
}

// ── Screen Detail Panel ──────────────────────────────────

function ScreenDetailPanel({
  screen,
  onClose,
}: {
  screen: JourneyScreen;
  onClose: () => void;
}): React.JSX.Element {
  const typeColor = SCREEN_TYPE_COLORS[screen.screenType] ?? "#757575";

  return (
    <div className="w-80 h-full border-l border-edge bg-surface overflow-y-auto p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-bold uppercase px-2 py-0.5 rounded text-white"
          style={{ background: typeColor }}
        >
          {screen.screenType}
        </span>
        <button onClick={onClose} className="text-muted hover:text-foreground">
          X
        </button>
      </div>

      <h3 className="text-lg font-semibold">{screen.title}</h3>

      {screen.url && (
        <div className="text-xs text-muted break-all">{screen.url}</div>
      )}

      {screen.description && (
        <p className="text-sm text-muted">{screen.description}</p>
      )}

      {screen.screenshot && (
        <div className="rounded-lg overflow-hidden border border-edge">
          <img
            src={`/api/v1/journey/screenshots/_/${screen.screenshot}`}
            alt={screen.title}
            className="w-full"
          />
        </div>
      )}

      {screen.fields && screen.fields.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase text-muted mb-1.5">
            Form Fields ({screen.fields.length})
          </h4>
          <div className="space-y-1.5">
            {screen.fields.map((field: JourneyField) => (
              <div
                key={field.name}
                className="flex items-center gap-2 text-sm bg-surface-alt rounded px-2 py-1"
              >
                <span className="font-mono text-xs text-accent">{field.type}</span>
                <span>{field.label ?? field.name}</span>
                {field.required && (
                  <span className="text-[9px] text-red-400 font-bold">*</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {screen.ctas && screen.ctas.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase text-muted mb-1.5">
            CTAs ({screen.ctas.length})
          </h4>
          <div className="flex flex-wrap gap-1">
            {screen.ctas.map((cta) => (
              <span
                key={cta}
                className="text-xs px-2 py-0.5 rounded-full bg-accent text-white"
              >
                {cta}
              </span>
            ))}
          </div>
        </div>
      )}

      {screen.metadata && Object.keys(screen.metadata).length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase text-muted mb-1.5">
            Metadata
          </h4>
          <pre className="text-[10px] bg-surface-alt rounded p-2 overflow-x-auto">
            {JSON.stringify(screen.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Map Selector ─────────────────────────────────────────

function MapSelector({
  maps,
  selectedId,
  onSelect,
  onImport,
  loading,
}: {
  maps: JourneyMap[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onImport: () => void;
  loading: boolean;
}): React.JSX.Element {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted">
        Loading journey maps...
      </div>
    );
  }

  if (maps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted">
        <div className="text-5xl">&#128506;</div>
        <p className="text-sm font-medium">No journey maps yet</p>
        <p className="text-xs text-center max-w-xs">
          Import a journey map JSON file or capture website screens to create a journey flow visualization.
        </p>
        <button
          onClick={onImport}
          className="px-4 py-2 rounded-lg bg-accent text-white text-sm hover:opacity-90 transition-opacity"
        >
          Import Journey Map
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 p-2 border-b border-edge bg-surface-alt">
      <label className="text-xs font-medium text-muted">Journey:</label>
      <select
        value={selectedId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
        className="text-sm bg-surface border border-edge rounded px-2 py-1 flex-1"
      >
        {maps.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <button
        onClick={onImport}
        className="text-xs px-2 py-1 rounded bg-surface-elevated hover:bg-edge text-muted"
      >
        + Import
      </button>
    </div>
  );
}

// ── Variant Selector ─────────────────────────────────────

function VariantSelector({
  variants,
  activeVariant,
  onSelect,
}: {
  variants: Array<{ id: string; name: string; description?: string; path: string[] }>;
  activeVariant: string | null;
  onSelect: (id: string | null) => void;
}): React.JSX.Element | null {
  if (variants.length === 0) return null;

  return (
    <div className="flex items-center gap-2 p-2 border-b border-edge">
      <label className="text-xs font-medium text-muted">Variant:</label>
      <button
        onClick={() => onSelect(null)}
        className={`text-xs px-2 py-1 rounded ${
          activeVariant === null
            ? "bg-accent text-white"
            : "bg-surface-elevated text-muted"
        }`}
      >
        All
      </button>
      {variants.map((v) => (
        <button
          key={v.id}
          onClick={() => onSelect(v.id)}
          className={`text-xs px-2 py-1 rounded ${
            activeVariant === v.id
              ? "bg-accent text-white"
              : "bg-surface-elevated text-muted"
          }`}
          title={v.description}
        >
          {v.name}
        </button>
      ))}
    </div>
  );
}

// ── Import Modal ─────────────────────────────────────────

function ImportJourneyModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}): React.JSX.Element | null {
  const [json, setJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleImport = async (): Promise<void> => {
    setError(null);
    setLoading(true);
    try {
      const data = JSON.parse(json);
      await apiClient.importJourneyMap(data);
      onImported();
      onClose();
      setJson("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setJson(reader.result as string);
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Import Journey Map</h2>

        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">Upload JSON file</label>
          <input
            type="file"
            accept=".json"
            onChange={handleFile}
            className="text-sm"
          />
        </div>

        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">Or paste JSON</label>
          <textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            rows={10}
            className="w-full text-xs font-mono bg-surface-alt border border-edge rounded p-2"
            placeholder='{"journey": {"name": "..."}, "screens": [...], "edges": [...]}'
          />
        </div>

        {error && (
          <div className="text-sm text-danger mb-3">{error}</div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-lg border border-edge hover:bg-surface-alt"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!json.trim() || loading}
            className="px-3 py-1.5 text-sm rounded-lg bg-accent text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Importing..." : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Journey Tab ─────────────────────────────────────

const proOptions = { hideAttribution: true };

export function JourneyTab(): React.JSX.Element {
  const [maps, setMaps] = useState<JourneyMap[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [journeyData, setJourneyData] = useState<JourneyMapFull | null>(null);
  const [selectedScreen, setSelectedScreen] = useState<JourneyScreen | null>(null);
  const [activeVariant, setActiveVariant] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<JourneyNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Load maps on mount
  const loadMaps = useCallback(async () => {
    try {
      const result = await apiClient.getJourneyMaps();
      setMaps(result.maps);
      if (result.maps.length > 0 && !selectedMapId) {
        setSelectedMapId(result.maps[0].id);
      }
    } catch {
      // Map table may not exist yet (migration pending)
      setMaps([]);
    } finally {
      setLoading(false);
    }
  }, [selectedMapId]);

  // Load selected map
  const loadMap = useCallback(async (mapId: string) => {
    try {
      const data = await apiClient.getJourneyMap(mapId);
      setJourneyData(data);
    } catch {
      setJourneyData(null);
    }
  }, []);

  useEffect(() => {
    void loadMaps();
  }, [loadMaps]);

  useEffect(() => {
    if (selectedMapId) {
      void loadMap(selectedMapId);
    }
  }, [selectedMapId, loadMap]);

  // Filter by variant
  const filteredData = useMemo(() => {
    if (!journeyData) return null;
    if (!activeVariant) return journeyData;

    const variant = journeyData.variants.find((v) => v.id === activeVariant);
    if (!variant) return journeyData;

    const pathSet = new Set(variant.path);
    return {
      ...journeyData,
      screens: journeyData.screens.filter((s) => pathSet.has(s.id)),
      edges: journeyData.edges.filter((e) => pathSet.has(e.from) && pathSet.has(e.to)),
    };
  }, [journeyData, activeVariant]);

  // Update React Flow when data changes
  useEffect(() => {
    if (!filteredData) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const flowNodes = layoutScreens(filteredData.screens, filteredData.edges);
    // Attach onSelect handler
    const nodesWithHandler = flowNodes.map((n) => ({
      ...n,
      data: { ...n.data, onSelect: setSelectedScreen },
    }));
    setNodes(nodesWithHandler);
    setEdges(toFlowEdges(filteredData.edges));
  }, [filteredData, setNodes, setEdges]);

  const handleImported = useCallback(() => {
    setLoading(true);
    void loadMaps();
  }, [loadMaps]);

  if (loading || maps.length === 0) {
    return (
      <>
        <MapSelector
          maps={maps}
          selectedId={selectedMapId}
          onSelect={setSelectedMapId}
          onImport={() => setImportOpen(true)}
          loading={loading}
        />
        <ImportJourneyModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onImported={handleImported}
        />
      </>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <MapSelector
        maps={maps}
        selectedId={selectedMapId}
        onSelect={setSelectedMapId}
        onImport={() => setImportOpen(true)}
        loading={false}
      />
      {journeyData && (
        <VariantSelector
          variants={journeyData.variants}
          activeVariant={activeVariant}
          onSelect={setActiveVariant}
        />
      )}

      <div className="flex-1 flex min-h-0">
        {/* Graph canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            proOptions={proOptions}
            fitView
            minZoom={0.1}
            maxZoom={3}
            defaultViewport={{ x: 0, y: 0, zoom: 0.7 }}
          >
            <Background color="var(--color-border)" gap={20} />
            <Controls position="bottom-left" />
            <MiniMap
              nodeColor={(node) => {
                const data = node.data as JourneyNodeData;
                return SCREEN_TYPE_COLORS[data.screen.screenType] ?? "#757575";
              }}
              maskColor="rgba(0,0,0,0.1)"
              position="bottom-right"
            />
          </ReactFlow>
        </div>

        {/* Detail panel */}
        {selectedScreen && (
          <ScreenDetailPanel
            screen={selectedScreen}
            onClose={() => setSelectedScreen(null)}
          />
        )}
      </div>

      <ImportJourneyModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={handleImported}
      />
    </div>
  );
}
