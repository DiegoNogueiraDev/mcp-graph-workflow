/**
 * Delivery Checklist — composite gate for REVIEW→HANDOFF transition.
 */

import type { GraphDocument } from "../graph/graph-types.js";
import type { HandoffReadinessReport, HandoffReadinessCheck } from "../../schemas/handoff-schema.js";
import type { AdrGrade } from "../../schemas/designer-schema.js";
import { assessRisks } from "../analyzer/risk-assessment.js";
import { analyzeScope } from "../analyzer/scope-analyzer.js";
import { detectBottlenecks } from "../insights/bottleneck-detector.js";
import { calculateVelocity } from "../planner/velocity.js";
import { detectCycles } from "../planner/dependency-chain.js";
import { checkDocCompleteness } from "./doc-completeness.js";
import { logger } from "../utils/logger.js";

const TASK_TYPES = new Set(["task", "subtask"]);

export interface HandoffReadinessOptions {
  knowledgeCount?: number;
}

function scoreToGrade(score: number): AdrGrade {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

export function checkHandoffReadiness(
  doc: GraphDocument,
  opts?: HandoffReadinessOptions,
): HandoffReadinessReport {
  const checks: HandoffReadinessCheck[] = [];

  const tasks = doc.nodes.filter((n) => TASK_TYPES.has(n.type));
  const doneTasks = tasks.filter((n) => n.status === "done");

  // ── Required checks ──

  // 1. all_tasks_done — 100% tasks done
  const allDone = tasks.length > 0 && tasks.every((n) => n.status === "done");
  checks.push({
    name: "all_tasks_done",
    passed: allDone,
    details: allDone
      ? "Todas tasks done"
      : `${doneTasks.length}/${tasks.length} tasks done (100% requerido)`,
    severity: "required",
  });

  // 2. no_blocked_nodes — zero blocked nodes
  const bottlenecks = detectBottlenecks(doc);
  const noBlocked = bottlenecks.blockedTasks.length === 0;
  checks.push({
    name: "no_blocked_nodes",
    passed: noBlocked,
    details: noBlocked
      ? "Nenhum node bloqueado"
      : `${bottlenecks.blockedTasks.length} node(s) bloqueado(s)`,
    severity: "required",
  });

  // 3. no_critical_risks — zero critical/high unmitigated risks
  const riskMatrix = assessRisks(doc);
  const unmitigated = riskMatrix.risks.filter(
    (r) => (r.level === "critical" || r.level === "high") && r.mitigationStatus === "unmitigated",
  );
  const risksPass = unmitigated.length === 0;
  checks.push({
    name: "no_critical_risks",
    passed: risksPass,
    details: risksPass
      ? "Nenhum risco critical/high sem mitigação"
      : `${unmitigated.length} risco(s) critical/high sem mitigação`,
    severity: "required",
  });

  // 4. ac_coverage — ≥80% tasks with AC
  const tasksWithAC = tasks.filter(
    (t) => t.acceptanceCriteria && t.acceptanceCriteria.length > 0,
  );
  const acCoverage = tasks.length > 0 ? Math.round((tasksWithAC.length / tasks.length) * 100) : 100;
  const acPass = acCoverage >= 80;
  checks.push({
    name: "ac_coverage",
    passed: acPass,
    details: `${acCoverage}% tasks com AC (meta: 80%)`,
    severity: "required",
  });

  // 5. no_cycles — no dependency cycles
  const cycles = detectCycles(doc);
  const noCycles = cycles.length === 0;
  checks.push({
    name: "no_cycles",
    passed: noCycles,
    details: noCycles
      ? "Nenhum ciclo de dependência detectado"
      : `${cycles.length} ciclo(s) detectado(s)`,
    severity: "required",
  });

  // ── Recommended checks ──

  // 6. knowledge_captured — knowledge count > 0
  const knowledgeCount = opts?.knowledgeCount ?? 0;
  const knowledgePass = knowledgeCount > 0;
  checks.push({
    name: "knowledge_captured",
    passed: knowledgePass,
    details: knowledgePass
      ? `${knowledgeCount} conhecimento(s) capturado(s)`
      : "Nenhum conhecimento capturado no knowledge store",
    severity: "recommended",
  });

  // 7. milestones_done — ≥1 milestone done
  const milestonesDone = doc.nodes.filter((n) => n.type === "milestone" && n.status === "done");
  const milestonesPass = milestonesDone.length > 0;
  checks.push({
    name: "milestones_done",
    passed: milestonesPass,
    details: milestonesPass
      ? `${milestonesDone.length} milestone(s) concluído(s)`
      : "Nenhum milestone concluído",
    severity: "recommended",
  });

  // 8. scope_clean — zero orphans
  const scopeAnalysis = analyzeScope(doc);
  const noOrphans = scopeAnalysis.orphans.length === 0;
  checks.push({
    name: "scope_clean",
    passed: noOrphans,
    details: noOrphans
      ? "Sem nodes órfãos"
      : `${scopeAnalysis.orphans.length} node(s) órfão(s)`,
    severity: "recommended",
  });

  // 9. velocity_recorded — ≥1 sprint with data
  const velocity = calculateVelocity(doc);
  const velocityPass = velocity.sprints.length > 0;
  checks.push({
    name: "velocity_recorded",
    passed: velocityPass,
    details: velocityPass
      ? `${velocity.sprints.length} sprint(s) com dados de velocidade`
      : "Nenhum sprint com dados de velocidade",
    severity: "recommended",
  });

  // 10. doc_completeness — ≥70% nodes with description
  const docReport = checkDocCompleteness(doc);
  const docPass = docReport.coverageRate >= 70;
  checks.push({
    name: "doc_completeness",
    passed: docPass,
    details: `${docReport.coverageRate}% nodes com description (meta: 70%)`,
    severity: "recommended",
  });

  // ── Scoring ──
  const totalChecks = checks.length;
  const passedChecks = checks.filter((c) => c.passed).length;
  const score = Math.round((passedChecks / totalChecks) * 100);
  const grade = scoreToGrade(score);

  const ready = checks.filter((c) => c.severity === "required").every((c) => c.passed);

  const summary = ready
    ? `Handoff Ready (${grade}): ${passedChecks}/${totalChecks} checks passed, score ${score}`
    : `Handoff Not Ready: ${checks.filter((c) => c.severity === "required" && !c.passed).map((c) => c.name).join(", ")} failed`;

  logger.info("handoff-readiness", { ready, score, grade, passed: passedChecks, total: totalChecks });

  return { checks, ready, score, grade, summary };
}
