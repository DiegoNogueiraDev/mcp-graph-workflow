/**
 * Node Indexer — indexes graph nodes into the Knowledge Store
 * so they become discoverable via RAG search.
 *
 * Converts node content (title, description, AC, tags) into
 * knowledge documents with sourceType "graph_node".
 */

import type Database from "better-sqlite3";
import type { GraphNode, NodeType, NodeStatus } from "../graph/graph-types.js";
import { KnowledgeStore } from "../store/knowledge-store.js";
import { indexEntitiesForDoc } from "./entity-index-hook.js";
import { logger } from "../utils/logger.js";

/**
 * Index a single graph node as a knowledge document.
 * If a doc already exists for this node (same sourceId), it is replaced.
 */
export function indexNodeAsKnowledge(db: Database.Database, node: GraphNode): void {
  try {
    const ks = new KnowledgeStore(db);

    // Build rich content from node fields
    const parts: string[] = [];
    parts.push(`# ${node.title}`);
    parts.push(`Type: ${node.type} | Status: ${node.status} | Priority: ${node.priority}`);

    if (node.description) {
      parts.push("", node.description);
    }

    if (node.acceptanceCriteria && node.acceptanceCriteria.length > 0) {
      parts.push("", "## Acceptance Criteria");
      for (const ac of node.acceptanceCriteria) {
        parts.push(`- ${ac}`);
      }
    }

    if (node.tags && node.tags.length > 0) {
      parts.push("", `Tags: ${node.tags.join(", ")}`);
    }

    const content = parts.join("\n");

    // Remove existing doc for this node (update = delete + insert)
    removeNodeFromKnowledge(db, node.id);

    // Insert as knowledge document
    const doc = ks.insert({
      sourceType: "graph_node",
      sourceId: node.id,
      title: node.title,
      content,
      chunkIndex: 0,
      metadata: {
        nodeType: node.type,
        status: node.status,
        priority: node.priority,
      },
    });

    // Extract entities from the node content
    indexEntitiesForDoc(db, doc.id);

    logger.debug("node-indexer:indexed", { nodeId: node.id, docId: doc.id });
  } catch (err) {
    logger.warn("node-indexer:index-failed", { nodeId: node.id, error: String(err) });
  }
}

/**
 * Remove a node's knowledge document.
 */
export function removeNodeFromKnowledge(db: Database.Database, nodeId: string): void {
  try {
    const ks = new KnowledgeStore(db);
    const docs = ks.getBySourceId(nodeId);
    for (const doc of docs) {
      // Clean up orphaned entity mentions before deleting the doc
      try {
        db.prepare("DELETE FROM kg_mentions WHERE doc_id = ?").run(doc.id);
      } catch {
        // kg_mentions table may not exist yet — safe to ignore
      }
      ks.delete(doc.id);
    }
  } catch (err) {
    logger.warn("node-indexer:remove-failed", { nodeId, error: String(err) });
  }
}

/**
 * Index all existing graph nodes into the Knowledge Store.
 * Used by reindex_knowledge with source "graph".
 */
export function indexAllNodes(db: Database.Database, projectId?: string): { indexed: number } {
  try {
    const rows = projectId
      ? db.prepare("SELECT * FROM nodes WHERE project_id = ?").all(projectId) as Array<Record<string, unknown>>
      : db.prepare("SELECT * FROM nodes").all() as Array<Record<string, unknown>>;

    let indexed = 0;
    for (const row of rows) {
      try {
        const node: GraphNode = {
          id: row.id as string,
          type: row.type as NodeType,
          title: row.title as string,
          description: row.description as string | undefined,
          status: row.status as NodeStatus,
          priority: row.priority as 1 | 2 | 3 | 4 | 5,
          tags: row.tags ? JSON.parse(row.tags as string) as string[] : undefined,
          acceptanceCriteria: row.acceptance_criteria ? JSON.parse(row.acceptance_criteria as string) as string[] : undefined,
          parentId: row.parent_id as string | undefined,
          createdAt: row.created_at as string,
          updatedAt: row.updated_at as string,
        };
        indexNodeAsKnowledge(db, node);
        indexed++;
      } catch (rowErr) {
        logger.warn("node-indexer:row-parse-failed", { rowId: row.id, error: String(rowErr) });
      }
    }

    logger.info("node-indexer:all-indexed", { indexed });
    return { indexed };
  } catch (err) {
    logger.warn("node-indexer:index-all-failed", { error: String(err) });
    return { indexed: 0 };
  }
}
