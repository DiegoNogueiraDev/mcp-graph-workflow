import type { NodeType, NodeStatus, RelationType } from "./types";

export const NODE_TYPE_COLORS: Record<NodeType, string> = {
  epic: "#7c3aed",
  task: "#2196f3",
  subtask: "#10b981",
  requirement: "#f59e0b",
  constraint: "#ef4444",
  milestone: "#8b5cf6",
  acceptance_criteria: "#06b6d4",
  risk: "#f97316",
  decision: "#ec4899",
};

export const STATUS_COLORS: Record<NodeStatus, string> = {
  done: "#4caf50",
  in_progress: "#2196f3",
  blocked: "#f44336",
  ready: "#ff9800",
  backlog: "#9e9e9e",
};

export const STATUS_LABELS: Record<NodeStatus, string> = {
  done: "Done",
  in_progress: "In Progress",
  blocked: "Blocked",
  ready: "Ready",
  backlog: "Backlog",
};

export const EDGE_STYLES: Record<RelationType, { color: string; dashed: boolean; label: string }> = {
  depends_on: { color: "#6c757d", dashed: false, label: "depends on" },
  blocks: { color: "#f44336", dashed: true, label: "blocks" },
  parent_of: { color: "#7c3aed", dashed: false, label: "parent of" },
  child_of: { color: "#10b981", dashed: false, label: "child of" },
  related_to: { color: "#9e9e9e", dashed: true, label: "related to" },
  priority_over: { color: "#ff9800", dashed: true, label: "priority over" },
  implements: { color: "#2196f3", dashed: false, label: "implements" },
  derived_from: { color: "#06b6d4", dashed: true, label: "derived from" },
};

export const ALL_STATUSES: NodeStatus[] = ["backlog", "ready", "in_progress", "blocked", "done"];
export const ALL_TYPES: NodeType[] = [
  "epic", "task", "subtask", "requirement", "constraint",
  "milestone", "acceptance_criteria", "risk", "decision",
];

// ── Code Graph ─────────────────────────────────

export const CODE_SYMBOL_COLORS: Record<string, string> = {
  function: "#4fc3f7",
  class: "#ce93d8",
  method: "#81c784",
  interface: "#4dd0e1",
  variable: "#ffd54f",
  module: "#b39ddb",
  file: "#90a4ae",
  folder: "#78909c",
};

export const CODE_RELATION_COLORS: Record<string, string> = {
  imports: "#546e7a",
  calls: "#4fc3f7",
  belongs_to: "#ce93d8",
  extends: "#81c784",
  implements: "#4dd0e1",
};

export const CODE_RELATION_LABELS: Record<string, string> = {
  belongs_to: "Contains",
  imports: "Imports",
  calls: "Calls",
  extends: "Extends",
  implements: "Implements",
};
