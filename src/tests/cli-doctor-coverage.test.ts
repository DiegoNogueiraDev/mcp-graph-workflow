import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { STORE_DIR } from "../core/utils/constants.js";
import { runDoctor } from "../core/doctor/doctor-runner.js";
import { doctorCommand } from "../cli/commands/doctor.js";

describe("runDoctor CLI integration", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "mcp-doctor-test-"));
    const storeDir = path.join(tmpDir, STORE_DIR);
    mkdirSync(storeDir, { recursive: true });
    const store = SqliteStore.open(tmpDir);
    store.initProject("Test");
    store.close();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should run doctor successfully on valid project", async () => {
    const report = await runDoctor(tmpDir);
    expect(report).toBeDefined();
    expect(report.checks).toBeDefined();
    expect(Array.isArray(report.checks)).toBe(true);
    expect(report.summary).toBeDefined();
    expect(typeof report.summary.ok).toBe("number");
    expect(typeof report.summary.warning).toBe("number");
    expect(typeof report.summary.error).toBe("number");
  });

  it("should pass on a properly initialized project", async () => {
    const report = await runDoctor(tmpDir);
    expect(report.passed).toBe(true);
  });

  it("should return checks with name, level, and message", async () => {
    const report = await runDoctor(tmpDir);
    for (const check of report.checks) {
      expect(typeof check.name).toBe("string");
      expect(["ok", "warning", "error"]).toContain(check.level);
      expect(typeof check.message).toBe("string");
    }
  });

  it("should include graph-initialized check when DB exists", async () => {
    const report = await runDoctor(tmpDir);
    const graphCheck = report.checks.find((c) => c.name === "graph-initialized");
    expect(graphCheck).toBeDefined();
    expect(graphCheck!.level).toBe("ok");
  });
});

describe("doctorCommand wiring", () => {
  it("should create a command with --json option", () => {
    const cmd = doctorCommand();
    expect(cmd.name()).toBe("doctor");
    const opts = cmd.options.map((o) => o.long);
    expect(opts).toContain("--json");
    expect(opts).toContain("--dir");
  });

  it("should have a description", () => {
    const cmd = doctorCommand();
    expect(cmd.description()).toBeTruthy();
  });
});
