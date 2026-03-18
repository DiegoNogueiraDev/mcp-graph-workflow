import { describe, it, expect } from "vitest";
import { GraphEventBus } from "../core/events/event-bus.js";
import type { GraphEvent, GraphEventType } from "../core/events/event-types.js";

describe("Knowledge event types", () => {
  it("should emit knowledge:indexed event", () => {
    const bus = new GraphEventBus();
    const events: GraphEvent[] = [];

    bus.on("knowledge:indexed", (event) => events.push(event));

    bus.emitTyped("knowledge:indexed", {
      source: "memory",
      documentsIndexed: 5,
    });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("knowledge:indexed");
    expect(events[0].payload.source).toBe("memory");
    expect(events[0].payload.documentsIndexed).toBe(5);
  });

  it("should emit knowledge:deleted event", () => {
    const bus = new GraphEventBus();
    const events: GraphEvent[] = [];

    bus.on("knowledge:deleted", (event) => events.push(event));

    bus.emitTyped("knowledge:deleted", {
      source: "web_capture",
      documentsDeleted: 3,
    });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("knowledge:deleted");
    expect(events[0].payload.documentsDeleted).toBe(3);
  });

  it("should catch knowledge events via wildcard listener", () => {
    const bus = new GraphEventBus();
    const events: GraphEvent[] = [];

    bus.on("*", (event) => events.push(event));

    bus.emitTyped("knowledge:indexed", { source: "docs", documentsIndexed: 10 });
    bus.emitTyped("knowledge:deleted", { source: "memory", documentsDeleted: 2 });

    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("knowledge:indexed");
    expect(events[1].type).toBe("knowledge:deleted");
  });

  it("should include new types in GraphEventType", () => {
    // Type-level check — if this compiles, the types are correct
    const types: GraphEventType[] = [
      "knowledge:indexed",
      "knowledge:deleted",
    ];
    expect(types).toHaveLength(2);
  });
});
