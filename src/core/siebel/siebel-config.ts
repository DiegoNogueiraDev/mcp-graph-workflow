/**
 * Siebel Environment Configuration Manager.
 * Persists Siebel environment settings to workflow-graph/siebel-envs.json.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../utils/logger.js";
import { ValidationError } from "../utils/errors.js";
import { SiebelEnvironmentSchema } from "../../schemas/siebel.schema.js";
import type { SiebelEnvironment } from "../../schemas/siebel.schema.js";

const CONFIG_FILE = "siebel-envs.json";

interface SiebelConfigFile {
  version: string;
  environments: SiebelEnvironment[];
}

/**
 * Load Siebel environment configurations from disk.
 */
export function loadSiebelConfig(graphDir: string): SiebelEnvironment[] {
  const filePath = join(graphDir, CONFIG_FILE);

  if (!existsSync(filePath)) {
    return [];
  }

  try {
    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as SiebelConfigFile;
    return data.environments ?? [];
  } catch (err) {
    logger.warn("Failed to load Siebel config", { path: filePath, error: String(err) });
    return [];
  }
}

/**
 * Save Siebel environment configurations to disk.
 */
export function saveSiebelConfig(graphDir: string, environments: SiebelEnvironment[]): void {
  if (!existsSync(graphDir)) {
    mkdirSync(graphDir, { recursive: true });
  }

  const filePath = join(graphDir, CONFIG_FILE);
  const config: SiebelConfigFile = {
    version: "1.0",
    environments,
  };

  writeFileSync(filePath, JSON.stringify(config, null, 2), "utf-8");
  logger.info("Siebel config saved", { path: filePath, envCount: String(environments.length) });
}

/**
 * Add a new Siebel environment.
 * @throws ValidationError if name already exists.
 */
export function addEnvironment(graphDir: string, env: SiebelEnvironment): SiebelEnvironment[] {
  // Validate schema
  SiebelEnvironmentSchema.parse(env);

  const environments = loadSiebelConfig(graphDir);

  if (environments.some((e) => e.name === env.name)) {
    throw new ValidationError(`Environment "${env.name}" already exists`, [
      { field: "name", message: "duplicate" },
    ]);
  }

  environments.push(env);
  saveSiebelConfig(graphDir, environments);

  logger.info("Siebel environment added", { name: env.name, type: env.type });
  return environments;
}

/**
 * Remove a Siebel environment by name.
 * @throws ValidationError if name not found.
 */
export function removeEnvironment(graphDir: string, name: string): SiebelEnvironment[] {
  const environments = loadSiebelConfig(graphDir);
  const idx = environments.findIndex((e) => e.name === name);

  if (idx === -1) {
    throw new ValidationError(`Environment "${name}" not found`, [
      { field: "name", message: "not found" },
    ]);
  }

  environments.splice(idx, 1);
  saveSiebelConfig(graphDir, environments);

  logger.info("Siebel environment removed", { name });
  return environments;
}

/**
 * Find an environment by name.
 */
export function findEnvironment(graphDir: string, name: string): SiebelEnvironment | undefined {
  const environments = loadSiebelConfig(graphDir);
  return environments.find((e) => e.name === name);
}
