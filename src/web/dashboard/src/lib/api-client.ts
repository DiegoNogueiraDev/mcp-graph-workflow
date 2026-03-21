import type { GraphDocument, GraphEdge, GraphNode, GraphStats, IntegrationStatus, CodeGraphStatus, ProjectMemory, ReindexResult, LogEntry, FolderInfo, OpenFolderResult, BrowseResult, CodeGraphData, ImpactResult, KnowledgeStats, Skill, CustomSkill, CustomSkillInput, ContextBudget, JourneyMap, JourneyMapFull } from "./types";

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
  getProject: () => request<{ name: string; id: string }>("/project"),
  initProject: (name: string) =>
    request("/project/init", { method: "POST", body: JSON.stringify({ name }) }),
  getProjects: () =>
    request<{ total: number; projects: Array<{ id: string; name: string; createdAt: string; updatedAt: string }> }>("/project/list"),
  getActiveProject: () =>
    request<{ id: string; name: string; createdAt: string; updatedAt: string }>("/project/active"),
  activateProject: (id: string) =>
    request<{ ok: boolean; project: { id: string; name: string } }>(`/project/${id}/activate`, { method: "POST" }),

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
  getSkills: () => request<{ skills: Skill[]; totalTokens: number }>("/skills"),
  getSkillPreferences: () => request<{ preferences: Record<string, boolean> }>("/skills/preferences"),
  toggleSkill: (name: string, enabled: boolean) =>
    request<{ ok: boolean; name: string; enabled: boolean }>(`/skills/${encodeURIComponent(name)}/preference`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    }),
  createCustomSkill: (data: CustomSkillInput) =>
    request<CustomSkill>("/skills/custom", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCustomSkill: (id: string, data: Partial<CustomSkillInput>) =>
    request<CustomSkill>(`/skills/custom/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteCustomSkill: (id: string) =>
    request<null>(`/skills/custom/${id}`, { method: "DELETE" }),
  getContextBudget: () => request<ContextBudget>("/context/budget"),

  // Knowledge
  getKnowledgeStats: () => request<KnowledgeStats>("/knowledge/stats/summary"),

  // Capture
  captureUrl: (url: string, selector?: string, waitForSelector?: string) =>
    request("/capture", {
      method: "POST",
      body: JSON.stringify({ url, selector, waitForSelector }),
    }),

  // Code Graph (native Code Intelligence engine)
  getCodeGraphStatus: () => request<CodeGraphStatus>("/code-graph/status"),
  getSymbolContext: (symbol: string) =>
    request<CodeGraphData>("/code-graph/context", {
      method: "POST",
      body: JSON.stringify({ symbol }),
    }),
  getSymbolImpact: (symbol: string) =>
    request<ImpactResult>("/code-graph/impact", {
      method: "POST",
      body: JSON.stringify({ symbol }),
    }),
  searchCodeGraph: (query: string, limit?: number) =>
    request("/code-graph/search", {
      method: "POST",
      body: JSON.stringify({ query, limit }),
    }),
  getFullCodeGraph: () =>
    request<CodeGraphData>("/code-graph/full"),
  triggerReindex: () =>
    request<ReindexResult>("/code-graph/reindex", { method: "POST" }),

  /** @deprecated Use getCodeGraphStatus instead */
  getGitNexusStatus: () => request<CodeGraphStatus>("/code-graph/status"),

  // Memories
  getMemories: () => request<ProjectMemory[]>("/integrations/memories"),
  /** @deprecated Use getMemories instead */
  getSerenaMemories: () => request<ProjectMemory[]>("/integrations/memories"),

  // Folder
  getFolder: () => request<FolderInfo>("/folder"),
  openFolder: (path: string) =>
    request<OpenFolderResult>("/folder/open", {
      method: "POST",
      body: JSON.stringify({ path }),
    }),
  browseFolder: (path: string) =>
    request<BrowseResult>(`/folder/browse?path=${encodeURIComponent(path)}`),

  // Logs
  getLogs: (params?: { level?: string; since?: number; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.level) qs.set("level", params.level);
    if (params?.since !== undefined) qs.set("since", String(params.since));
    if (params?.search) qs.set("search", params.search);
    const query = qs.toString();
    return request<{ logs: LogEntry[]; total: number }>(`/logs${query ? "?" + query : ""}`);
  },
  clearLogs: () => request<null>("/logs", { method: "DELETE" }),

  // Journey
  getJourneyMaps: () => request<{ maps: JourneyMap[] }>("/journey/maps"),
  getJourneyMap: (id: string) => request<JourneyMapFull>(`/journey/maps/${id}`),
  createJourneyMap: (data: { name: string; url?: string; description?: string }) =>
    request<JourneyMap>("/journey/maps", { method: "POST", body: JSON.stringify(data) }),
  deleteJourneyMap: (id: string) =>
    request<null>(`/journey/maps/${id}`, { method: "DELETE" }),
  importJourneyMap: (data: Record<string, unknown>) =>
    request<{ id: string; screensCreated: number; edgesCreated: number }>("/journey/maps/import", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getJourneyScreenshots: () =>
    request<{ files: Array<{ name: string; size: number; url: string }> }>("/journey/screenshots"),
};
