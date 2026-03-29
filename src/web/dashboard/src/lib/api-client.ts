import type { GraphDocument, GraphEdge, GraphNode, GraphStats, IntegrationStatus, CodeGraphStatus, ProjectMemory, ReindexResult, LogEntry, FolderInfo, OpenFolderResult, BrowseResult, CodeGraphData, ImpactResult, KnowledgeStats, Skill, CustomSkill, CustomSkillInput, ContextBudget, JourneyMap, JourneyMapFull, TranslationAnalysis, TranslationJob, TranslationPrepareResult, TranslationFinalizeResult, TranslationStats } from "./types";

const BASE = "/api/v1";
const REQUEST_TIMEOUT_MS = 30_000;

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

function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  return Promise.race([
    fetch(url, options),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new ApiError(`Request timeout after ${REQUEST_TIMEOUT_MS / 1000}s: ${url}`, 0)), REQUEST_TIMEOUT_MS),
    ),
  ]);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE}${path}`;
  const res = await fetchWithTimeout(url, {
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
  readMemory: (name: string) =>
    request<ProjectMemory>(`/integrations/memories/${encodeURIComponent(name)}`),
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

  // Siebel
  siebelGetObjects: (params?: { type?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.type) qs.set("type", params.type);
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return request<{ objects: Array<{ title: string; sourceType: string; siebelType?: string; siebelProject?: string; contentPreview: string }>; total: number }>(
      `/siebel/objects${query ? "?" + query : ""}`,
    );
  },
  siebelGetTemplates: () =>
    request<{ templates: Array<{ type: string; xmlTag: string; requiredAttrs: string[]; optionalAttrs: string[]; childTags: string[] }> }>(
      "/siebel/generate/templates",
    ),
  siebelPrepareGeneration: (data: { description: string; objectTypes: string[]; basedOnProject?: string; properties?: Record<string, string> }) =>
    request<{ prompt: string; templates: string[]; existingObjectsCount: number; relatedDocsCount: number; validationRules: string[] }>(
      "/siebel/generate/prepare",
      { method: "POST", body: JSON.stringify(data) },
    ),
  siebelFinalizeGeneration: (data: { generatedXml: string; description?: string; objectTypes?: string[] }) =>
    request<{ sifContent: string; objects: Array<{ name: string; type: string }>; validation: { status: string; messages: Array<{ level: string; message: string; objectName?: string }>; score: number }; metadata: { generatedAt: string; requestDescription: string; objectCount: number } }>(
      "/siebel/generate/finalize",
      { method: "POST", body: JSON.stringify(data) },
    ),
  siebelUploadDocs: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/siebel/upload-docs`, { method: "POST", body: form });
    const body = await res.json();
    if (!res.ok) throw new ApiError(body.error || `HTTP ${res.status}`, res.status);
    return body as { ok: boolean; fileName: string; format: string; chunksIndexed: number; textLength: number };
  },
  siebelImportSif: (content: string, fileName?: string, mapToGraph?: boolean) =>
    request<{ metadata: unknown; objectCount: number; dependencyCount: number; objects: Array<{ name: string; type: string; project?: string }>; dependencies: Array<{ from: { name: string; type: string }; to: { name: string; type: string }; relationType: string }>; nodesCreated?: number; edgesCreated?: number; documentsIndexed?: number }>(
      "/siebel/import",
      { method: "POST", body: JSON.stringify({ content, fileName, mapToGraph }) },
    ),
  siebelGetGraph: (params?: { limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return request<{ objects: Array<{ name: string; type: string; project?: string; properties: Array<{ name: string; value: string }>; children: unknown[] }>; dependencies: Array<{ from: { name: string; type: string }; to: { name: string; type: string }; relationType: string }>; metadata: { fileName: string; repositoryName: string; projectName?: string; objectCount: number; objectTypes: string[]; extractedAt: string } | null }>(
      `/siebel/graph${query ? "?" + query : ""}`,
    );
  },

  // Siebel — Analysis & Quality
  siebelGetMetrics: () =>
    request<{ totalObjects: number; totalSifs: number; typeDistribution: Record<string, number>; projectDistribution: Record<string, number>; scriptCoverage: { scriptableObjects: number; withScripts: number; percentage: number }; lockedObjects: Array<{ name: string; type: string; lockedBy: string }> }>(
      "/siebel/metrics",
    ),
  siebelRunReview: (content: string, prefix?: string) =>
    request<{ issues: Array<{ category: string; severity: string; objectName: string; detail: string; suggestion: string }>; score: number; breakdown: Record<string, number>; objectCount: number }>(
      "/siebel/review",
      { method: "POST", body: JSON.stringify({ content, prefix }) },
    ),
  siebelGetBestPractices: (category?: string) => {
    const query = category ? `?category=${encodeURIComponent(category)}` : "";
    return request<{ rules: Array<{ id: string; category: string; title: string; description: string; severity: string; correct: string; incorrect: string }>; total?: number; category?: string }>(
      `/siebel/best-practices${query}`,
    );
  },
  siebelRunReadyCheck: (content: string, prefix?: string, currentUser?: string) =>
    request<{ ready: boolean; checks: Array<{ name: string; passed: boolean; detail: string }> }>(
      "/siebel/ready-check",
      { method: "POST", body: JSON.stringify({ content, prefix, currentUser }) },
    ),
  siebelGetErd: (project?: string) => {
    const query = project ? `?project=${encodeURIComponent(project)}` : "";
    return request<{ tables: Array<{ name: string; bcName: string; columns: Array<{ name: string; fieldName: string }> }>; relationships: Array<{ fromTable: string; toTable: string; fromField: string; toField: string; label: string }>; mermaid: string }>(
      `/siebel/erd${query}`,
    );
  },
  siebelEnrich: (content: string) =>
    request<{ summary: string; objectTypes: string[]; dependsOn: Array<{ name: string; type: string }>; usedBy: Array<{ name: string; type: string }>; objectCount: number }>(
      "/siebel/enrich",
      { method: "POST", body: JSON.stringify({ content }) },
    ),
  siebelAnalyzeImpact: (content: string, objectName: string, objectType: string) =>
    request<{ targetObject: { name: string; type: string }; directDependents: Array<{ name: string; type: string }>; transitiveDependents: Array<{ name: string; type: string }>; totalAffected: number; riskLevel: string }>(
      "/siebel/analyze/impact",
      { method: "POST", body: JSON.stringify({ content, objectName, objectType }) },
    ),
  siebelAnalyzeCircular: (content: string) =>
    request<{ cyclesFound: number; cycles: Array<{ cycle: Array<{ name: string; type: string }> }> }>(
      "/siebel/analyze/circular",
      { method: "POST", body: JSON.stringify({ content }) },
    ),

  // Siebel — Environment Management
  siebelGetEnvironments: () =>
    request<{ environments: Array<{ name: string; url: string; version: string; type: string; composerUrl?: string; restApiUrl?: string }>; count: number }>(
      "/siebel/environments",
    ),
  siebelAddEnvironment: (env: { name: string; url: string; version: string; type: string; composerUrl?: string; restApiUrl?: string }) =>
    request<{ environments: Array<{ name: string; url: string; version: string; type: string }> }>(
      "/siebel/environments",
      { method: "POST", body: JSON.stringify(env) },
    ),
  siebelDeleteEnvironment: (name: string) =>
    request<{ environments: Array<{ name: string; url: string; version: string; type: string }> }>(
      `/siebel/environments/${encodeURIComponent(name)}`,
      { method: "DELETE" },
    ),

  // LSP — Language Server Protocol
  getLspLanguages: () =>
    request<{ ok: boolean; detected: Array<{ languageId: string; fileCount: number; confidence: number; detectedVia: string; configFile?: string; serverCommand?: string }>; supportedLanguages: string[]; estimatedTokens?: number }>("/code-graph/lsp/languages"),
  getLspStatus: () =>
    request<{ ok: boolean; bridgeInitialized: boolean; servers: Record<string, string> }>("/code-graph/lsp/status"),
  lspDefinition: (file: string, line: number, character: number) =>
    request<{ ok: boolean; definitions: Array<{ file: string; startLine: number; startCharacter: number; endLine: number; endCharacter: number; hint?: string }> }>("/code-graph/lsp/definition", {
      method: "POST", body: JSON.stringify({ file, line, character }),
    }),
  lspReferences: (file: string, line: number, character: number) =>
    request<{ ok: boolean; totalReferences: number; references: Array<{ file: string; startLine: number; startCharacter: number; endLine: number; endCharacter: number }>; byFile: Record<string, number> }>("/code-graph/lsp/references", {
      method: "POST", body: JSON.stringify({ file, line, character }),
    }),
  lspHover: (file: string, line: number, character: number) =>
    request<{ ok: boolean; hover: { signature: string | null; documentation?: string; language?: string } | null }>("/code-graph/lsp/hover", {
      method: "POST", body: JSON.stringify({ file, line, character }),
    }),
  lspRename: (file: string, line: number, character: number, newName: string) =>
    request<{ ok: boolean; edit: unknown }>("/code-graph/lsp/rename", {
      method: "POST", body: JSON.stringify({ file, line, character, newName }),
    }),
  lspCallHierarchy: (file: string, line: number, character: number, direction: "incoming" | "outgoing") =>
    request<{ ok: boolean; direction: string; items: unknown[] }>("/code-graph/lsp/call-hierarchy", {
      method: "POST", body: JSON.stringify({ file, line, character, direction }),
    }),
  lspDiagnostics: (file: string) =>
    request<{ ok: boolean; file: string; diagnostics: Array<{ file: string; startLine: number; startCharacter: number; endLine: number; endCharacter: number; severity: number; message: string; code?: string; source?: string }> }>(`/code-graph/lsp/diagnostics?file=${encodeURIComponent(file)}`),
  lspSymbols: (file: string) =>
    request<{ ok: boolean; file: string; symbols: Array<{ name: string; kind: string; file: string; startLine: number; endLine: number; children?: unknown[] }> }>(`/code-graph/lsp/symbols?file=${encodeURIComponent(file)}`),

  // Translation
  translationAnalyze: (code: string, languageHint?: string, targetLanguage?: string) =>
    request<TranslationAnalysis>("/translation/analyze", {
      method: "POST", body: JSON.stringify({ code, languageHint, targetLanguage }),
    }),
  translationCreateJob: (sourceCode: string, targetLanguage: string, scope?: string, sourceLanguage?: string) =>
    request<TranslationPrepareResult>("/translation/jobs", {
      method: "POST", body: JSON.stringify({ sourceCode, targetLanguage, scope: scope ?? "snippet", sourceLanguage }),
    }),
  translationListJobs: () =>
    request<{ jobs: TranslationJob[] }>("/translation/jobs"),
  translationGetJob: (id: string) =>
    request<TranslationJob>(`/translation/jobs/${id}`),
  translationFinalize: (id: string, generatedCode: string) =>
    request<TranslationFinalizeResult>(`/translation/jobs/${id}/finalize`, {
      method: "POST", body: JSON.stringify({ generatedCode }),
    }),
  translationDeleteJob: (id: string) =>
    request<null>(`/translation/jobs/${id}`, { method: "DELETE" }),
  translationStats: () =>
    request<TranslationStats>("/translation/stats"),
};
