/**
 * Status Flow Checker — validates that done tasks went through proper status transitions.
 */

import type { GraphDocument } from "../graph/graph-types.js";
import type { StatusFlowReport, StatusFlowViolation } from "../../schemas/validator-schema.js";
import { logger } from "../utils/logger.js";

const TASK_TYPES = new Set(["task", "subtask"]);

export function checkStatusFlow(doc: GraphDocument): StatusFlowReport {
  const violations: StatusFlowViolation[] = [];

  const doneTasks = doc.nodes.filter((n) => TASK_TYPES.has(n.type) && n.status === "done");

  for (const task of doneTasks) {
    // Heuristic: if updatedAt === createdAt, the task never transitioned through statuses
    if (task.updatedAt === task.createdAt) {
      violations.push({
        nodeId: task.id,
        title: task.title,
        currentStatus: task.status,
        details: `Task "${task.title}" marcada como done sem transição de status (createdAt === updatedAt)`,
      });
    }
  }

  const complianceRate = doneTasks.length === 0
    ? 100
    : Math.round(((doneTasks.length - violations.length) / doneTasks.length) * 100);

  logger.info("status-flow-check", { complianceRate, violationCount: violations.length });

  return { violations, complianceRate };
}
