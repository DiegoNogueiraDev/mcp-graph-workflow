/**
 * Phase Summary Generator — creates a knowledge document summarizing
 * what was accomplished during a lifecycle phase when transitioning out.
 */

import type { GraphDocument } from "../graph/graph-types.js";
import type { LifecyclePhase } from "../planner/lifecycle-phase.js";
import { KnowledgeStore } from "../store/knowledge-store.js";
import { logger } from "../utils/logger.js";

export interface PhaseSummaryResult {
  indexed: boolean;
  summaryText: string;
}

const TASK_TYPES = new Set(["task", "subtask"]);
const DESIGN_TYPES = new Set(["decision", "constraint", "risk", "acceptance_criteria"]);

/**
 * Generate and index a phase summary document into the knowledge store.
 * Captures key metrics and decisions from the completed phase.
 */
export function generateAndIndexPhaseSummary(
  knowledgeStore: KnowledgeStore,
  doc: GraphDocument,
  fromPhase: LifecyclePhase,
  toPhase: LifecyclePhase,
): PhaseSummaryResult {
  const summaryText = buildPhaseSummaryText(doc, fromPhase, toPhase);

  const sourceId = `phase_summary:${fromPhase}:${new Date().toISOString()}`;

  try {
    knowledgeStore.insert({
      sourceType: "phase_summary",
      sourceId,
      title: `Phase ${fromPhase} Summary → ${toPhase}`,
      content: summaryText,
      metadata: {
        phase: fromPhase,
        transitionTo: toPhase,
        transitionedAt: new Date().toISOString(),
      },
    });

    logger.info("Phase summary indexed", { fromPhase, toPhase });
    return { indexed: true, summaryText };
  } catch (err) {
    logger.warn("Phase summary indexing failed", { error: String(err) });
    return { indexed: false, summaryText };
  }
}

/**
 * Build a human-readable summary of what happened during a phase.
 */
function buildPhaseSummaryText(
  doc: GraphDocument,
  fromPhase: LifecyclePhase,
  toPhase: LifecyclePhase,
): string {
  const { nodes, edges } = doc;
  const tasks = nodes.filter((n) => TASK_TYPES.has(n.type));
  const doneTasks = tasks.filter((n) => n.status === "done");
  const inProgressTasks = tasks.filter((n) => n.status === "in_progress");
  const designNodes = nodes.filter((n) => DESIGN_TYPES.has(n.type));

  const sections: string[] = [];

  sections.push(`Phase ${fromPhase} completed. Transitioning to ${toPhase}.`);
  sections.push(`Total nodes: ${nodes.length}. Edges: ${edges.length}.`);

  if (tasks.length > 0) {
    sections.push(
      `Tasks: ${tasks.length} total, ${doneTasks.length} done, ${inProgressTasks.length} in progress, ${tasks.length - doneTasks.length - inProgressTasks.length} remaining.`,
    );
  }

  // Phase-specific summaries
  switch (fromPhase) {
    case "ANALYZE": {
      const requirements = nodes.filter((n) => n.type === "requirement");
      const epics = nodes.filter((n) => n.type === "epic");
      sections.push(`Requirements defined: ${requirements.length}. Epics: ${epics.length}.`);
      break;
    }
    case "DESIGN": {
      const decisions = designNodes.filter((n) => n.type === "decision");
      const constraints = designNodes.filter((n) => n.type === "constraint");
      const risks = designNodes.filter((n) => n.type === "risk");
      sections.push(`Decisions: ${decisions.length}. Constraints: ${constraints.length}. Risks: ${risks.length}.`);
      if (decisions.length > 0) {
        const decisionTitles = decisions.map((d) => d.title).slice(0, 5);
        sections.push(`Key decisions: ${decisionTitles.join("; ")}.`);
      }
      break;
    }
    case "PLAN": {
      const sprintTasks = tasks.filter((n) => n.sprint != null);
      const sprints = new Set(sprintTasks.map((n) => n.sprint));
      sections.push(`Sprint-assigned tasks: ${sprintTasks.length} across ${sprints.size} sprint(s).`);
      break;
    }
    case "IMPLEMENT": {
      sections.push(`Tasks completed: ${doneTasks.length}/${tasks.length}.`);
      const acNodes = nodes.filter((n) => n.type === "acceptance_criteria");
      if (acNodes.length > 0) {
        sections.push(`Acceptance criteria nodes: ${acNodes.length}.`);
      }
      break;
    }
    case "VALIDATE": {
      const tasksWithAc = tasks.filter((n) => n.acceptanceCriteria && n.acceptanceCriteria.length > 0);
      sections.push(`Tasks with acceptance criteria: ${tasksWithAc.length}/${tasks.length}.`);
      break;
    }
    case "REVIEW": {
      sections.push(`All tasks done: ${doneTasks.length === tasks.length ? "yes" : "no"}.`);
      break;
    }
    case "HANDOFF": {
      sections.push(`Handoff completed. ${doneTasks.length} tasks delivered.`);
      break;
    }
    case "LISTENING": {
      const feedbackNodes = nodes.filter((n) => n.type === "requirement" || n.type === "risk");
      sections.push(`Feedback items collected: ${feedbackNodes.length}.`);
      break;
    }
  }

  return sections.join("\n");
}
