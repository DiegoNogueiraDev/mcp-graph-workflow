import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { runUpdate } from "../mcp/init-project.js";
import { STORE_DIR } from "../core/utils/constants.js";
import { GraphNotInitializedError } from "../core/utils/errors.js";
import { SqliteStore } from "../core/store/sqlite-store.js";

const TEST_DIR = path.join(process.cwd(), ".test-update-cmd");

function initTestProject(): void {
  const storeDir = path.join(TEST_DIR, STORE_DIR);
  mkdirSync(storeDir, { recursive: true });
  const store = SqliteStore.open(TEST_DIR);
  store.initProject("test-project");
  store.close();
}

describe("runUpdate", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("should throw GraphNotInitializedError when DB does not exist", async () => {
    await expect(runUpdate(TEST_DIR)).rejects.toThrow(GraphNotInitializedError);
  });

  it("should return all steps up-to-date when nothing changed", async () => {
    initTestProject();

    // Run update twice — second run should find everything up-to-date
    await runUpdate(TEST_DIR);
    const report = await runUpdate(TEST_DIR);

    expect(report.steps.length).toBeGreaterThan(0);

    const configSteps = report.steps.filter(
      (s) => s.step !== "db" && s.step !== "deps",
    );
    for (const step of configSteps) {
      expect(step.status).toBe("up-to-date");
    }
    expect(report.hasChanges).toBe(false);
  });

  it("should detect changes in CLAUDE.md and report updated", async () => {
    initTestProject();

    // First run creates files
    await runUpdate(TEST_DIR);

    // Tamper with CLAUDE.md by removing the mcp-graph section
    const claudePath = path.join(TEST_DIR, "CLAUDE.md");
    writeFileSync(claudePath, "# My Project\n", "utf-8");

    const report = await runUpdate(TEST_DIR);
    const claudeStep = report.steps.find((s) => s.step === "claude-md");

    expect(claudeStep).toBeDefined();
    expect(claudeStep!.status).toBe("updated");
    expect(report.hasChanges).toBe(true);
  });

  it("should detect changes in .mcp.json and report updated", async () => {
    initTestProject();

    // First run creates files
    await runUpdate(TEST_DIR);

    // Tamper with .mcp.json
    const mcpJsonPath = path.join(TEST_DIR, ".mcp.json");
    writeFileSync(mcpJsonPath, '{"mcpServers": {}}\n', "utf-8");

    const report = await runUpdate(TEST_DIR);
    const mcpStep = report.steps.find((s) => s.step === "mcp-json");

    expect(mcpStep).toBeDefined();
    expect(mcpStep!.status).toBe("updated");
  });

  it("should respect --only filter", async () => {
    initTestProject();

    const report = await runUpdate(TEST_DIR, { only: ["claude-md"] });

    expect(report.steps.length).toBe(1);
    expect(report.steps[0].step).toBe("claude-md");
  });

  it("should not write files when dryRun is true", async () => {
    initTestProject();

    const report = await runUpdate(TEST_DIR, { dryRun: true });

    // Files should NOT exist (dry run skips writes)
    // .mcp.json should not be created by dry run alone
    // (it didn't exist before, so dry run should report "created" but not write)
    const claudeStep = report.steps.find((s) => s.step === "claude-md");
    expect(claudeStep).toBeDefined();
    expect(claudeStep!.status).toBe("created");

    // Verify the file was NOT actually written
    const claudePath = path.join(TEST_DIR, "CLAUDE.md");
    expect(existsSync(claudePath)).toBe(false);
  });

  it("should report created when file does not exist", async () => {
    initTestProject();

    const report = await runUpdate(TEST_DIR);
    const claudeStep = report.steps.find((s) => s.step === "claude-md");

    expect(claudeStep).toBeDefined();
    expect(claudeStep!.status).toBe("created");
  });

  it("should include all standard steps when no filter", async () => {
    initTestProject();

    const report = await runUpdate(TEST_DIR);
    const stepNames = report.steps.map((s) => s.step);

    expect(stepNames).toContain("db");
    expect(stepNames).toContain("mcp-json");
    expect(stepNames).toContain("vscode-mcp");
    expect(stepNames).toContain("gitignore");
    expect(stepNames).toContain("deps");
    expect(stepNames).toContain("claude-md");
    expect(stepNames).toContain("copilot-md");
  });
});
