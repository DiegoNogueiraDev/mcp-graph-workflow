import { describe, it, expect, beforeEach, vi } from "vitest";
import { LspBridge } from "../../core/lsp/lsp-bridge.js";
import { LspDiagnosticsCollector } from "../../core/lsp/lsp-diagnostics.js";
import type { LspDiagnostic, LspServerState } from "../../core/lsp/lsp-types.js";
import { LspDiagnosticSeverity } from "../../core/lsp/lsp-types.js";

// ---------------------------------------------------------------------------
// Minimal mocks
// ---------------------------------------------------------------------------

function createMockClient(responses: Record<string, unknown> = {}) {
  return {
    sendRequest: vi.fn(async (method: string) => {
      return responses[method] ?? null;
    }),
    sendNotification: vi.fn(),
  };
}

function createMockManager(client: ReturnType<typeof createMockClient> | null = null) {
  return {
    getClientForFile: vi.fn(async () => client),
    getStatus: vi.fn(() => {
      const map = new Map<string, LspServerState>();
      map.set("typescript", { languageId: "typescript", status: "ready" });
      return map;
    }),
  };
}

function createMockCache() {
  return {
    get: vi.fn((): unknown => null),
    set: vi.fn(),
  };
}

const BASE_PATH = "/workspace/project";

function _makeBridge(
  overrides: {
    manager?: ReturnType<typeof createMockManager>;
    cache?: ReturnType<typeof createMockCache> | null;
    diagnostics?: LspDiagnosticsCollector;
  } = {},
): {
  bridge: LspBridge;
  manager: ReturnType<typeof createMockManager>;
  cache: ReturnType<typeof createMockCache> | null;
  diagnostics: LspDiagnosticsCollector;
} {
  const manager = overrides.manager ?? createMockManager();
  const cache = overrides.cache === undefined ? createMockCache() : overrides.cache;
  const diagnostics = overrides.diagnostics ?? new LspDiagnosticsCollector();

  // We need to cast because the bridge accepts the full interfaces
  // but our mocks implement only the methods we test.
  const bridge = new LspBridge(
    manager as unknown as Parameters<typeof LspBridge.prototype.goToDefinition extends (...args: infer _A) => infer _R ? never : never> extends never ? Parameters<ConstructorParameters<typeof LspBridge>[0] extends infer M ? () => M : never> extends never ? unknown : unknown : unknown as never,
    cache as unknown as Parameters<ConstructorParameters<typeof LspBridge>[1] extends infer C ? () => C : never> extends never ? unknown : unknown as never,
    diagnostics,
    BASE_PATH,
  );

  return { bridge, manager, cache, diagnostics };
}

// We need a simpler cast approach — just construct directly
function createBridge(
  manager: ReturnType<typeof createMockManager>,
  cache: ReturnType<typeof createMockCache> | null,
  diagnostics: LspDiagnosticsCollector,
): LspBridge {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  return new LspBridge(
    manager as never,
    cache as never,
    diagnostics,
    BASE_PATH,
  );
}

// ---------------------------------------------------------------------------
// Mock fs.statSync so the bridge can get mtime without real files
// ---------------------------------------------------------------------------

