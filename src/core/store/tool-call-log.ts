/**
 * Tool Call Log — tracks MCP tool calls per node for prerequisite enforcement.
 * Follows ToolTokenStore pattern: receives Database.Database in constructor.
 */

import type Database from "better-sqlite3";
import { now } from "../utils/time.js";
import { logger } from "../utils/logger.js";

export interface ToolCallEntry {
  id: number;
  projectId: string;
  nodeId: string | null;
  toolName: string;
  toolArgs: string | null;
  calledAt: string;
}

interface ToolCallRow {
  id: number;
  project_id: string;
  node_id: string | null;
  tool_name: string;
  tool_args: string | null;
  called_at: string;
}

function rowToEntry(row: ToolCallRow): ToolCallEntry {
  return {
    id: row.id,
    projectId: row.project_id,
    nodeId: row.node_id,
    toolName: row.tool_name,
    toolArgs: row.tool_args,
    calledAt: row.called_at,
  };
}

/** Escape SQL LIKE wildcards (Bug #053). */
function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, (c) => `\\${c}`);
}

export class ToolCallLog {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /** Record a successful tool call. */
  record(projectId: string, nodeId: string | null, toolName: string, toolArgs?: string): void {
    this.db.prepare(
      `INSERT INTO tool_call_log (project_id, node_id, tool_name, tool_args, called_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(projectId, nodeId, toolName, toolArgs ?? null, now());
    logger.debug("tool-call-log: recorded", { toolName, nodeId });
  }

  /** Check if a tool was called for a node (or project-wide when nodeId is null). */
  hasBeenCalled(projectId: string, nodeId: string | null, toolName: string, toolArgs?: string): boolean {
    if (nodeId === null) {
      if (toolArgs) {
        const row = this.db.prepare(
          `SELECT 1 FROM tool_call_log
           WHERE project_id = ? AND node_id IS NULL AND tool_name = ? AND tool_args LIKE ? ESCAPE '\\'
           LIMIT 1`,
        ).get(projectId, toolName, `%${escapeLike(toolArgs)}%`);
        return row !== undefined;
      }
      const row = this.db.prepare(
        `SELECT 1 FROM tool_call_log
         WHERE project_id = ? AND node_id IS NULL AND tool_name = ?
         LIMIT 1`,
      ).get(projectId, toolName);
      return row !== undefined;
    }

    if (toolArgs) {
      const row = this.db.prepare(
        `SELECT 1 FROM tool_call_log
         WHERE project_id = ? AND node_id = ? AND tool_name = ? AND tool_args LIKE ? ESCAPE '\\'
         LIMIT 1`,
      ).get(projectId, nodeId, toolName, `%${escapeLike(toolArgs)}%`);
      return row !== undefined;
    }

    const row = this.db.prepare(
      `SELECT 1 FROM tool_call_log
       WHERE project_id = ? AND node_id = ? AND tool_name = ?
       LIMIT 1`,
    ).get(projectId, nodeId, toolName);
    return row !== undefined;
  }

  /** Get all tool calls for a specific node. */
  getCallsForNode(projectId: string, nodeId: string): ToolCallEntry[] {
    const rows = this.db.prepare(
      `SELECT * FROM tool_call_log
       WHERE project_id = ? AND node_id = ?
       ORDER BY called_at ASC`,
    ).all(projectId, nodeId) as ToolCallRow[];
    return rows.map(rowToEntry);
  }

  /** Clear all logs for a project. */
  clearProject(projectId: string): void {
    this.db.prepare("DELETE FROM tool_call_log WHERE project_id = ?").run(projectId);
    logger.debug("tool-call-log: cleared project", { projectId });
  }
}
