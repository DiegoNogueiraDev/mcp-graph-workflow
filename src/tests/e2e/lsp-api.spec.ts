import { test, expect } from "@playwright/test";

test.describe("Code Graph API — Endpoints", () => {
  // ── Core Code Graph API ─────────────────────────────

  test.describe("Code Graph Core", () => {
    test("GET /api/v1/code-graph/status returns valid shape", async ({ request }) => {
      const res = await request.get("/api/v1/code-graph/status");
      expect(res.ok()).toBeTruthy();

      const body = await res.json();
      expect(body).toHaveProperty("indexed");
      expect(body).toHaveProperty("basePath");
      expect(body).toHaveProperty("symbolCount");
      expect(body).toHaveProperty("relationCount");
      expect(body).toHaveProperty("fileCount");
      expect(body).toHaveProperty("typescriptAvailable");
      expect(typeof body.indexed).toBe("boolean");
      expect(typeof body.symbolCount).toBe("number");
      expect(typeof body.relationCount).toBe("number");
      expect(typeof body.fileCount).toBe("number");
    });

    test("POST /api/v1/code-graph/reindex returns success", async ({ request }) => {
      const res = await request.post("/api/v1/code-graph/reindex");
      expect(res.ok()).toBeTruthy();

      const body = await res.json();
      expect(body).toHaveProperty("success", true);
    });

    test("POST /api/v1/code-graph/search with query returns results array", async ({ request }) => {
      const res = await request.post("/api/v1/code-graph/search", {
        data: { query: "test" },
      });
      expect(res.ok()).toBeTruthy();

      const body = await res.json();
      expect(body).toHaveProperty("results");
      expect(Array.isArray(body.results)).toBe(true);
    });

    test("POST /api/v1/code-graph/search with empty body returns 400", async ({ request }) => {
      const res = await request.post("/api/v1/code-graph/search", {
        data: {},
      });
      expect(res.status()).toBe(400);
    });

    test("POST /api/v1/code-graph/context with symbol returns data", async ({ request }) => {
      const res = await request.post("/api/v1/code-graph/context", {
        data: { symbol: "NonExistent" },
      });
      expect(res.ok()).toBeTruthy();

      const body = await res.json();
      expect(typeof body).toBe("object");
    });

    test("POST /api/v1/code-graph/context with empty body returns 400", async ({ request }) => {
      const res = await request.post("/api/v1/code-graph/context", {
        data: {},
      });
      expect(res.status()).toBe(400);
    });

    test("POST /api/v1/code-graph/impact with symbol returns data", async ({ request }) => {
      const res = await request.post("/api/v1/code-graph/impact", {
        data: { symbol: "NonExistent" },
      });
      expect(res.ok()).toBeTruthy();

      const body = await res.json();
      expect(typeof body).toBe("object");
    });

    test("POST /api/v1/code-graph/impact with empty body returns 400", async ({ request }) => {
      const res = await request.post("/api/v1/code-graph/impact", {
        data: {},
      });
      expect(res.status()).toBe(400);
    });

    test("GET /api/v1/code-graph/full returns graph data", async ({ request }) => {
      const res = await request.get("/api/v1/code-graph/full");
      expect(res.ok()).toBeTruthy();

      const body = await res.json();
      expect(typeof body).toBe("object");
    });
  });

  // ── LSP Detection API ───────────────────────────────

  test.describe("LSP Detection", () => {
    test("GET /api/v1/code-graph/lsp/languages returns detected and supportedLanguages", async ({ request }) => {
      const res = await request.get("/api/v1/code-graph/lsp/languages");
      expect(res.ok()).toBeTruthy();

      const body = await res.json();
      expect(body).toHaveProperty("ok", true);
      expect(body).toHaveProperty("detected");
      expect(body).toHaveProperty("supportedLanguages");
      expect(Array.isArray(body.detected)).toBe(true);
      expect(Array.isArray(body.supportedLanguages)).toBe(true);
      expect(body.supportedLanguages.length).toBeGreaterThan(0);
    });

    test("GET /api/v1/code-graph/lsp/status returns bridge status", async ({ request }) => {
      const res = await request.get("/api/v1/code-graph/lsp/status");
      expect(res.ok()).toBeTruthy();

      const body = await res.json();
      expect(body).toHaveProperty("ok", true);
      expect(body).toHaveProperty("bridgeInitialized");
      expect(body).toHaveProperty("servers");
      expect(typeof body.bridgeInitialized).toBe("boolean");
      expect(typeof body.servers).toBe("object");
    });
  });

  // ── LSP Operations API ──────────────────────────────

  test.describe("LSP Operations", () => {
    test("POST /api/v1/code-graph/lsp/definition responds gracefully", async ({ request }) => {
      const res = await request.post("/api/v1/code-graph/lsp/definition", {
        data: { file: "nonexistent.ts", line: 1, character: 0 },
      });
      // Accept success or structured error (no LSP server installed)
      expect(res.status()).toBeLessThan(502);
      if (res.ok()) {
        const body = await res.json();
        expect(body).toHaveProperty("ok", true);
        expect(body).toHaveProperty("definitions");
      }
    });

    test("POST /api/v1/code-graph/lsp/definition with invalid body returns error", async ({ request }) => {
      const res = await request.post("/api/v1/code-graph/lsp/definition", {
        data: {},
      });
      expect(res.status()).toBeGreaterThanOrEqual(400);
    });

    test("POST /api/v1/code-graph/lsp/references responds gracefully", async ({ request }) => {
      const res = await request.post("/api/v1/code-graph/lsp/references", {
        data: { file: "nonexistent.ts", line: 1, character: 0 },
      });
      expect(res.status()).toBeLessThan(502);
      if (res.ok()) {
        const body = await res.json();
        expect(body).toHaveProperty("ok", true);
        expect(body).toHaveProperty("references");
      }
    });

    test("POST /api/v1/code-graph/lsp/hover responds gracefully", async ({ request }) => {
      const res = await request.post("/api/v1/code-graph/lsp/hover", {
        data: { file: "nonexistent.ts", line: 1, character: 0 },
      });
      expect(res.status()).toBeLessThan(502);
      if (res.ok()) {
        const body = await res.json();
        expect(body).toHaveProperty("ok", true);
        expect(body).toHaveProperty("hover");
      }
    });

    test("GET /api/v1/code-graph/lsp/diagnostics with file responds gracefully", async ({ request }) => {
      const res = await request.get("/api/v1/code-graph/lsp/diagnostics?file=nonexistent.ts");
      expect(res.status()).toBeLessThan(502);
      if (res.ok()) {
        const body = await res.json();
        expect(body).toHaveProperty("ok", true);
        expect(body).toHaveProperty("diagnostics");
      }
    });

    test("GET /api/v1/code-graph/lsp/diagnostics without file returns error", async ({ request }) => {
      const res = await request.get("/api/v1/code-graph/lsp/diagnostics");
      expect(res.status()).toBeGreaterThanOrEqual(400);
    });

    test("GET /api/v1/code-graph/lsp/symbols with file responds gracefully", async ({ request }) => {
      const res = await request.get("/api/v1/code-graph/lsp/symbols?file=nonexistent.ts");
      expect(res.status()).toBeLessThan(502);
      if (res.ok()) {
        const body = await res.json();
        expect(body).toHaveProperty("ok", true);
        expect(body).toHaveProperty("symbols");
      }
    });

    test("GET /api/v1/code-graph/lsp/symbols without file returns error", async ({ request }) => {
      const res = await request.get("/api/v1/code-graph/lsp/symbols");
      expect(res.status()).toBeGreaterThanOrEqual(400);
    });
  });
});
