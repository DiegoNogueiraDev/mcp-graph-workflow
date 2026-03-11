import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { logger, getLogBuffer, clearLogBuffer, setLogListener } from "../core/utils/logger.js";
import type { LogEntry } from "../schemas/log.schema.js";

describe("Logger Buffer", () => {
  beforeEach(() => {
    clearLogBuffer();
    setLogListener(null);
    // Suppress stderr output during tests
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return empty buffer initially", () => {
    const buffer = getLogBuffer();
    expect(buffer).toEqual([]);
  });

  it("should add info entry to buffer", () => {
    logger.info("test message");
    const buffer = getLogBuffer();
    expect(buffer).toHaveLength(1);
    expect(buffer[0].level).toBe("info");
    expect(buffer[0].message).toBe("test message");
  });

  it("should add warn entry to buffer", () => {
    logger.warn("warning message");
    const buffer = getLogBuffer();
    expect(buffer).toHaveLength(1);
    expect(buffer[0].level).toBe("warn");
  });

  it("should add error entry to buffer", () => {
    logger.error("error message");
    const buffer = getLogBuffer();
    expect(buffer).toHaveLength(1);
    expect(buffer[0].level).toBe("error");
  });

  it("should add success entry to buffer", () => {
    logger.success("success message");
    const buffer = getLogBuffer();
    expect(buffer).toHaveLength(1);
    expect(buffer[0].level).toBe("success");
  });

  it("should buffer debug only when MCP_GRAPH_DEBUG is set", () => {
    // Without env var — should not buffer
    const original = process.env.MCP_GRAPH_DEBUG;
    delete process.env.MCP_GRAPH_DEBUG;
    logger.debug("debug message 1");
    expect(getLogBuffer()).toHaveLength(0);

    // With env var — should buffer
    process.env.MCP_GRAPH_DEBUG = "1";
    logger.debug("debug message 2");
    expect(getLogBuffer()).toHaveLength(1);
    expect(getLogBuffer()[0].level).toBe("debug");

    // Restore
    if (original !== undefined) {
      process.env.MCP_GRAPH_DEBUG = original;
    } else {
      delete process.env.MCP_GRAPH_DEBUG;
    }
  });

  it("should have correct shape with id, level, message, context, timestamp", () => {
    logger.info("shaped message", { key: "value" });
    const entry = getLogBuffer()[0];
    expect(entry).toMatchObject({
      id: expect.any(Number),
      level: "info",
      message: "shaped message",
      context: { key: "value" },
      timestamp: expect.any(String),
    });
  });

  it("should have auto-incremental monotonic IDs", () => {
    logger.info("first");
    logger.info("second");
    logger.info("third");
    const buffer = getLogBuffer();
    expect(buffer[0].id).toBeLessThan(buffer[1].id);
    expect(buffer[1].id).toBeLessThan(buffer[2].id);
  });

  it("should respect MAX_BUFFER_SIZE of 1000 entries", () => {
    for (let i = 0; i < 1050; i++) {
      logger.info(`message ${i}`);
    }
    const buffer = getLogBuffer();
    expect(buffer).toHaveLength(1000);
    // Oldest entries should have been removed
    expect(buffer[0].message).toBe("message 50");
    expect(buffer[999].message).toBe("message 1049");
  });

  it("should clear buffer with clearLogBuffer()", () => {
    logger.info("to be cleared");
    expect(getLogBuffer()).toHaveLength(1);
    clearLogBuffer();
    expect(getLogBuffer()).toHaveLength(0);
  });

  it("should call logListener on each log entry", () => {
    const listener = vi.fn();
    setLogListener(listener);

    logger.info("listened message", { foo: "bar" });

    expect(listener).toHaveBeenCalledOnce();
    const entry: LogEntry = listener.mock.calls[0][0];
    expect(entry.level).toBe("info");
    expect(entry.message).toBe("listened message");
    expect(entry.context).toEqual({ foo: "bar" });
  });

  it("should return a copy of the buffer, not the internal reference", () => {
    logger.info("test");
    const buffer1 = getLogBuffer();
    const buffer2 = getLogBuffer();
    expect(buffer1).not.toBe(buffer2);
    expect(buffer1).toEqual(buffer2);
  });
});
