/**
 * UCR Seed Loader — loads construct-seed-data.json into ConstructRegistry.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { UcrSeedDataSchema } from "./construct-types.js";
import type { UcrSeedData } from "./construct-types.js";
import type { ConstructRegistry, SeedResult } from "./construct-registry.js";
import { logger } from "../../utils/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_SEED_PATH = resolve(__dirname, "construct-seed-data.json");

/** Load the built-in seed data and populate the registry. Idempotent. */
export function loadAndSeedRegistry(registry: ConstructRegistry): SeedResult {
  return seedRegistryFromFile(registry, DEFAULT_SEED_PATH);
}

/** Load seed data from a custom JSON file and populate the registry. Validates against Zod schema. */
export function seedRegistryFromFile(registry: ConstructRegistry, filePath: string): SeedResult {
  const raw = readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw) as unknown;

  const validated = UcrSeedDataSchema.parse(parsed);

  const result = registry.seedFromJson(validated);

  logger.info("ucr:seed:file", {
    file: filePath,
    categories: result.categories,
    constructs: result.constructs,
    mappings: result.mappings,
  });

  return result;
}

/** Parse and validate seed data without inserting (dry-run). */
export function validateSeedData(filePath: string): UcrSeedData {
  const raw = readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw) as unknown;
  return UcrSeedDataSchema.parse(parsed);
}
