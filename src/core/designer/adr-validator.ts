/**
 * ADR (Architecture Decision Record) validator.
 * Validates decision nodes against ADR pattern: Status, Context, Decision, Consequences.
 */

import type { GraphDocument } from "../graph/graph-types.js";
import type { AdrReport, AdrGrade, AdrValidationResult } from "../../schemas/designer-schema.js";
import { logger } from "../utils/logger.js";

const ADR_SECTIONS = ["Status", "Context", "Decision", "Consequences"] as const;

/** Match both `## Section` and `Section:` formats, case-insensitive */
function hasSection(text: string, section: string): boolean {
  const sectionLower = section.toLowerCase();
  const lines = text.toLowerCase().split("\n");
  return lines.some((line) => {
    const trimmed = line.trimStart();
    return trimmed.startsWith(`## ${sectionLower}`) ||
      trimmed.startsWith(`##${sectionLower}`) ||
      trimmed.startsWith(`${sectionLower}:`) ||
      trimmed.startsWith(`${sectionLower} :`);
  });
}

function sectionCountToGrade(count: number): AdrGrade {
  if (count >= 4) return "A";
  if (count === 3) return "B";
  if (count === 2) return "C";
  if (count === 1) return "D";
  return "F";
}

const GRADE_ORDER: Record<AdrGrade, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };

export function validateAdrs(doc: GraphDocument): AdrReport {
  const decisionNodes = doc.nodes.filter((n) => n.type === "decision");

  const decisions: AdrValidationResult[] = decisionNodes.map((node) => {
    const text = node.description ?? "";
    const hasStatus = hasSection(text, "Status");
    const hasContext = hasSection(text, "Context");
    const hasDecision = hasSection(text, "Decision");
    const hasConsequences = hasSection(text, "Consequences");

    const sectionFlags = { Status: hasStatus, Context: hasContext, Decision: hasDecision, Consequences: hasConsequences };
    const missingFields = ADR_SECTIONS.filter((s) => !sectionFlags[s]);
    const sectionCount = ADR_SECTIONS.length - missingFields.length;

    return {
      nodeId: node.id,
      title: node.title,
      grade: sectionCountToGrade(sectionCount),
      hasStatus,
      hasContext,
      hasDecision,
      hasConsequences,
      missingFields,
    };
  });

  let overallGrade: AdrGrade = "F";
  if (decisions.length > 0) {
    overallGrade = decisions.reduce<AdrGrade>(
      (worst, d) => (GRADE_ORDER[d.grade] < GRADE_ORDER[worst] ? d.grade : worst),
      "A",
    );
  }

  const summary = `${decisions.length} decision(s) avaliada(s). Grade geral: ${overallGrade}`;
  logger.info("adr-validator", { count: decisions.length, overallGrade });

  return { decisions, overallGrade, summary };
}
