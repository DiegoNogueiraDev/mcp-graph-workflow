import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import {
  buildEnrichedContext,
} from "../core/integrations/enriched-context.js";

describe("enriched-context", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = path.join(tmpdir(), `enriched-ctx-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── buildEnrichedContext ───────────────────────

  describe("buildEnrichedContext", () => {
    it("should return correct shape with all sections", async () => {
      const ctx = await buildEnrichedContext("GraphStore", tmpDir);

      expect(ctx).toHaveProperty("symbol");
      expect(ctx).toHaveProperty("serena");
      expect(ctx).toHaveProperty("gitnexus");
      expect(ctx).toHaveProperty("combined");
      expect(ctx.symbol).toBe("GraphStore");
    });

    it("should return serena data when memories exist", async () => {
      const memoriesDir = path.join(tmpDir, ".serena", "memories");
      mkdirSync(memoriesDir, { recursive: true });
      writeFileSync(
        path.join(memoriesDir, "architecture.md"),
        "# Architecture\nGraphStore handles all database operations.\nIt uses SQLite for persistence.",
      );

      const ctx = await buildEnrichedContext("GraphStore", tmpDir);

      expect(ctx.serena.available).toBe(true);
      expect(ctx.serena.relevantMemories.length).toBeGreaterThan(0);
      expect(ctx.serena.relevantMemories[0].name).toBe("architecture");
    });

    it("should return empty serena when no memories dir", async () => {
      const ctx = await buildEnrichedContext("GraphStore", tmpDir);

      expect(ctx.serena.available).toBe(false);
      expect(ctx.serena.relevantMemories).toHaveLength(0);
    });

    it("should return gitnexus unavailable when not running", async () => {
      const ctx = await buildEnrichedContext("GraphStore", tmpDir);

      expect(ctx.gitnexus.available).toBe(false);
    });

    it("should always include combined summary", async () => {
      const ctx = await buildEnrichedContext("GraphStore", tmpDir);

      expect(typeof ctx.combined).toBe("string");
      expect(ctx.combined.length).toBeGreaterThan(0);
    });

    it("should filter memories relevant to the symbol", async () => {
      const memoriesDir = path.join(tmpDir, ".serena", "memories");
      mkdirSync(memoriesDir, { recursive: true });
      writeFileSync(path.join(memoriesDir, "db-layer.md"), "# DB Layer\nGraphStore is the main store class.");
      writeFileSync(path.join(memoriesDir, "ui-guide.md"), "# UI Guide\nThe dashboard uses React.");

      const ctx = await buildEnrichedContext("GraphStore", tmpDir);

      // Should include db-layer (mentions GraphStore) but may or may not include ui-guide
      const memNames = ctx.serena.relevantMemories.map((m) => m.name);
      expect(memNames).toContain("db-layer");
    });
  });
});
