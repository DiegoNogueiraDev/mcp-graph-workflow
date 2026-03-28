/**
 * TDD Red — Tests for LspBridge edit methods:
 * formatDocument, formatRange, getCodeActions, notifyDocumentChanged.
 */

import { describe, it, expect, vi } from "vitest";
import { LspBridge } from "../../core/lsp/lsp-bridge.js";
import { LspDiagnosticsCollector } from "../../core/lsp/lsp-diagnostics.js";

// ---------------------------------------------------------------------------
// Minimal mocks (same pattern as lsp-bridge.test.ts)
// ---------------------------------------------------------------------------

function createMockClient(responses: Record<string, unknown> = {}) {
  return {
    sendRequest: vi.fn(async (method: string) => responses[method] ?? null),
    sendNotification: vi.fn(),
  };
}

function createMockManager(client: ReturnType<typeof createMockClient> | null = null) {
  return {
    getClientForFile: vi.fn(async () => client),
    getStatus: vi.fn(() => new Map()),
  };
}

function createMockCache() {
  return {
    get: vi.fn((): unknown => null),
    set: vi.fn(),
  };
}

const BASE_PATH = "/workspace/project";

function createBridge(
  manager: ReturnType<typeof createMockManager>,
  cache: ReturnType<typeof createMockCache> | null = null,
): LspBridge {
  return new LspBridge(
    manager as never,
    cache as never,
    new LspDiagnosticsCollector(),
    BASE_PATH,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LspBridge — formatDocument", () => {
  it("should return normalized LspTextEdit[] from formatting response", async () => {
    const rawEdits = [
      {
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 5 },
        },
        newText: "const",
      },
    ];

    const client = createMockClient({
      "textDocument/formatting": rawEdits,
    });
    const manager = createMockManager(client);
    const bridge = createBridge(manager);

    const result = await bridge.formatDocument("src/test.ts");

    expect(result).toHaveLength(1);
    expect(result[0].file).toBe("src/test.ts");
    expect(result[0].startLine).toBe(1); // 0-based → 1-based
    expect(result[0].startCharacter).toBe(0);
    expect(result[0].newText).toBe("const");
  });

  it("should return empty array when no server available", async () => {
    const manager = createMockManager(null);
    const bridge = createBridge(manager);

    const result = await bridge.formatDocument("src/test.ts");
    expect(result).toEqual([]);
  });

  it("should return empty array when server returns null", async () => {
    const client = createMockClient({});
    const manager = createMockManager(client);
    const bridge = createBridge(manager);

    const result = await bridge.formatDocument("src/test.ts");
    expect(result).toEqual([]);
  });
});

describe("LspBridge — formatRange", () => {
  it("should send range formatting request with correct parameters", async () => {
    const rawEdits = [
      {
        range: {
          start: { line: 4, character: 0 },
          end: { line: 4, character: 10 },
        },
        newText: "  formatted",
      },
    ];

    const client = createMockClient({
      "textDocument/rangeFormatting": rawEdits,
    });
    const manager = createMockManager(client);
    const bridge = createBridge(manager);

    const result = await bridge.formatRange("src/test.ts", 5, 0, 5, 10);

    expect(result).toHaveLength(1);
    expect(result[0].startLine).toBe(5); // normalized
    expect(result[0].newText).toBe("  formatted");

    // Verify the request was sent with 0-based positions
    expect(client.sendRequest).toHaveBeenCalledWith(
      "textDocument/rangeFormatting",
      expect.objectContaining({
        range: {
          start: { line: 4, character: 0 },
          end: { line: 4, character: 10 },
        },
      }),
    );
  });

  it("should return empty array when no server available", async () => {
    const manager = createMockManager(null);
    const bridge = createBridge(manager);

    const result = await bridge.formatRange("src/test.ts", 1, 0, 5, 0);
    expect(result).toEqual([]);
  });
});

