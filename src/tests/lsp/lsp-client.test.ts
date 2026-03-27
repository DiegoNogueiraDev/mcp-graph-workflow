/**
 * LspClient — JSON-RPC 2.0 framing & message handling tests.
 *
 * Tests the core JSON-RPC protocol logic without spawning real LSP servers.
 * Uses direct access to internal methods to simulate incoming data.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";

// Mock child_process before importing LspClient
const mockStdin = {
  writable: true,
  write: vi.fn(),
};

const mockStdout = new EventEmitter();
const mockStderr = new EventEmitter();

const mockProcess = Object.assign(new EventEmitter(), {
  stdin: mockStdin,
  stdout: mockStdout,
  stderr: mockStderr,
  pid: 12345,
  kill: vi.fn(),
});

// Shared emitters are reused across tests — raise limit to avoid warnings
mockStdout.setMaxListeners(50);
mockStderr.setMaxListeners(50);
mockProcess.setMaxListeners(50);

vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => mockProcess),
}));

// Suppress logger output during tests
vi.mock("../../core/utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    success: vi.fn(),
  },
}));

import { LspClient } from "../../core/lsp/lsp-client.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a Content-Length framed JSON-RPC message buffer. */
function encodeMessage(obj: Record<string, unknown>): Buffer {
  const json = JSON.stringify(obj);
  const body = Buffer.from(json, "utf8");
  const header = `Content-Length: ${body.byteLength}\r\n\r\n`;
  return Buffer.concat([Buffer.from(header, "ascii"), body]);
}

