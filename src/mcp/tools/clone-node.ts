import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import type { GraphNode, RelationType } from "../../core/graph/graph-types.js";
import { NodeNotFoundError } from "../../core/utils/errors.js";
import { generateId } from "../../core/utils/id.js";
import { now } from "../../core/utils/time.js";
import { logger } from "../../core/utils/logger.js";

function cloneSingle(
  store: SqliteStore,
  source: GraphNode,
  parentId: string | null | undefined,
  timestamp: string,
): GraphNode {
  const clone: GraphNode = {
    id: generateId("node"),
    type: source.type,
    title: source.title,
    description: source.description,
    status: "backlog",
    priority: source.priority,
    xpSize: source.xpSize,
    estimateMinutes: source.estimateMinutes,
    tags: source.tags ? [...source.tags] : undefined,
    parentId: parentId,
    sprint: source.sprint,
    acceptanceCriteria: source.acceptanceCriteria ? [...source.acceptanceCriteria] : undefined,
    blocked: false,
    metadata: source.metadata ? { ...source.metadata } : undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  store.insertNode(clone);

  if (parentId) {
    store.insertEdge({
      id: generateId("edge"),
      from: parentId,
      to: clone.id,
      relationType: "parent_of" as RelationType,
      createdAt: timestamp,
    });
    store.insertEdge({
      id: generateId("edge"),
      from: clone.id,
      to: parentId,
      relationType: "child_of" as RelationType,
      createdAt: timestamp,
    });
  }

  return clone;
}

function cloneDeep(
  store: SqliteStore,
  sourceId: string,
  parentId: string | null | undefined,
  timestamp: string,
  cloned: GraphNode[],
): void {
  const source = store.getNodeById(sourceId);
  if (!source) return;

  const clone = cloneSingle(store, source, parentId, timestamp);
  cloned.push(clone);

  const children = store.getChildNodes(sourceId);
  for (const child of children) {
    cloneDeep(store, child.id, clone.id, timestamp, cloned);
  }
}

export function registerCloneNode(server: McpServer, store: SqliteStore): void {
  server.tool(
    "clone_node",
    "Clone a node (optionally with all children)",
    {
      id: z.string().describe("The node ID to clone"),
      deep: z.boolean().optional().describe("Clone children recursively (default: false)"),
      newParentId: z.string().optional().describe("Parent ID for the cloned node"),
    },
    async ({ id, deep, newParentId }) => {
      logger.debug("tool:clone_node", { sourceId: id, deep });
      const source = store.getNodeById(id);
      if (!source) {
        const err = new NodeNotFoundError(id);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ error: err.message }) },
          ],
          isError: true,
        };
      }

      if (newParentId) {
        const parent = store.getNodeById(newParentId);
        if (!parent) {
          const err = new NodeNotFoundError(newParentId);
          return {
            content: [
              { type: "text" as const, text: JSON.stringify({ error: `Parent not found: ${err.message}` }) },
            ],
            isError: true,
          };
        }
      }

      const timestamp = now();
      const parentForClone = newParentId ?? source.parentId;

      if (deep) {
        const cloned: GraphNode[] = [];
        cloneDeep(store, id, parentForClone, timestamp, cloned);
        logger.info("tool:clone_node:ok", { sourceId: id, deep: true, clonedCount: cloned.length });
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ ok: true, clonedCount: cloned.length, nodes: cloned }, null, 2),
            },
          ],
        };
      }

      const clone = cloneSingle(store, source, parentForClone, timestamp);
      logger.info("tool:clone_node:ok", { sourceId: id, deep: false, cloneId: clone.id });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ ok: true, node: clone }, null, 2),
          },
        ],
      };
    },
  );
}
