/**
 * Review Readiness — composite gate for VALIDATE→REVIEW transition.
 * 100% reuse of existing analyzers, no new helper modules.
 */

import type { GraphDocument } from "../graph/graph-types.js";
import type { ReviewReadinessReport, ReviewReadinessCheck } from "../../schemas/reviewer-schema.js";
import { analyzeScope } from "../analyzer/scope-analyzer.js";
import { assessRisks } from "../analyzer/risk-assessment.js";
import { detectBottlenecks } from "../insights/bottleneck-detector.js";
import { validateAcQuality } from "../analyzer/ac-validator.js";
import { calculateVelocity } from "../planner/velocity.js";
import { detectCycles } from "../planner/dependency-chain.js";
import { scoreToGrade } from "../utils/grading.js";
import { TASK_TYPES } from "../utils/node-type-sets.js";
import { nodeHasAc } from "../utils/ac-helpers.js";
import { logger } from "../utils/logger.js";

export function checkReviewReadiness(doc: GraphDocument): ReviewReadinessReport {
  const checks: ReviewReadinessCheck[] = [];

  const tasks = doc.nodes.filter((n) => TASK_TYPES.has(n.type));
  const doneTasks = tasks.filter((n) => n.status === "done");
  const completionRate = tasks.length > 0 ? (doneTasks.length / tasks.length) * 100 : 0;

  // Reuse results from expensive calls
  const bottlenecks = detectBottlenecks(doc);
  const scopeAnalysis = analyzeScope(doc);

  // ── Required checks ──

  // 1. completion_rate — ≥80% tasks done
  const enough = completionRate >= 80;
  checks.push({
    name: "completion_rate",
    passed: enough,
    details: enough
      ? `${Math.round(completionRate)}% tasks done (meta: 80%)`
      : `Apenas ${Math.round(completionRate)}% tasks done (meta: 80%)`,
    severity: "required",
  });

  // 2. no_blocked_tasks — zero blocked tasks
  const blockedCount = bottlenecks.blockedTasks.length;
  const noBlocked = blockedCount === 0;
  checks.push({
    name: "no_blocked_tasks",
    passed: noBlocked,
    details: noBlocked
      ? "Nenhuma task bloqueada"
      : `${blockedCount} task(s) bloqueada(s)`,
    severity: "required",
  });

  // 3. ac_coverage — ≥70% done tasks with AC (inline or child AC nodes)
  const doneWithAC = doneTasks.filter(
    (t) => nodeHasAc(doc, t.id),
  );
  const acCoverage = doneTasks.length > 0 ? Math.round((doneWithAC.length / doneTasks.length) * 100) : 100;
  const acCoveragePass = acCoverage >= 70;
  checks.push({
    name: "ac_coverage",
    passed: acCoveragePass,
    details: `${acCoverage}% done tasks com AC (meta: 70%)`,
    severity: "required",
  });

  // 4. no_cycles — no dependency cycles
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

  // 5. risks_addressed — zero critical/high unmitigated risks
  const riskMatrix = assessRisks(doc);
  const unmitigatedCritical = riskMatrix.risks.filter(
    (r) => (r.level === "critical" || r.level === "high") && r.mitigationStatus === "unmitigated",
  );
  const risksPass = unmitigatedCritical.length === 0;
  checks.push({
    name: "risks_addressed",
    passed: risksPass,
    details: risksPass
      ? "Todos riscos critical/high endereçados"
      : `${unmitigatedCritical.length} risco(s) critical/high sem mitigação`,
    severity: "required",
  });

  // ── Recommended checks ──

  // 6. velocity_stable — coefficient of variation < 1.0 (≥2 sprints)
  const velocity = calculateVelocity(doc);
  let velocityPass = true;
  let velocityDetails = "Dados insuficientes para avaliar estabilidade";
  if (velocity.sprints.length >= 2) {
    const points = velocity.sprints.map((s) => s.totalPoints);
    const avg = points.reduce((a, b) => a + b, 0) / points.length;
    const variance = points.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) / points.length;
    const stdDev = Math.sqrt(variance);
    const cv = avg > 0 ? stdDev / avg : 0;
    velocityPass = cv < 1.0;
    velocityDetails = `Coeficiente de variação: ${cv.toFixed(2)} (meta: < 1.0)`;
  }
  checks.push({
    name: "velocity_stable",
    passed: velocityPass,
    details: velocityDetails,
    severity: "recommended",
  });

  // 7. no_orphan_tasks — zero orphan tasks
  const orphanTasks = scopeAnalysis.orphans.filter((o) => TASK_TYPES.has(o.type));
  const noOrphans = orphanTasks.length === 0;
  checks.push({
    name: "no_orphan_tasks",
    passed: noOrphans,
    details: noOrphans
      ? "Nenhuma task órfã"
      : `${orphanTasks.length} task(s) órfã(s)`,
    severity: "recommended",
  });

  // 8. no_oversized_tasks — no tasks >120min without subtasks
  const noOversized = bottlenecks.oversizedTasks.length === 0;
  checks.push({
    name: "no_oversized_tasks",
    passed: noOversized,
    details: noOversized
      ? "Nenhuma task oversized"
      : `${bottlenecks.oversizedTasks.length} task(s) >120min sem decomposição`,
    severity: "recommended",
  });

  // 9. scope_integrity — no scope conflicts
  const noConflicts = scopeAnalysis.conflicts.length === 0;
  checks.push({
    name: "scope_integrity",
    passed: noConflicts,
    details: noConflicts
      ? "Sem conflitos de escopo"
      : `${scopeAnalysis.conflicts.length} conflito(s) de escopo`,
    severity: "recommended",
  });

  // 10. ac_quality — AC quality score ≥ 60
  const acReport = validateAcQuality(doc);
  const acQualityPass = acReport.overallScore >= 60;
  checks.push({
    name: "ac_quality",
    passed: acQualityPass,
    details: `AC quality score: ${acReport.overallScore} (meta: 60)`,
    severity: "recommended",
  });

  // ── Scoring ──
  const totalChecks = checks.length;
  const passedChecks = checks.filter((c) => c.passed).length;
  const score = Math.round((passedChecks / totalChecks) * 100);
  const grade = scoreToGrade(score);

  const ready = checks.filter((c) => c.severity === "required").every((c) => c.passed);

  const summary = ready
    ? `Review Ready (${grade}): ${passedChecks}/${totalChecks} checks passed, score ${score}`
    : `Review Not Ready: ${checks.filter((c) => c.severity === "required" && !c.passed).map((c) => c.name).join(", ")} failed`;

  logger.info("review-readiness", { ready, score, grade, passed: passedChecks, total: totalChecks });

  return { checks, ready, score, grade, summary };
}