describe("LspBridge — getCodeActions", () => {
  it("should return normalized code actions", async () => {
    const rawActions = [
      {
        title: "Add missing import",
        kind: "quickfix",
        isPreferred: true,
        edit: {
          changes: {
            ["file:///workspace/project/src/test.ts"]: [
              {
                range: {
                  start: { line: 0, character: 0 },
                  end: { line: 0, character: 0 },
                },
                newText: "import { foo } from './foo.js';\n",
              },
            ],
          },
        },
      },
    ];

    const client = createMockClient({
      "textDocument/codeAction": rawActions,
    });
    const manager = createMockManager(client);
    const bridge = createBridge(manager);

    const result = await bridge.getCodeActions("src/test.ts", 1, 0, 1, 10);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Add missing import");
    expect(result[0].kind).toBe("quickfix");
    expect(result[0].isPreferred).toBe(true);
    expect(result[0].edit).toBeDefined();
    expect(result[0].edit!.changes).toHaveLength(1);
    expect(result[0].edit!.changes[0].file).toBe("src/test.ts");
    expect(result[0].edit!.changes[0].startLine).toBe(1);
  });

  it("should filter by kinds when provided", async () => {
    const rawActions = [
      { title: "Quick fix", kind: "quickfix" },
      { title: "Refactor", kind: "refactor.extract" },
      { title: "Organize imports", kind: "source.organizeImports" },
    ];

    const client = createMockClient({
      "textDocument/codeAction": rawActions,
    });
    const manager = createMockManager(client);
    const bridge = createBridge(manager);

    const result = await bridge.getCodeActions("src/test.ts", 1, 0, 1, 10, ["source.organizeImports"]);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Organize imports");
  });

  it("should return empty array when no server available", async () => {
    const manager = createMockManager(null);
    const bridge = createBridge(manager);

    const result = await bridge.getCodeActions("src/test.ts", 1, 0, 1, 10);
    expect(result).toEqual([]);
  });
});

describe("LspBridge — notifyDocumentChanged", () => {
  it("should attempt ensureDocumentOpen before sending didChange", async () => {
    const client = createMockClient({});
    const manager = createMockManager(client);
    const bridge = createBridge(manager);

    // notifyDocumentChanged should call ensureDocumentOpen (which may fail
    // for non-existent files in tests), then still send didChange
    await bridge.notifyDocumentChanged("src/test.ts", "const x = 1;\n");

    const notifyCalls = client.sendNotification.mock.calls;
    const didChangeCall = notifyCalls.find((c: unknown[]) => c[0] === "textDocument/didChange");

    // didChange must be sent regardless of didOpen success
    expect(didChangeCall).toBeDefined();
    expect(
      (didChangeCall![1] as { textDocument: { version: number } }).textDocument.version,
    ).toBe(2);
  });

  it("should increment version on each call", async () => {
    const client = createMockClient({});
    const manager = createMockManager(client);
    const bridge = createBridge(manager);

    await bridge.notifyDocumentChanged("src/test.ts", "v1");
    await bridge.notifyDocumentChanged("src/test.ts", "v2");

    const calls = client.sendNotification.mock.calls.filter(
      (c: unknown[]) => c[0] === "textDocument/didChange",
    );
    expect(calls).toHaveLength(2);

    // Version should increment: 2, 3
    const version1 = (calls[0][1] as { textDocument: { version: number } }).textDocument.version;
    const version2 = (calls[1][1] as { textDocument: { version: number } }).textDocument.version;
    expect(version2).toBe(version1 + 1);
  });

  it("should do nothing when no server available", async () => {
    const manager = createMockManager(null);
    const bridge = createBridge(manager);

    // Should not throw
    await bridge.notifyDocumentChanged("src/test.ts", "content");
  });

  it("should pass formatting options when custom options provided", async () => {
    const rawEdits = [
      {
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 5 },
        },
        newText: "const",
      },
    ];

    const client = createMockClient({
      "textDocument/formatting": rawEdits,
    });
    const manager = createMockManager(client);
    const bridge = createBridge(manager);

    await bridge.formatDocument("src/test.ts", { tabSize: 4, insertSpaces: false });

    expect(client.sendRequest).toHaveBeenCalledWith(
      "textDocument/formatting",
      expect.objectContaining({
        options: { tabSize: 4, insertSpaces: false },
      }),
    );
  });
});
