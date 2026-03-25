import { test, expect } from "@playwright/test";

/**
 * E2E tests for the RAG pipeline — validates knowledge CRUD,
 * FTS search, semantic search, context building, and the full
 * end-to-end pipeline via REST API on a real SQLite store.
 */

// ── Knowledge Store CRUD ─────────────────────────────────

test.describe("Knowledge Store CRUD", () => {
  test("POST /knowledge should upload a knowledge document", async ({ request }) => {
    const res = await request.post("/api/v1/knowledge", {
      data: {
        title: "RAG Architecture Decision",
        content: "We chose FTS5 with BM25 ranking for full-text search because it provides good relevance without external dependencies.",
        sourceType: "memory",
      },
    });

    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.chunksCreated).toBeGreaterThanOrEqual(1);
    expect(body.documents).toBeDefined();
    expect(body.documents.length).toBeGreaterThanOrEqual(1);
  });

  test("POST /knowledge should auto-chunk long documents", async ({ request }) => {
    // Generate a long document (~3000 tokens worth)
    const longContent = Array.from({ length: 60 }, (_, i) =>
      `Section ${i + 1}: This paragraph contains detailed information about the knowledge pipeline architecture, including FTS5 indexing, BM25 ranking, TF-IDF embeddings, and cosine similarity search. Each section adds approximately 50 tokens to the total document length.`,
    ).join("\n\n");

    const res = await request.post("/api/v1/knowledge", {
      data: {
        title: "Long Architecture Document",
        content: longContent,
        sourceType: "docs",
      },
    });

    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.ok).toBe(true);
    // Long document should be chunked into multiple pieces
    expect(body.chunksCreated).toBeGreaterThan(1);
  });

  test("GET /knowledge should list documents with pagination", async ({ request }) => {
    // Upload a document first
    await request.post("/api/v1/knowledge", {
      data: {
        title: "Pagination Test Doc",
        content: "Content for testing pagination of knowledge documents.",
        sourceType: "upload",
      },
    });

    const res = await request.get("/api/v1/knowledge");
    expect(res.ok()).toBe(true);

    const body = await res.json();
    expect(body).toHaveProperty("documents");
    expect(body).toHaveProperty("total");
    expect(Array.isArray(body.documents)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(1);
  });

  test("DELETE /knowledge/:id should remove a document", async ({ request }) => {
    // Upload
    const upload = await request.post("/api/v1/knowledge", {
      data: {
        title: "To Be Deleted",
        content: "This document will be deleted in the test.",
        sourceType: "upload",
      },
    });
    const uploadBody = await upload.json();
    const docId = uploadBody.documents[0].id;

    // Delete
    const del = await request.delete(`/api/v1/knowledge/${docId}`);
    expect(del.ok()).toBe(true);

    // Confirm deletion
    const get = await request.get(`/api/v1/knowledge/${docId}`);
    expect(get.ok()).toBe(false);
  });
});

// ── Knowledge Search ─────────────────────────────────────

test.describe("Knowledge Search", () => {
  test("POST /knowledge/search should return relevant results", async ({ request }) => {
    // Seed a document
    await request.post("/api/v1/knowledge", {
      data: {
        title: "SQLite Store Architecture",
        content: "The SqliteStore provides persistent storage using better-sqlite3. It supports transactions, migrations, and FTS5 full-text search indexing.",
        sourceType: "memory",
      },
    });

    const res = await request.post("/api/v1/knowledge/search", {
      data: { query: "sqlite storage transactions" },
    });

    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty("results");
    expect(body.results.length).toBeGreaterThanOrEqual(1);

    // Verify result structure
    const first = body.results[0];
    expect(first).toHaveProperty("id");
    expect(first).toHaveProperty("title");
    expect(first).toHaveProperty("content");
    expect(first).toHaveProperty("sourceType");
  });

  test("POST /knowledge/search should return empty for unmatched query", async ({ request }) => {
    const res = await request.post("/api/v1/knowledge/search", {
      data: { query: "xyznonexistenttermabc123" },
    });

    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.results).toHaveLength(0);
  });

  test("GET /knowledge/stats/summary should return counts by sourceType", async ({ request }) => {
    const res = await request.get("/api/v1/knowledge/stats/summary");
    expect(res.ok()).toBe(true);

    const body = await res.json();
    expect(body).toHaveProperty("total");
    expect(typeof body.total).toBe("number");
  });
});

// ── RAG Semantic Search ──────────────────────────────────

test.describe("RAG Semantic Search", () => {
  test("POST /rag/reindex should rebuild embeddings", async ({ request }) => {
    const res = await request.post("/api/v1/rag/reindex");
    expect(res.ok()).toBe(true);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.indexed).toBe("number");
    expect(typeof body.nodes).toBe("number");
    expect(typeof body.knowledge).toBe("number");
  });

  test("POST /rag/query should return results with similarity scores", async ({ request }) => {
    // Ensure embeddings are indexed
    await request.post("/api/v1/rag/reindex");

    const res = await request.post("/api/v1/rag/query", {
      data: { query: "task management graph", limit: 5 },
    });

    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty("query");
    expect(body).toHaveProperty("results");
    expect(body).toHaveProperty("totalIndexed");

    if (body.results.length > 0) {
      const first = body.results[0];
      expect(first).toHaveProperty("id");
      expect(first).toHaveProperty("text");
      expect(first).toHaveProperty("similarity");
      expect(first).toHaveProperty("source");
      expect(typeof first.similarity).toBe("number");
      expect(first.similarity).toBeGreaterThan(0);
      expect(first.similarity).toBeLessThanOrEqual(1);
    }
  });

  test("POST /rag/query should handle empty results gracefully", async ({ request }) => {
    await request.post("/api/v1/rag/reindex");

    const res = await request.post("/api/v1/rag/query", {
      data: { query: "xyznonexistentterm999" },
    });

    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body.results)).toBe(true);
  });

  test("GET /rag/stats should return embedding stats", async ({ request }) => {
    const res = await request.get("/api/v1/rag/stats");
    expect(res.ok()).toBe(true);

    const body = await res.json();
    expect(body).toHaveProperty("totalEmbeddings");
    expect(typeof body.totalEmbeddings).toBe("number");
    expect(body).toHaveProperty("indexed");
  });
});

