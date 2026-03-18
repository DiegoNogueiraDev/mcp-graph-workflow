import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { getIntegrationsStatus } from "../core/integrations/tool-status.js";

describe("getIntegrationsStatus", { timeout: 15_000 }, () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = path.join(tmpdir(), `tool-status-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  // ── Shape ──────────────────────────────────────────

  it("should return correct shape with all fields", async () => {
    const status = await getIntegrationsStatus(tmpDir);

    expect(status).toHaveProperty("codeGraph");
    expect(status).toHaveProperty("memories");
    expect(status).toHaveProperty("playwright");
    expect(status.codeGraph).toHaveProperty("installed");
    expect(status.codeGraph).toHaveProperty("running");
    expect(status.codeGraph).toHaveProperty("symbolCount");
    expect(status.memories).toHaveProperty("available");
    expect(status.memories).toHaveProperty("count");
    expect(status.memories).toHaveProperty("directory");
    expect(status.memories).toHaveProperty("names");
    expect(status.playwright).toHaveProperty("installed");
    expect(status.playwright).toHaveProperty("running");
  });

  // ── Memories detection ──────────────────────────────

  it("should detect memories when workflow-graph/memories/ exists with files", async () => {
    const memoriesDir = path.join(tmpDir, "workflow-graph", "memories");
    mkdirSync(memoriesDir, { recursive: true });
    writeFileSync(path.join(memoriesDir, "architecture.md"), "# Architecture notes");
    writeFileSync(path.join(memoriesDir, "conventions.md"), "# Conventions");

    const status = await getIntegrationsStatus(tmpDir);

    expect(status.memories.available).toBe(true);
    expect(status.memories.count).toBe(2);
    expect(status.memories.names).toContain("architecture");
    expect(status.memories.names).toContain("conventions");
  });

  it("should report no memories when directory does not exist", async () => {
    const status = await getIntegrationsStatus(tmpDir);

    expect(status.memories.available).toBe(false);
    expect(status.memories.count).toBe(0);
    expect(status.memories.names).toHaveLength(0);
  });

  it("should report empty when memories dir is empty", async () => {
    const memoriesDir = path.join(tmpDir, "workflow-graph", "memories");
    mkdirSync(memoriesDir, { recursive: true });

    const status = await getIntegrationsStatus(tmpDir);

    expect(status.memories.available).toBe(false);
    expect(status.memories.count).toBe(0);
  });

  // ── Code Graph ──────────────────────────────────────

  it("should report code graph not indexed when no DB exists", async () => {
    const status = await getIntegrationsStatus(tmpDir);

    expect(status.codeGraph.installed).toBe(true); // Always available (native)
    expect(status.codeGraph.running).toBe(false);
    expect(status.codeGraph.symbolCount).toBe(0);
  });

  // ── Playwright ────────────────────────────────────

  it("should detect playwright based on npx availability", async () => {
    const status = await getIntegrationsStatus(tmpDir);

    expect(typeof status.playwright.installed).toBe("boolean");
    expect(status.playwright.running).toBe(false);
  });

  // ── Memories edge case ──────────────────────────────

  it("should only include .md files in memories list", async () => {
    const memoriesDir = path.join(tmpDir, "workflow-graph", "memories");
    mkdirSync(memoriesDir, { recursive: true });
    writeFileSync(path.join(memoriesDir, "notes.md"), "# Notes");
    writeFileSync(path.join(memoriesDir, "data.json"), "{}");
    writeFileSync(path.join(memoriesDir, "readme.txt"), "text");

    const status = await getIntegrationsStatus(tmpDir);

    expect(status.memories.names).toEqual(["notes"]);
  });
});
