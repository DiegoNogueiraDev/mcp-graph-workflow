/**
 * TDD Red — Tests for LSP types (Zod schemas).
 * Validates all LSP-related schemas: server config, locations, results, etc.
 */

import { describe, it, expect } from "vitest";
import {
  LspServerConfigSchema,
  LspConfigOverrideSchema,
  LspLocationSchema,
  LspHoverResultSchema,
  LspDiagnosticSchema,
  LspDiagnosticSeverity,
  LspCallHierarchyItemSchema,
  LspDocumentSymbolSchema,
  LspWorkspaceEditSchema,
  LspServerStateSchema,
  DetectedLanguageSchema,
} from "../../core/lsp/lsp-types.js";

describe("LspServerConfigSchema", () => {
  it("should validate a complete server config", () => {
    const config = {
      languageId: "typescript",
      extensions: ["ts", "tsx", "js", "jsx"],
      command: "typescript-language-server",
      args: ["--stdio"],
      configFiles: ["tsconfig.json", "jsconfig.json"],
    };

    const result = LspServerConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.languageId).toBe("typescript");
      expect(result.data.extensions).toHaveLength(4);
    }
  });

  it("should validate config with optional fields", () => {
    const config = {
      languageId: "python",
      extensions: ["py", "pyi"],
      command: "pylsp",
      args: [],
      configFiles: ["pyproject.toml"],
      probeCommand: "pylsp --version",
      initializationOptions: { diagnostics: { enable: true } },
      settings: { python: { analysis: { typeCheckingMode: "basic" } } },
    };

    const result = LspServerConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.probeCommand).toBe("pylsp --version");
      expect(result.data.initializationOptions).toBeDefined();
      expect(result.data.settings).toBeDefined();
    }
  });

  it("should reject config missing required fields", () => {
    const invalid = { languageId: "rust" }; // missing extensions, command, args, configFiles
    const result = LspServerConfigSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("should reject empty extensions array is allowed", () => {
    const config = {
      languageId: "custom",
      extensions: [],
      command: "custom-lsp",
      args: [],
      configFiles: [],
    };
    // Empty extensions is technically valid (user might only use configFiles)
    const result = LspServerConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });
});

describe("LspConfigOverrideSchema", () => {
  it("should validate a minimal override", () => {
    const override = {
      languageId: "typescript",
      command: "/usr/local/bin/custom-ts-server",
    };

    const result = LspConfigOverrideSchema.safeParse(override);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.args).toEqual([]); // default
    }
  });

  it("should validate override with all optional fields", () => {
    const override = {
      languageId: "python",
      command: "pylsp",
      args: ["--check-parent-process"],
      extensions: ["py"],
      initializationOptions: { rope: { enabled: false } },
      settings: {},
    };

    const result = LspConfigOverrideSchema.safeParse(override);
    expect(result.success).toBe(true);
  });
});

describe("LspLocationSchema", () => {
  it("should validate a location", () => {
    const loc = {
      file: "src/core/store/sqlite-store.ts",
      startLine: 42,
      startCharacter: 10,
      endLine: 42,
      endCharacter: 25,
    };

    const result = LspLocationSchema.safeParse(loc);
    expect(result.success).toBe(true);
  });

  it("should reject negative line numbers", () => {
    const loc = {
      file: "test.ts",
      startLine: -1,
      startCharacter: 0,
      endLine: 1,
      endCharacter: 0,
    };

    const result = LspLocationSchema.safeParse(loc);
    expect(result.success).toBe(false);
  });
});

describe("LspHoverResultSchema", () => {
  it("should validate hover result with signature only", () => {
    const hover = {
      signature: "function validateNode(node: GraphNode): boolean",
    };

    const result = LspHoverResultSchema.safeParse(hover);
    expect(result.success).toBe(true);
  });

  it("should validate hover result with all fields", () => {
    const hover = {
      signature: "def process_data(input: DataFrame) -> Result",
      documentation: "Processes input data and returns a Result object.",
      language: "python",
    };

    const result = LspHoverResultSchema.safeParse(hover);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.language).toBe("python");
    }
  });
});