/** Simulate the server sending data to the client via stdout. */
function simulateServerData(data: Buffer): void {
  mockStdout.emit("data", data);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LspClient", () => {
  let client: LspClient;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockStdin.writable = true;
    mockStdin.write.mockReturnValue(true);

    client = new LspClient("fake-lsp", ["--stdio"], 500);
    await client.start();
  });

  afterEach(() => {
    // Reset internal state by killing
    client.kill();
  });

  // -----------------------------------------------------------------------
  // 1. encode — Content-Length header correctness
  // -----------------------------------------------------------------------

  describe("encode", () => {
    it("should produce correct Content-Length for ASCII content", () => {
      // Arrange
      const method = "textDocument/hover";

      // Act
      client.sendNotification(method, { position: { line: 0, character: 0 } });

      // Assert
      expect(mockStdin.write).toHaveBeenCalledTimes(1);
      const written = mockStdin.write.mock.calls[0][0] as Buffer;
      const str = written.toString("utf8");
      const match = /Content-Length: (\d+)\r\n\r\n(.*)/.exec(str);
      expect(match).not.toBeNull();
      const declaredLength = parseInt(match![1], 10);
      const bodyBytes = Buffer.from(match![2], "utf8").byteLength;
      expect(declaredLength).toBe(bodyBytes);
    });

    it("should produce correct Content-Length for UTF-8 content", () => {
      // Arrange — multi-byte characters
      const params = { text: "cafe\u0301" }; // "café" with combining accent

      // Act
      client.sendNotification("test/utf8", params);

      // Assert
      const written = mockStdin.write.mock.calls[0][0] as Buffer;
      const str = written.toString("utf8");
      const match = /Content-Length: (\d+)\r\n\r\n(.*)/.exec(str);
      expect(match).not.toBeNull();
      const declaredLength = parseInt(match![1], 10);
      const bodyBuffer = Buffer.from(match![2], "utf8");
      expect(declaredLength).toBe(bodyBuffer.byteLength);
    });
  });

  // -----------------------------------------------------------------------
  // 2. handleData — complete message
  // -----------------------------------------------------------------------

  describe("handleData — complete message", () => {
    it("should resolve pending request when complete response arrives", async () => {
      // Arrange
      const requestPromise = client.sendRequest<string>("test/method");
      const writtenBuf = mockStdin.write.mock.calls[0][0] as Buffer;
      const writtenJson = JSON.parse(
        writtenBuf.toString("utf8").split("\r\n\r\n")[1],
      ) as { id: number };
      const requestId = writtenJson.id;

      // Act
      const response = encodeMessage({
        jsonrpc: "2.0",
        id: requestId,
        result: "hello",
      });
      simulateServerData(response);

      // Assert
      const result = await requestPromise;
      expect(result).toBe("hello");
    });
  });

  // -----------------------------------------------------------------------
  // 3. handleData — chunked message
  // -----------------------------------------------------------------------

  describe("handleData — chunked message", () => {
    it("should handle header and body arriving in separate chunks", async () => {
      // Arrange
      const requestPromise = client.sendRequest<number>("test/chunked");
      const writtenBuf = mockStdin.write.mock.calls[0][0] as Buffer;
      const writtenJson = JSON.parse(
        writtenBuf.toString("utf8").split("\r\n\r\n")[1],
      ) as { id: number };
      const requestId = writtenJson.id;

      const fullMessage = encodeMessage({
        jsonrpc: "2.0",
        id: requestId,
        result: 42,
      });

      // Split at an arbitrary point inside the header
      const splitPoint = 10;

      // Act — send two chunks
      simulateServerData(fullMessage.subarray(0, splitPoint));
      simulateServerData(fullMessage.subarray(splitPoint));

      // Assert
      const result = await requestPromise;
      expect(result).toBe(42);
    });
  });

  // -----------------------------------------------------------------------
  // 4. handleData — multiple messages concatenated
  // -----------------------------------------------------------------------

  describe("handleData — multiple messages", () => {
    it("should resolve both requests from a single concatenated buffer", async () => {
      // Arrange
      const promise1 = client.sendRequest<string>("test/first");
      const promise2 = client.sendRequest<string>("test/second");

      const calls = mockStdin.write.mock.calls;
      const id1 = JSON.parse(
        (calls[0][0] as Buffer).toString("utf8").split("\r\n\r\n")[1],
      ).id as number;
      const id2 = JSON.parse(
        (calls[1][0] as Buffer).toString("utf8").split("\r\n\r\n")[1],
      ).id as number;

      // Act — concatenate two responses into one buffer
      const msg1 = encodeMessage({ jsonrpc: "2.0", id: id1, result: "a" });
      const msg2 = encodeMessage({ jsonrpc: "2.0", id: id2, result: "b" });
      simulateServerData(Buffer.concat([msg1, msg2]));

      // Assert
      expect(await promise1).toBe("a");
      expect(await promise2).toBe("b");
    });
  });

  // -----------------------------------------------------------------------
  // 5. sendRequest — JSON-RPC format & incrementing id
  // -----------------------------------------------------------------------

  describe("sendRequest", () => {
    it("should send valid JSON-RPC with incrementing id", () => {
      // Act — catch the promises to prevent unhandled rejection on timeout
      const p1 = client.sendRequest("method/one", { a: 1 }).catch(() => {});
      const p2 = client.sendRequest("method/two").catch(() => {});

      // Assert
      const calls = mockStdin.write.mock.calls;
      expect(calls).toHaveLength(2);

      const parsed1 = JSON.parse(
        (calls[0][0] as Buffer).toString("utf8").split("\r\n\r\n")[1],
      ) as { jsonrpc: string; id: number; method: string; params?: unknown };

      const parsed2 = JSON.parse(
        (calls[1][0] as Buffer).toString("utf8").split("\r\n\r\n")[1],
      ) as { jsonrpc: string; id: number; method: string };

      expect(parsed1.jsonrpc).toBe("2.0");
      expect(parsed1.method).toBe("method/one");
      expect(parsed1.params).toEqual({ a: 1 });
      expect(typeof parsed1.id).toBe("number");

      expect(parsed2.jsonrpc).toBe("2.0");
      expect(parsed2.method).toBe("method/two");
      expect(parsed2.id).toBe(parsed1.id + 1);
      // No params key when undefined
      expect(parsed2).not.toHaveProperty("params");

      // Resolve the pending requests to clean up timers
      simulateServerData(
        encodeMessage({ jsonrpc: "2.0", id: parsed1.id, result: null }),
      );
      simulateServerData(
        encodeMessage({ jsonrpc: "2.0", id: parsed2.id, result: null }),
      );

      // Suppress unused variable warnings
      void p1;
      void p2;
    });
  });

  // -----------------------------------------------------------------------
  // 6. sendRequest timeout
  // -----------------------------------------------------------------------

  describe("sendRequest timeout", () => {
    it("should reject after the configured timeout", async () => {
      // Arrange — client created with 500ms timeout in beforeEach

      // Act & Assert
      await expect(client.sendRequest("test/timeout")).rejects.toThrow(
        /timed out after 500ms/,
      );
    });
  });

  // -----------------------------------------------------------------------
  // 7. sendNotification — no id in message
  // -----------------------------------------------------------------------

  describe("sendNotification", () => {
    it("should send message without id field", () => {
      // Act
      client.sendNotification("textDocument/didOpen", { uri: "file:///test.ts" });

      // Assert
      const written = mockStdin.write.mock.calls[0][0] as Buffer;
      const parsed = JSON.parse(
        written.toString("utf8").split("\r\n\r\n")[1],
      ) as Record<string, unknown>;

      expect(parsed.jsonrpc).toBe("2.0");
      expect(parsed.method).toBe("textDocument/didOpen");
      expect(parsed.params).toEqual({ uri: "file:///test.ts" });
      expect(parsed).not.toHaveProperty("id");
    });
  });

  // -----------------------------------------------------------------------
  // 8. handleMessage — server-initiated notification
  // -----------------------------------------------------------------------

  describe("handleMessage — server notification", () => {
    it("should emit 'notification' event for server-initiated notifications", async () => {
      // Arrange
      const received: Array<{ method: string; params: unknown }> = [];
      client.on("notification", (n: { method: string; params: unknown }) => {
        received.push(n);
      });

      // Act
      const notification = encodeMessage({
        jsonrpc: "2.0",
        method: "textDocument/publishDiagnostics",
        params: { uri: "file:///test.ts", diagnostics: [] },
      });
      simulateServerData(notification);

      // Assert — allow event loop tick
      await new Promise<void>((r) => setTimeout(r, 10));
      expect(received).toHaveLength(1);
      expect(received[0].method).toBe("textDocument/publishDiagnostics");
      expect(received[0].params).toEqual({
        uri: "file:///test.ts",
        diagnostics: [],
      });
    });
  });

  // -----------------------------------------------------------------------
  // 9. stop — shutdown request + exit notification
  // -----------------------------------------------------------------------

  describe("stop", () => {
    it("should send shutdown request then exit notification", async () => {
      // Arrange — capture writes then immediately resolve shutdown
      const stopPromise = client.stop();

      // The first write is the shutdown request
      const shutdownBuf = mockStdin.write.mock.calls[0][0] as Buffer;
      const shutdownMsg = JSON.parse(
        shutdownBuf.toString("utf8").split("\r\n\r\n")[1],
      ) as { id: number; method: string };

      expect(shutdownMsg.method).toBe("shutdown");

      // Respond to shutdown
      simulateServerData(
        encodeMessage({ jsonrpc: "2.0", id: shutdownMsg.id, result: null }),
      );

      // Wait a tick for the exit notification to be sent
      await new Promise<void>((r) => setTimeout(r, 10));

      // The second write should be the exit notification
      const exitBuf = mockStdin.write.mock.calls[1][0] as Buffer;
      const exitMsg = JSON.parse(
        exitBuf.toString("utf8").split("\r\n\r\n")[1],
      ) as { method: string };

      expect(exitMsg.method).toBe("exit");
      expect(exitMsg).not.toHaveProperty("id");

      // Simulate process exiting
      mockProcess.emit("exit", 0, null);

      await stopPromise;
      expect(client.ready).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // 10. rejectAll on process exit
  // -----------------------------------------------------------------------

  describe("rejectAll on process exit", () => {
    it("should reject all pending requests when the process exits unexpectedly", async () => {
      // Arrange
      const p1 = client.sendRequest("test/one");
      const p2 = client.sendRequest("test/two");

      // Act — simulate unexpected exit
      mockProcess.emit("exit", 1, null);

      // Assert
      await expect(p1).rejects.toThrow(/LSP process exited/);
      await expect(p2).rejects.toThrow(/LSP process exited/);
    });
  });

  // -----------------------------------------------------------------------
  // 11. JSON-RPC error response
  // -----------------------------------------------------------------------

  describe("handleMessage — error response", () => {
    it("should reject pending request with LSP error details", async () => {
      // Arrange
      const requestPromise = client.sendRequest("test/error");
      const writtenBuf = mockStdin.write.mock.calls[0][0] as Buffer;
      const writtenJson = JSON.parse(
        writtenBuf.toString("utf8").split("\r\n\r\n")[1],
      ) as { id: number };

      // Act
      simulateServerData(
        encodeMessage({
          jsonrpc: "2.0",
          id: writtenJson.id,
          error: { code: -32600, message: "Invalid Request" },
        }),
      );

      // Assert
      await expect(requestPromise).rejects.toThrow("LSP error -32600: Invalid Request");
    });
  });
});
