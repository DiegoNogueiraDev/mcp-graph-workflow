/**
 * Backlog Health — analyzes backlog state for new cycle readiness.
 */

import type { GraphDocument } from "../graph/graph-types.js";
import type { BacklogHealthReport } from "../../schemas/listener-schema.js";
import { logger } from "../utils/logger.js";

const TASK_TYPES = new Set(["task", "subtask"]);
const TECH_DEBT_KEYWORDS = ["tech-debt", "refactor", "fix", "debt", "cleanup", "deprecat"];
const STALE_THRESHOLD_DAYS = 30;

export function analyzeBacklogHealth(doc: GraphDocument): BacklogHealthReport {
  const tasks = doc.nodes.filter((n) => TASK_TYPES.has(n.type));
  const backlogTasks = tasks.filter((n) => n.status === "backlog");
  const readyTasks = tasks.filter((n) => n.status === "ready");

  const now = Date.now();

  // Find stale tasks (in backlog/ready for more than 30 days)
  const staleTasks = [...backlogTasks, ...readyTasks]
    .filter((t) => {
      const createdMs = new Date(t.createdAt).getTime();
      const daysOld = (now - createdMs) / (1000 * 60 * 60 * 24);
      return daysOld >= STALE_THRESHOLD_DAYS;
    })
    .map((t) => ({
      nodeId: t.id,
      title: t.title,
      daysInBacklog: Math.floor((now - new Date(t.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
    }));

  // Find tech debt indicators by tags/title/description keywords
  const techDebtIndicators = doc.nodes
    .filter((n) => {
      const searchText = [
        n.title.toLowerCase(),
        (n.description ?? "").toLowerCase(),
        ...(n.tags ?? []).map((t) => t.toLowerCase()),
      ].join(" ");
      return TECH_DEBT_KEYWORDS.some((kw) => searchText.includes(kw));
    })
    .map((n) => {
      const searchText = [
        n.title.toLowerCase(),
        (n.description ?? "").toLowerCase(),
        ...(n.tags ?? []).map((t) => t.toLowerCase()),
      ].join(" ");
      const matchedKeywords = TECH_DEBT_KEYWORDS.filter((kw) => searchText.includes(kw));
      return {
        nodeId: n.id,
        title: n.title,
        keywords: matchedKeywords,
      };
    });

  // Clean for new cycle = no stale tasks and limited tech debt
  const cleanForNewCycle = staleTasks.length === 0 && techDebtIndicators.length <= 3;

  logger.info("backlog-health", {
    backlogCount: backlogTasks.length,
    readyCount: readyTasks.length,
    staleCount: staleTasks.length,
    techDebtCount: techDebtIndicators.length,
  });

  return {
    backlogCount: backlogTasks.length,
    readyCount: readyTasks.length,
    staleTasks,
    techDebtIndicators,
    cleanForNewCycle,
  };
}