describe("LspDiagnosticSchema", () => {
  it("should validate a diagnostic", () => {
    const diag = {
      file: "src/main.ts",
      startLine: 10,
      startCharacter: 5,
      endLine: 10,
      endCharacter: 15,
      severity: LspDiagnosticSeverity.Error,
      message: "Type 'string' is not assignable to type 'number'",
      code: "2322",
      source: "typescript",
    };

    const result = LspDiagnosticSchema.safeParse(diag);
    expect(result.success).toBe(true);
  });

  it("should validate diagnostic without optional fields", () => {
    const diag = {
      file: "src/main.py",
      startLine: 1,
      startCharacter: 0,
      endLine: 1,
      endCharacter: 10,
      severity: LspDiagnosticSeverity.Warning,
      message: "Unused import",
    };

    const result = LspDiagnosticSchema.safeParse(diag);
    expect(result.success).toBe(true);
  });
});

describe("LspCallHierarchyItemSchema", () => {
  it("should validate a call hierarchy item", () => {
    const item = {
      name: "validateNode",
      kind: "function",
      file: "src/core/graph/validator.ts",
      startLine: 42,
      endLine: 67,
    };

    const result = LspCallHierarchyItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });
});

describe("LspDocumentSymbolSchema", () => {
  it("should validate a document symbol with children", () => {
    const sym = {
      name: "SqliteStore",
      kind: "class",
      file: "src/core/store/sqlite-store.ts",
      startLine: 10,
      endLine: 200,
      children: [
        {
          name: "open",
          kind: "method",
          file: "src/core/store/sqlite-store.ts",
          startLine: 15,
          endLine: 30,
        },
      ],
    };

    const result = LspDocumentSymbolSchema.safeParse(sym);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.children).toHaveLength(1);
    }
  });

  it("should validate symbol without children", () => {
    const sym = {
      name: "MAX_RETRIES",
      kind: "variable",
      file: "src/constants.ts",
      startLine: 5,
      endLine: 5,
    };

    const result = LspDocumentSymbolSchema.safeParse(sym);
    expect(result.success).toBe(true);
  });
});

describe("LspWorkspaceEditSchema", () => {
  it("should validate a workspace edit with changes", () => {
    const edit = {
      changes: [
        {
          file: "src/core/validator.ts",
          startLine: 42,
          startCharacter: 9,
          endLine: 42,
          endCharacter: 21,
          newText: "checkNodeValidity",
        },
        {
          file: "src/mcp/tools/validate.ts",
          startLine: 15,
          startCharacter: 20,
          endLine: 15,
          endCharacter: 32,
          newText: "checkNodeValidity",
        },
      ],
    };

    const result = LspWorkspaceEditSchema.safeParse(edit);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.changes).toHaveLength(2);
    }
  });
});

describe("LspServerStateSchema", () => {
  it("should validate a ready server state", () => {
    const state = {
      languageId: "typescript",
      status: "ready",
      pid: 12345,
    };

    const result = LspServerStateSchema.safeParse(state);
    expect(result.success).toBe(true);
  });

  it("should validate an error server state", () => {
    const state = {
      languageId: "python",
      status: "error",
      error: "pylsp not found in PATH",
    };

    const result = LspServerStateSchema.safeParse(state);
    expect(result.success).toBe(true);
  });

  it("should validate all status values", () => {
    for (const status of ["stopped", "starting", "ready", "error"]) {
      const state = { languageId: "test", status };
      const result = LspServerStateSchema.safeParse(state);
      expect(result.success).toBe(true);
    }
  });
});

describe("DetectedLanguageSchema", () => {
  it("should validate a detected language from config file", () => {
    const detected = {
      languageId: "typescript",
      confidence: 0.9,
      detectedVia: "config_file",
      fileCount: 120,
      configFile: "tsconfig.json",
    };

    const result = DetectedLanguageSchema.safeParse(detected);
    expect(result.success).toBe(true);
  });

  it("should validate a detected language from extension", () => {
    const detected = {
      languageId: "python",
      confidence: 0.7,
      detectedVia: "file_extension",
      fileCount: 15,
    };

    const result = DetectedLanguageSchema.safeParse(detected);
    expect(result.success).toBe(true);
  });

  it("should reject confidence outside 0-1 range", () => {
    const detected = {
      languageId: "rust",
      confidence: 1.5,
      detectedVia: "config_file",
      fileCount: 10,
    };

    const result = DetectedLanguageSchema.safeParse(detected);
    expect(result.success).toBe(false);
  });
});
