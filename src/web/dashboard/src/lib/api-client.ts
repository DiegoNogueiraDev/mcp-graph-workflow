import type { GraphDocument, GraphEdge, GraphNode, GraphStats, IntegrationStatus, GitNexusStatus, SerenaMemory, AnalyzeResult, ServeResult } from "./types";

const BASE = "/api/v1";

class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  if (res.status === 204) return null as T;

  const body = await res.json();
  if (!res.ok) {
    throw new ApiError(
      body.error || `HTTP ${res.status}`,
      res.status,
      body.details,
    );
  }
  return body as T;
}

export const apiClient = {
  request,

  // Project
  getProject: () => request<{ name: string }>("/project"),
  initProject: (name: string) =>
    request("/project/init", { method: "POST", body: JSON.stringify({ name }) }),

  // Nodes
  getNodes: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<GraphNode[]>(`/nodes${qs ? "?" + qs : ""}`);
  },
  getNode: (id: string) => request<GraphNode>(`/nodes/${id}`),
  createNode: (data: Partial<GraphNode>) =>
    request<GraphNode>("/nodes", { method: "POST", body: JSON.stringify(data) }),
  updateNode: (id: string, data: Partial<GraphNode>) =>
    request<GraphNode>(`/nodes/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteNode: (id: string) =>
    request<null>(`/nodes/${id}`, { method: "DELETE" }),

  // Edges
  getEdges: () => request<GraphEdge[]>("/edges"),
  createEdge: (data: Partial<GraphEdge>) =>
    request<GraphEdge>("/edges", { method: "POST", body: JSON.stringify(data) }),
  deleteEdge: (id: string) =>
    request<null>(`/edges/${id}`, { method: "DELETE" }),

  // Stats
  getStats: () => request<GraphStats>("/stats"),

  // Search
  search: (q: string, limit?: number) => {
    const params: Record<string, string> = { q };
    if (limit) params.limit = String(limit);
    return request<GraphNode[]>(`/search?${new URLSearchParams(params)}`);
  },

  // Graph
  getGraph: () => request<GraphDocument>("/graph"),

  // Import (multipart)
  importFile: async (file: File, force = false) => {
    const formData = new FormData();
    formData.append("file", file);
    if (force) formData.append("force", "true");

    const res = await fetch(`${BASE}/import`, { method: "POST", body: formData });
    const body = await res.json();
    if (!res.ok) {
      throw new ApiError(body.error || `HTTP ${res.status}`, res.status);
    }
    return body as { ok: boolean; nodesCreated: number; edgesCreated: number; sourceFile: string };
  },

  // Integrations
  getIntegrationStatus: () => request<IntegrationStatus>("/integrations/status"),

  // Insights
  getBottlenecks: () => request("/insights/bottlenecks"),
  getRecommendations: () => request<{ recommendations: Array<{ phase: string; skill: string; reason: string }> }>("/insights/recommendations"),
  getMetrics: () => request("/insights/metrics"),
  getSkills: () => request<Array<{ name: string; category: string; description: string }>>("/skills"),

  // Capture
  captureUrl: (url: string, selector?: string, waitForSelector?: string) =>
    request("/capture", {
      method: "POST",
      body: JSON.stringify({ url, selector, waitForSelector }),
    }),

  // GitNexus Code Graph
  getGitNexusStatus: () => request<GitNexusStatus>("/gitnexus/status"),
  queryCodeGraph: (query: string) =>
    request("/gitnexus/query", {
      method: "POST",
      body: JSON.stringify({ query }),
    }),
  getSymbolContext: (symbol: string) =>
    request("/gitnexus/context", {
      method: "POST",
      body: JSON.stringify({ symbol }),
    }),
  getSymbolImpact: (symbol: string) =>
    request("/gitnexus/impact", {
      method: "POST",
      body: JSON.stringify({ symbol }),
    }),

  // GitNexus on-demand actions
  triggerAnalyze: () =>
    request<AnalyzeResult>("/gitnexus/analyze", { method: "POST" }),
  triggerServe: () =>
    request<ServeResult>("/gitnexus/serve", { method: "POST" }),

  // Serena Memories
  getSerenaMemories: () => request<SerenaMemory[]>("/integrations/serena/memories"),
};
