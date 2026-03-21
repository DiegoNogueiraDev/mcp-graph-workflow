import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { indexSwaggerContent } from "../../core/rag/swagger-indexer.js";
import type { SwaggerParseResult } from "../../core/parser/read-swagger.js";

let sqliteStore: SqliteStore;

function createTestStore(): KnowledgeStore {
  sqliteStore = SqliteStore.open(":memory:");
  sqliteStore.initProject("Test Project");
  return new KnowledgeStore(sqliteStore.getDb());
}

function createSampleSwaggerResult(): SwaggerParseResult {
  return {
    title: "Account API",
    version: "1.0.0",
    format: "openapi3",
    endpoints: [
      {
        method: "GET",
        path: "/accounts",
        operationId: "listAccounts",
        summary: "List all accounts",
        parameters: [{ name: "limit", location: "query", type: "integer", required: false }],
        requestBody: undefined,
        responses: ["200: List of accounts"],
      },
      {
        method: "POST",
        path: "/accounts",
        operationId: "createAccount",
        summary: "Create account",
        parameters: [],
        requestBody: "Account",
        responses: ["201: Created"],
      },
    ],
    schemas: [
      {
        name: "Account",
        type: "object",
        properties: [
          { name: "name", type: "string", required: true },
          { name: "location", type: "string", required: false },
        ],
        required: ["name"],
      },
    ],
  };
}

describe("swagger-indexer", () => {
  let store: KnowledgeStore;

  beforeEach(() => {
    store = createTestStore();
  });

  afterEach(() => {
    sqliteStore.close();
  });

  it("should index swagger endpoints into knowledge store", () => {
    const swaggerResult = createSampleSwaggerResult();
    const result = indexSwaggerContent(store, swaggerResult, "account-api.yaml");

    expect(result.documentsIndexed).toBeGreaterThan(0);
    expect(result.fileName).toBe("account-api.yaml");

    // Verify endpoints are searchable
    const searchResults = store.search("listAccounts", 10);
    expect(searchResults.length).toBeGreaterThan(0);
  });

  it("should index swagger schemas into knowledge store", () => {
    const swaggerResult = createSampleSwaggerResult();
    indexSwaggerContent(store, swaggerResult, "account-api.yaml");

    const searchResults = store.search("Account", 10);
    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults.some((r) => r.sourceType === "swagger")).toBe(true);
  });

  it("should use sourceType swagger for all documents", () => {
    const swaggerResult = createSampleSwaggerResult();
    indexSwaggerContent(store, swaggerResult, "account-api.yaml");

    const docs = store.getBySourceId(`swagger:account-api.yaml`);
    expect(docs.length).toBeGreaterThan(0);
    for (const doc of docs) {
      expect(doc.sourceType).toBe("swagger");
    }
  });

  it("should re-index cleanly on duplicate import", () => {
    const swaggerResult = createSampleSwaggerResult();

    const first = indexSwaggerContent(store, swaggerResult, "account-api.yaml");
    const second = indexSwaggerContent(store, swaggerResult, "account-api.yaml");

    expect(second.documentsIndexed).toBe(first.documentsIndexed);

    // Should not duplicate — re-index replaces
    const docs = store.getBySourceId(`swagger:account-api.yaml`);
    expect(docs.length).toBe(first.documentsIndexed);
  });

  it("should include metadata with endpoint details", () => {
    const swaggerResult = createSampleSwaggerResult();
    indexSwaggerContent(store, swaggerResult, "account-api.yaml");

    const docs = store.getBySourceId(`swagger:account-api.yaml`);
    const endpointDoc = docs.find((d) => d.title.includes("GET /accounts"));
    expect(endpointDoc).toBeDefined();
    expect(endpointDoc!.metadata).toBeDefined();
    expect((endpointDoc!.metadata as Record<string, unknown>).apiTitle).toBe("Account API");
  });

  it("should handle empty endpoints gracefully", () => {
    const emptyResult: SwaggerParseResult = {
      title: "Empty API",
      version: "1.0.0",
      format: "openapi3",
      endpoints: [],
      schemas: [],
    };

    const result = indexSwaggerContent(store, emptyResult, "empty.yaml");
    expect(result.documentsIndexed).toBe(0);
  });
});
