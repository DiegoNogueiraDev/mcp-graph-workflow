/**
 * TDD Red — Tests for LspEditApplier.
 * Validates: single-file edit, multi-file edit, reverse ordering,
 * rollback, atomicity, and range validation.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile, readFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { LspEditApplier } from "../../core/lsp/lsp-edit-applier.js";
import type { LspWorkspaceEdit } from "../../core/lsp/lsp-types.js";

describe("LspEditApplier", () => {
  let testDir: string;
  let applier: LspEditApplier;

  beforeEach(async () => {
    testDir = join(tmpdir(), `lsp-edit-test-${randomUUID()}`);
    await mkdir(testDir, { recursive: true });
    applier = new LspEditApplier();
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  // --- Helper ---
  async function createFile(name: string, content: string): Promise<string> {
    const filePath = join(testDir, name);
    await writeFile(filePath, content, "utf-8");
    return filePath;
  }

  async function readTestFile(name: string): Promise<string> {
    return readFile(join(testDir, name), "utf-8");
  }

  // --- Single-file edit ---
  describe("single-file edit", () => {
    it("should apply a single text edit to a file", async () => {
      const filePath = await createFile("test.ts", "const foo = 1;\nconst bar = 2;\n");

      const edit: LspWorkspaceEdit = {
        changes: [
          {
            file: filePath,
            startLine: 1,
            startCharacter: 6,
            endLine: 1,
            endCharacter: 9,
            newText: "baz",
          },
        ],
      };

      const result = await applier.applyWorkspaceEdit(edit);

      expect(result.applied).toBe(true);
      expect(result.filesModified).toEqual([filePath]);
      expect(result.totalEdits).toBe(1);
      expect(result.errors).toEqual([]);

      const content = await readTestFile("test.ts");
      expect(content).toBe("const baz = 1;\nconst bar = 2;\n");
    });

    it("should apply multiple edits to the same file in reverse order", async () => {
      const filePath = await createFile(
        "multi.ts",
        "const aaa = 1;\nconst bbb = 2;\nconst ccc = 3;\n",
      );

      const edit: LspWorkspaceEdit = {
        changes: [
          {
            file: filePath,
            startLine: 1,
            startCharacter: 6,
            endLine: 1,
            endCharacter: 9,
            newText: "xxx",
          },
          {
            file: filePath,
            startLine: 3,
            startCharacter: 6,
            endLine: 3,
            endCharacter: 9,
            newText: "zzz",
          },
        ],
      };

      const result = await applier.applyWorkspaceEdit(edit);

      expect(result.applied).toBe(true);
      expect(result.totalEdits).toBe(2);

      const content = await readTestFile("multi.ts");
      expect(content).toBe("const xxx = 1;\nconst bbb = 2;\nconst zzz = 3;\n");
    });

    it("should handle inserting text (empty range)", async () => {
      const filePath = await createFile("insert.ts", "const x = 1;\n");

      const edit: LspWorkspaceEdit = {
        changes: [
          {
            file: filePath,
            startLine: 1,
            startCharacter: 0,
            endLine: 1,
            endCharacter: 0,
            newText: "// comment\n",
          },
        ],
      };

      const result = await applier.applyWorkspaceEdit(edit);

      expect(result.applied).toBe(true);
      const content = await readTestFile("insert.ts");
      expect(content).toBe("// comment\nconst x = 1;\n");
    });

    it("should handle deleting text (empty newText)", async () => {
      const filePath = await createFile("delete.ts", "const x = 1;\nconst y = 2;\n");

      const edit: LspWorkspaceEdit = {
        changes: [
          {
            file: filePath,
            startLine: 1,
            startCharacter: 0,
            endLine: 2,
            endCharacter: 0,
            newText: "",
          },
        ],
      };

      const result = await applier.applyWorkspaceEdit(edit);

      expect(result.applied).toBe(true);
      const content = await readTestFile("delete.ts");
      expect(content).toBe("const y = 2;\n");
    });
  });

  // --- Multi-file edit ---
  describe("multi-file edit", () => {
    it("should apply edits across multiple files", async () => {
      const file1 = await createFile("a.ts", "import { foo } from './b.js';\n");
      const file2 = await createFile("b.ts", "export const foo = 42;\n");

      // "import { foo } from './b.js';\n"
      //  0123456789...  foo starts at char 9, ends at 12
      // "export const foo = 42;\n"
      //  0123456789012345  foo starts at char 13, ends at 16
      const edit: LspWorkspaceEdit = {
        changes: [
          {
            file: file1,
            startLine: 1,
            startCharacter: 9,
            endLine: 1,
            endCharacter: 12,
            newText: "bar",
          },
          {
            file: file2,
            startLine: 1,
            startCharacter: 13,
            endLine: 1,
            endCharacter: 16,
            newText: "bar",
          },
        ],
      };

      const result = await applier.applyWorkspaceEdit(edit);

      expect(result.applied).toBe(true);
      expect(result.filesModified).toHaveLength(2);
      expect(result.totalEdits).toBe(2);

      const content1 = await readTestFile("a.ts");
      expect(content1).toBe("import { bar } from './b.js';\n");

      const content2 = await readTestFile("b.ts");
      expect(content2).toBe("export const bar = 42;\n");
    });
  });

  // --- Reverse ordering ---
  describe("reverse ordering preserves positions", () => {
    it("should apply edits bottom-to-top within the same file", async () => {
      const filePath = await createFile(
        "order.ts",
        "aaa\nbbb\nccc\nddd\n",
      );

      // Two edits on different lines — order matters
      const edit: LspWorkspaceEdit = {
        changes: [
          {
            file: filePath,
            startLine: 2,
            startCharacter: 0,
            endLine: 2,
            endCharacter: 3,
            newText: "BBB_REPLACED",
          },
          {
            file: filePath,
            startLine: 4,
            startCharacter: 0,
            endLine: 4,
            endCharacter: 3,
            newText: "DDD_REPLACED",
          },
        ],
      };

      const result = await applier.applyWorkspaceEdit(edit);

      expect(result.applied).toBe(true);
      const content = await readTestFile("order.ts");
      expect(content).toBe("aaa\nBBB_REPLACED\nccc\nDDD_REPLACED\n");
    });
  });

  // --- Rollback ---
  describe("rollback", () => {
    it("should restore files to original state after rollback", async () => {
      const filePath = await createFile("rollback.ts", "original content\n");

      const edit: LspWorkspaceEdit = {
        changes: [
          {
            file: filePath,
            startLine: 1,
            startCharacter: 0,
            endLine: 1,
            endCharacter: 16,
            newText: "modified content",
          },
        ],
      };

      const result = await applier.applyWorkspaceEdit(edit);
      expect(result.applied).toBe(true);

      // Verify modification
      let content = await readTestFile("rollback.ts");
      expect(content).toBe("modified content\n");

      // Rollback
      await applier.rollback(result);

      content = await readTestFile("rollback.ts");
      expect(content).toBe("original content\n");
    });

    it("should rollback multi-file edits completely", async () => {
      const file1 = await createFile("r1.ts", "file1 original\n");
      const file2 = await createFile("r2.ts", "file2 original\n");

      const edit: LspWorkspaceEdit = {
        changes: [
          {
            file: file1,
            startLine: 1,
            startCharacter: 0,
            endLine: 1,
            endCharacter: 14,
            newText: "file1 modified",
          },
          {
            file: file2,
            startLine: 1,
            startCharacter: 0,
            endLine: 1,
            endCharacter: 14,
            newText: "file2 modified",
          },
        ],
      };

      const result = await applier.applyWorkspaceEdit(edit);
      await applier.rollback(result);

      const content1 = await readTestFile("r1.ts");
      const content2 = await readTestFile("r2.ts");
      expect(content1).toBe("file1 original\n");
      expect(content2).toBe("file2 original\n");
    });
  });

  // --- Atomicity ---
  describe("atomicity", () => {
    it("should rollback all files if any file fails", async () => {
      const file1 = await createFile("atom1.ts", "good file\n");
      const nonExistent = join(testDir, "does-not-exist", "nested", "bad.ts");

      const edit: LspWorkspaceEdit = {
        changes: [
          {
            file: file1,
            startLine: 1,
            startCharacter: 0,
            endLine: 1,
            endCharacter: 9,
            newText: "modified",
          },
          {
            file: nonExistent,
            startLine: 1,
            startCharacter: 0,
            endLine: 1,
            endCharacter: 5,
            newText: "fail",
          },
        ],
      };

      const result = await applier.applyWorkspaceEdit(edit);

      expect(result.applied).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      // file1 should be untouched (rolled back)
      const content = await readTestFile("atom1.ts");
      expect(content).toBe("good file\n");
    });
  });

  // --- CRLF line endings ---
  describe("CRLF line endings", () => {
    it("should correctly apply edits to files with CRLF line endings", async () => {
      const filePath = await createFile("crlf.ts", "const aaa = 1;\r\nconst bbb = 2;\r\n");

      const edit: LspWorkspaceEdit = {
        changes: [
          {
            file: filePath,
            startLine: 1,
            startCharacter: 6,
            endLine: 1,
            endCharacter: 9,
            newText: "xxx",
          },
        ],
      };

      const result = await applier.applyWorkspaceEdit(edit);

      expect(result.applied).toBe(true);
      const content = await readTestFile("crlf.ts");
      expect(content).toBe("const xxx = 1;\r\nconst bbb = 2;\r\n");
    });

    it("should handle multi-line edits in CRLF files", async () => {
      const filePath = await createFile("crlf2.ts", "line1\r\nline2\r\nline3\r\n");

      const edit: LspWorkspaceEdit = {
        changes: [
          {
            file: filePath,
            startLine: 1,
            startCharacter: 0,
            endLine: 2,
            endCharacter: 5,
            newText: "replaced",
          },
        ],
      };

      const result = await applier.applyWorkspaceEdit(edit);

      expect(result.applied).toBe(true);
      const content = await readTestFile("crlf2.ts");
      expect(content).toBe("replaced\r\nline3\r\n");
    });
  });

  // --- Multi-line edits ---
  describe("multi-line edits", () => {
    it("should handle edits spanning multiple lines (startLine != endLine)", async () => {
      const filePath = await createFile(
        "multiline.ts",
        "function foo() {\n  const x = 1;\n  const y = 2;\n  return x + y;\n}\n",
      );

      // Replace lines 2-3 with a single line
      const edit: LspWorkspaceEdit = {
        changes: [
          {
            file: filePath,
            startLine: 2,
            startCharacter: 0,
            endLine: 3,
            endCharacter: 14,
            newText: "  const sum = 3;",
          },
        ],
      };

      const result = await applier.applyWorkspaceEdit(edit);

      expect(result.applied).toBe(true);
      const content = await readTestFile("multiline.ts");
      expect(content).toBe("function foo() {\n  const sum = 3;\n  return x + y;\n}\n");
    });

    it("should handle inserting multiple lines (expanding line count)", async () => {
      const filePath = await createFile("expand.ts", "a\nb\nc\n");

      const edit: LspWorkspaceEdit = {
        changes: [
          {
            file: filePath,
            startLine: 2,
            startCharacter: 0,
            endLine: 2,
            endCharacter: 1,
            newText: "x\ny\nz",
          },
        ],
      };

      const result = await applier.applyWorkspaceEdit(edit);

      expect(result.applied).toBe(true);
      const content = await readTestFile("expand.ts");
      expect(content).toBe("a\nx\ny\nz\nc\n");
    });

    it("should handle deleting multiple lines", async () => {
      const filePath = await createFile("shrink.ts", "line1\nline2\nline3\nline4\n");

      // Delete lines 2-3 entirely
      const edit: LspWorkspaceEdit = {
        changes: [
          {
            file: filePath,
            startLine: 2,
            startCharacter: 0,
            endLine: 4,
            endCharacter: 0,
            newText: "",
          },
        ],
      };

      const result = await applier.applyWorkspaceEdit(edit);

      expect(result.applied).toBe(true);
      const content = await readTestFile("shrink.ts");
      expect(content).toBe("line1\nline4\n");
    });
  });

  // --- Edge cases ---
  describe("edge cases", () => {
    it("should handle file with single line and no trailing newline", async () => {
      const filePath = await createFile("noeol.ts", "hello");

      const edit: LspWorkspaceEdit = {
        changes: [
          {
            file: filePath,
            startLine: 1,
            startCharacter: 0,
            endLine: 1,
            endCharacter: 5,
            newText: "world",
          },
        ],
      };

      const result = await applier.applyWorkspaceEdit(edit);

      expect(result.applied).toBe(true);
      const content = await readTestFile("noeol.ts");
      expect(content).toBe("world");
    });
  });

  // --- Range validation ---
  describe("range validation", () => {
    it("should reject edits with line beyond file bounds", async () => {
      const filePath = await createFile("short.ts", "line1\n");

      const edit: LspWorkspaceEdit = {
        changes: [
          {
            file: filePath,
            startLine: 99,
            startCharacter: 0,
            endLine: 99,
            endCharacter: 5,
            newText: "nope",
          },
        ],
      };

      const result = await applier.applyWorkspaceEdit(edit);

      expect(result.applied).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should reject edits with character beyond line length", async () => {
      const filePath = await createFile("chartest.ts", "short\n");

      const edit: LspWorkspaceEdit = {
        changes: [
          {
            file: filePath,
            startLine: 1,
            startCharacter: 0,
            endLine: 1,
            endCharacter: 999,
            newText: "nope",
          },
        ],
      };

      const result = await applier.applyWorkspaceEdit(edit);

      expect(result.applied).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should handle empty workspace edit gracefully", async () => {
      const edit: LspWorkspaceEdit = { changes: [] };

      const result = await applier.applyWorkspaceEdit(edit);

      expect(result.applied).toBe(true);
      expect(result.filesModified).toEqual([]);
      expect(result.totalEdits).toBe(0);
    });
  });
});
