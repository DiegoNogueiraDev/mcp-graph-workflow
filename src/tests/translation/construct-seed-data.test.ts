import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { UcrSeedDataSchema } from "../../core/translation/ucr/construct-types.js";
import type { UcrSeedData } from "../../core/translation/ucr/construct-types.js";

const SEED_PATH = resolve(__dirname, "../../core/translation/ucr/construct-seed-data.json");

describe("UCR Seed Data (construct-seed-data.json)", () => {
  let data: UcrSeedData;

  it("should be valid JSON that parses against UcrSeedDataSchema", () => {
    const raw = readFileSync(SEED_PATH, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    const result = UcrSeedDataSchema.safeParse(parsed);
    expect(result.success).toBe(true);
    if (result.success) data = result.data;
  });

  it("should have at least 8 categories", () => {
    const raw = JSON.parse(readFileSync(SEED_PATH, "utf-8")) as UcrSeedData;
    expect(raw.categories.length).toBeGreaterThanOrEqual(8);
  });

  it("should have at least 50 canonical constructs", () => {
    const raw = JSON.parse(readFileSync(SEED_PATH, "utf-8")) as UcrSeedData;
    expect(raw.constructs.length).toBeGreaterThanOrEqual(50);
  });

  it("should have at least 400 language mappings", () => {
    const raw = JSON.parse(readFileSync(SEED_PATH, "utf-8")) as UcrSeedData;
    expect(raw.mappings.length).toBeGreaterThanOrEqual(400);
  });

  it("should have mappings for all 12 supported languages", () => {
    const raw = JSON.parse(readFileSync(SEED_PATH, "utf-8")) as UcrSeedData;
    const langs = new Set(raw.mappings.map((m) => m.languageId));
    for (const expected of ["typescript", "python", "go", "java", "rust", "csharp", "ruby", "php", "kotlin", "swift", "cpp", "lua"]) {
      expect(langs.has(expected)).toBe(true);
    }
  });

  it("should have at least 30 mappings per language", () => {
    const raw = JSON.parse(readFileSync(SEED_PATH, "utf-8")) as UcrSeedData;
    const byLang = new Map<string, number>();
    for (const m of raw.mappings) {
      byLang.set(m.languageId, (byLang.get(m.languageId) ?? 0) + 1);
    }
    for (const [lang, count] of byLang) {
      expect(count, `${lang} should have >= 30 mappings but has ${count}`).toBeGreaterThanOrEqual(30);
    }
  });

  it("should have >60% of constructs with confidence 1.0 mappings", () => {
    const raw = JSON.parse(readFileSync(SEED_PATH, "utf-8")) as UcrSeedData;
    const highConfidence = new Set(
      raw.mappings.filter((m) => m.confidence === 1.0).map((m) => m.constructId),
    );
    const ratio = highConfidence.size / raw.constructs.length;
    expect(ratio).toBeGreaterThanOrEqual(0.6);
  });

  it("every mapping.constructId should reference an existing construct", () => {
    const raw = JSON.parse(readFileSync(SEED_PATH, "utf-8")) as UcrSeedData;
    const constructIds = new Set(raw.constructs.map((c) => c.id));
    for (const m of raw.mappings) {
      expect(constructIds.has(m.constructId)).toBe(true);
    }
  });

  it("every construct.categoryId should reference an existing category", () => {
    const raw = JSON.parse(readFileSync(SEED_PATH, "utf-8")) as UcrSeedData;
    const categoryIds = new Set(raw.categories.map((c) => c.id));
    for (const c of raw.constructs) {
      expect(categoryIds.has(c.categoryId)).toBe(true);
    }
  });

  it("every mapping should have a non-empty syntaxPattern", () => {
    const raw = JSON.parse(readFileSync(SEED_PATH, "utf-8")) as UcrSeedData;
    for (const m of raw.mappings) {
      expect(m.syntaxPattern.length).toBeGreaterThan(0);
    }
  });

  it("should have unique construct canonical names", () => {
    const raw = JSON.parse(readFileSync(SEED_PATH, "utf-8")) as UcrSeedData;
    const names = raw.constructs.map((c) => c.canonicalName);
    expect(new Set(names).size).toBe(names.length);
  });
});
