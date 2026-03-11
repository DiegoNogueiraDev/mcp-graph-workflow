import { describe, it, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import type { Express } from "express";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { GraphEventBus } from "../core/events/event-bus.js";
import { createApiRouter } from "../api/router.js";
import { generateId } from "../core/utils/id.js";
import { now } from "../core/utils/time.js";
import http from "node:http";
import { makeNode } from "./helpers/factories.js";

describe("SSE Events", () => {
  let app: Express;
  let store: SqliteStore;
  let eventBus: GraphEventBus;
  let server: http.Server;
  let port: number;

  beforeEach(async () => {
    store = SqliteStore.open(":memory:");
    store.initProject("SSE Test");
    eventBus = new GraphEventBus();
    store.eventBus = eventBus;

    app = express();
    app.use(express.json());
    app.use("/api/v1", createApiRouter({ store, eventBus }));

    // Start on random port
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        port = typeof addr === "object" && addr ? addr.port : 0;
        resolve();
      });
    });
  });

  afterEach(async () => {
    store.close();
    eventBus.removeAllListeners();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("should emit node:created event via SSE when a node is inserted", async () => {
    const _events: string[] = [];

    // Connect to SSE
    const response = await fetch(`http://localhost:${port}/api/v1/events`);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    // Read the initial connection comment
    const { value: initial } = await reader.read();
    const initialText = decoder.decode(initial);
    expect(initialText).toContain(": connected");

    // Insert a node (triggers event)
    const node = makeNode({ title: "SSE Test Node" });
    store.insertNode(node);

    // Read the event
    const { value } = await reader.read();
    const text = decoder.decode(value);

    expect(text).toContain("event: node:created");
    expect(text).toContain("SSE Test Node");

    reader.cancel();
  });

  it("should emit events for store mutations via event bus", () => {
    const received: string[] = [];
    eventBus.on("*", (e) => received.push(e.type));

    store.insertNode(makeNode({ title: "A" }));
    const nodeB = makeNode({ title: "B" });
    store.insertNode(nodeB);
    store.updateNodeStatus(nodeB.id, "done");
    store.deleteNode(nodeB.id);

    expect(received).toEqual([
      "node:created",
      "node:created",
      "node:updated",
      "node:deleted",
    ]);
  });

  it("should emit edge events", () => {
    const received: string[] = [];
    eventBus.on("*", (e) => received.push(e.type));

    const a = makeNode({ title: "A" });
    const b = makeNode({ title: "B" });
    store.insertNode(a);
    store.insertNode(b);

    const edgeId = generateId("edge");
    store.insertEdge({
      id: edgeId,
      from: a.id,
      to: b.id,
      relationType: "depends_on",
      createdAt: now(),
    });
    store.deleteEdge(edgeId);

    expect(received).toContain("edge:created");
    expect(received).toContain("edge:deleted");
  });

  it("should emit import:completed on bulkInsert", () => {
    const received: string[] = [];
    eventBus.on("*", (e) => received.push(e.type));

    store.bulkInsert([makeNode({ title: "Bulk" })], []);

    expect(received).toContain("import:completed");
  });
});
