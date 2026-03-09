import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  listSerenaMemories,
  readSerenaMemory,
  readAllSerenaMemories,
} from "../core/integrations/serena-reader.js";

describe("serena-reader", () => {
  let tmpBase: string;

  beforeEach(() => {
    tmpBase = path.join(tmpdir(), `serena-test-${Date.now()}`);
    const memoriesDir = path.join(tmpBase, ".serena", "memories");
    mkdirSync(memoriesDir, { recursive: true });
    writeFileSync(path.join(memoriesDir, "overview.md"), "# Project Overview\nThis is a test project.");
    writeFileSync(path.join(memoriesDir, "architecture.md"), "# Architecture\nModular design.");
  });

  afterEach(() => {
    rmSync(tmpBase, { recursive: true, force: true });
  });

  it("should list Serena memory names", async () => {
    const memories = await listSerenaMemories(tmpBase);

    expect(memories).toContain("overview");
    expect(memories).toContain("architecture");
    expect(memories).toHaveLength(2);
  });

  it("should read a specific memory", async () => {
    const memory = await readSerenaMemory(tmpBase, "overview");

    expect(memory).not.toBeNull();
    expect(memory!.name).toBe("overview");
    expect(memory!.content).toContain("Project Overview");
    expect(memory!.sizeBytes).toBeGreaterThan(0);
  });

  it("should return null for non-existent memory", async () => {
    const memory = await readSerenaMemory(tmpBase, "nonexistent");
    expect(memory).toBeNull();
  });

  it("should read all memories", async () => {
    const memories = await readAllSerenaMemories(tmpBase);

    expect(memories).toHaveLength(2);
    expect(memories.map((m) => m.name).sort()).toEqual(["architecture", "overview"]);
  });

  it("should return empty array when no .serena directory", async () => {
    const emptyDir = path.join(tmpdir(), `empty-${Date.now()}`);
    mkdirSync(emptyDir, { recursive: true });

    const memories = await listSerenaMemories(emptyDir);
    expect(memories).toEqual([]);

    rmSync(emptyDir, { recursive: true, force: true });
  });
});
