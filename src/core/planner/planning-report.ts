/**
 * Planning Report — generates a structured report for sprint planning.
 * Includes recommended order, missing docs, and risk assessment.
 */

import type { GraphDocument, GraphNode } from "../graph/graph-types.js";
import type { SqliteStore } from "../store/sqlite-store.js";
import { KnowledgeStore } from "../store/knowledge-store.js";
import { findNextTask } from "./next-task.js";
import { calculateVelocity } from "./velocity.js";
import { XP_SIZE_POINTS } from "../utils/xp-sizing.js";
import { logger } from "../utils/logger.js";

export interface PlanningReport {
  /** Recommended task execution order */
  recommendedOrder: Array<{
    id: string;
    title: string;
    type: string;
    priority: number;
    xpSize: string;
    reason: string;
  }>;
  /** Libraries or topics with missing documentation */
  missingDocs: string[];
  /** Risk assessment */
  risks: Array<{
    nodeId: string;
    title: string;
    risk: string;
    severity: "low" | "medium" | "high";
  }>;
  /** Summary metrics */
  summary: {
    totalReady: number;
    totalBlocked: number;
    estimatedPoints: number;
    avgVelocity: number | null;
  };
}

/**
 * Generate a planning report for the current sprint.
 */
export function generatePlanningReport(
  doc: GraphDocument,
  store: SqliteStore,
): PlanningReport {
  const eligibleNodes = doc.nodes.filter(
    (n) =>
      (n.type === "task" || n.type === "subtask") &&
      (n.status === "backlog" || n.status === "ready") &&
      !n.blocked,
  );

  const blockedNodes = doc.nodes.filter(
    (n) =>
      (n.type === "task" || n.type === "subtask") &&
      (n.status === "blocked" || n.blocked),
  );

  // Build recommended order using next-task algorithm iteratively
  const recommendedOrder = buildRecommendedOrder(doc);

  // Assess missing docs
  const missingDocs = assessMissingDocs(store, eligibleNodes);

  // Assess risks
  const risks = assessRisks(doc, eligibleNodes, blockedNodes);

  // Velocity
  const velocity = calculateVelocity(doc);

  const estimatedPoints = eligibleNodes.reduce(
    (sum, n) => sum + (XP_SIZE_POINTS[n.xpSize ?? "M"] ?? 3),
    0,
  );

  logger.info("Planning report generated", {
    ready: eligibleNodes.length,
    blocked: blockedNodes.length,
    points: estimatedPoints,
  });

  return {
    recommendedOrder,
    missingDocs,
    risks,
    summary: {
      totalReady: eligibleNodes.length,
      totalBlocked: blockedNodes.length,
      estimatedPoints,
      avgVelocity: velocity.overall.avgPointsPerSprint,
    },
  };
}

function buildRecommendedOrder(
  doc: GraphDocument,
): PlanningReport["recommendedOrder"] {
  // Clone the doc to simulate progressive execution
  const remaining = new Set(
    doc.nodes
      .filter(
        (n) =>
          (n.type === "task" || n.type === "subtask") &&
          (n.status === "backlog" || n.status === "ready") &&
          !n.blocked,
      )
      .map((n) => n.id),
  );

  const order: PlanningReport["recommendedOrder"] = [];
  const simulatedDone = new Set(
    doc.nodes.filter((n) => n.status === "done").map((n) => n.id),
  );

  // Bug #087: increased cap from 20 to 100 to handle larger graphs
  const MAX_ITERATIONS = Math.min(remaining.size, 100);
  for (let i = 0; i < MAX_ITERATIONS && remaining.size > 0; i++) {
    const result = findNextTask({
      ...doc,
      nodes: doc.nodes.map((n) => {
        if (simulatedDone.has(n.id)) return { ...n, status: "done" as const };
        return n;
      }),
    });

    if (!result || !remaining.has(result.node.id)) break;

    order.push({
      id: result.node.id,
      title: result.node.title,
      type: result.node.type,
      priority: result.node.priority,
      xpSize: result.node.xpSize ?? "M",
      reason: result.reason,
    });

    simulatedDone.add(result.node.id);
    remaining.delete(result.node.id);
  }

  return order;
}

function assessMissingDocs(
  store: SqliteStore,
  nodes: GraphNode[],
): string[] {
  try {
    const knowledgeStore = new KnowledgeStore(store.getDb());
    if (knowledgeStore.count() === 0) return ["No knowledge documents indexed"];

    const missing: string[] = [];
    const checked = new Set<string>();

    for (const node of nodes) {
      const tags = node.tags ?? [];
      for (const tag of tags) {
        if (checked.has(tag)) continue;
        checked.add(tag);

        const results = knowledgeStore.search(tag, 1);
        if (results.length === 0) {
          missing.push(tag);
        }
      }
    }

    return missing;
  } catch {
    return [];
  }
}

function assessRisks(
  doc: GraphDocument,
  eligible: GraphNode[],
  blocked: GraphNode[],
): PlanningReport["risks"] {
  const risks: PlanningReport["risks"] = [];

  // Blocked tasks are a risk
  for (const node of blocked) {
    risks.push({
      nodeId: node.id,
      title: node.title,
      risk: "Task is blocked",
      severity: "high",
    });
  }

  // Tasks with many dependencies
  for (const node of eligible) {
    const deps = doc.edges.filter(
      (e) => e.from === node.id && e.relationType === "depends_on",
    );
    if (deps.length >= 3) {
      risks.push({
        nodeId: node.id,
        title: node.title,
        risk: `Has ${deps.length} dependencies`,
        severity: "medium",
      });
    }
  }

  // XL tasks are risky
  for (const node of eligible) {
    if (node.xpSize === "XL") {
      risks.push({
        nodeId: node.id,
        title: node.title,
        risk: "Extra-large task — consider decomposing",
        severity: "medium",
      });
    }
  }

  return risks;
}
