/**
 * Definition of Done — composite gate for IMPLEMENT task completion.
 * Validates 8 checks (4 required + 4 recommended) before marking a task as done.
 */

import type { GraphDocument } from "../graph/graph-types.js";
import type { ImplementDoneReport, DodCheck } from "../../schemas/implementer-schema.js";
import { validateAcQuality } from "../analyzer/ac-validator.js";
import { parseAc } from "../analyzer/ac-parser.js";
import { nodeHasAc, getNodeAcTexts } from "../utils/ac-helpers.js";
import { findTransitiveBlockers } from "../planner/dependency-chain.js";
import { scoreToGrade } from "../utils/grading.js";
import { XP_SIZE_ORDER } from "../utils/xp-sizing.js";
import { logger } from "../utils/logger.js";

const LARGE_XP_THRESHOLD = 4; // L=4, XL=5

/**
 * Check Definition of Done for a specific task node.
 */
export function checkDefinitionOfDone(doc: GraphDocument, nodeId: string): ImplementDoneReport {
  const node = doc.nodes.find((n) => n.id === nodeId);
  const checks: DodCheck[] = [];

  if (!node) {
    return {
      nodeId,
      title: "(not found)",
      checks: [],
      ready: false,
      score: 0,
      grade: "F",
      summary: `Node "${nodeId}" não encontrado no grafo`,
    };
  }

  // ── Required checks ──

  // 1. has_acceptance_criteria — task or parent has AC (inline or child AC nodes)
  const hasAc = nodeHasAc(doc, nodeId);
  const parentHasAc = node.parentId ? nodeHasAc(doc, node.parentId) : false;
  const acPass = !!(hasAc || parentHasAc);
  checks.push({
    name: "has_acceptance_criteria",
    passed: acPass,
    details: acPass
      ? `AC definidos${parentHasAc && !hasAc ? " (herdado do parent)" : ""}`
      : "Nenhum acceptance criteria definido no node ou parent",
    severity: "required",
  });

  // 2. ac_quality_pass — AC score >= 60
  if (hasAc) {
    const acReport = validateAcQuality(doc, nodeId);
    const nodeReport = acReport.nodes.find((r) => r.nodeId === nodeId);
    const acScore = nodeReport?.score ?? 0;
    const acQualityPass = acScore >= 60;
    checks.push({
      name: "ac_quality_pass",
      passed: acQualityPass,
      details: acQualityPass
        ? `AC quality score: ${acScore} (mínimo: 60)`
        : `AC quality score: ${acScore} — abaixo do mínimo de 60`,
      severity: "required",
    });
  } else {
    checks.push({
      name: "ac_quality_pass",
      passed: false,
      details: "Sem AC para avaliar qualidade",
      severity: "required",
    });
  }

  // 3. no_unresolved_blockers — no depends_on non-done nodes
  const blockers = findTransitiveBlockers(doc, nodeId);
  const unresolvedBlockers = blockers.filter((b) => b.status !== "done");
  const noBlockers = unresolvedBlockers.length === 0;
  checks.push({
    name: "no_unresolved_blockers",
    passed: noBlockers,
    details: noBlockers
      ? "Sem blockers não-resolvidos"
      : `${unresolvedBlockers.length} blocker(s) pendente(s): ${unresolvedBlockers.map((b) => b.id).join(", ")}`,
    severity: "required",
  });

  // 4. status_flow_valid — must have been in_progress or done
  const validStatuses = new Set(["in_progress", "done"]);
  const statusValid = validStatuses.has(node.status);
  checks.push({
    name: "status_flow_valid",
    passed: statusValid,
    details: statusValid
      ? `Status atual: ${node.status}`
      : `Status "${node.status}" — deve passar por in_progress antes de done`,
    severity: "required",
  });

  // ── Recommended checks ──

  // 5. has_description — non-empty description
  const hasDesc = !!(node.description && node.description.trim().length > 0);
  checks.push({
    name: "has_description",
    passed: hasDesc,
    details: hasDesc
      ? "Descrição definida"
      : "Sem descrição — recomendado adicionar contexto",
    severity: "recommended",
  });

  // 6. not_oversized — not L/XL without subtasks
  const sizeOrder = XP_SIZE_ORDER[node.xpSize ?? "M"] ?? 3;
  const isLarge = sizeOrder >= LARGE_XP_THRESHOLD;
  const hasChildren = doc.nodes.some((n) => n.parentId === node.id);
  const notOversized = !isLarge || hasChildren;
  checks.push({
    name: "not_oversized",
    passed: notOversized,
    details: notOversized
      ? isLarge ? `Task ${node.xpSize} com subtasks — ok` : `Task ${node.xpSize ?? "M"} — tamanho adequado`
      : `Task ${node.xpSize} sem subtasks — considerar decomposição`,
    severity: "recommended",
  });

  // 7. has_testable_ac — at least 1 AC is testable (inline or child AC nodes)
  const acs = getNodeAcTexts(doc, nodeId);
  const parsedAcs = acs.map((ac) => parseAc(ac));
  const testableCount = parsedAcs.filter((p) => p.isTestable).length;
  const hasTestableAc = testableCount > 0;
  checks.push({
    name: "has_testable_ac",
    passed: hasTestableAc,
    details: hasTestableAc
      ? `${testableCount}/${acs.length} AC(s) testáveis`
      : "Nenhum AC testável — adicionar assertions concretas",
    severity: "recommended",
  });

  // 8. has_estimate — xpSize or estimateMinutes defined
  const hasEstimate = !!(node.xpSize || node.estimateMinutes);
  checks.push({
    name: "has_estimate",
    passed: hasEstimate,
    details: hasEstimate
      ? `Estimativa: ${node.xpSize ? `size=${node.xpSize}` : ""}${node.estimateMinutes ? ` ${node.estimateMinutes}min` : ""}`.trim()
      : "Sem estimativa — recomendado definir xpSize ou estimateMinutes",
    severity: "recommended",
  });

  // ── Scoring ──
  const totalChecks = checks.length;
  const passedChecks = checks.filter((c) => c.passed).length;
  const score = Math.round((passedChecks / totalChecks) * 100);
  const grade = scoreToGrade(score);
  const ready = checks.filter((c) => c.severity === "required").every((c) => c.passed);

  const summary = ready
    ? `DoD Ready (${grade}): ${passedChecks}/${totalChecks} checks passed, score ${score}`
    : `DoD Not Ready: ${checks.filter((c) => c.severity === "required" && !c.passed).map((c) => c.name).join(", ")} failed`;

  logger.info("definition-of-done", { nodeId, ready, score, grade, passed: passedChecks, total: totalChecks });

  return { nodeId, title: node.title, checks, ready, score, grade, summary };
}
