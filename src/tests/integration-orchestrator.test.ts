import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { GraphEventBus } from "../core/events/event-bus.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { IntegrationOrchestrator } from "../core/integrations/integration-orchestrator.js";
import type { GraphEvent } from "../core/events/event-types.js";

describe("IntegrationOrchestrator", () => {
  let store: SqliteStore;
  let eventBus: GraphEventBus;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    eventBus = new GraphEventBus();
  });

  afterEach(() => {
    eventBus.removeAllListeners();
    store.close();
  });

  it("should register event handlers on the bus", () => {
    const orchestrator = new IntegrationOrchestrator(store, eventBus);
    orchestrator.register();

    // Should have listeners for import:completed and knowledge:indexed
    expect(eventBus.listenerCount("import:completed")).toBe(1);
    expect(eventBus.listenerCount("knowledge:indexed")).toBe(1);
  });

  it("should not register import handler when autoReindex is false", () => {
    const orchestrator = new IntegrationOrchestrator(store, eventBus, { autoReindex: false });
    orchestrator.register();

    expect(eventBus.listenerCount("import:completed")).toBe(0);
    expect(eventBus.listenerCount("knowledge:indexed")).toBe(1);
  });

  it("should return integration statuses", () => {
    const orchestrator = new IntegrationOrchestrator(store, eventBus);
    const statuses = orchestrator.getStatuses();

    expect(statuses.length).toBe(5); // upload, serena, code_context, docs, web_capture
    expect(statuses.every((s) => s.status === "idle")).toBe(true);
  });

  it("should track document counts in statuses", () => {
    const knowledgeStore = new KnowledgeStore(store.getDb());
    knowledgeStore.insert({ sourceType: "upload", sourceId: "f1", title: "Doc", content: "Content" });
    knowledgeStore.insert({ sourceType: "upload", sourceId: "f2", title: "Doc2", content: "Content 2" });

    const orchestrator = new IntegrationOrchestrator(store, eventBus);
    const statuses = orchestrator.getStatuses();

    const uploadStatus = statuses.find((s) => s.source === "upload");
    expect(uploadStatus!.documentCount).toBe(2);
  });

  it("should reindex on import:completed event", async () => {
    const orchestrator = new IntegrationOrchestrator(store, eventBus);
    orchestrator.register();

    // Track knowledge:indexed events
    const indexedEvents: GraphEvent[] = [];
    eventBus.on("knowledge:indexed", (event) => indexedEvents.push(event));

    // Emit import:completed
    eventBus.emitTyped("import:completed", { nodesCreated: 5, edgesCreated: 3 });

    // Wait for async handler
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(indexedEvents.length).toBeGreaterThanOrEqual(1);
    expect(indexedEvents[0].payload.source).toBe("import_reindex");
  });

  it("should handle knowledge:indexed event", () => {
    const orchestrator = new IntegrationOrchestrator(store, eventBus);
    orchestrator.register();

    // This should not throw
    eventBus.emitTyped("knowledge:indexed", { source: "docs", documentsIndexed: 10 });
  });
});
