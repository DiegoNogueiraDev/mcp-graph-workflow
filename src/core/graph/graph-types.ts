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

export type NodeStatus =
  | "backlog"
  | "ready"
  | "in_progress"
  | "blocked"
  | "done";

export type XpSize = "XS" | "S" | "M" | "L" | "XL";

export type RelationType =
  | "parent_of"
  | "child_of"
  | "depends_on"
  | "blocks"
  | "related_to"
  | "priority_over"
  | "implements"
  | "derived_from";

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
  priority: 1 | 2 | 3 | 4 | 5;
  xpSize?: XpSize;
  estimateMinutes?: number;
  tags?: string[];
  parentId?: string | null;
  sprint?: string | null;
  sourceRef?: SourceRef;
  acceptanceCriteria?: string[];
  blocked?: boolean;
  metadata?: {
    inferred?: boolean;
    origin?: string;
    [key: string]: unknown;
  };
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
  metadata?: {
    inferred?: boolean;
    confidence?: number;
    [key: string]: unknown;
  };
  createdAt: string;
}

export interface GraphIndexes {
  byId: Record<string, number>;
  childrenByParent: Record<string, string[]>;
  incomingByNode: Record<string, string[]>;
  outgoingByNode: Record<string, string[]>;
}

export interface GraphProject {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface GraphMeta {
  sourceFiles: string[];
  lastImport: string | null;
}

export interface GraphDocument {
  version: string;
  project: GraphProject;
  nodes: GraphNode[];
  edges: GraphEdge[];
  indexes: GraphIndexes;
  meta: GraphMeta;
}
