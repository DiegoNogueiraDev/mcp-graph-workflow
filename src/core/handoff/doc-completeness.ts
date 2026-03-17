/**
 * Doc Completeness Checker — validates documentation coverage for handoff.
 */

import type { GraphDocument } from "../graph/graph-types.js";
import type { DocCompletenessReport } from "../../schemas/handoff-schema.js";
import { logger } from "../utils/logger.js";

export function checkDocCompleteness(doc: GraphDocument): DocCompletenessReport {
  const { nodes } = doc;

  const withDescription = nodes.filter((n) => n.description && n.description.trim().length > 0);
  const withoutDescription = nodes.filter((n) => !n.description || n.description.trim().length === 0);

  const totalNodes = nodes.length;
  const descriptionsPresent = withDescription.length;
  const coverageRate = totalNodes > 0 ? Math.round((descriptionsPresent / totalNodes) * 100) : 100;

  const nodesWithoutDescription = withoutDescription.map((n) => ({
    nodeId: n.id,
    title: n.title,
  }));

  logger.info("doc-completeness", { coverageRate, totalNodes, descriptionsPresent });

  return { descriptionsPresent, totalNodes, coverageRate, nodesWithoutDescription };
}
