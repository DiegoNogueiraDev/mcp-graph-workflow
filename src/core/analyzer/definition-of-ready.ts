/**
 * Definition of Ready — gate checklist for ANALYZE → DESIGN transition.
 *
 * Checks:
 * 1. ≥1 epic or requirement
 * 2. Tasks with acceptance criteria
 * 3. No orphan nodes
 * 4. No dependency cycles
 * 5. ≥1 constraint
 * 6. ≥1 risk identified
 * 7. PRD quality score ≥ 60
 */

import type { GraphDocument } from "../graph/graph-types.js";
import type { ReadinessReport, ReadinessCheck } from "../../schemas/analyzer-schema.js";
import { analyzeScope } from "./scope-analyzer.js";
import { analyzePrdQuality } from "./prd-quality.js";
import { logger } from "../utils/logger.js";

export function checkDefinitionOfReady(doc: GraphDocument): ReadinessReport {
  const { nodes } = doc;
  const checks: ReadinessCheck[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];

  // 1. Has epics or requirements
  const hasEpicOrReq = nodes.some((n) => n.type === "epic" || n.type === "requirement");
  checks.push({
    name: "has_requirements",
    passed: hasEpicOrReq,
    details: hasEpicOrReq
      ? `${nodes.filter((n) => n.type === "epic" || n.type === "requirement").length} requirements/epics encontrados`
      : "Nenhum epic ou requirement definido",
  });
  if (!hasEpicOrReq) blockers.push("Criar pelo menos 1 epic ou requirement");

  // 2. Tasks with AC
  const tasks = nodes.filter((n) => n.type === "task" || n.type === "subtask");
  const acNodes = nodes.filter((n) => n.type === "acceptance_criteria");
  const tasksWithAc = tasks.filter((n) => n.acceptanceCriteria && n.acceptanceCriteria.length > 0);
  const hasAc = tasksWithAc.length > 0 || acNodes.length > 0;
  checks.push({
    name: "has_acceptance_criteria",
    passed: hasAc,
    details: hasAc
      ? `${tasksWithAc.length} tasks com AC, ${acNodes.length} AC nodes`
      : "Nenhum acceptance criteria definido",
  });
  if (!hasAc && tasks.length > 0) warnings.push("Definir acceptance criteria para as tasks");

  // 3. No orphans
  const scope = analyzeScope(doc);
  const noOrphans = scope.orphans.length === 0;
  checks.push({
    name: "no_orphans",
    passed: noOrphans,
    details: noOrphans
      ? "Nenhum nó órfão detectado"
      : `${scope.orphans.length} nós órfãos: ${scope.orphans.map((o) => o.id).join(", ")}`,
  });
  if (!noOrphans) warnings.push(`Resolver ${scope.orphans.length} nós órfãos`);

  // 4. No cycles
  const noCycles = scope.cycles.length === 0;
  checks.push({
    name: "no_cycles",
    passed: noCycles,
    details: noCycles
      ? "Nenhum ciclo de dependência"
      : `${scope.cycles.length} ciclos detectados`,
  });
  if (!noCycles) blockers.push("Resolver ciclos de dependência");

  // 5. Has constraints
  const hasConstraints = nodes.some((n) => n.type === "constraint");
  checks.push({
    name: "has_constraints",
    passed: hasConstraints,
    details: hasConstraints
      ? `${nodes.filter((n) => n.type === "constraint").length} constraints definidas`
      : "Nenhuma constraint definida",
  });
  if (!hasConstraints) warnings.push("Definir restrições técnicas/negócio");

  // 6. Has risks
  const hasRisks = nodes.some((n) => n.type === "risk");
  checks.push({
    name: "has_risks",
    passed: hasRisks,
    details: hasRisks
      ? `${nodes.filter((n) => n.type === "risk").length} riscos identificados`
      : "Nenhum risco identificado",
  });
  if (!hasRisks) warnings.push("Identificar riscos do projeto");

  // 7. PRD quality score
  const prdQuality = analyzePrdQuality(doc);
  const qualityPass = prdQuality.score >= 60;
  checks.push({
    name: "prd_quality_score",
    passed: qualityPass,
    details: `PRD score: ${prdQuality.score}/100 (${prdQuality.grade}) — mínimo: 60`,
  });
  if (!qualityPass) blockers.push(`PRD quality score ${prdQuality.score} < 60 mínimo`);

  const readyForNextPhase = blockers.length === 0 && checks.filter((c) => !c.passed).length <= 2;

  const passedCount = checks.filter((c) => c.passed).length;
  const summary = `Definition of Ready: ${passedCount}/${checks.length} checks passed. ${readyForNextPhase ? "Ready para DESIGN." : "Não atende os critérios."}`;

  logger.info("definition-of-ready", { passedCount, total: checks.length, ready: readyForNextPhase });

  return { readyForNextPhase, checks, blockers, warnings, summary };
}
