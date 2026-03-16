import { describe, it, expect } from "vitest";
import { tmpdir } from "node:os";

// We test each check function in isolation
// The actual implementations will be in doctor-checks.ts

describe("checkNodeVersion", () => {
  it("should return ok when Node.js version is >= 20", async () => {
    const { checkNodeVersion } = await import("../core/doctor/doctor-checks.js");
    // Current test environment should be >= 20
    const result = checkNodeVersion();
    expect(result.name).toBe("node-version");
    expect(result.level).toBe("ok");
    expect(result.message).toContain("Node.js");
  });

  it("should return error for version below 20", async () => {
    const { checkNodeVersionWith } = await import("../core/doctor/doctor-checks.js");
    const result = checkNodeVersionWith("18.0.0");
    expect(result.level).toBe("error");
    expect(result.suggestion).toBeTruthy();
  });

  it("should return ok for version exactly 20.0.0", async () => {
    const { checkNodeVersionWith } = await import("../core/doctor/doctor-checks.js");
    const result = checkNodeVersionWith("20.0.0");
    expect(result.level).toBe("ok");
  });
});

describe("checkWritePermissions", () => {
  it("should return ok when directory is writable", async () => {
    const { checkWritePermissions } = await import("../core/doctor/doctor-checks.js");
    const result = await checkWritePermissions(tmpdir());
    expect(result.name).toBe("write-permissions");
    expect(result.level).toBe("ok");
  });

  it("should return error for non-existent directory", async () => {
    const { checkWritePermissions } = await import("../core/doctor/doctor-checks.js");
    const result = await checkWritePermissions("/nonexistent-path-xyz-" + Date.now());
    expect(result.level).toBe("error");
    expect(result.suggestion).toBeTruthy();
  });
});

describe("checkSqliteDatabase", () => {
  it("should return error when database does not exist", async () => {
    const { checkSqliteDatabase } = await import("../core/doctor/doctor-checks.js");
    const result = await checkSqliteDatabase("/nonexistent-path-xyz-" + Date.now());
    expect(result.name).toBe("sqlite-database");
    expect(result.level).toBe("error");
    expect(result.suggestion).toContain("init");
  });

  it("should return ok when database exists and opens", async () => {
    // Create a temp store to test against
    const { SqliteStore } = await import("../core/store/sqlite-store.js");
    const os = await import("node:os");
    const path = await import("node:path");
    const fs = await import("node:fs");
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "doctor-test-"));
    const store = SqliteStore.open(tmpDir);
    store.initProject("test-project");
    store.close();

    const { checkSqliteDatabase } = await import("../core/doctor/doctor-checks.js");
    const result = await checkSqliteDatabase(tmpDir);
    expect(result.level).toBe("ok");

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("checkDbIntegrity", () => {
  it("should return ok for a valid database", async () => {
    const { SqliteStore } = await import("../core/store/sqlite-store.js");
    const os = await import("node:os");
    const path = await import("node:path");
    const fs = await import("node:fs");
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "doctor-integrity-"));
    const store = SqliteStore.open(tmpDir);
    store.initProject("test-project");
    store.close();

    const { checkDbIntegrity } = await import("../core/doctor/doctor-checks.js");
    const result = await checkDbIntegrity(tmpDir);
    expect(result.name).toBe("db-integrity");
    expect(result.level).toBe("ok");

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should return error when database does not exist", async () => {
    const { checkDbIntegrity } = await import("../core/doctor/doctor-checks.js");
    const result = await checkDbIntegrity("/nonexistent-" + Date.now());
    expect(result.level).toBe("error");
  });
});

