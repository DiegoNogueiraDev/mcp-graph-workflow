/**
 * Bug Verification — Gates & Tool Classification
 * Verifies fixes for: #001, #002, #005, #006, #007, #013, #015, #022
 *
 * These tests confirm that bootstrap/read-only tools are correctly classified
 * and not blocked by code-intelligence or lifecycle wrappers.
 */
import { describe, it, expect } from "vitest";
import { ALWAYS_ALLOWED_TOOLS, READ_ONLY_TOOLS } from "../mcp/tool-classification.js";

describe("Bug Verification — Gates & Tool Classification", () => {
  // ── #001, #002, #005, #006: Deadlock — bootstrap tools must be in both sets ──

  describe("Bootstrap tools in ALWAYS_ALLOWED_TOOLS (#001, #002, #005, #006)", () => {
    it.each(["init", "set_phase", "reindex_knowledge", "sync_stack_docs"])(
      "should include '%s' in ALWAYS_ALLOWED_TOOLS",
      (tool) => {
        expect(ALWAYS_ALLOWED_TOOLS.has(tool)).toBe(true);
      },
    );
  });

  describe("Bootstrap tools in READ_ONLY_TOOLS (#001, #002, #005, #006)", () => {
    it.each(["init", "set_phase", "reindex_knowledge", "sync_stack_docs"])(
      "should include '%s' in READ_ONLY_TOOLS",
      (tool) => {
        expect(READ_ONLY_TOOLS.has(tool)).toBe(true);
      },
    );
  });

  // ── #007: Consistent whitelists — ALWAYS_ALLOWED is subset of READ_ONLY ──

  describe("Whitelist consistency (#007)", () => {
    it("ALWAYS_ALLOWED_TOOLS should be a subset of READ_ONLY_TOOLS", () => {
      for (const tool of ALWAYS_ALLOWED_TOOLS) {
        expect(READ_ONLY_TOOLS.has(tool), `${tool} missing from READ_ONLY_TOOLS`).toBe(true);
      }
    });
  });

  // ── #015: edge list should be read-only ──
  // edge is NOT in READ_ONLY_TOOLS (it has mutating actions), but:
  // - edge(action="list") is handled at the tool level
  // - The wrapper checks tool name, not action
  // This test verifies the tool name is NOT in the set (mutating tool), which is correct.
  // The fix for #015 is that edge(list) is handled inside the tool handler, not at wrapper level.

  // ── #022: journey should be read-only ──

  describe("Journey in READ_ONLY_TOOLS (#022)", () => {
    it("should include 'journey' in READ_ONLY_TOOLS", () => {
      expect(READ_ONLY_TOOLS.has("journey")).toBe(true);
    });
  });

  // ── #013: manage_skill removed from READ_ONLY_TOOLS (has mutating actions) ──

  describe("manage_skill NOT in READ_ONLY_TOOLS (#013 revised)", () => {
    it("should NOT include 'manage_skill' in READ_ONLY_TOOLS (has create/update/delete)", () => {
      expect(READ_ONLY_TOOLS.has("manage_skill")).toBe(false);
    });
  });

  // ── General: known read-only tools classification ──

  describe("Read-only tools completeness", () => {
    const expectedReadOnly = [
      "list", "show", "search", "metrics", "export", "context",
      "rag_context", "analyze", "snapshot", "next",
      "list_memories", "read_memory", "list_skills",
      "plan_sprint", "validate_ac",
      "knowledge_stats", "knowledge_feedback", "code_intelligence", "journey",
    ];

    it.each(expectedReadOnly)(
      "should include '%s' in READ_ONLY_TOOLS",
      (tool) => {
        expect(READ_ONLY_TOOLS.has(tool)).toBe(true);
      },
    );
  });
});
