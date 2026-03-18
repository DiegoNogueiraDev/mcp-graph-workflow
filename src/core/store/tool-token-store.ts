/**
 * Tool Token Store — tracks token usage per MCP tool call.
 * Follows KnowledgeStore pattern: receives Database.Database in constructor.
 */

import type Database from "better-sqlite3";
import { now } from "../utils/time.js";
import { logger } from "../utils/logger.js";

export interface ToolTokenEntry {
  id: number;
  projectId: string;
  toolName: string;
  inputTokens: number;
  outputTokens: number;
  calledAt: string;
}

export interface ToolTokenAggregate {
  toolName: string;
  callCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  totalTokens: number;
}

export interface ToolTokenSummary {
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  perTool: ToolTokenAggregate[];
  recentCalls: ToolTokenEntry[];
}

interface TokenRow {
  id: number;
  project_id: string;
  tool_name: string;
  input_tokens: number;
  output_tokens: number;
  called_at: string;
}

interface AggregateRow {
  tool_name: string;
  call_count: number;
  total_input: number;
  total_output: number;
  avg_input: number;
  avg_output: number;
}

interface TotalsRow {
  total_calls: number;
  total_input: number;
  total_output: number;
}

function rowToEntry(row: TokenRow): ToolTokenEntry {
  return {
    id: row.id,
    projectId: row.project_id,
    toolName: row.tool_name,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    calledAt: row.called_at,
  };
}

function rowToAggregate(row: AggregateRow): ToolTokenAggregate {
  return {
    toolName: row.tool_name,
    callCount: row.call_count,
    totalInputTokens: row.total_input,
    totalOutputTokens: row.total_output,
    avgInputTokens: Math.round(row.avg_input),
    avgOutputTokens: Math.round(row.avg_output),
    totalTokens: row.total_input + row.total_output,
  };
}

export class ToolTokenStore {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  record(projectId: string, toolName: string, inputTokens: number, outputTokens: number): void {
    this.db.prepare(
      `INSERT INTO tool_token_usage (project_id, tool_name, input_tokens, output_tokens, called_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(projectId, toolName, inputTokens, outputTokens, now());
    logger.debug("tool-token-store: recorded", { toolName, inputTokens, outputTokens });
  }

  getPerToolStats(projectId: string): ToolTokenAggregate[] {
    const rows = this.db.prepare(
      `SELECT
         tool_name,
         COUNT(*) AS call_count,
         SUM(input_tokens) AS total_input,
         SUM(output_tokens) AS total_output,
         AVG(input_tokens) AS avg_input,
         AVG(output_tokens) AS avg_output
       FROM tool_token_usage
       WHERE project_id = ?
       GROUP BY tool_name
       ORDER BY (SUM(input_tokens) + SUM(output_tokens)) DESC`,
    ).all(projectId) as AggregateRow[];

    return rows.map(rowToAggregate);
  }

  getRecentCalls(projectId: string, limit: number = 20): ToolTokenEntry[] {
    const rows = this.db.prepare(
      `SELECT * FROM tool_token_usage
       WHERE project_id = ?
       ORDER BY called_at DESC, id DESC
       LIMIT ?`,
    ).all(projectId, limit) as TokenRow[];

    return rows.map(rowToEntry);
  }

  getSummary(projectId: string, recentLimit: number = 20): ToolTokenSummary {
    const totals = this.db.prepare(
      `SELECT
         COUNT(*) AS total_calls,
         COALESCE(SUM(input_tokens), 0) AS total_input,
         COALESCE(SUM(output_tokens), 0) AS total_output
       FROM tool_token_usage
       WHERE project_id = ?`,
    ).get(projectId) as TotalsRow;

    return {
      totalCalls: totals.total_calls,
      totalInputTokens: totals.total_input,
      totalOutputTokens: totals.total_output,
      perTool: this.getPerToolStats(projectId),
      recentCalls: this.getRecentCalls(projectId, recentLimit),
    };
  }

  clearProject(projectId: string): void {
    this.db.prepare("DELETE FROM tool_token_usage WHERE project_id = ?").run(projectId);
    logger.debug("tool-token-store: cleared project", { projectId });
  }
}