describe("checkGraphInitialized", () => {
  it("should return warning when project is not initialized", async () => {
    const { SqliteStore } = await import("../core/store/sqlite-store.js");
    const os = await import("node:os");
    const path = await import("node:path");
    const fs = await import("node:fs");
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "doctor-init-"));
    const store = SqliteStore.open(tmpDir);
    // Don't init project

    const { checkGraphInitialized } = await import("../core/doctor/doctor-checks.js");
    const result = checkGraphInitialized(store);
    expect(result.name).toBe("graph-initialized");
    expect(result.level).toBe("warning");
    expect(result.suggestion).toContain("init");

    store.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should return ok when project is initialized", async () => {
    const { SqliteStore } = await import("../core/store/sqlite-store.js");
    const os = await import("node:os");
    const path = await import("node:path");
    const fs = await import("node:fs");
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "doctor-init-ok-"));
    const store = SqliteStore.open(tmpDir);
    store.initProject("test-project");

    const { checkGraphInitialized } = await import("../core/doctor/doctor-checks.js");
    const result = checkGraphInitialized(store);
    expect(result.level).toBe("ok");

    store.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("checkConfigFile", () => {
  it("should return ok when no config file exists (defaults used)", async () => {
    const os = await import("node:os");
    const path = await import("node:path");
    const fs = await import("node:fs");
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "doctor-config-"));

    const { checkConfigFile } = await import("../core/doctor/doctor-checks.js");
    const result = checkConfigFile(tmpDir);
    expect(result.name).toBe("config-file");
    expect(result.level).toBe("ok");
    expect(result.message).toContain("default");

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should return warning when config file has invalid JSON", async () => {
    const os = await import("node:os");
    const path = await import("node:path");
    const fs = await import("node:fs");
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "doctor-config-bad-"));
    fs.writeFileSync(path.join(tmpDir, "mcp-graph.config.json"), "not json{{{");

    const { checkConfigFile } = await import("../core/doctor/doctor-checks.js");
    const result = checkConfigFile(tmpDir);
    expect(result.level).toBe("warning");
    expect(result.suggestion).toBeTruthy();

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("checkDashboardBuild", () => {
  it("should return warning when dashboard build does not exist", async () => {
    const { checkDashboardBuild } = await import("../core/doctor/doctor-checks.js");
    const result = await checkDashboardBuild("/nonexistent-" + Date.now());
    expect(result.name).toBe("dashboard-build");
    expect(result.level).toBe("warning");
    expect(result.suggestion).toBeTruthy();
  });
});

describe("checkMcpJson", () => {
  it("should return warning when .mcp.json does not exist", async () => {
    const { checkMcpJson } = await import("../core/doctor/doctor-checks.js");
    const result = checkMcpJson("/nonexistent-" + Date.now());
    expect(result.name).toBe("mcp-json");
    expect(result.level).toBe("warning");
    expect(result.suggestion).toBeTruthy();
  });

  it("should return ok when .mcp.json exists and is valid JSON", async () => {
    const os = await import("node:os");
    const path = await import("node:path");
    const fs = await import("node:fs");
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "doctor-mcp-"));
    fs.writeFileSync(path.join(tmpDir, ".mcp.json"), JSON.stringify({ mcpServers: {} }));

    const { checkMcpJson } = await import("../core/doctor/doctor-checks.js");
    const result = checkMcpJson(tmpDir);
    expect(result.level).toBe("ok");

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should return warning when .mcp.json has invalid JSON", async () => {
    const os = await import("node:os");
    const path = await import("node:path");
    const fs = await import("node:fs");
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "doctor-mcp-bad-"));
    fs.writeFileSync(path.join(tmpDir, ".mcp.json"), "{invalid}}}");

    const { checkMcpJson } = await import("../core/doctor/doctor-checks.js");
    const result = checkMcpJson(tmpDir);
    expect(result.level).toBe("warning");

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("checkIntegrations", () => {
  it("should return results for gitnexus, serena, and playwright", { timeout: 15_000 }, async () => {
    const { checkIntegrations } = await import("../core/doctor/doctor-checks.js");
    const results = await checkIntegrations(tmpdir());
    expect(results.length).toBe(3);
    expect(results.map((r) => r.name)).toEqual(
      expect.arrayContaining(["integration-gitnexus", "integration-serena", "integration-playwright"]),
    );
    // All should be either ok or warning (never error for integrations)
    for (const r of results) {
      expect(["ok", "warning"]).toContain(r.level);
    }
  });
});
