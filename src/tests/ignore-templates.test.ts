import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import {
  getIgnoreTemplate,
  ensureClaudeIgnore,
  ensureCopilotIgnore,
} from "../core/config/ignore-templates.js";

describe("ignore-templates", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = path.join(tmpdir(), `ignore-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── Template content ──────────────────────────────

  it("should return non-empty ignore template", () => {
    const template = getIgnoreTemplate();

    expect(template.length).toBeGreaterThan(500);
    expect(template).toContain("node_modules/");
    expect(template).toContain("!CLAUDE.md");
  });

  it("should include critical ignore patterns", () => {
    const template = getIgnoreTemplate();

    expect(template).toContain("dist/");
    expect(template).toContain(".git/");
    expect(template).toContain("workflow-graph/");
    expect(template).toContain("*.db");
    expect(template).toContain(".env*");
    expect(template).toContain("coverage/");
  });

  it("should preserve CLAUDE.md and .claude/rules/", () => {
    const template = getIgnoreTemplate();

    expect(template).toContain("!CLAUDE.md");
    // Should not ignore .claude/rules/
    expect(template).not.toContain(".claude/rules/");
  });

  // ── .claudeignore and .copilotignore share same content ─

  it("should generate identical content for both ignore files", () => {
    ensureClaudeIgnore(tmpDir);
    ensureCopilotIgnore(tmpDir);

    const claudeContent = readFileSync(path.join(tmpDir, ".claudeignore"), "utf-8");
    const copilotContent = readFileSync(path.join(tmpDir, ".copilotignore"), "utf-8");

    expect(claudeContent).toBe(copilotContent);
  });

  // ── ensureClaudeIgnore ────────────────────────────

  it("should create .claudeignore if not exists", () => {
    const created = ensureClaudeIgnore(tmpDir);

    expect(created).toBe(true);
    expect(existsSync(path.join(tmpDir, ".claudeignore"))).toBe(true);
  });

  it("should NOT overwrite existing .claudeignore", () => {
    const filePath = path.join(tmpDir, ".claudeignore");
    writeFileSync(filePath, "# custom content\nnode_modules/\n", "utf-8");

    const created = ensureClaudeIgnore(tmpDir);

    expect(created).toBe(false);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toBe("# custom content\nnode_modules/\n");
  });

  // ── ensureCopilotIgnore ───────────────────────────

  it("should create .copilotignore if not exists", () => {
    const created = ensureCopilotIgnore(tmpDir);

    expect(created).toBe(true);
    expect(existsSync(path.join(tmpDir, ".copilotignore"))).toBe(true);
  });

  it("should NOT overwrite existing .copilotignore", () => {
    const filePath = path.join(tmpDir, ".copilotignore");
    writeFileSync(filePath, "# my custom ignores\n", "utf-8");

    const created = ensureCopilotIgnore(tmpDir);

    expect(created).toBe(false);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toBe("# my custom ignores\n");
  });
});
