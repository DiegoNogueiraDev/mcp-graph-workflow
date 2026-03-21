/** Client-side types mirroring backend schemas */

export type NodeType =
  | "epic"
  | "task"
  | "subtask"
  | "requirement"
  | "constraint"
  | "milestone"
  | "acceptance_criteria"
  | "risk"
  | "decision";

export type NodeStatus = "backlog" | "ready" | "in_progress" | "blocked" | "done";

export type XpSize = "XS" | "S" | "M" | "L" | "XL";

export type Priority = 1 | 2 | 3 | 4 | 5;

export interface SourceRef {
  file: string;
  startLine?: number;
  endLine?: number;
  confidence?: number;
}

export interface GraphNode {
  id: string;
  type: NodeType;
  title: string;
  description?: string;
  status: NodeStatus;
  priority: Priority;
  xpSize?: XpSize;
  estimateMinutes?: number;
  tags?: string[];
  parentId?: string | null;
  sprint?: string | null;
  sourceRef?: SourceRef;
  acceptanceCriteria?: string[];
  blocked?: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  relationType: RelationType;
  weight?: number;
  reason?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export type RelationType =
  | "parent_of"
  | "child_of"
  | "depends_on"
  | "blocks"
  | "related_to"
  | "priority_over"
  | "implements"
  | "derived_from";

export interface GraphDocument {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphStats {
  totalNodes: number;
  byStatus: Record<NodeStatus, number>;
  byType: Record<NodeType, number>;
}

export interface Bottlenecks {
  blockedTasks: Array<{ id: string; title: string; blockerTitles: string[] }>;
  missingAcceptanceCriteria: Array<{ id: string; title: string }>;
  oversizedTasks: Array<{ id: string; title: string; estimateMinutes: number }>;
  criticalPath?: { path: string[]; titles: string[]; length: number };
}

export interface Metrics {
  totalTasks: number;
  completionRate: number;
  velocity: { tasksCompleted: number; avgPointsPerTask?: number };
  statusDistribution: Array<{ status: NodeStatus; count: number; percentage: number }>;
  sprintProgress: Array<{ sprint: string; done: number; total: number; percentage: number }>;
}

export interface Recommendation {
  phase: string;
  skill: string;
  reason: string;
}

export interface Skill {
  name: string;
  category: string;
  description: string;
  phases?: string[];
  source: "built-in" | "filesystem" | "custom";
  estimatedTokens: number;
  enabled: boolean;
  id?: string;
}

export interface CustomSkillInput {
  name: string;
  description: string;
  category: string;
  phases: string[];
  instructions: string;
}

export interface CustomSkill extends CustomSkillInput {
  id: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContextBudget {
  totalTokens: number;
  activeTokens: number;
  totalCount: number;
  activeCount: number;
  health: "green" | "yellow" | "red";
  healthMessage: string;
  recommendations: string[];
  breakdown: Array<{
    name: string;
    source: "built-in" | "custom";
    tokens: number;
    enabled: boolean;
  }>;
}

export interface IntegrationStatus {
  codeGraph?: { installed: boolean; running: boolean; symbolCount: number };
  memories?: { available: boolean; count: number; directory: string; names: string[] };
  playwright?: { installed: boolean; running: boolean };
}

// ── Code Graph types ────────────────────────────

export interface CodeGraphStatus {
  indexed: boolean;
  basePath?: string;
  symbolCount: number;
  relationCount: number;
  fileCount: number;
  lastIndexed: string | null;
  gitHash: string | null;
}

/** @deprecated Use CodeGraphStatus instead */
export type GitNexusStatus = CodeGraphStatus;

export interface CodeSymbol {
  id?: string;
  name: string;
  kind: "function" | "class" | "method" | "interface" | "variable" | "module" | "file" | "folder";
  file?: string;
  startLine?: number;
  endLine?: number;
  metadata?: Record<string, unknown>;
}

export interface CodeRelation {
  from?: string;
  to?: string;
  fromSymbol?: string;
  toSymbol?: string;
  type: "imports" | "calls" | "belongs_to" | "extends" | "implements";
}

export interface CodeGraphData {
  symbols: CodeSymbol[];
  relations: CodeRelation[];
}

export interface ImpactResult {
  symbol: string;
  affectedSymbols: Array<{ name: string; file: string; confidence: number }>;
  riskLevel: "low" | "medium" | "high";
}

export interface ProjectMemory {
  name: string;
  content: string;
  sizeBytes?: number;
}

/** @deprecated Use ProjectMemory instead */
export type SerenaMemory = ProjectMemory;

// ── Log types ────────────────────────────────────

export type LogLevel = "info" | "warn" | "error" | "success" | "debug";

export interface LogEntry {
  id: number;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

// ── Folder / Open Folder ─────────────────────────

export interface FolderInfo {
  currentPath: string;
  recentFolders: string[];
}

export interface BrowseEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  hasGraph: boolean;
}

export interface BrowseResult {
  path: string;
  parent: string;
  entries: BrowseEntry[];
}

export interface OpenFolderResult {
  ok: boolean;
  basePath?: string;
  error?: string;
  recentFolders?: string[];
}

// ── Code Graph action results ───────────────────

export interface ReindexResult {
  success: boolean;
  fileCount: number;
  symbolCount: number;
  relationCount: number;
}

/** @deprecated Use ReindexResult instead */
export interface AnalyzeResult {
  skipped: boolean;
  success?: boolean;
  reason: string;
}

export interface KnowledgeStats {
  total: number;
  bySource: Record<string, number>;
}

/** @deprecated Will be removed with GitNexus */
export interface ServeResult {
  started: boolean;
  message: string;
  port?: number;
}

// ── Journey types ───────────────────────────────────

export interface JourneyMap {
  id: string;
  name: string;
  url?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface JourneyField {
  name: string;
  type: string;
  required?: boolean;
  label?: string;
  options?: string[];
}

export interface JourneyScreen {
  id: string;
  mapId: string;
  title: string;
  description?: string;
  screenshot?: string;
  url?: string;
  screenType: string;
  fields?: JourneyField[];
  ctas?: string[];
  metadata?: Record<string, unknown>;
  positionX: number;
  positionY: number;
  createdAt: string;
  updatedAt: string;
}

export interface JourneyEdge {
  id: string;
  mapId: string;
  from: string;
  to: string;
  label?: string;
  type: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface JourneyVariant {
  id: string;
  mapId: string;
  name: string;
  description?: string;
  path: string[];
  createdAt: string;
}

export interface JourneyMapFull extends JourneyMap {
  screens: JourneyScreen[];
  edges: JourneyEdge[];
  variants: JourneyVariant[];
}
