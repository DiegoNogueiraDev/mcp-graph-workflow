import { describe, it, expect, beforeEach } from "vitest";
import { LspDiagnosticsCollector } from "../../core/lsp/lsp-diagnostics.js";
import type { LspDiagnostic } from "../../core/lsp/lsp-types.js";
import { LspDiagnosticSeverity } from "../../core/lsp/lsp-types.js";

function makeDiag(overrides: Partial<LspDiagnostic> = {}): LspDiagnostic {
  return {
    file: "src/a.ts",
    startLine: 1,
    startCharacter: 0,
    endLine: 1,
    endCharacter: 5,
    severity: LspDiagnosticSeverity.Error,
    message: "test error",
    ...overrides,
  };
}

describe("LspDiagnosticsCollector", () => {
  let collector: LspDiagnosticsCollector;

  beforeEach(() => {
    collector = new LspDiagnosticsCollector();
  });

  // ---- 1. onDiagnostics stores diagnostics by language and file ----
  it("should store diagnostics by language and file", () => {
    const diags = [makeDiag({ file: "src/a.ts" })];
    collector.onDiagnostics("typescript", "src/a.ts", diags);

    const langMap = collector.getForLanguage("typescript");
    expect(langMap.get("src/a.ts")).toEqual(diags);
  });

  // ---- 2. getForFile returns diagnostics across all languages ----
  it("should return diagnostics across all languages for a file", () => {
    const tsDiag = makeDiag({ file: "src/a.ts", message: "ts error" });
    const cssDiag = makeDiag({ file: "src/a.ts", message: "css warning", severity: LspDiagnosticSeverity.Warning });

    collector.onDiagnostics("typescript", "src/a.ts", [tsDiag]);
    collector.onDiagnostics("css", "src/a.ts", [cssDiag]);

    const result = collector.getForFile("src/a.ts");
    expect(result).toHaveLength(2);
    expect(result).toContainEqual(tsDiag);
    expect(result).toContainEqual(cssDiag);
  });

  // ---- 3. getForLanguage returns map of file→diagnostics ----
  it("should return map of file to diagnostics for a language", () => {
    const diagA = makeDiag({ file: "src/a.ts" });
    const diagB = makeDiag({ file: "src/b.ts" });

    collector.onDiagnostics("typescript", "src/a.ts", [diagA]);
    collector.onDiagnostics("typescript", "src/b.ts", [diagB]);

    const langMap = collector.getForLanguage("typescript");
    expect(langMap.size).toBe(2);
    expect(langMap.get("src/a.ts")).toEqual([diagA]);
    expect(langMap.get("src/b.ts")).toEqual([diagB]);
  });

  // ---- 4. getForLanguage returns empty map for unknown language ----
  it("should return empty map for unknown language", () => {
    const langMap = collector.getForLanguage("rust");
    expect(langMap.size).toBe(0);
  });

  // ---- 5. getAll returns everything when no severity filter ----
  it("should return all diagnostics when no severity filter", () => {
    const err = makeDiag({ file: "src/a.ts", severity: LspDiagnosticSeverity.Error });
    const warn = makeDiag({ file: "src/b.ts", severity: LspDiagnosticSeverity.Warning });

    collector.onDiagnostics("typescript", "src/a.ts", [err]);
    collector.onDiagnostics("python", "src/b.ts", [warn]);

    const all = collector.getAll();
    expect(all.size).toBe(2);
    expect(all.get("src/a.ts")).toEqual([err]);
    expect(all.get("src/b.ts")).toEqual([warn]);
  });

  // ---- 6. getAll filters by severity ----
  it("should filter diagnostics by severity", () => {
    const err = makeDiag({ file: "src/a.ts", severity: LspDiagnosticSeverity.Error, message: "err" });
    const warn = makeDiag({ file: "src/a.ts", severity: LspDiagnosticSeverity.Warning, message: "warn" });

    collector.onDiagnostics("typescript", "src/a.ts", [err, warn]);

    const errOnly = collector.getAll(LspDiagnosticSeverity.Error);
    expect(errOnly.get("src/a.ts")).toHaveLength(1);
    expect(errOnly.get("src/a.ts")![0].message).toBe("err");
  });

  // ---- 7. getSummary counts errors/warnings/info/hints per language ----
  it("should count errors, warnings, info, and hints per language", () => {
    collector.onDiagnostics("typescript", "src/a.ts", [
      makeDiag({ severity: LspDiagnosticSeverity.Error }),
      makeDiag({ severity: LspDiagnosticSeverity.Error }),
      makeDiag({ severity: LspDiagnosticSeverity.Warning }),
    ]);
    collector.onDiagnostics("python", "src/b.py", [
      makeDiag({ severity: LspDiagnosticSeverity.Information }),
      makeDiag({ severity: LspDiagnosticSeverity.Hint }),
    ]);

    const summary = collector.getSummary();

    expect(summary.total).toEqual({ errors: 2, warnings: 1, info: 1, hints: 1 });
    expect(summary.byLanguage["typescript"]).toEqual({ errors: 2, warnings: 1, info: 0, hints: 0 });
    expect(summary.byLanguage["python"]).toEqual({ errors: 0, warnings: 0, info: 1, hints: 1 });
  });

  // ---- 8. clearLanguage removes only that language's diagnostics ----
  it("should remove only the specified language diagnostics", () => {
    collector.onDiagnostics("typescript", "src/a.ts", [makeDiag()]);
    collector.onDiagnostics("python", "src/b.py", [makeDiag()]);

    collector.clearLanguage("typescript");

    expect(collector.getForLanguage("typescript").size).toBe(0);
    expect(collector.getForLanguage("python").size).toBe(1);
  });

  // ---- 9. clearAll empties everything ----
  it("should clear all diagnostics", () => {
    collector.onDiagnostics("typescript", "src/a.ts", [makeDiag()]);
    collector.onDiagnostics("python", "src/b.py", [makeDiag()]);

    collector.clearAll();

    expect(collector.getAll().size).toBe(0);
    expect(collector.getSummary().total).toEqual({ errors: 0, warnings: 0, info: 0, hints: 0 });
  });

  // ---- 10. onDiagnostics with empty array removes file entry ----
  it("should remove file entry when empty diagnostics array is published", () => {
    collector.onDiagnostics("typescript", "src/a.ts", [makeDiag()]);
    expect(collector.getForFile("src/a.ts")).toHaveLength(1);

    collector.onDiagnostics("typescript", "src/a.ts", []);
    expect(collector.getForFile("src/a.ts")).toHaveLength(0);
  });

  // ---- 11. getAll merges same-file diagnostics from different languages ----
  it("should merge diagnostics from different languages for the same file", () => {
    collector.onDiagnostics("typescript", "src/a.ts", [
      makeDiag({ severity: LspDiagnosticSeverity.Error, message: "ts" }),
    ]);
    collector.onDiagnostics("css", "src/a.ts", [
      makeDiag({ severity: LspDiagnosticSeverity.Warning, message: "css" }),
    ]);

    const all = collector.getAll();
    expect(all.get("src/a.ts")).toHaveLength(2);
  });
});
