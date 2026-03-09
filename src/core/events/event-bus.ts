import { EventEmitter } from "node:events";
import { logger } from "../utils/logger.js";
import type { GraphEvent, GraphEventType } from "./event-types.js";

type EventHandler = (event: GraphEvent) => void;

/**
 * Typed event bus for graph mutations.
 * Wraps Node.js EventEmitter with typed GraphEvent payloads.
 */
export class GraphEventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  /** Emit a graph event */
  emit(event: GraphEvent): void {
    logger.info("Event emitted", { type: event.type });
    this.emitter.emit(event.type, event);
    this.emitter.emit("*", event);
  }

  /** Listen for a specific event type */
  on(type: GraphEventType | "*", handler: EventHandler): void {
    this.emitter.on(type, handler);
  }

  /** Listen for a specific event type (once) */
  once(type: GraphEventType | "*", handler: EventHandler): void {
    this.emitter.once(type, handler);
  }

  /** Remove a specific listener */
  off(type: GraphEventType | "*", handler: EventHandler): void {
    this.emitter.off(type, handler);
  }

  /** Remove all listeners */
  removeAllListeners(): void {
    this.emitter.removeAllListeners();
  }

  /** Get listener count for a type */
  listenerCount(type: GraphEventType | "*"): number {
    return this.emitter.listenerCount(type);
  }

  /** Helper: create and emit event in one call */
  emitTyped(type: GraphEventType, payload: Record<string, unknown>): void {
    this.emit({
      type,
      timestamp: new Date().toISOString(),
      payload,
    });
  }
}
