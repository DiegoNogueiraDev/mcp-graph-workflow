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
