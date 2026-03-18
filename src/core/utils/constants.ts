/**
 * Centralized constants for mcp-graph store directories.
 */

import path from "node:path";
import os from "node:os";

/** Current store directory name (visible, not hidden) */
export const STORE_DIR = "workflow-graph";

/** Legacy store directory name (hidden, pre-migration) */
export const LEGACY_STORE_DIR = ".mcp-graph";

/** Default database file name */
export const DB_FILE = "graph.db";

/** Global store directory name (inside home dir) */
export const GLOBAL_STORE_DIR = ".mcp-graph";

/** Global store directory path (~/.mcp-graph/) */
export const GLOBAL_DB_DIR = path.join(os.homedir(), GLOBAL_STORE_DIR);

/** Global database file path (~/.mcp-graph/graph.db) */
export const GLOBAL_DB_PATH = path.join(GLOBAL_DB_DIR, DB_FILE);

/** Global memories directory (~/.mcp-graph/memories/) */
export const GLOBAL_MEMORIES_DIR = path.join(GLOBAL_DB_DIR, "memories");

/** Global config file (~/.mcp-graph/config.json) */
export const GLOBAL_CONFIG_FILE = path.join(GLOBAL_DB_DIR, "config.json");
