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
}

export interface IntegrationStatus {
  gitnexus?: { running: boolean; url: string };
  serena?: { memories?: Array<{ name: string; content: string }> };
}

// ── GitNexus Code Graph types ───────────────────

export interface GitNexusStatus {
  indexed: boolean;
  running: boolean;
  port: number;
  url?: string;
  analyzePhase?: "idle" | "analyzing" | "ready" | "unavailable" | "error";
}

export interface CodeSymbol {
  name: string;
  kind: "function" | "class" | "method" | "interface" | "variable" | "module" | "file" | "folder";
  file?: string;
  startLine?: number;
  endLine?: number;
  metadata?: Record<string, unknown>;
}

export interface CodeRelation {
  from: string;
  to: string;
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

export interface SerenaMemory {
  name: string;
  content: string;
}

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

// ── GitNexus on-demand action results ───────────

export interface AnalyzeResult {
  skipped: boolean;
  success?: boolean;
  reason: string;
}

export interface ServeResult {
  started: boolean;
  message: string;
  port?: number;
}
