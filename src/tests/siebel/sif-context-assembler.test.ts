import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { assembleSifContext } from "../../core/siebel/sif-context-assembler.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { SqliteStore } from "../../core/store/sqlite-store.js";
import type { SifGenerationRequest } from "../../schemas/siebel.schema.js";

describe("sif-context-assembler", () => {
  let store: SqliteStore;
  let knowledgeStore: KnowledgeStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Context Assembler Test");
    knowledgeStore = new KnowledgeStore(store.getDb());
  });

  afterEach(() => {
    store.close();
  });

  it("should assemble context for a basic BC generation request", () => {
    const request: SifGenerationRequest = {
      description: "Create a Business Component for Service Requests with fields: SR Number, Status, Priority",
      objectTypes: ["business_component"],
    };

    const context = assembleSifContext(knowledgeStore, request);

    expect(context.templates.length).toBeGreaterThan(0);
    expect(context.templates[0].type).toBe("business_component");
    expect(context.prompt).toContain("Business Component");
    expect(context.prompt).toContain("Service Requests");
    expect(context.validationRules.length).toBeGreaterThan(0);
  });

  it("should include existing objects when knowledge store has indexed SIF content", () => {
    // Index some existing objects
    knowledgeStore.insert({
      sourceType: "siebel_sif",
      sourceId: "siebel_sif:account.sif",
      title: "Siebel business_component: Account",
      content: "Business Component: Account\nType: business_component\nTable: S_ORG_EXT\nFields: Name, Location, Status",
      chunkIndex: 0,
    });

    const request: SifGenerationRequest = {
      description: "Create a BC similar to Account for Partners",
      objectTypes: ["business_component"],
    };

    const context = assembleSifContext(knowledgeStore, request);

    // Should find existing Account BC in knowledge results
    expect(context.existingObjects.length).toBeGreaterThan(0);
  });

  it("should include related docs when available", () => {
    // Index documentation
    knowledgeStore.insert({
      sourceType: "siebel_docs",
      sourceId: "siebel_docs:bc-guide.pdf",
      title: "Siebel Business Component Guide",
      content: "A Business Component maps to a database table. Required: NAME, TABLE. Optional: CLASS, SORT_SPEC.",
      chunkIndex: 0,
    });

    const request: SifGenerationRequest = {
      description: "Create a Business Component",
      objectTypes: ["business_component"],
    };

    const context = assembleSifContext(knowledgeStore, request);

    expect(context.relatedDocs.length).toBeGreaterThan(0);
  });

  it("should include swagger context when available", () => {
    knowledgeStore.insert({
      sourceType: "swagger",
      sourceId: "swagger:api.yaml",
      title: "GET /api/v1/accounts",
      content: "Endpoint: GET /api/v1/accounts\nReturns list of accounts with fields: id, name, status, location",
      chunkIndex: 0,
    });

    const request: SifGenerationRequest = {
      description: "Create Integration Object for accounts API",
      objectTypes: ["integration_object"],
    };

    const context = assembleSifContext(knowledgeStore, request);

    // Should find swagger docs
    expect(context.relatedDocs.length).toBeGreaterThan(0);
  });

  it("should generate a structured prompt with templates and context", () => {
    const request: SifGenerationRequest = {
      description: "Create an Applet and View for displaying Opportunities",
      objectTypes: ["applet", "view"],
      basedOnProject: "Opportunity (SSE)",
      properties: { BUS_COMP: "Opportunity", BUS_OBJECT: "Opportunity" },
    };

    const context = assembleSifContext(knowledgeStore, request);

    expect(context.prompt).toContain("Applet");
    expect(context.prompt).toContain("View");
    expect(context.prompt).toContain("Opportunity");
    expect(context.prompt).toContain("REPOSITORY");
    expect(context.templates.length).toBe(2);
  });

  it("should include validation rules in the context", () => {
    const request: SifGenerationRequest = {
      description: "Create a BC",
      objectTypes: ["business_component"],
    };

    const context = assembleSifContext(knowledgeStore, request);

    expect(context.validationRules).toContain("Every object must have a NAME attribute");
    expect(context.validationRules.some((r) => r.includes("TABLE"))).toBe(true);
  });
});