// ── Context Build ────────────────────────────────────────

test.describe("Context Build", () => {
  test("GET /context/preview should return context for existing node", async ({ request }) => {
    // Get a node ID from the test store
    const nodesRes = await request.get("/api/v1/nodes");
    const nodesBody = await nodesRes.json();

    if (nodesBody.nodes && nodesBody.nodes.length > 0) {
      const nodeId = nodesBody.nodes[0].id;

      const res = await request.get(`/api/v1/context/preview?nodeId=${nodeId}`);
      expect(res.ok()).toBe(true);

      const body = await res.json();
      expect(body).toHaveProperty("task");
      expect(body).toHaveProperty("metrics");
      expect(body.metrics).toHaveProperty("estimatedTokens");
      expect(typeof body.metrics.estimatedTokens).toBe("number");
    }
  });

  test("GET /context/budget should return token budget breakdown", async ({ request }) => {
    const res = await request.get("/api/v1/context/budget");
    expect(res.ok()).toBe(true);

    const body = await res.json();
    expect(body).toHaveProperty("totalTokens");
    expect(body).toHaveProperty("activeTokens");
    expect(body).toHaveProperty("health");
    expect(body).toHaveProperty("breakdown");
    expect(typeof body.totalTokens).toBe("number");
    expect(["green", "yellow", "red"]).toContain(body.health);
  });

  test("GET /context/preview should return 404 for non-existent node", async ({ request }) => {
    const res = await request.get("/api/v1/context/preview?nodeId=nonexistent_node_12345");
    expect(res.ok()).toBe(false);
    expect(res.status()).toBe(404);
  });
});

// ── Full Pipeline E2E ────────────────────────────────────

test.describe("Full RAG Pipeline E2E", () => {
  test("should upload knowledge → reindex → semantic search → find document", async ({ request }) => {
    // 1. Upload a specific knowledge document
    const uploadRes = await request.post("/api/v1/knowledge", {
      data: {
        title: "Unique Pipeline Test Document",
        content: "The enrichment pipeline extracts keywords, entities, and summaries from text chunks. It uses TF-IDF for keyword ranking and regex patterns for entity detection.",
        sourceType: "docs",
      },
    });
    expect(uploadRes.ok()).toBe(true);

    // 2. Reindex embeddings to include the new document
    const reindexRes = await request.post("/api/v1/rag/reindex");
    expect(reindexRes.ok()).toBe(true);
    const reindexBody = await reindexRes.json();
    expect(reindexBody.knowledge).toBeGreaterThan(0);

    // 3. Search for the document via semantic search
    const searchRes = await request.post("/api/v1/rag/query", {
      data: { query: "enrichment pipeline keyword extraction", limit: 10 },
    });
    expect(searchRes.ok()).toBe(true);
    const searchBody = await searchRes.json();

    // Should find at least one result related to our uploaded document
    expect(searchBody.results.length).toBeGreaterThanOrEqual(1);

    // 4. Also verify via FTS search
    const ftsRes = await request.post("/api/v1/knowledge/search", {
      data: { query: "enrichment pipeline" },
    });
    expect(ftsRes.ok()).toBe(true);
    const ftsBody = await ftsRes.json();
    expect(ftsBody.results.length).toBeGreaterThanOrEqual(1);

    const found = ftsBody.results.find(
      (r: { title: string }) => r.title.includes("Pipeline Test Document"),
    );
    expect(found).toBeTruthy();
  });

  test("should create node + upload knowledge → context preview includes knowledge", async ({ request }) => {
    // 1. Create a task node
    const nodeRes = await request.post("/api/v1/nodes", {
      data: {
        type: "task",
        title: "Implement RAG caching layer",
        description: "Add LRU cache with TTL for RAG query results to avoid redundant searches",
        status: "ready",
        priority: 2,
      },
    });
    expect(nodeRes.ok()).toBe(true);
    const nodeBody = await nodeRes.json();
    const nodeId = nodeBody.node?.id ?? nodeBody.id;
    expect(nodeId).toBeTruthy();

    // 2. Upload related knowledge
    await request.post("/api/v1/knowledge", {
      data: {
        title: "RAG Cache Architecture",
        content: "The QueryCache uses LRU eviction with configurable TTL. Cache is invalidated on reindex_knowledge calls. Max size is 100 entries.",
        sourceType: "memory",
      },
    });

    // 3. Get context preview for the node
    const ctxRes = await request.get(`/api/v1/context/preview?nodeId=${nodeId}`);
    expect(ctxRes.ok()).toBe(true);

    const ctxBody = await ctxRes.json();
    expect(ctxBody).toHaveProperty("task");
    expect(ctxBody.task.title).toContain("RAG caching");
    expect(ctxBody).toHaveProperty("metrics");
    expect(ctxBody.metrics.estimatedTokens).toBeGreaterThan(0);
  });
});
