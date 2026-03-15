import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { SqliteStore } from "./sqlite-store.js";
import { STORE_DIR, LEGACY_STORE_DIR, DB_FILE } from "../utils/constants.js";
import { logger } from "../utils/logger.js";

/** Mutable reference to the current SqliteStore — shared across route closures. */
export interface StoreRef {
  current: SqliteStore;
}

const MAX_RECENT = 10;
const RECENT_FILE = path.join(os.homedir(), ".mcp-graph-recent-folders.json");

export class StoreManager {
  private _ref: StoreRef;
  private _basePath: string;
  private _recentFolders: string[];

  private constructor(store: SqliteStore, basePath: string, recentFolders: string[]) {
    this._ref = { current: store };
    this._basePath = basePath;
    this._recentFolders = recentFolders;
  }

  static create(basePath: string): StoreManager {
    const store = SqliteStore.open(basePath);
    const recent = loadRecentFolders();
    return new StoreManager(store, basePath, recent);
  }

  get store(): SqliteStore {
    return this._ref.current;
  }

  get storeRef(): StoreRef {
    return this._ref;
  }

  get basePath(): string {
    return this._basePath;
  }

  get recentFolders(): string[] {
    return [...this._recentFolders];
  }

  get recentFilePath(): string {
    return RECENT_FILE;
  }

  /** Returns a stable getter function for basePath — captures `this` by reference. */
  get getBasePathFn(): () => string {
    return () => this._basePath;
  }

  /**
   * Swap the active store to a new project directory.
   * If the swap fails, the old store remains active.
   */
  swap(newBasePath: string): { ok: true; basePath: string } | { ok: false; error: string } {
    // Validate directory exists
    if (!existsSync(newBasePath)) {
      return { ok: false, error: `Directory does not exist: ${newBasePath}` };
    }

    // Check for graph.db in either workflow-graph/ or legacy .mcp-graph/
    const newStoreDir = path.join(newBasePath, STORE_DIR);
    const legacyStoreDir = path.join(newBasePath, LEGACY_STORE_DIR);
    const hasNew = existsSync(path.join(newStoreDir, DB_FILE));
    const hasLegacy = existsSync(path.join(legacyStoreDir, DB_FILE));

    if (!hasNew && !hasLegacy) {
      return { ok: false, error: `No graph database found at ${newBasePath}. Expected ${STORE_DIR}/${DB_FILE}` };
    }

    // Preserve eventBus from current store
    const eventBus = this._ref.current.eventBus;
    const oldStore = this._ref.current;
    const oldBasePath = this._basePath;

    try {
      const newStore = SqliteStore.open(newBasePath);
      if (eventBus) {
        newStore.eventBus = eventBus;
      }

      // Close old store
      oldStore.close();

      // Update refs
      this._ref.current = newStore;
      this._basePath = newBasePath;

      // Update recent folders
      this._addRecent(oldBasePath);
      this._addRecent(newBasePath);
      this._persistRecent();

      logger.info("store-manager:swap:ok", { from: oldBasePath, to: newBasePath });
      return { ok: true, basePath: newBasePath };
    } catch (err) {
      // Swap failed — old store remains active
      logger.error("store-manager:swap:fail", {
        error: err instanceof Error ? err.message : String(err),
        targetPath: newBasePath,
      });
      return {
        ok: false,
        error: `Failed to open store at ${newBasePath}: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  close(): void {
    this._ref.current.close();
  }

  private _addRecent(folder: string): void {
    // Remove if already present (dedup)
    this._recentFolders = this._recentFolders.filter((f) => f !== folder);
    // Add to front
    this._recentFolders.unshift(folder);
    // Trim to max
    if (this._recentFolders.length > MAX_RECENT) {
      this._recentFolders = this._recentFolders.slice(0, MAX_RECENT);
    }
  }

  private _persistRecent(): void {
    try {
      writeFileSync(RECENT_FILE, JSON.stringify(this._recentFolders, null, 2), "utf-8");
    } catch (err) {
      logger.warn("store-manager:persist-recent:fail", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

function loadRecentFolders(): string[] {
  try {
    if (existsSync(RECENT_FILE)) {
      const data = JSON.parse(readFileSync(RECENT_FILE, "utf-8"));
      if (Array.isArray(data)) {
        return data.filter((item): item is string => typeof item === "string").slice(0, MAX_RECENT);
      }
    }
  } catch {
    // Ignore corrupt file
  }
  return [];
}
