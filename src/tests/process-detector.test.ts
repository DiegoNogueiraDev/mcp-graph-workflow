import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { CodeStore } from "../core/code/code-store.js";
import { configureDb, runMigrations } from "../core/store/migrations.js";
import { detectProcesses } from "../core/code/process-detector.js";
import type { CodeSymbol } from "../core/code/code-types.js";

describe("process-detector", () => {
  let db: Database.Database;
  let store: CodeStore;
  const projectId = "proj_process";

  // Build a known call chain:
  //   main() → handleRequest() → validateInput() → saveToDb()
  //   main() is an entry point (exported, no callers)
  let symMain: CodeSymbol;
  let symHandle: CodeSymbol;
  let symValidate: CodeSymbol;
  let symSave: CodeSymbol;
  let symHelper: CodeSymbol; // internal, not entry point

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    store = new CodeStore(db);

    const mk = (name: string, file: string, exported: boolean = true) =>
      store.insertSymbol({ projectId, name, kind: "function", file, startLine: 1, endLine: 10, exported });

    symMain = mk("main", "src/index.ts");
    symHandle = mk("handleRequest", "src/server.ts");
    symValidate = mk("validateInput", "src/validator.ts");
    symSave = mk("saveToDb", "src/db.ts");
    symHelper = mk("formatDate", "src/utils.ts", false); // not exported, not entry

    store.insertRelation({ projectId, fromSymbol: symMain.id, toSymbol: symHandle.id, type: "calls" });
    store.insertRelation({ projectId, fromSymbol: symHandle.id, toSymbol: symValidate.id, type: "calls" });
    store.insertRelation({ projectId, fromSymbol: symValidate.id, toSymbol: symSave.id, type: "calls" });
    store.insertRelation({ projectId, fromSymbol: symHandle.id, toSymbol: symHelper.id, type: "calls" });
  });

  afterEach(() => {
    db.close();
  });

  it("should detect entry points (exported symbols with no callers)", () => {
    const processes = detectProcesses(store, projectId);

    const entryNames = processes.map((p) => p.entryPoint);
    expect(entryNames).toContain("main");
    // handleRequest has a caller (main), so it should not be an entry point
    expect(entryNames).not.toContain("handleRequest");
  });

  it("should trace call chains from entry points", () => {
    const processes = detectProcesses(store, projectId);

    const mainProcess = processes.find((p) => p.entryPoint === "main");
    expect(mainProcess).toBeDefined();
    expect(mainProcess!.chain.length).toBeGreaterThanOrEqual(2);

    // Chain should include handleRequest → validateInput → saveToDb
    const chainNames = mainProcess!.chain.map((s) => s.name);
    expect(chainNames).toContain("handleRequest");
    expect(chainNames).toContain("validateInput");
  });

  it("should return process with file information", () => {
    const processes = detectProcesses(store, projectId);

    const mainProcess = processes.find((p) => p.entryPoint === "main");
    expect(mainProcess!.entryFile).toBe("src/index.ts");
  });
});
