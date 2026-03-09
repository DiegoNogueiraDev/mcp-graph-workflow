import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type {
  GraphDocument,
  GraphNode,
  GraphEdge,
  GraphProject,
  NodeType,
  NodeStatus,
  SourceRef,
} from "../graph/graph-types.js";
import { buildIndexes } from "../graph/graph-indexes.js";
import { generateId } from "../utils/id.js";
import { now } from "../utils/time.js";
import { configureDb, runMigrations } from "./migrations.js";
import { logger } from "../utils/logger.js";
import { GraphNotInitializedError, ValidationError, SnapshotNotFoundError } from "../utils/errors.js";
import { GraphNodeSchema } from "../../schemas/node.schema.js";
import { GraphEdgeSchema } from "../../schemas/edge.schema.js";
import { z } from "zod/v4";

const STORE_DIR = ".mcp-graph";
const DB_FILE = "graph.db";

// ── Row types (SQLite ↔ JS) ─────────────────────────────

interface ProjectRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface NodeRow {
  id: string;
  project_id: string;
  type: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  xp_size: string | null;
  estimate_minutes: number | null;
  tags: string | null;
  parent_id: string | null;
  sprint: string | null;
  source_file: string | null;
  source_start_line: number | null;
  source_end_line: number | null;
  source_confidence: number | null;
  acceptance_criteria: string | null;
  blocked: number;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

interface EdgeRow {
  id: string;
  project_id: string;
  from_node: string;
  to_node: string;
  relation_type: string;
  weight: number | null;
  reason: string | null;
  metadata: string | null;
  created_at: string;
}

interface StatsRow {
  type: string;
  status: string;
  count: number;
}

// ── Mapping helpers ──────────────────────────────────────

function nodeToRow(node: GraphNode, projectId: string): NodeRow {
  return {
    id: node.id,
    project_id: projectId,
    type: node.type,
    title: node.title,
    description: node.description ?? null,
    status: node.status,
    priority: node.priority,
    xp_size: node.xpSize ?? null,
    estimate_minutes: node.estimateMinutes ?? null,
    tags: node.tags ? JSON.stringify(node.tags) : null,
    parent_id: node.parentId ?? null,
    sprint: node.sprint ?? null,
    source_file: node.sourceRef?.file ?? null,
    source_start_line: node.sourceRef?.startLine ?? null,
    source_end_line: node.sourceRef?.endLine ?? null,
    source_confidence: node.sourceRef?.confidence ?? null,
    acceptance_criteria: node.acceptanceCriteria
      ? JSON.stringify(node.acceptanceCriteria)
      : null,
    blocked: node.blocked ? 1 : 0,
    metadata: node.metadata ? JSON.stringify(node.metadata) : null,
    created_at: node.createdAt,
    updated_at: node.updatedAt,
  };
}

function rowToNode(row: NodeRow): GraphNode {
  const node: GraphNode = {
    id: row.id,
    type: row.type as NodeType,
    title: row.title,
    status: row.status as NodeStatus,
    priority: row.priority as 1 | 2 | 3 | 4 | 5,
    blocked: row.blocked === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (row.description) node.description = row.description;
  if (row.xp_size) node.xpSize = row.xp_size as GraphNode["xpSize"];
  if (row.estimate_minutes != null) node.estimateMinutes = row.estimate_minutes;
  if (row.tags) node.tags = JSON.parse(row.tags);
  if (row.parent_id) node.parentId = row.parent_id;
  if (row.sprint) node.sprint = row.sprint;
  if (row.acceptance_criteria)
    node.acceptanceCriteria = JSON.parse(row.acceptance_criteria);
  if (row.metadata) node.metadata = JSON.parse(row.metadata);

  if (row.source_file) {
    const ref: SourceRef = { file: row.source_file };
    if (row.source_start_line != null) ref.startLine = row.source_start_line;
    if (row.source_end_line != null) ref.endLine = row.source_end_line;
    if (row.source_confidence != null) ref.confidence = row.source_confidence;
    node.sourceRef = ref;
  }

  return node;
}

function edgeToRow(edge: GraphEdge, projectId: string): EdgeRow {
  return {
    id: edge.id,
    project_id: projectId,
    from_node: edge.from,
    to_node: edge.to,
    relation_type: edge.relationType,
    weight: edge.weight ?? null,
    reason: edge.reason ?? null,
    metadata: edge.metadata ? JSON.stringify(edge.metadata) : null,
    created_at: edge.createdAt,
  };
}

function rowToEdge(row: EdgeRow): GraphEdge {
  const edge: GraphEdge = {
    id: row.id,
    from: row.from_node,
    to: row.to_node,
    relationType: row.relation_type as GraphEdge["relationType"],
    createdAt: row.created_at,
  };

  if (row.weight != null) edge.weight = row.weight;
  if (row.reason) edge.reason = row.reason;
  if (row.metadata) edge.metadata = JSON.parse(row.metadata);

  return edge;
}

// ── SqliteStore ──────────────────────────────────────────

export class SqliteStore {
  private db: Database.Database;
  private projectId: string | null = null;
  private _eventBus: import("../events/event-bus.js").GraphEventBus | null = null;

  private constructor(db: Database.Database) {
    this.db = db;
  }

  /** Attach an event bus to emit mutation events */
  set eventBus(bus: import("../events/event-bus.js").GraphEventBus | null) {
    this._eventBus = bus;
  }

  get eventBus(): import("../events/event-bus.js").GraphEventBus | null {
    return this._eventBus;
  }

  /**
   * Open (or create) a store at basePath/.mcp-graph/graph.db.
   * Pass ":memory:" for in-memory testing.
   */
  static open(basePath: string = process.cwd()): SqliteStore {
    let db: Database.Database;

    if (basePath === ":memory:") {
      db = new Database(":memory:");
    } else {
      const dir = path.join(basePath, STORE_DIR);
      mkdirSync(dir, { recursive: true });
      db = new Database(path.join(dir, DB_FILE));
    }

    configureDb(db);
    runMigrations(db);

    const store = new SqliteStore(db);

    // Auto-load project if one exists
    const row = db
      .prepare("SELECT id FROM projects LIMIT 1")
      .get() as { id: string } | undefined;
    if (row) store.projectId = row.id;

    logger.info(`Store opened${basePath === ":memory:" ? " (in-memory)" : ` at ${basePath}`}`);
    return store;
  }

  /** Expose the raw database instance for extension modules (e.g. DocsCacheStore). */
  getDb(): Database.Database {
    return this.db;
  }

  close(): void {
    this.db.close();
  }

  // ── Project ──────────────────────────────────────

  initProject(name: string = "Local MCP Graph"): GraphProject {
    if (this.projectId) {
      return this.getProject()!;
    }

    const id = generateId("proj");
    const timestamp = now();
    this.db
      .prepare(
        "INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
      )
      .run(id, name, timestamp, timestamp);

    this.projectId = id;
    logger.info(`Project initialized: ${name} (${id})`);
    return { id, name, createdAt: timestamp, updatedAt: timestamp };
  }

  getProject(): GraphProject | null {
    if (!this.projectId) return null;
    const row = this.db
      .prepare("SELECT * FROM projects WHERE id = ?")
      .get(this.projectId) as ProjectRow | undefined;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private ensureProject(): string {
    if (!this.projectId) {
      throw new GraphNotInitializedError();
    }
    return this.projectId;
  }

  // ── Nodes ────────────────────────────────────────

  insertNode(node: GraphNode): void {
    try {
      GraphNodeSchema.parse(node);
    } catch (err) {
      if (err instanceof z.ZodError) {
        throw new ValidationError("Invalid node", err.issues);
      }
      throw err;
    }
    const pid = this.ensureProject();
    const row = nodeToRow(node, pid);
    this.db
      .prepare(
        `INSERT INTO nodes
          (id, project_id, type, title, description, status, priority,
           xp_size, estimate_minutes, tags, parent_id, sprint,
           source_file, source_start_line, source_end_line, source_confidence,
           acceptance_criteria, blocked, metadata, created_at, updated_at)
         VALUES
          (@id, @project_id, @type, @title, @description, @status, @priority,
           @xp_size, @estimate_minutes, @tags, @parent_id, @sprint,
           @source_file, @source_start_line, @source_end_line, @source_confidence,
           @acceptance_criteria, @blocked, @metadata, @created_at, @updated_at)`,
      )
      .run(row);
    this._eventBus?.emitTyped("node:created", { nodeId: node.id, title: node.title, nodeType: node.type });
  }

  getNodeById(id: string): GraphNode | null {
    this.ensureProject();
    const row = this.db
      .prepare("SELECT * FROM nodes WHERE id = ? AND project_id = ?")
      .get(id, this.projectId) as NodeRow | undefined;
    return row ? rowToNode(row) : null;
  }

  getAllNodes(): GraphNode[] {
    const pid = this.ensureProject();
    const rows = this.db
      .prepare("SELECT * FROM nodes WHERE project_id = ? ORDER BY created_at")
      .all(pid) as NodeRow[];
    return rows.map(rowToNode);
  }

  getNodesByType(type: NodeType): GraphNode[] {
    const pid = this.ensureProject();
    const rows = this.db
      .prepare(
        "SELECT * FROM nodes WHERE project_id = ? AND type = ? ORDER BY created_at",
      )
      .all(pid, type) as NodeRow[];
    return rows.map(rowToNode);
  }

  getNodesByStatus(status: NodeStatus): GraphNode[] {
    const pid = this.ensureProject();
    const rows = this.db
      .prepare(
        "SELECT * FROM nodes WHERE project_id = ? AND status = ? ORDER BY created_at",
      )
      .all(pid, status) as NodeRow[];
    return rows.map(rowToNode);
  }

  getChildNodes(parentId: string): GraphNode[] {
    const pid = this.ensureProject();
    const rows = this.db
      .prepare(
        "SELECT * FROM nodes WHERE project_id = ? AND parent_id = ? ORDER BY created_at",
      )
      .all(pid, parentId) as NodeRow[];
    return rows.map(rowToNode);
  }

  updateNodeStatus(id: string, status: NodeStatus): GraphNode | null {
    const pid = this.ensureProject();
    const timestamp = now();
    const result = this.db
      .prepare(
        "UPDATE nodes SET status = ?, updated_at = ? WHERE id = ? AND project_id = ?",
      )
      .run(status, timestamp, id, pid);

    if (result.changes === 0) return null;
    this._eventBus?.emitTyped("node:updated", { nodeId: id, fields: ["status"] });
    return this.getNodeById(id);
  }

  updateNode(
    id: string,
    fields: Partial<
      Pick<
        GraphNode,
        | "title"
        | "description"
        | "type"
        | "priority"
        | "xpSize"
        | "estimateMinutes"
        | "tags"
        | "parentId"
        | "sprint"
        | "blocked"
        | "acceptanceCriteria"
        | "metadata"
      >
    >,
  ): GraphNode | null {
    const pid = this.ensureProject();
    const existing = this.getNodeById(id);
    if (!existing) return null;

    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (fields.title !== undefined) {
      setClauses.push("title = ?");
      params.push(fields.title);
    }
    if (fields.description !== undefined) {
      setClauses.push("description = ?");
      params.push(fields.description ?? null);
    }
    if (fields.type !== undefined) {
      setClauses.push("type = ?");
      params.push(fields.type);
    }
    if (fields.priority !== undefined) {
      setClauses.push("priority = ?");
      params.push(fields.priority);
    }
    if (fields.xpSize !== undefined) {
      setClauses.push("xp_size = ?");
      params.push(fields.xpSize ?? null);
    }
    if (fields.estimateMinutes !== undefined) {
      setClauses.push("estimate_minutes = ?");
      params.push(fields.estimateMinutes ?? null);
    }
    if (fields.tags !== undefined) {
      setClauses.push("tags = ?");
      params.push(fields.tags ? JSON.stringify(fields.tags) : null);
    }
    if (fields.parentId !== undefined) {
      setClauses.push("parent_id = ?");
      params.push(fields.parentId ?? null);
    }
    if (fields.sprint !== undefined) {
      setClauses.push("sprint = ?");
      params.push(fields.sprint ?? null);
    }
    if (fields.blocked !== undefined) {
      setClauses.push("blocked = ?");
      params.push(fields.blocked ? 1 : 0);
    }
    if (fields.acceptanceCriteria !== undefined) {
      setClauses.push("acceptance_criteria = ?");
      params.push(
        fields.acceptanceCriteria
          ? JSON.stringify(fields.acceptanceCriteria)
          : null,
      );
    }
    if (fields.metadata !== undefined) {
      setClauses.push("metadata = ?");
      params.push(fields.metadata ? JSON.stringify(fields.metadata) : null);
    }

    if (setClauses.length === 0) return existing;

    const timestamp = now();
    setClauses.push("updated_at = ?");
    params.push(timestamp);
    params.push(id, pid);

    this.db
      .prepare(
        `UPDATE nodes SET ${setClauses.join(", ")} WHERE id = ? AND project_id = ?`,
      )
      .run(...params);

    this._eventBus?.emitTyped("node:updated", { nodeId: id, fields: Object.keys(fields) });
    return this.getNodeById(id);
  }

  deleteNode(id: string): boolean {
    const pid = this.ensureProject();

    return this.db.transaction(() => {
      // Delete edges referencing this node
      this.db
        .prepare(
          "DELETE FROM edges WHERE project_id = ? AND (from_node = ? OR to_node = ?)",
        )
        .run(pid, id, id);

      const result = this.db
        .prepare("DELETE FROM nodes WHERE id = ? AND project_id = ?")
        .run(id, pid);

      const deleted = result.changes > 0;
      if (deleted) this._eventBus?.emitTyped("node:deleted", { nodeId: id });
      return deleted;
    })();
  }

  deleteEdge(id: string): boolean {
    const pid = this.ensureProject();
    const result = this.db
      .prepare("DELETE FROM edges WHERE id = ? AND project_id = ?")
      .run(id, pid);
    const deleted = result.changes > 0;
    if (deleted) this._eventBus?.emitTyped("edge:deleted", { edgeId: id });
    return deleted;
  }

  // ── Edges ────────────────────────────────────────

  insertEdge(edge: GraphEdge): void {
    try {
      GraphEdgeSchema.parse(edge);
    } catch (err) {
      if (err instanceof z.ZodError) {
        throw new ValidationError("Invalid edge", err.issues);
      }
      throw err;
    }
    const pid = this.ensureProject();
    const row = edgeToRow(edge, pid);
    this.db
      .prepare(
        `INSERT INTO edges
          (id, project_id, from_node, to_node, relation_type, weight, reason, metadata, created_at)
         VALUES
          (@id, @project_id, @from_node, @to_node, @relation_type, @weight, @reason, @metadata, @created_at)`,
      )
      .run(row);
    this._eventBus?.emitTyped("edge:created", { edgeId: edge.id, from: edge.from, to: edge.to, relationType: edge.relationType });
  }

  getEdgesFrom(nodeId: string): GraphEdge[] {
    const pid = this.ensureProject();
    const rows = this.db
      .prepare("SELECT * FROM edges WHERE project_id = ? AND from_node = ?")
      .all(pid, nodeId) as EdgeRow[];
    return rows.map(rowToEdge);
  }

  getEdgesTo(nodeId: string): GraphEdge[] {
    const pid = this.ensureProject();
    const rows = this.db
      .prepare("SELECT * FROM edges WHERE project_id = ? AND to_node = ?")
      .all(pid, nodeId) as EdgeRow[];
    return rows.map(rowToEdge);
  }

  getAllEdges(): GraphEdge[] {
    const pid = this.ensureProject();
    const rows = this.db
      .prepare("SELECT * FROM edges WHERE project_id = ? ORDER BY created_at")
      .all(pid) as EdgeRow[];
    return rows.map(rowToEdge);
  }

  // ── Import cleanup ─────────────────────────────────

  /**
   * Check if a source file has been previously imported.
   */
  hasImport(sourceFile: string): boolean {
    const pid = this.ensureProject();
    const row = this.db
      .prepare(
        "SELECT 1 FROM import_history WHERE project_id = ? AND source_file = ? LIMIT 1",
      )
      .get(pid, sourceFile) as unknown;
    return row !== undefined;
  }

  /**
   * Delete all nodes (and their edges) that were imported from a specific source file.
   * Also removes the import history entry so re-import is clean.
   */
  clearImportedNodes(sourceFile: string): { nodesDeleted: number; edgesDeleted: number } {
    const pid = this.ensureProject();

    return this.db.transaction(() => {
      // Find node IDs from this source file
      const nodeIds = this.db
        .prepare(
          "SELECT id FROM nodes WHERE project_id = ? AND source_file = ?",
        )
        .all(pid, sourceFile) as { id: string }[];

      let edgesDeleted = 0;

      for (const { id } of nodeIds) {
        const result = this.db
          .prepare(
            "DELETE FROM edges WHERE project_id = ? AND (from_node = ? OR to_node = ?)",
          )
          .run(pid, id, id);
        edgesDeleted += result.changes;
      }

      const nodesResult = this.db
        .prepare(
          "DELETE FROM nodes WHERE project_id = ? AND source_file = ?",
        )
        .run(pid, sourceFile);

      // Clear import history for this source file
      this.db
        .prepare(
          "DELETE FROM import_history WHERE project_id = ? AND source_file = ?",
        )
        .run(pid, sourceFile);

      const result = { nodesDeleted: nodesResult.changes, edgesDeleted };
      this._eventBus?.emitTyped("bulk:updated", { count: result.nodesDeleted + result.edgesDeleted, operation: "clearImportedNodes" });
      return result;
    })();
  }

  // ── Bulk ─────────────────────────────────────────

  bulkInsert(nodes: GraphNode[], edges: GraphEdge[]): void {
    const pid = this.ensureProject();
    logger.info(`Bulk insert: ${nodes.length} nodes, ${edges.length} edges`);

    this.db.transaction(() => {
      for (const node of nodes) {
        const row = nodeToRow(node, pid);
        this.db
          .prepare(
            `INSERT INTO nodes
              (id, project_id, type, title, description, status, priority,
               xp_size, estimate_minutes, tags, parent_id, sprint,
               source_file, source_start_line, source_end_line, source_confidence,
               acceptance_criteria, blocked, metadata, created_at, updated_at)
             VALUES
              (@id, @project_id, @type, @title, @description, @status, @priority,
               @xp_size, @estimate_minutes, @tags, @parent_id, @sprint,
               @source_file, @source_start_line, @source_end_line, @source_confidence,
               @acceptance_criteria, @blocked, @metadata, @created_at, @updated_at)`,
          )
          .run(row);
      }
      for (const edge of edges) {
        const row = edgeToRow(edge, pid);
        this.db
          .prepare(
            `INSERT INTO edges
              (id, project_id, from_node, to_node, relation_type, weight, reason, metadata, created_at)
             VALUES
              (@id, @project_id, @from_node, @to_node, @relation_type, @weight, @reason, @metadata, @created_at)`,
          )
          .run(row);
      }
    })();
    this._eventBus?.emitTyped("import:completed", { nodesCreated: nodes.length, edgesCreated: edges.length });
  }

  // ── Snapshots ────────────────────────────────────

  createSnapshot(): number {
    const pid = this.ensureProject();
    const doc = this.toGraphDocument();
    const result = this.db
      .prepare(
        "INSERT INTO snapshots (project_id, data, created_at) VALUES (?, ?, ?)",
      )
      .run(pid, JSON.stringify(doc), now());
    return result.lastInsertRowid as number;
  }

  // ── Import history ───────────────────────────────

  recordImport(
    sourceFile: string,
    nodesCreated: number,
    edgesCreated: number,
  ): void {
    const pid = this.ensureProject();
    this.db
      .prepare(
        `INSERT INTO import_history (project_id, source_file, nodes_created, edges_created, imported_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(pid, sourceFile, nodesCreated, edgesCreated, now());
  }

  // ── Stats ────────────────────────────────────────

  getStats(): {
    totalNodes: number;
    totalEdges: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  } {
    const pid = this.ensureProject();

    const totalNodes = (
      this.db
        .prepare("SELECT COUNT(*) as c FROM nodes WHERE project_id = ?")
        .get(pid) as { c: number }
    ).c;

    const totalEdges = (
      this.db
        .prepare("SELECT COUNT(*) as c FROM edges WHERE project_id = ?")
        .get(pid) as { c: number }
    ).c;

    const byType: Record<string, number> = {};
    const typeRows = this.db
      .prepare(
        "SELECT type, COUNT(*) as c FROM nodes WHERE project_id = ? GROUP BY type",
      )
      .all(pid) as { type: string; c: number }[];
    for (const r of typeRows) byType[r.type] = r.c;

    const byStatus: Record<string, number> = {};
    const statusRows = this.db
      .prepare(
        "SELECT status, COUNT(*) as c FROM nodes WHERE project_id = ? GROUP BY status",
      )
      .all(pid) as { status: string; c: number }[];
    for (const r of statusRows) byStatus[r.status] = r.c;

    return { totalNodes, totalEdges, byType, byStatus };
  }

  // ── Full-text search ─────────────────────────────

  /**
   * Search nodes using FTS5 with BM25 ranking.
   * Returns nodes ordered by relevance score.
   */
  searchNodes(query: string, limit: number = 20): Array<GraphNode & { score: number }> {
    const pid = this.ensureProject();

    // FTS5 match query — escape user input for safety
    const rows = this.db
      .prepare(
        `SELECT n.*, bm25(nodes_fts) AS score
         FROM nodes_fts fts
         JOIN nodes n ON n.rowid = fts.rowid
         WHERE nodes_fts MATCH ?
           AND n.project_id = ?
         ORDER BY score
         LIMIT ?`,
      )
      .all(query, pid, limit) as (NodeRow & { score: number })[];

    return rows.map((row) => ({
      ...rowToNode(row),
      score: row.score,
    }));
  }

  // ── Bulk status update ─────────────────────────

  bulkUpdateStatus(ids: string[], status: NodeStatus): { updated: string[]; notFound: string[] } {
    this.ensureProject();
    const updated: string[] = [];
    const notFound: string[] = [];

    this.db.transaction(() => {
      for (const id of ids) {
        const result = this.updateNodeStatus(id, status);
        if (result) {
          updated.push(id);
        } else {
          notFound.push(id);
        }
      }
    })();

    return { updated, notFound };
  }

  // ── Restore snapshot ──────────────────────────

  restoreSnapshot(snapshotId: number): void {
    const pid = this.ensureProject();
    const row = this.db
      .prepare("SELECT data FROM snapshots WHERE rowid = ? AND project_id = ?")
      .get(snapshotId, pid) as { data: string } | undefined;

    if (!row) {
      throw new SnapshotNotFoundError(snapshotId);
    }

    const doc = JSON.parse(row.data) as GraphDocument;

    this.db.transaction(() => {
      this.db.prepare("DELETE FROM edges WHERE project_id = ?").run(pid);
      this.db.prepare("DELETE FROM nodes WHERE project_id = ?").run(pid);

      for (const node of doc.nodes) {
        const r = nodeToRow(node, pid);
        this.db
          .prepare(
            `INSERT INTO nodes
              (id, project_id, type, title, description, status, priority,
               xp_size, estimate_minutes, tags, parent_id, sprint,
               source_file, source_start_line, source_end_line, source_confidence,
               acceptance_criteria, blocked, metadata, created_at, updated_at)
             VALUES
              (@id, @project_id, @type, @title, @description, @status, @priority,
               @xp_size, @estimate_minutes, @tags, @parent_id, @sprint,
               @source_file, @source_start_line, @source_end_line, @source_confidence,
               @acceptance_criteria, @blocked, @metadata, @created_at, @updated_at)`,
          )
          .run(r);
      }
      for (const edge of doc.edges) {
        const r = edgeToRow(edge, pid);
        this.db
          .prepare(
            `INSERT INTO edges
              (id, project_id, from_node, to_node, relation_type, weight, reason, metadata, created_at)
             VALUES
              (@id, @project_id, @from_node, @to_node, @relation_type, @weight, @reason, @metadata, @created_at)`,
          )
          .run(r);
      }
    })();
  }

  listSnapshots(): Array<{ snapshotId: number; createdAt: string }> {
    const pid = this.ensureProject();
    const rows = this.db
      .prepare(
        "SELECT id, created_at FROM snapshots WHERE project_id = ? ORDER BY id DESC",
      )
      .all(pid) as Array<{ id: number; created_at: string }>;
    return rows.map((r) => ({ snapshotId: r.id, createdAt: r.created_at }));
  }

  // ── Bridge: materialize full GraphDocument ───────

  toGraphDocument(): GraphDocument {
    const project = this.getProject();
    if (!project) {
      throw new GraphNotInitializedError();
    }

    const nodes = this.getAllNodes();
    const edges = this.getAllEdges();
    const indexes = buildIndexes(nodes, edges);

    // Collect source files from import history
    const pid = this.ensureProject();
    const imports = this.db
      .prepare(
        "SELECT DISTINCT source_file FROM import_history WHERE project_id = ?",
      )
      .all(pid) as { source_file: string }[];

    const lastImportRow = this.db
      .prepare(
        "SELECT imported_at FROM import_history WHERE project_id = ? ORDER BY imported_at DESC LIMIT 1",
      )
      .get(pid) as { imported_at: string } | undefined;

    return {
      version: "1.0.0",
      project,
      nodes,
      edges,
      indexes,
      meta: {
        sourceFiles: imports.map((r) => r.source_file),
        lastImport: lastImportRow?.imported_at ?? null,
      },
    };
  }
}
