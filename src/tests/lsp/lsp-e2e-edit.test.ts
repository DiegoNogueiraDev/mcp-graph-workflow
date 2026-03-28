/**
 * E2E integration tests for LSP edit operations.
 * Tests the full edit workflow: create files → apply workspace edits → verify results.
 * Covers rename (multi-file), format, and code action scenarios.
 * Note: Lines are 1-based in LspTextEdit (normalized from LSP 0-based by lsp-bridge).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile, readFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { LspEditApplier } from "../../core/lsp/lsp-edit-applier.js";
import type { LspTextEdit, LspWorkspaceEdit } from "../../core/lsp/lsp-types.js";

/** Helper: 1-based line/char edit */
function e(file: string, sl: number, sc: number, el: number, ec: number, newText: string): LspTextEdit {
  return { file, startLine: sl, startCharacter: sc, endLine: el, endCharacter: ec, newText };
}

describe("LSP E2E Edit Integration", () => {
  let testDir: string;
  let applier: LspEditApplier;

  beforeEach(async () => {
    testDir = join(tmpdir(), `lsp-e2e-${randomUUID()}`);
    await mkdir(testDir, { recursive: true });
    applier = new LspEditApplier();
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  async function createFile(name: string, content: string): Promise<string> {
    const filePath = join(testDir, name);
    await writeFile(filePath, content, "utf-8");
    return filePath;
  }

  async function readTestFile(name: string): Promise<string> {
    return readFile(join(testDir, name), "utf-8");
  }

  // ── E2E Rename (multi-file) ───────────────────────────

  describe("E2E rename — multi-file symbol rename", () => {
    it("should rename a function across two files", async () => {
      // Line 1: import { calcTotal } from "./utils.js";
      // Line 2: (empty)
      // Line 3: const r = calcTotal([1,2,3]);
      const mainPath = await createFile("main.ts",
        'import { calcTotal } from "./utils.js";\n\nconst r = calcTotal([1, 2, 3]);\n');

      // Line 1: export function calcTotal(items: number[]): number {
      // Line 2:   return items.reduce((s, n) => s + n, 0);
      // Line 3: }
      const utilsPath = await createFile("utils.ts",
        "export function calcTotal(items: number[]): number {\n  return items.reduce((s, n) => s + n, 0);\n}\n");

      const wsEdit: LspWorkspaceEdit = {
        changes: [
          e(mainPath, 1, 9, 1, 18, "computeSum"),   // import { calcTotal → computeSum
          e(mainPath, 3, 10, 3, 19, "computeSum"),   // calcTotal([1,2,3]) → computeSum
          e(utilsPath, 1, 16, 1, 25, "computeSum"),  // function calcTotal → computeSum
        ],
      };

      const result = await applier.applyWorkspaceEdit(wsEdit);
      expect(result.applied).toBe(true);
      expect(result.filesModified).toHaveLength(2);
      expect(result.totalEdits).toBe(3);

      const mainContent = await readTestFile("main.ts");
      expect(mainContent).toContain("computeSum");
      expect(mainContent).not.toContain("calcTotal");

      const utilsContent = await readTestFile("utils.ts");
      expect(utilsContent).toContain("function computeSum");
    });

    it("should not corrupt adjacent lines", async () => {
      const fp = await createFile("adj.ts",
        "const a = 1;\nconst oldName = 2;\nconst c = 3;\n");

      const wsEdit: LspWorkspaceEdit = {
        changes: [e(fp, 2, 6, 2, 13, "newName")],
      };

      const result = await applier.applyWorkspaceEdit(wsEdit);
      expect(result.applied).toBe(true);

      const content = await readTestFile("adj.ts");
      expect(content).toBe("const a = 1;\nconst newName = 2;\nconst c = 3;\n");
    });
  });

  // ── E2E Format ────────────────────────────────────────

  describe("E2E format — document formatting", () => {
    it("should insert indentation via format edits", async () => {
      const fp = await createFile("fmt.ts",
        "function f() {\nconst x = 1;\nif (x) {\nconsole.log(x);\n}\n}\n");

      // Simulate formatter adding indentation
      const wsEdit: LspWorkspaceEdit = {
        changes: [
          e(fp, 2, 0, 2, 0, "  "),        // indent const
          e(fp, 3, 0, 3, 0, "  "),        // indent if
          e(fp, 4, 0, 4, 0, "    "),      // indent console.log
          e(fp, 5, 0, 5, 0, "  "),        // indent closing }
        ],
      };

      const result = await applier.applyWorkspaceEdit(wsEdit);
      expect(result.applied).toBe(true);

      const content = await readTestFile("fmt.ts");
      expect(content).toContain("  const x = 1;");
      expect(content).toContain("    console.log(x);");
    });

    it("should preserve unchanged lines", async () => {
      const fp = await createFile("preserve.ts",
        "// keep\nfoo();\n// keep2\n");

      const wsEdit: LspWorkspaceEdit = {
        changes: [e(fp, 2, 0, 2, 3, "bar")],  // foo → bar
      };

      const result = await applier.applyWorkspaceEdit(wsEdit);
      expect(result.applied).toBe(true);

      const content = await readTestFile("preserve.ts");
      expect(content).toContain("// keep");
      expect(content).toContain("bar();");
      expect(content).toContain("// keep2");
    });
  });

  // ── E2E Code Action ───────────────────────────────────

  describe("E2E code action — quick fix application", () => {
    it("should insert import at top of file", async () => {
      const fp = await createFile("needs-import.ts",
        "\nconst x = readFileSync('data.json');\n");

      const wsEdit: LspWorkspaceEdit = {
        changes: [
          e(fp, 1, 0, 1, 0, "import { readFileSync } from 'node:fs';\n"),
        ],
      };

      const result = await applier.applyWorkspaceEdit(wsEdit);
      expect(result.applied).toBe(true);

      const content = await readTestFile("needs-import.ts");
      expect(content).toContain("import { readFileSync } from 'node:fs'");
      expect(content).toContain("readFileSync('data.json')");
    });

    it("should delete a line (remove unused variable)", async () => {
      const fp = await createFile("unused.ts",
        "function f() {\n  const unused = 42;\n  const used = 1;\n  return used;\n}\n");

      // Delete line 2 entirely (unused var)
      const wsEdit: LspWorkspaceEdit = {
        changes: [e(fp, 2, 0, 3, 0, "")],
      };

      const result = await applier.applyWorkspaceEdit(wsEdit);
      expect(result.applied).toBe(true);

      const content = await readTestFile("unused.ts");
      expect(content).not.toContain("unused");
      expect(content).toContain("const used = 1;");
    });
  });

  // ── Sequential Edits ──────────────────────────────────

  describe("post-edit consistency", () => {
    it("should handle sequential edits on same file", async () => {
      const fp = await createFile("seq.ts",
        "export class Calc {\n  add(a: number, b: number) { return a + b; }\n}\n");

      // Edit 1: rename class
      const r1 = await applier.applyWorkspaceEdit({
        changes: [e(fp, 1, 13, 1, 17, "MathEngine")],
      });
      expect(r1.applied).toBe(true);

      // Edit 2: rename method
      const r2 = await applier.applyWorkspaceEdit({
        changes: [e(fp, 2, 2, 2, 5, "sum")],
      });
      expect(r2.applied).toBe(true);

      const final = await readTestFile("seq.ts");
      expect(final).toContain("class MathEngine");
      expect(final).toContain("sum(a: number");
    });
  });
});
