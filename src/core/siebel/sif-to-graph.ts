/**
 * SIF-to-Graph Converter — maps parsed Siebel objects to mcp-graph nodes and edges.
 *
 * Mapping strategy:
 * - SIF Project → epic node
 * - BC, BO, Workflow, Business Service → task nodes (core logic)
 * - Applets, Views, Screens, Web Templates, Integration Objects → subtask nodes (UI/integration)
 * - Dependencies → depends_on / related_to edges
 */

import type { GraphNode, GraphEdge } from "../graph/graph-types.js";
import type {
  SiebelSifParseResult,
  SiebelObject,
  SiebelDependency,
  SiebelObjectType,
} from "../../schemas/siebel.schema.js";
import { generateId } from "../utils/id.js";
import { now } from "../utils/time.js";
import { logger } from "../utils/logger.js";

/** Siebel types mapped to task nodes (core/backend objects). */
const TASK_TYPES: Set<SiebelObjectType> = new Set([
  "business_component",
  "business_object",
  "workflow",
  "business_service",
]);

/** Siebel types mapped to subtask nodes (UI/integration objects). */
const SUBTASK_TYPES: Set<SiebelObjectType> = new Set([
  "applet",
  "view",
  "screen",
  "web_template",
  "integration_object",
  "pick_list",
  "table",
]);

export interface SifToGraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Convert a parsed SIF result into graph nodes and edges.
 */
export function convertSifToGraph(parseResult: SiebelSifParseResult): SifToGraphResult {
  const { metadata, objects, dependencies } = parseResult;

  if (objects.length === 0) {
    return { nodes: [], edges: [] };
  }

  const timestamp = now();
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Lookup: siebelType:siebelName → graphNodeId
  const siebelToNodeId = new Map<string, string>();

  // Create epic node for the project
  const epicId = generateId("siebel");
  const epic: GraphNode = {
    id: epicId,
    type: "epic",
    title: `Siebel: ${metadata.projectName ?? metadata.fileName}`,
    description: `Siebel project imported from ${metadata.fileName}. ${metadata.objectCount} objects, ${dependencies.length} dependencies.`,
    status: "backlog",
    priority: 2,
    tags: ["siebel", "project"],
    sourceRef: { file: metadata.fileName },
    metadata: {
      siebelType: "project",
      siebelProject: metadata.projectName,
      origin: "sif_import",
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  nodes.push(epic);

  // Convert each Siebel object to a graph node
  for (const obj of objects) {
    const nodeType = getGraphNodeType(obj.type);
    const nodeId = generateId("siebel");

    siebelToNodeId.set(`${obj.type}:${obj.name}`, nodeId);

    const description = buildDescription(obj);

    const node: GraphNode = {
      id: nodeId,
      type: nodeType,
      title: obj.name,
      description,
      status: "backlog",
      priority: getPriority(obj.type),
      tags: ["siebel", obj.type],
      parentId: epicId,
      sourceRef: { file: metadata.fileName },
      metadata: {
        siebelType: obj.type,
        siebelProject: obj.project,
        siebelProperties: obj.properties.reduce(
          (acc, p) => ({ ...acc, [p.name]: p.value }),
          {} as Record<string, string>,
        ),
        childCount: obj.children.length,
        origin: "sif_import",
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    nodes.push(node);
  }

  // Convert dependencies to edges
  for (const dep of dependencies) {
    const fromKey = `${dep.from.type}:${dep.from.name}`;
    const toKey = `${dep.to.type}:${dep.to.name}`;
    const fromId = siebelToNodeId.get(fromKey);
    const toId = siebelToNodeId.get(toKey);

    if (fromId && toId) {
      edges.push({
        id: generateId("edge"),
        from: fromId,
        to: toId,
        relationType: mapDependencyRelation(dep),
        reason: `Siebel ${dep.relationType}: ${dep.from.name} → ${dep.to.name}`,
        metadata: {
          inferred: dep.inferred ?? true,
          siebelRelationType: dep.relationType,
        },
        createdAt: timestamp,
      });
    }
  }

  logger.info("SIF converted to graph", {
    nodes: String(nodes.length),
    edges: String(edges.length),
    epicId,
  });

  return { nodes, edges };
}

function getGraphNodeType(siebelType: SiebelObjectType): "epic" | "task" | "subtask" {
  if (TASK_TYPES.has(siebelType)) return "task";
  if (SUBTASK_TYPES.has(siebelType)) return "subtask";
  return "task";
}

function getPriority(siebelType: SiebelObjectType): 1 | 2 | 3 | 4 | 5 {
  switch (siebelType) {
    case "business_component":
    case "business_object":
      return 2;
    case "workflow":
    case "business_service":
      return 3;
    case "applet":
    case "view":
      return 3;
    case "screen":
    case "web_template":
    case "integration_object":
      return 4;
    default:
      return 3;
  }
}

function buildDescription(obj: SiebelObject): string {
  const parts: string[] = [`Siebel ${obj.type.replace(/_/g, " ")} — ${obj.name}`];

  const table = obj.properties.find((p) => p.name === "TABLE");
  if (table) parts.push(`Table: ${table.value}`);

  const busComp = obj.properties.find((p) => p.name === "BUS_COMP");
  if (busComp) parts.push(`BC: ${busComp.value}`);

  const busObject = obj.properties.find((p) => p.name === "BUS_OBJECT");
  if (busObject) parts.push(`BO: ${busObject.value}`);

  if (obj.children.length > 0) {
    parts.push(`Children: ${obj.children.length}`);
  }

  return parts.join(". ");
}

function mapDependencyRelation(dep: SiebelDependency): "depends_on" | "related_to" {
  switch (dep.relationType) {
    case "uses":
    case "references":
    case "based_on":
      return "depends_on";
    case "contains":
    case "extends":
    case "linked_to":
    case "parent_of":
      return "related_to";
    default:
      return "related_to";
  }
}
