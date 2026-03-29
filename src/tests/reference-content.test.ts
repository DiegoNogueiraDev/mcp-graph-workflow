import { describe, it, expect } from "vitest";

import {
  getToolReference,
  getAnalyzeModes,
  getSkillsByPhase,
  getCliCommands,
  getKnowledgePipeline,
  getFullReference,
  TOOL_TABLE_FULL,
  ANALYZE_MODES_SECTION,
  SKILLS_SECTION,
  KNOWLEDGE_PIPELINE_SECTION,
  CLI_COMMANDS,
  DEPRECATED_TOOLS_SECTION,
} from "../core/config/reference-content.js";

describe("reference-content", () => {
  // ── Constants exist and are non-empty ─────────────

  it("should export all 6 constants as non-empty strings", () => {
    expect(TOOL_TABLE_FULL.length).toBeGreaterThan(100);
    expect(ANALYZE_MODES_SECTION.length).toBeGreaterThan(100);
    expect(SKILLS_SECTION.length).toBeGreaterThan(100);
    expect(KNOWLEDGE_PIPELINE_SECTION.length).toBeGreaterThan(100);
    expect(CLI_COMMANDS.length).toBeGreaterThan(50);
    expect(DEPRECATED_TOOLS_SECTION.length).toBeGreaterThan(50);
  });

  // ── getToolReference ──────────────────────────────

  it("should return full tool table when no phase specified", () => {
    const result = getToolReference();

    expect(result).toContain("init");
    expect(result).toContain("next");
    expect(result).toContain("validate");
  });

  it("should filter tool reference by phase", () => {
    const result = getToolReference("IMPLEMENT");

    expect(result).toContain("next");
    expect(result).toContain("context");
    expect(result).toContain("update_status");
  });

  // ── getAnalyzeModes ───────────────────────────────

  it("should return all analyze modes when no phase specified", () => {
    const result = getAnalyzeModes();

    expect(result).toContain("prd_quality");
    expect(result).toContain("implement_done");
    expect(result).toContain("backlog_health");
  });

  it("should filter analyze modes by IMPLEMENT phase", () => {
    const result = getAnalyzeModes("IMPLEMENT");

    expect(result).toContain("implement_done");
    expect(result).toContain("tdd_check");
    expect(result).toContain("progress");
    expect(result).not.toContain("prd_quality");
    expect(result).not.toContain("adr");
  });

  it("should filter analyze modes by DESIGN phase", () => {
    const result = getAnalyzeModes("DESIGN");

    expect(result).toContain("adr");
    expect(result).toContain("traceability");
    expect(result).not.toContain("implement_done");
  });

  // ── getSkillsByPhase ──────────────────────────────

  it("should return all skills when no phase specified", () => {
    const result = getSkillsByPhase();

    expect(result).toContain("ANALYZE");
    expect(result).toContain("IMPLEMENT");
  });

  it("should filter skills by VALIDATE phase", () => {
    const result = getSkillsByPhase("VALIDATE");

    expect(result).toContain("playwright");
    expect(result).toContain("e2e-testing");
  });

  // ── getCliCommands ────────────────────────────────

  it("should return CLI commands", () => {
    const result = getCliCommands();

    expect(result).toContain("npx mcp-graph");
    expect(result).toContain("stats");
  });

  // ── getKnowledgePipeline ──────────────────────────

  it("should return knowledge pipeline docs", () => {
    const result = getKnowledgePipeline();

    expect(result).toContain("Knowledge Store");
    expect(result).toContain("rag_context");
  });

  // ── getFullReference ──────────────────────────────

  it("should return all sections combined", () => {
    const result = getFullReference();

    expect(result).toContain("init");
    expect(result).toContain("implement_done");
    expect(result).toContain("npx mcp-graph");
    expect(result).toContain("Knowledge Store");
    expect(result.length).toBeGreaterThan(5000);
  });
});
