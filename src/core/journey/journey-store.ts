import type Database from "better-sqlite3";
import { generateId } from "../utils/id.js";
import { now } from "../utils/time.js";
import { logger } from "../utils/logger.js";

// ── Row types ────────────────────────────────────────────

interface JourneyMapRow {
  id: string;
  project_id: string;
  name: string;
  url: string | null;
  description: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

interface JourneyScreenRow {
  id: string;
  map_id: string;
  project_id: string;
  title: string;
  description: string | null;
  screenshot: string | null;
  url: string | null;
  screen_type: string;
  fields: string | null;
  ctas: string | null;
  metadata: string | null;
  position_x: number;
  position_y: number;
  created_at: string;
  updated_at: string;
}

interface JourneyEdgeRow {
  id: string;
  map_id: string;
  project_id: string;
  from_screen: string;
  to_screen: string;
  label: string | null;
  edge_type: string;
  metadata: string | null;
  created_at: string;
}

interface JourneyVariantRow {
  id: string;
  map_id: string;
  project_id: string;
  name: string;
  description: string | null;
  path: string;
  created_at: string;
}

// ── Public types ─────────────────────────────────────────

export interface JourneyMap {
  id: string;
  name: string;
  url?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface JourneyScreen {
  id: string;
  mapId: string;
  title: string;
  description?: string;
  screenshot?: string;
  url?: string;
  screenType: string;
  fields?: JourneyField[];
  ctas?: string[];
  metadata?: Record<string, unknown>;
  positionX: number;
  positionY: number;
  createdAt: string;
  updatedAt: string;
}

export interface JourneyField {
  name: string;
  type: string;
  required?: boolean;
  label?: string;
  options?: string[];
}

export interface JourneyEdge {
  id: string;
  mapId: string;
  from: string;
  to: string;
  label?: string;
  type: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface JourneyVariant {
  id: string;
  mapId: string;
  name: string;
  description?: string;
  path: string[];
  createdAt: string;
}

export interface JourneyMapFull extends JourneyMap {
  screens: JourneyScreen[];
  edges: JourneyEdge[];
  variants: JourneyVariant[];
}

// ── Mapping helpers ──────────────────────────────────────

function mapRowToMap(row: JourneyMapRow): JourneyMap {
  return {
    id: row.id,
    name: row.name,
    url: row.url ?? undefined,
    description: row.description ?? undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) as Record<string, unknown> : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRowToScreen(row: JourneyScreenRow): JourneyScreen {
  return {
    id: row.id,
    mapId: row.map_id,
    title: row.title,
    description: row.description ?? undefined,
    screenshot: row.screenshot ?? undefined,
    url: row.url ?? undefined,
    screenType: row.screen_type,
    fields: row.fields ? JSON.parse(row.fields) as JourneyField[] : undefined,
    ctas: row.ctas ? JSON.parse(row.ctas) as string[] : undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) as Record<string, unknown> : undefined,
    positionX: row.position_x,
    positionY: row.position_y,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRowToEdge(row: JourneyEdgeRow): JourneyEdge {
  return {
    id: row.id,
    mapId: row.map_id,
    from: row.from_screen,
    to: row.to_screen,
    label: row.label ?? undefined,
    type: row.edge_type,
    metadata: row.metadata ? JSON.parse(row.metadata) as Record<string, unknown> : undefined,
    createdAt: row.created_at,
  };
}

function mapRowToVariant(row: JourneyVariantRow): JourneyVariant {
  return {
    id: row.id,
    mapId: row.map_id,
    name: row.name,
    description: row.description ?? undefined,
    path: JSON.parse(row.path) as string[],
    createdAt: row.created_at,
  };
}

// ── Journey Store ────────────────────────────────────────

export class JourneyStore {
  constructor(
    private readonly db: Database.Database,
    private readonly projectId: string,
  ) {}

  // ── Maps ────────────────────────────────────────────

  listMaps(): JourneyMap[] {
    const rows = this.db
      .prepare("SELECT * FROM journey_maps WHERE project_id = ? ORDER BY created_at DESC")
      .all(this.projectId) as JourneyMapRow[];
    return rows.map(mapRowToMap);
  }

  getMap(id: string): JourneyMapFull | null {
    const row = this.db
      .prepare("SELECT * FROM journey_maps WHERE id = ? AND project_id = ?")
      .get(id, this.projectId) as JourneyMapRow | undefined;
    if (!row) return null;

    const screens = this.db
      .prepare("SELECT * FROM journey_screens WHERE map_id = ? ORDER BY created_at ASC")
      .all(id) as JourneyScreenRow[];

    const edges = this.db
      .prepare("SELECT * FROM journey_edges WHERE map_id = ? ORDER BY created_at ASC")
      .all(id) as JourneyEdgeRow[];

    const variants = this.db
      .prepare("SELECT * FROM journey_variants WHERE map_id = ? ORDER BY created_at ASC")
      .all(id) as JourneyVariantRow[];

    return {
      ...mapRowToMap(row),
      screens: screens.map(mapRowToScreen),
      edges: edges.map(mapRowToEdge),
      variants: variants.map(mapRowToVariant),
    };
  }

  createMap(input: { name: string; url?: string; description?: string; metadata?: Record<string, unknown> }): JourneyMap {
    const id = generateId("jmap");
    const ts = now();
    this.db
      .prepare(
        `INSERT INTO journey_maps (id, project_id, name, url, description, metadata, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, this.projectId, input.name, input.url ?? null, input.description ?? null,
        input.metadata ? JSON.stringify(input.metadata) : null, ts, ts);

    logger.info("journey:map:created", { id, name: input.name });
    return { id, name: input.name, url: input.url, description: input.description, metadata: input.metadata, createdAt: ts, updatedAt: ts };
  }

  deleteMap(id: string): boolean {
    const result = this.db
      .prepare("DELETE FROM journey_maps WHERE id = ? AND project_id = ?")
      .run(id, this.projectId);
    if (result.changes > 0) {
      logger.info("journey:map:deleted", { id });
    }
    return result.changes > 0;
  }

  // ── Screens ─────────────────────────────────────────

  addScreen(mapId: string, input: {
    title: string;
    description?: string;
    screenshot?: string;
    url?: string;
    screenType?: string;
    fields?: JourneyField[];
    ctas?: string[];
    metadata?: Record<string, unknown>;
    positionX?: number;
    positionY?: number;
  }): JourneyScreen {
    const id = generateId("jscr");
    const ts = now();
    this.db
      .prepare(
        `INSERT INTO journey_screens (id, map_id, project_id, title, description, screenshot, url, screen_type, fields, ctas, metadata, position_x, position_y, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id, mapId, this.projectId, input.title,
        input.description ?? null, input.screenshot ?? null, input.url ?? null,
        input.screenType ?? "page",
        input.fields ? JSON.stringify(input.fields) : null,
        input.ctas ? JSON.stringify(input.ctas) : null,
        input.metadata ? JSON.stringify(input.metadata) : null,
        input.positionX ?? 0, input.positionY ?? 0,
        ts, ts,
      );

    logger.info("journey:screen:created", { id, mapId, title: input.title });
    return {
      id, mapId, title: input.title,
      description: input.description, screenshot: input.screenshot, url: input.url,
      screenType: input.screenType ?? "page",
      fields: input.fields, ctas: input.ctas, metadata: input.metadata,
      positionX: input.positionX ?? 0, positionY: input.positionY ?? 0,
      createdAt: ts, updatedAt: ts,
    };
  }

  updateScreen(id: string, input: {
    title?: string;
    description?: string;
    screenshot?: string;
    positionX?: number;
    positionY?: number;
  }): JourneyScreen | null {
    const existing = this.db
      .prepare("SELECT * FROM journey_screens WHERE id = ? AND project_id = ?")
      .get(id, this.projectId) as JourneyScreenRow | undefined;
    if (!existing) return null;

    const ts = now();
    this.db
      .prepare(
        `UPDATE journey_screens SET title = ?, description = ?, screenshot = ?, position_x = ?, position_y = ?, updated_at = ? WHERE id = ?`,
      )
      .run(
        input.title ?? existing.title,
        input.description ?? existing.description,
        input.screenshot ?? existing.screenshot,
        input.positionX ?? existing.position_x,
        input.positionY ?? existing.position_y,
        ts, id,
      );

    const updated = this.db
      .prepare("SELECT * FROM journey_screens WHERE id = ?")
      .get(id) as JourneyScreenRow;
    return mapRowToScreen(updated);
  }

  deleteScreen(id: string): boolean {
    const result = this.db
      .prepare("DELETE FROM journey_screens WHERE id = ? AND project_id = ?")
      .run(id, this.projectId);
    return result.changes > 0;
  }

  // ── Edges ───────────────────────────────────────────

  addEdge(mapId: string, input: {
    from: string;
    to: string;
    label?: string;
    type?: string;
    metadata?: Record<string, unknown>;
  }): JourneyEdge {
    const id = generateId("jedg");
    const ts = now();
    this.db
      .prepare(
        `INSERT INTO journey_edges (id, map_id, project_id, from_screen, to_screen, label, edge_type, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, mapId, this.projectId, input.from, input.to,
        input.label ?? null, input.type ?? "navigation",
        input.metadata ? JSON.stringify(input.metadata) : null, ts);

    logger.info("journey:edge:created", { id, mapId, from: input.from, to: input.to });
    return { id, mapId, from: input.from, to: input.to, label: input.label, type: input.type ?? "navigation", metadata: input.metadata, createdAt: ts };
  }

  deleteEdge(id: string): boolean {
    const result = this.db
      .prepare("DELETE FROM journey_edges WHERE id = ? AND project_id = ?")
      .run(id, this.projectId);
    return result.changes > 0;
  }

  // ── Variants ────────────────────────────────────────

  addVariant(mapId: string, input: {
    name: string;
    description?: string;
    path: string[];
  }): JourneyVariant {
    const id = generateId("jvar");
    const ts = now();
    this.db
      .prepare(
        `INSERT INTO journey_variants (id, map_id, project_id, name, description, path, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, mapId, this.projectId, input.name, input.description ?? null,
        JSON.stringify(input.path), ts);
    return { id, mapId, name: input.name, description: input.description, path: input.path, createdAt: ts };
  }

  // ── Import (bulk) ──────────────────────────────────

  importJourneyMap(data: {
    journey: { name: string; url?: string; description?: string };
    screens: Array<{
      id?: string;
      title: string;
      description?: string;
      screenshot?: string;
      url?: string;
      screenType?: string;
      fields?: JourneyField[];
      ctas?: string[];
      metadata?: Record<string, unknown>;
    }>;
    edges: Array<{ from: string; to: string; label?: string; type?: string }>;
    variants?: Record<string, { name: string; description?: string; path: string[] }>;
  }): { id: string; screensCreated: number; edgesCreated: number } {
    const map = this.createMap(data.journey);

    // Map old screen IDs to new ones
    const idMap = new Map<string, string>();
    let screensCreated = 0;
    let edgesCreated = 0;

    this.db.transaction(() => {
      for (const screen of data.screens) {
        const newScreen = this.addScreen(map.id, screen);
        if (screen.id) {
          idMap.set(screen.id, newScreen.id);
        }
        screensCreated++;
      }

      for (const edge of data.edges) {
        const from = idMap.get(edge.from) ?? edge.from;
        const to = idMap.get(edge.to) ?? edge.to;
        this.addEdge(map.id, { from, to, label: edge.label, type: edge.type });
        edgesCreated++;
      }

      if (data.variants) {
        for (const [, variant] of Object.entries(data.variants)) {
          const mappedPath = variant.path.map((sid) => idMap.get(sid) ?? sid);
          this.addVariant(map.id, { name: variant.name, description: variant.description, path: mappedPath });
        }
      }
    })();

    logger.info("journey:imported", { mapId: map.id, screensCreated, edgesCreated });
    return { id: map.id, screensCreated, edgesCreated };
  }
}
