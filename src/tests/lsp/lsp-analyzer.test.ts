import { describe, it, expect } from "vitest";
import { LspAnalyzer } from "../../core/lsp/lsp-analyzer.js";
import type { LspClient } from "../../core/lsp/lsp-client.js";

/**
 * Minimal mock of LspClient — only needs to satisfy the type constraint.
 * LspAnalyzer stub does not call any LspClient methods yet.
 */
function createMockLspClient(): LspClient {
  return {} as LspClient;
}

describe("LspAnalyzer", () => {
  it("should expose the correct languages and extensions", () => {
    // Arrange
    const client = createMockLspClient();
    const analyzer = new LspAnalyzer(client, ["python"], [".py", ".pyi"]);

    // Assert
    expect(analyzer.languages).toEqual(["python"]);
    expect(analyzer.extensions).toEqual([".py", ".pyi"]);
  });

  it("should implement CodeAnalyzer interface", () => {
    // Arrange
    const client = createMockLspClient();
    const analyzer = new LspAnalyzer(client, ["rust"], [".rs"]);

    // Assert — structural check
    expect(typeof analyzer.analyzeFile).toBe("function");
    expect(Array.isArray(analyzer.languages)).toBe(true);
    expect(Array.isArray(analyzer.extensions)).toBe(true);
  });

  it("should return AnalyzedFile with correct relative file path", async () => {
    // Arrange
    const client = createMockLspClient();
    const analyzer = new LspAnalyzer(client, ["go"], [".go"]);
    const basePath = "/home/user/project";
    const filePath = "/home/user/project/cmd/main.go";

    // Act
    const result = await analyzer.analyzeFile(filePath, basePath);

    // Assert
    expect(result.file).toBe("cmd/main.go");
  });

  it("should return empty symbols and relations (stub behavior)", async () => {
    // Arrange
    const client = createMockLspClient();
    const analyzer = new LspAnalyzer(client, ["python"], [".py"]);

    // Act
    const result = await analyzer.analyzeFile("/proj/src/app.py", "/proj");

    // Assert
    expect(result.symbols).toEqual([]);
    expect(result.relations).toEqual([]);
  });
});
