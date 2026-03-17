/**
 * Scope Analyzer — detects orphans, coverage gaps, and conflicts in the graph.
 */

import type { GraphDocument } from "../graph/graph-types.js";
import type { ScopeAnalysis, OrphanNode, CoverageMatrix } from "../../schemas/analyzer-schema.js";
import { detectCycles } from "../planner/dependency-chain.js";
import { logger } from "../utils/logger.js";

const TASK_TYPES = new Set(["task", "subtask"]);
const REQUIREMENT_TYPES = new Set(["epic", "requirement"]);

export function analyzeScope(doc: GraphDocument): ScopeAnalysis {
  const { nodes, edges } = doc;
  const orphans: OrphanNode[] = [];

  // ── Orphan detection ──

  // Requirements without tasks linked
  const reqNodes = nodes.filter((n) => REQUIREMENT_TYPES.has(n.type));
  const tasks = nodes.filter((n) => TASK_TYPES.has(n.type));

  const parentIds = new Set(tasks.map((t) => t.parentId).filter(Boolean));
  const edgeTargetIds = new Set(edges.map((e) => e.to));
  const edgeSourceIds = new Set(edges.map((e) => e.from));

  for (const req of reqNodes) {
    const hasChildTask = parentIds.has(req.id);
    const hasEdgeToTask = edgeSourceIds.has(req.id) || edgeTargetIds.has(req.id);
    if (!hasChildTask && !hasEdgeToTask) {
      orphans.push({
        id: req.id,
        title: req.title,
        type: req.type,
        reason: "Requirement sem tasks vinculadas",
      });
    }
  }

  // Tasks without parent or edges
  for (const task of tasks) {
    const hasParent = task.parentId != null;
    const hasEdges = edgeSourceIds.has(task.id) || edgeTargetIds.has(task.id);
    if (!hasParent && !hasEdges) {
      orphans.push({
        id: task.id,
        title: task.title,
        type: task.type,
        reason: "Task sem parent ou relações",
      });
    }
  }

  // ── Cycles ──
  const cycles = detectCycles(doc);

  // ── Coverage matrix ──
  const reqsWithTasks = reqNodes.filter((r) => {
    const hasChild = tasks.some((t) => t.parentId === r.id);
    const hasEdge = edges.some((e) => e.from === r.id || e.to === r.id);
    return hasChild || hasEdge;
  });

  const tasksWithAc = tasks.filter(
    (t) => (t.acceptanceCriteria && t.acceptanceCriteria.length > 0) ||
      nodes.some((n) => n.type === "acceptance_criteria" && n.parentId === t.id),
  );

  const coverage: CoverageMatrix = {
    requirementsToTasks: reqNodes.length > 0
      ? Math.round((reqsWithTasks.length / reqNodes.length) * 100)
      : 100,
    tasksToAc: tasks.length > 0
      ? Math.round((tasksWithAc.length / tasks.length) * 100)
      : 100,
    orphanRequirements: orphans.filter((o) => REQUIREMENT_TYPES.has(o.type)).length,
    orphanTasks: orphans.filter((o) => TASK_TYPES.has(o.type)).length,
  };

  // ── Conflicts (simple keyword contradiction detection) ──
  const conflicts: string[] = [];
  const constraintNodes = nodes.filter((n) => n.type === "constraint");
  const constraintTexts = constraintNodes.map((n) => ({
    id: n.id,
    text: `${n.title} ${n.description ?? ""}`.toLowerCase(),
  }));

  const contradictions = [
    ["performance", "funcionalidade"],
    ["velocidade", "segurança"],
    ["simples", "completo"],
    ["rápido", "robusto"],
  ];

  for (let i = 0; i < constraintTexts.length; i++) {
    for (let j = i + 1; j < constraintTexts.length; j++) {
      for (const [a, b] of contradictions) {
        if (
          (constraintTexts[i].text.includes(a) && constraintTexts[j].text.includes(b)) ||
          (constraintTexts[i].text.includes(b) && constraintTexts[j].text.includes(a))
        ) {
          conflicts.push(
            `Possível conflito entre "${constraintTexts[i].id}" (${a}) e "${constraintTexts[j].id}" (${b})`,
          );
        }
      }
    }
  }

  const summaryParts: string[] = [];
  if (orphans.length > 0) summaryParts.push(`${orphans.length} órfãos`);
  if (cycles.length > 0) summaryParts.push(`${cycles.length} ciclos`);
  if (conflicts.length > 0) summaryParts.push(`${conflicts.length} conflitos`);
  const summary = summaryParts.length > 0
    ? `Scope issues: ${summaryParts.join(", ")}`
    : "Escopo limpo — sem órfãos, ciclos ou conflitos detectados";

  logger.info("scope-analyzer", { orphans: orphans.length, cycles: cycles.length, conflicts: conflicts.length });

  return { orphans, cycles, coverage, conflicts, summary };
}