vi.mock("node:fs", () => ({
  statSync: vi.fn(() => ({ mtimeMs: 1000 })),
  readFileSync: vi.fn(() => "// mock file content"),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LspBridge", () => {
  let manager: ReturnType<typeof createMockManager>;
  let cache: ReturnType<typeof createMockCache>;
  let diagnostics: LspDiagnosticsCollector;
  let bridge: LspBridge;

  beforeEach(() => {
    vi.clearAllMocks();
    diagnostics = new LspDiagnosticsCollector();
  });

  // ---- 1. goToDefinition routes to correct server ----
  it("should route goToDefinition to the correct server via manager", async () => {
    const rawResponse = [
      {
        uri: `file://${BASE_PATH}/src/utils.ts`,
        range: { start: { line: 9, character: 0 }, end: { line: 9, character: 10 } },
      },
    ];
    const client = createMockClient({ "textDocument/definition": rawResponse });
    manager = createMockManager(client);
    cache = createMockCache();
    bridge = createBridge(manager, cache, diagnostics);

    const result = await bridge.goToDefinition("src/main.ts", 5, 10);

    expect(manager.getClientForFile).toHaveBeenCalled();
    expect(client.sendRequest).toHaveBeenCalledWith("textDocument/definition", expect.objectContaining({
      textDocument: { uri: `file://${BASE_PATH}/src/main.ts` },
      position: { line: 4, character: 10 },
    }));
    expect(result).toHaveLength(1);
    expect(result[0].file).toBe("src/utils.ts");
    expect(result[0].startLine).toBe(10); // 0-based 9 → 1-based 10
  });

  // ---- 2. goToDefinition returns [] when no server available ----
  it("should return empty array when no server is available for goToDefinition", async () => {
    manager = createMockManager(null);
    cache = createMockCache();
    bridge = createBridge(manager, cache, diagnostics);

    const result = await bridge.goToDefinition("src/unknown.xyz", 1, 0);

    expect(result).toEqual([]);
  });

  // ---- 3. cache hit skips LSP round-trip ----
  it("should return cached result without calling sendRequest", async () => {
    // Cache stores raw LSP format (same as what the server returns)
    const cachedRaw = [
      {
        uri: `file://${BASE_PATH}/src/cached.ts`,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
      },
    ];
    const client = createMockClient();
    manager = createMockManager(client);
    cache = createMockCache();
    cache.get.mockReturnValue(cachedRaw);
    bridge = createBridge(manager, cache, diagnostics);

    const result = await bridge.goToDefinition("src/main.ts", 5, 10);

    expect(cache.get).toHaveBeenCalled();
    expect(client.sendRequest).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].file).toBe("src/cached.ts");
  });

  // ---- 4. cache miss triggers LSP request and caches result ----
  it("should call LSP and cache result on cache miss", async () => {
    const rawResponse = [
      {
        uri: `file://${BASE_PATH}/src/target.ts`,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
      },
    ];
    const client = createMockClient({ "textDocument/definition": rawResponse });
    manager = createMockManager(client);
    cache = createMockCache();
    cache.get.mockReturnValue(null);
    bridge = createBridge(manager, cache, diagnostics);

    await bridge.goToDefinition("src/main.ts", 5, 10);

    expect(cache.get).toHaveBeenCalled();
    expect(client.sendRequest).toHaveBeenCalled();
    expect(cache.set).toHaveBeenCalled();
  });

  // ---- 5. findReferences normalizes URIs to relative paths ----
  it("should normalize file URIs to relative paths in findReferences", async () => {
    const rawResponse = [
      {
        uri: `file://${BASE_PATH}/src/a.ts`,
        range: { start: { line: 4, character: 2 }, end: { line: 4, character: 8 } },
      },
      {
        uri: `file://${BASE_PATH}/src/b.ts`,
        range: { start: { line: 10, character: 0 }, end: { line: 10, character: 6 } },
      },
    ];
    const client = createMockClient({ "textDocument/references": rawResponse });
    manager = createMockManager(client);
    cache = createMockCache();
    bridge = createBridge(manager, cache, diagnostics);

    const result = await bridge.findReferences("src/main.ts", 5, 10);

    expect(result).toHaveLength(2);
    expect(result[0].file).toBe("src/a.ts");
    expect(result[1].file).toBe("src/b.ts");
    // Line numbers should be 1-based
    expect(result[0].startLine).toBe(5);
    expect(result[1].startLine).toBe(11);
  });

  // ---- 6. hover returns null when server unavailable ----
  it("should return null for hover when no server is available", async () => {
    manager = createMockManager(null);
    cache = createMockCache();
    bridge = createBridge(manager, cache, diagnostics);

    const result = await bridge.hover("src/unknown.xyz", 1, 0);

    expect(result).toBeNull();
  });

  // ---- 7. rename is not cached ----
  it("should not use cache for rename operations", async () => {
    const rawEdit = {
      changes: {
        [`file://${BASE_PATH}/src/a.ts`]: [
          {
            range: { start: { line: 0, character: 5 }, end: { line: 0, character: 10 } },
            newText: "newName",
          },
        ],
      },
    };
    const client = createMockClient({ "textDocument/rename": rawEdit });
    manager = createMockManager(client);
    cache = createMockCache();
    bridge = createBridge(manager, cache, diagnostics);

    const result = await bridge.rename("src/a.ts", 1, 5, "newName");

    expect(cache.get).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
    expect(result).not.toBeNull();
    expect(result!.changes).toHaveLength(1);
    expect(result!.changes[0].file).toBe("src/a.ts");
    expect(result!.changes[0].newText).toBe("newName");
  });

  // ---- 8. getDiagnostics returns from collector ----
  it("should return diagnostics from the collector, not via LSP request", async () => {
    const diag: LspDiagnostic = {
      file: "src/a.ts",
      startLine: 1,
      startCharacter: 0,
      endLine: 1,
      endCharacter: 5,
      severity: LspDiagnosticSeverity.Error,
      message: "type error",
    };
    diagnostics.onDiagnostics("typescript", "src/a.ts", [diag]);

    const client = createMockClient();
    manager = createMockManager(client);
    cache = createMockCache();
    bridge = createBridge(manager, cache, diagnostics);

    const result = await bridge.getDiagnostics("src/a.ts");

    expect(result).toEqual([diag]);
    // No LSP request should have been made
    expect(client.sendRequest).not.toHaveBeenCalled();
  });

  // ---- 9. getLanguageStatus delegates to manager ----
  it("should delegate getLanguageStatus to the server manager", async () => {
    manager = createMockManager();
    cache = createMockCache();
    bridge = createBridge(manager, cache, diagnostics);

    const status = await bridge.getLanguageStatus();

    expect(manager.getStatus).toHaveBeenCalled();
    expect(status.get("typescript")).toEqual({ languageId: "typescript", status: "ready" });
  });

  // ---- 10. bridge works with null cache (no caching) ----
  it("should work correctly when cache is null", async () => {
    const rawResponse = [
      {
        uri: `file://${BASE_PATH}/src/target.ts`,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
      },
    ];
    const client = createMockClient({ "textDocument/definition": rawResponse });
    manager = createMockManager(client);
    bridge = createBridge(manager, null, diagnostics);

    const result = await bridge.goToDefinition("src/main.ts", 5, 10);

    expect(result).toHaveLength(1);
    expect(result[0].file).toBe("src/target.ts");
  });

  // ---- 11. hover parses MarkupContent ----
  it("should parse MarkupContent hover result", async () => {
    const rawHover = {
      contents: { kind: "markdown", value: "```ts\nfunction foo(): void\n```" },
    };
    const client = createMockClient({ "textDocument/hover": rawHover });
    manager = createMockManager(client);
    cache = createMockCache();
    bridge = createBridge(manager, cache, diagnostics);

    const result = await bridge.hover("src/main.ts", 5, 10);

    expect(result).not.toBeNull();
    expect(result!.signature).toBe("```ts\nfunction foo(): void\n```");
    expect(result!.language).toBe("markdown");
  });

  // ---- 12. rename returns null when no server available ----
  it("should return null for rename when no server is available", async () => {
    manager = createMockManager(null);
    cache = createMockCache();
    bridge = createBridge(manager, cache, diagnostics);

    const result = await bridge.rename("src/a.ts", 1, 5, "newName");

    expect(result).toBeNull();
  });

  // ---- 13. callHierarchyIncoming sends didOpen before request ----
  it("should send didOpen before callHierarchyIncoming request", async () => {
    const prepareResult = [{ name: "myFunc", kind: 12, uri: `file://${BASE_PATH}/src/a.ts`, range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } }, selectionRange: { start: { line: 0, character: 0 }, end: { line: 0, character: 6 } } }];
    const incomingResult = [{ from: { name: "caller", kind: 12, uri: `file://${BASE_PATH}/src/b.ts`, range: { start: { line: 5, character: 0 }, end: { line: 5, character: 10 } }, selectionRange: { start: { line: 5, character: 0 }, end: { line: 5, character: 6 } } }, fromRanges: [] }];

    const client = createMockClient({
      "textDocument/prepareCallHierarchy": prepareResult,
      "callHierarchy/incomingCalls": incomingResult,
    });
    manager = createMockManager(client);
    cache = createMockCache();
    bridge = createBridge(manager, cache, diagnostics);

    await bridge.callHierarchyIncoming("src/a.ts", 1, 0);

    // Verify didOpen was sent before the LSP request
    expect(client.sendNotification).toHaveBeenCalledWith(
      "textDocument/didOpen",
      expect.objectContaining({
        textDocument: expect.objectContaining({
          uri: `file://${BASE_PATH}/src/a.ts`,
        }),
      }),
    );

    // Verify the order: didOpen notification comes before prepareCallHierarchy request
    const notifCalls = client.sendNotification.mock.invocationCallOrder;
    const reqCalls = client.sendRequest.mock.invocationCallOrder;
    expect(notifCalls[0]).toBeLessThan(reqCalls[0]);
  });

  // ---- 14. callHierarchyOutgoing sends didOpen before request ----
  it("should send didOpen before callHierarchyOutgoing request", async () => {
    const prepareResult = [{ name: "myFunc", kind: 12, uri: `file://${BASE_PATH}/src/a.ts`, range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } }, selectionRange: { start: { line: 0, character: 0 }, end: { line: 0, character: 6 } } }];
    const outgoingResult = [{ to: { name: "callee", kind: 12, uri: `file://${BASE_PATH}/src/c.ts`, range: { start: { line: 10, character: 0 }, end: { line: 10, character: 10 } }, selectionRange: { start: { line: 10, character: 0 }, end: { line: 10, character: 6 } } }, fromRanges: [] }];

    const client = createMockClient({
      "textDocument/prepareCallHierarchy": prepareResult,
      "callHierarchy/outgoingCalls": outgoingResult,
    });
    manager = createMockManager(client);
    cache = createMockCache();
    bridge = createBridge(manager, cache, diagnostics);

    await bridge.callHierarchyOutgoing("src/a.ts", 1, 0);

    // Verify didOpen was sent
    expect(client.sendNotification).toHaveBeenCalledWith(
      "textDocument/didOpen",
      expect.objectContaining({
        textDocument: expect.objectContaining({
          uri: `file://${BASE_PATH}/src/a.ts`,
        }),
      }),
    );

    // Verify order: didOpen before prepareCallHierarchy
    const notifCalls = client.sendNotification.mock.invocationCallOrder;
    const reqCalls = client.sendRequest.mock.invocationCallOrder;
    expect(notifCalls[0]).toBeLessThan(reqCalls[0]);
  });

  // ---- 15. ensureDocumentOpen is idempotent ----
  it("should only send didOpen once for the same file", async () => {
    const rawResponse = [{ uri: `file://${BASE_PATH}/src/utils.ts`, range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } } }];
    const client = createMockClient({ "textDocument/definition": rawResponse });
    manager = createMockManager(client);
    cache = createMockCache();
    bridge = createBridge(manager, cache, diagnostics);

    // Call twice on same file
    await bridge.goToDefinition("src/main.ts", 1, 0);
    await bridge.goToDefinition("src/main.ts", 2, 0);

    // didOpen should be sent only once
    const didOpenCalls = client.sendNotification.mock.calls.filter(
      (call) => call[0] === "textDocument/didOpen",
    );
    expect(didOpenCalls).toHaveLength(1);
  });
});
