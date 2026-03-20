/**
 * Traceability matrix: requirement → decision → constraint coverage.
 * Follows edges to determine coverage level per requirement.
 */

import type { GraphDocument } from "../graph/graph-types.js";
import type { TraceabilityReport, TraceabilityEntry, TraceabilityCoverage } from "../../schemas/designer-schema.js";
import { logger } from "../utils/logger.js";

const TRACEABILITY_EDGE_TYPES = new Set([
  "implements", "derived_from", "related_to", "depends_on", "parent_of", "child_of",
]);

/**
 * Find all nodes of given types connected to nodeId via traceability edges (both directions).
 */
function findLinked(doc: GraphDocument, nodeId: string, targetTypes: Set<string>): string[] {
  const linked = new Set<string>();
  const nodeTypeMap = new Map(doc.nodes.map((n) => [n.id, n.type]));

  for (const edge of doc.edges) {
    if (!TRACEABILITY_EDGE_TYPES.has(edge.relationType)) continue;

    let otherId: string | null = null;
    if (edge.from === nodeId) otherId = edge.to;
    else if (edge.to === nodeId) otherId = edge.from;

    if (otherId && targetTypes.has(nodeTypeMap.get(otherId) ?? "")) {
      linked.add(otherId);
    }
  }

  return [...linked];
}

function determineCoverage(linkedDecisions: string[], linkedConstraints: string[]): TraceabilityCoverage {
  if (linkedDecisions.length > 0 && linkedConstraints.length > 0) return "full";
  if (linkedDecisions.length > 0 || linkedConstraints.length > 0) return "partial";
  return "none";
}

export function buildTraceabilityMatrix(doc: GraphDocument): TraceabilityReport {
  const requirements = doc.nodes.filter((n) => n.type === "requirement");
  const decisions = doc.nodes.filter((n) => n.type === "decision");

  const decisionTypes = new Set(["decision"]);
  const constraintTypes = new Set(["constraint"]);

  const matrix: TraceabilityEntry[] = requirements.map((req) => {
    const linkedDecisions = findLinked(doc, req.id, decisionTypes);
    const linkedConstraints = findLinked(doc, req.id, constraintTypes);
    const coverage = determineCoverage(linkedDecisions, linkedConstraints);

    return {
      requirementId: req.id,
      linkedDecisions,
      linkedConstraints,
      coverage,
    };
  });

  const orphanRequirements = matrix
    .filter((e) => e.coverage === "none")
    .map((e) => e.requirementId);

  const coveredCount = matrix.filter((e) => e.coverage !== "none").length;

  // Find orphan decisions: not linked to any requirement
  const linkedDecisionIds = new Set(matrix.flatMap((e) => e.linkedDecisions));
  const orphanDecisions = decisions
    .filter((d) => !linkedDecisionIds.has(d.id))
    .map((d) => d.id);

  // Include orphan decisions in coverage calculation
  const linkedDecisionCount = decisions.length - orphanDecisions.length;
  const totalItems = requirements.length + decisions.length;
  const linkedItems = coveredCount + linkedDecisionCount;
  const coverageRate = totalItems > 0
    ? Math.round((linkedItems / totalItems) * 10000) / 100
    : 100;

  logger.info("traceability-matrix", { requirements: requirements.length, coverageRate });

  return { matrix, coverageRate, orphanRequirements, orphanDecisions };
}
