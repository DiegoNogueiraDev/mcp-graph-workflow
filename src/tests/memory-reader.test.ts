import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  listMemories,
  readMemory,
  readAllMemories,
  writeMemory,
  deleteMemory,
} from "../core/memory/memory-reader.js";
import { migrateSerenaMemories } from "../core/memory/memory-migrator.js";

describe("memory-reader", () => {
  let tmpBase: string;

  beforeEach(() => {
    tmpBase = path.join(tmpdir(), `memory-test-${Date.now()}`);
    const memoriesDir = path.join(tmpBase, "workflow-graph", "memories");
    mkdirSync(memoriesDir, { recursive: true });
    writeFileSync(path.join(memoriesDir, "overview.md"), "# Project Overview\nThis is a test project.");
    writeFileSync(path.join(memoriesDir, "architecture.md"), "# Architecture\nModular design.");
  });

  afterEach(() => {
    rmSync(tmpBase, { recursive: true, force: true });
  });

  it("should list memory names from workflow-graph/memories/", async () => {
    const memories = await listMemories(tmpBase);

    expect(memories).toContain("overview");
    expect(memories).toContain("architecture");
    expect(memories).toHaveLength(2);
  });

  it("should read a specific memory", async () => {
    const memory = await readMemory(tmpBase, "overview");

    expect(memory).not.toBeNull();
    expect(memory!.name).toBe("overview");
    expect(memory!.content).toContain("Project Overview");
    expect(memory!.sizeBytes).toBeGreaterThan(0);
  });

  it("should return null for non-existent memory", async () => {
    const memory = await readMemory(tmpBase, "nonexistent");
    expect(memory).toBeNull();
  });

  it("should read all memories", async () => {
    const memories = await readAllMemories(tmpBase);

    expect(memories).toHaveLength(2);
    expect(memories.map((m) => m.name).sort()).toEqual(["architecture", "overview"]);
  });

  it("should return empty array when no memories directory", async () => {
    const emptyDir = path.join(tmpdir(), `empty-${Date.now()}`);
    mkdirSync(emptyDir, { recursive: true });

    const memories = await listMemories(emptyDir);
    expect(memories).toEqual([]);

    rmSync(emptyDir, { recursive: true, force: true });
  });

  it("should support nested directories", async () => {
    const nestedDir = path.join(tmpBase, "workflow-graph", "memories", "sub");
    mkdirSync(nestedDir, { recursive: true });
    writeFileSync(path.join(nestedDir, "nested.md"), "# Nested memory");

    const memories = await listMemories(tmpBase);
    expect(memories).toContain("sub/nested");
    expect(memories).toHaveLength(3);
  });

  // ── Write ─────────────────────────────────────

  it("should write a new memory file", async () => {
    await writeMemory(tmpBase, "new-memory", "# New Memory\nSome content.");

    const memory = await readMemory(tmpBase, "new-memory");
    expect(memory).not.toBeNull();
    expect(memory!.content).toBe("# New Memory\nSome content.");
  });

  it("should overwrite an existing memory", async () => {
    await writeMemory(tmpBase, "overview", "# Updated Overview");

    const memory = await readMemory(tmpBase, "overview");
    expect(memory!.content).toBe("# Updated Overview");
  });

  it("should create parent directories when writing nested memory", async () => {
    await writeMemory(tmpBase, "deep/nested/memory", "# Deep memory");

    const memory = await readMemory(tmpBase, "deep/nested/memory");
    expect(memory).not.toBeNull();
    expect(memory!.content).toBe("# Deep memory");
  });

  // ── Delete ────────────────────────────────────

  it("should delete an existing memory", async () => {
    const deleted = await deleteMemory(tmpBase, "overview");
    expect(deleted).toBe(true);

    const memory = await readMemory(tmpBase, "overview");
    expect(memory).toBeNull();
  });

  it("should return false when deleting non-existent memory", async () => {
    const deleted = await deleteMemory(tmpBase, "nonexistent");
    expect(deleted).toBe(false);
  });
});

describe("memory-migrator", () => {
  let tmpBase: string;

  beforeEach(() => {
    tmpBase = path.join(tmpdir(), `migrate-test-${Date.now()}`);
    mkdirSync(tmpBase, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpBase, { recursive: true, force: true });
  });

  it("should migrate .serena/memories/ to workflow-graph/memories/", async () => {
    const serenaDir = path.join(tmpBase, ".serena", "memories");
    mkdirSync(serenaDir, { recursive: true });
    writeFileSync(path.join(serenaDir, "overview.md"), "# Overview from Serena");
    writeFileSync(path.join(serenaDir, "rules.md"), "# Rules from Serena");

    const result = await migrateSerenaMemories(tmpBase);

    expect(result.migrated).toBe(2);
    expect(result.skipped).toBe(0);

    // Verify files exist in new location
    const newDir = path.join(tmpBase, "workflow-graph", "memories");
    expect(existsSync(path.join(newDir, "overview.md"))).toBe(true);
    expect(existsSync(path.join(newDir, "rules.md"))).toBe(true);
  });

  it("should skip files that already exist in target", async () => {
    const serenaDir = path.join(tmpBase, ".serena", "memories");
    mkdirSync(serenaDir, { recursive: true });
    writeFileSync(path.join(serenaDir, "overview.md"), "# Old overview");

    const targetDir = path.join(tmpBase, "workflow-graph", "memories");
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(path.join(targetDir, "overview.md"), "# New overview");

    const result = await migrateSerenaMemories(tmpBase);

    expect(result.migrated).toBe(0);
    expect(result.skipped).toBe(1);

    // Original content should be preserved
    const { readFile } = await import("node:fs/promises");
    const content = await readFile(path.join(targetDir, "overview.md"), "utf-8");
    expect(content).toBe("# New overview");
  });

  it("should return zeros when no .serena/memories/ exists", async () => {
    const result = await migrateSerenaMemories(tmpBase);

    expect(result.migrated).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it("should handle nested directories in .serena/memories/", async () => {
    const serenaDir = path.join(tmpBase, ".serena", "memories");
    const nestedDir = path.join(serenaDir, "sub");
    mkdirSync(nestedDir, { recursive: true });
    writeFileSync(path.join(nestedDir, "nested.md"), "# Nested");

    const result = await migrateSerenaMemories(tmpBase);

    expect(result.migrated).toBe(1);
    const targetFile = path.join(tmpBase, "workflow-graph", "memories", "sub", "nested.md");
    expect(existsSync(targetFile)).toBe(true);
  });
});
