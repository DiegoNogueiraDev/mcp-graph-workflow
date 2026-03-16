import { describe, it, expect } from "vitest";

describe("runDoctor", () => {
  it("should return a DoctorReport with all checks", async () => {
    const os = await import("node:os");
    const path = await import("node:path");
    const fs = await import("node:fs");
    const { SqliteStore } = await import("../core/store/sqlite-store.js");

    // Setup a valid temp project
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "doctor-runner-"));
    const store = SqliteStore.open(tmpDir);
    store.initProject("test-project");
    store.close();

    const { runDoctor } = await import("../core/doctor/doctor-runner.js");
    const report = await runDoctor(tmpDir);

    expect(report.checks.length).toBeGreaterThan(0);
    expect(report.summary).toHaveProperty("ok");
    expect(report.summary).toHaveProperty("warning");
    expect(report.summary).toHaveProperty("error");
    expect(typeof report.passed).toBe("boolean");

    // Summary should match check counts
    const okCount = report.checks.filter((c) => c.level === "ok").length;
    const warnCount = report.checks.filter((c) => c.level === "warning").length;
    const errCount = report.checks.filter((c) => c.level === "error").length;
    expect(report.summary.ok).toBe(okCount);
    expect(report.summary.warning).toBe(warnCount);
    expect(report.summary.error).toBe(errCount);

    // passed should be true only when zero errors
    expect(report.passed).toBe(errCount === 0);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should report errors for non-existent base path", async () => {
    const { runDoctor } = await import("../core/doctor/doctor-runner.js");
    const report = await runDoctor("/nonexistent-" + Date.now());

    expect(report.passed).toBe(false);
    expect(report.summary.error).toBeGreaterThan(0);
  });

  it("should include all expected check names", async () => {
    const os = await import("node:os");
    const path = await import("node:path");
    const fs = await import("node:fs");

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "doctor-runner-names-"));

    const { runDoctor } = await import("../core/doctor/doctor-runner.js");
    const report = await runDoctor(tmpDir);

    const names = report.checks.map((c) => c.name);
    expect(names).toContain("node-version");
    expect(names).toContain("write-permissions");
    expect(names).toContain("sqlite-database");
    expect(names).toContain("config-file");
    expect(names).toContain("mcp-json");
    expect(names).toContain("dashboard-build");

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
