import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import { logger } from "../utils/logger.js";

export interface SerenaMemory {
  name: string;
  content: string;
  sizeBytes: number;
}

const SERENA_MEMORIES_DIR = ".serena/memories";

/**
 * Recursively collect all .md files under a directory, returning paths relative to root.
 */
async function collectMdFiles(dir: string, root: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectMdFiles(fullPath, root);
      results.push(...nested);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      const relative = path.relative(root, fullPath);
      results.push(relative.replace(/\.md$/, ""));
    }
  }

  return results;
}

/**
 * List all Serena memory files from the project directory (supports nested dirs).
 */
export async function listSerenaMemories(basePath: string): Promise<string[]> {
  try {
    const dir = path.join(basePath, SERENA_MEMORIES_DIR);
    return await collectMdFiles(dir, dir);
  } catch {
    logger.info("No Serena memories directory found", { basePath });
    return [];
  }
}

/**
 * Read a specific Serena memory file.
 */
export async function readSerenaMemory(basePath: string, name: string): Promise<SerenaMemory | null> {
  try {
    const filePath = path.join(basePath, SERENA_MEMORIES_DIR, `${name}.md`);
    const content = await readFile(filePath, "utf-8");
    return {
      name,
      content,
      sizeBytes: Buffer.byteLength(content, "utf-8"),
    };
  } catch {
    logger.info("Serena memory not found", { name });
    return null;
  }
}

/**
 * Read all Serena memories at once.
 */
export async function readAllSerenaMemories(basePath: string): Promise<SerenaMemory[]> {
  const names = await listSerenaMemories(basePath);
  const memories: SerenaMemory[] = [];

  for (const name of names) {
    const memory = await readSerenaMemory(basePath, name);
    if (memory) memories.push(memory);
  }

  return memories;
}
