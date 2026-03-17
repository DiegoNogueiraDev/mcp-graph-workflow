/**
 * AC Validator — INVEST check for acceptance criteria quality.
 *
 * Checks:
 * - I: Independent — AC doesn't reference other ACs
 * - N: Negotiable — not overly prescriptive (implementation details)
 * - V: Valuable — has a clear outcome/benefit
 * - E: Estimable — can be estimated (not too vague)
 * - S: Small — not too many steps
 * - T: Testable — has concrete assertions
 */

import type { GraphDocument, GraphNode } from "../graph/graph-types.js";
import type { AcQualityReport, AcNodeReport, InvestCheck } from "../../schemas/ac-quality-schema.js";
import { parseAc } from "./ac-parser.js";
import { logger } from "../utils/logger.js";

const VAGUE_TERMS = [
  "apropriado", "appropriate", "adequado", "adequate",
  "rápido", "fast", "bom", "good", "bonito", "nice",
  "eficiente", "efficient", "robusto", "robust",
  "escalável", "scalable", "intuitivo", "intuitive",
  "fácil", "easy", "simples", "simple",
  "melhor", "better", "ótimo", "great",
  "etc", "e outros", "and more",
];

const IMPLEMENTATION_KEYWORDS = [
  "sql", "query", "endpoint", "api call", "function",
  "class", "method", "variable", "database", "table",
  "column", "redis", "queue", "cron",
];

export function validateAcQuality(doc: GraphDocument, nodeId?: string, all?: boolean): AcQualityReport {
  const { nodes } = doc;
  const targetNodes = selectTargetNodes(nodes, nodeId, all);
  const reports: AcNodeReport[] = [];

  for (const node of targetNodes) {
    const acs = node.acceptanceCriteria ?? [];
    if (acs.length === 0) continue;

    const parsedAcs = acs.map((ac) => parseAc(ac));
    const investChecks = runInvestChecks(node, parsedAcs);
    const vagueTerms = detectVagueTerms(acs);

    const passedChecks = investChecks.filter((c) => c.passed).length;
    const score = investChecks.length > 0
      ? Math.round((passedChecks / investChecks.length) * 100)
      : 0;

    reports.push({
      nodeId: node.id,
      title: node.title,
      score,
      parsedAcs,
      investChecks,
      vagueTerms,
    });
  }

  const overallScore = reports.length > 0
    ? Math.round(reports.reduce((sum, r) => sum + r.score, 0) / reports.length)
    : 0;

  const summary = reports.length > 0
    ? `AC Quality: ${overallScore}/100 across ${reports.length} nodes. ${reports.filter((r) => r.score >= 80).length} nodes with good AC quality.`
    : "Nenhum node com acceptance criteria encontrado.";

  logger.info("ac-validator", { nodeCount: reports.length, overallScore });

  return { nodes: reports, overallScore, summary };
}

function selectTargetNodes(nodes: GraphNode[], nodeId?: string, all?: boolean): GraphNode[] {
  if (nodeId) {
    const node = nodes.find((n) => n.id === nodeId);
    return node ? [node] : [];
  }

  if (all) {
    return nodes.filter((n) =>
      (n.type === "task" || n.type === "subtask") &&
      n.acceptanceCriteria &&
      n.acceptanceCriteria.length > 0,
    );
  }

  // Default: all tasks with AC
  return nodes.filter((n) =>
    (n.type === "task" || n.type === "subtask") &&
    n.acceptanceCriteria &&
    n.acceptanceCriteria.length > 0,
  );
}

function runInvestChecks(
  node: GraphNode,
  parsedAcs: ReturnType<typeof parseAc>[],
): InvestCheck[] {
  const checks: InvestCheck[] = [];
  const allText = (node.acceptanceCriteria ?? []).join(" ").toLowerCase();

  // I — Independent
  const hasInternalRefs = /ac\s*\d|critério\s*\d|criterion\s*\d/i.test(allText);
  checks.push({
    criterion: "Independent",
    passed: !hasInternalRefs,
    details: hasInternalRefs
      ? "AC referencia outros critérios — deve ser independente"
      : "AC é independente",
  });

  // N — Negotiable (not implementation-specific)
  const hasImpl = IMPLEMENTATION_KEYWORDS.some((k) => allText.includes(k));
  checks.push({
    criterion: "Negotiable",
    passed: !hasImpl,
    details: hasImpl
      ? "AC contém detalhes de implementação — deve descrever comportamento, não solução"
      : "AC descreve comportamento, não implementação",
  });

  // V — Valuable (has clear outcome)
  const hasOutcome = parsedAcs.some((p) => p.isTestable);
  checks.push({
    criterion: "Valuable",
    passed: hasOutcome,
    details: hasOutcome
      ? "AC descreve resultado observável"
      : "AC não descreve resultado claro — adicionar verbo de ação concreto",
  });

  // E — Estimable (not too vague)
  const vagueCount = detectVagueTerms(node.acceptanceCriteria ?? []).length;
  const isEstimable = vagueCount <= 1;
  checks.push({
    criterion: "Estimable",
    passed: isEstimable,
    details: isEstimable
      ? "AC é específico o suficiente para estimar"
      : `AC contém ${vagueCount} termos vagos — quantificar critérios`,
  });

  // S — Small (not too many steps)
  const totalSteps = parsedAcs.reduce((sum, p) => sum + (p.steps?.length ?? 1), 0);
  const isSmall = totalSteps <= 10;
  checks.push({
    criterion: "Small",
    passed: isSmall,
    details: isSmall
      ? `${totalSteps} steps — tamanho adequado`
      : `${totalSteps} steps — considerar dividir em ACs menores`,
  });

  // T — Testable
  const testableCount = parsedAcs.filter((p) => p.isTestable).length;
  const isTestable = testableCount > 0 && testableCount >= parsedAcs.length * 0.5;
  checks.push({
    criterion: "Testable",
    passed: isTestable,
    details: isTestable
      ? `${testableCount}/${parsedAcs.length} ACs testáveis`
      : `Apenas ${testableCount}/${parsedAcs.length} ACs são testáveis — adicionar assertions concretas`,
  });

  return checks;
}

function detectVagueTerms(acs: string[]): string[] {
  const allText = acs.join(" ").toLowerCase();
  return VAGUE_TERMS.filter((term) => allText.includes(term));
}
