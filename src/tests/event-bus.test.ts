import { describe, it, expect, vi } from "vitest";
import { GraphEventBus } from "../core/events/event-bus.js";
import type { GraphEvent } from "../core/events/event-types.js";

describe("GraphEventBus", () => {
  it("should emit and receive typed events", () => {
    const bus = new GraphEventBus();
    const handler = vi.fn();

    bus.on("node:created", handler);
    bus.emitTyped("node:created", { nodeId: "n1", title: "Task", nodeType: "task" });

    expect(handler).toHaveBeenCalledOnce();
    const event = handler.mock.calls[0][0] as GraphEvent;
    expect(event.type).toBe("node:created");
    expect(event.payload.nodeId).toBe("n1");
    expect(event.timestamp).toBeTruthy();
  });

  it("should support wildcard listener", () => {
    const bus = new GraphEventBus();
    const handler = vi.fn();

    bus.on("*", handler);
    bus.emitTyped("node:created", { nodeId: "n1", title: "A", nodeType: "task" });
    bus.emitTyped("edge:created", { edgeId: "e1", from: "a", to: "b", relationType: "depends_on" });

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("should not fire unrelated listeners", () => {
    const bus = new GraphEventBus();
    const handler = vi.fn();

    bus.on("node:deleted", handler);
    bus.emitTyped("node:created", { nodeId: "n1", title: "A", nodeType: "task" });

    expect(handler).not.toHaveBeenCalled();
  });

  it("should support once listener", () => {
    const bus = new GraphEventBus();
    const handler = vi.fn();

    bus.once("node:updated", handler);
    bus.emitTyped("node:updated", { nodeId: "n1", fields: ["status"] });
    bus.emitTyped("node:updated", { nodeId: "n2", fields: ["title"] });

    expect(handler).toHaveBeenCalledOnce();
  });

  it("should support removing listeners", () => {
    const bus = new GraphEventBus();
    const handler = vi.fn();

    bus.on("edge:deleted", handler);
    bus.off("edge:deleted", handler);
    bus.emitTyped("edge:deleted", { edgeId: "e1" });

    expect(handler).not.toHaveBeenCalled();
  });

  it("should report listener count", () => {
    const bus = new GraphEventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();

    bus.on("node:created", h1);
    bus.on("node:created", h2);

    expect(bus.listenerCount("node:created")).toBe(2);
  });

  it("should removeAllListeners", () => {
    const bus = new GraphEventBus();
    bus.on("node:created", vi.fn());
    bus.on("edge:created", vi.fn());
    bus.on("*", vi.fn());

    bus.removeAllListeners();

    expect(bus.listenerCount("node:created")).toBe(0);
    expect(bus.listenerCount("*")).toBe(0);
  });
});
