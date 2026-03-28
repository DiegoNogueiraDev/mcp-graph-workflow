/**
 * LspServerManager — Unit tests.
 *
 * Mocks LspClient and child_process to avoid starting real language servers.
 * Focuses on manager lifecycle: lazy startup, routing, keepAlive, restart logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import { ServerRegistry } from "../../core/lsp/server-registry.js";

// ---------------------------------------------------------------------------
// Mock LspClient
// ---------------------------------------------------------------------------

class MockLspClient extends EventEmitter {
  public readonly command: string;
  public readonly args: string[];
  private _ready = false;
  private _pid: number | undefined;

  constructor(command: string, args: string[], _requestTimeoutMs?: number) {
    super();
    this.command = command;
    this.args = args;
  }

  get ready(): boolean {
    return this._ready;
  }

  get pid(): number | undefined {
    return this._pid;
  }

  async start(): Promise<void> {
    this._ready = true;
    this._pid = Math.floor(Math.random() * 90000) + 10000;
  }

  async stop(): Promise<void> {
    this._ready = false;
    this._pid = undefined;
  }

  async sendRequest<T = unknown>(_method: string, _params?: unknown): Promise<T> {
    return {} as T;
  }

  sendNotification(_method: string, _params?: unknown): void {
    // no-op
  }

  kill(): void {
    this._ready = false;
    this._pid = undefined;
  }

  /** Simulate a crash (emit exit event) */
  simulateCrash(code: number | null = 1): void {
    this._ready = false;
    this._pid = undefined;
    this.emit("exit", code, null);
  }
}

// Mock the lsp-client module so LspServerManager uses MockLspClient
vi.mock("../../core/lsp/lsp-client.js", () => ({
  LspClient: MockLspClient,
}));

// Mock child_process.exec for isServerInstalled
const mockExecAsync = vi.fn<(cmd: string) => Promise<{ stdout: string; stderr: string }>>();

vi.mock("node:child_process", () => ({
  exec: (
    cmd: string,
    callback: (error: Error | null, result: { stdout: string; stderr: string }) => void,
  ) => {
    mockExecAsync(cmd)
      .then((result) => callback(null, result))
      .catch((err: unknown) => callback(err as Error, { stdout: "", stderr: "" }));
  },
  spawn: vi.fn(),
}));

// Mock node:fs to control resolveLocalBin behavior
const mockExistsSync = vi.fn<(p: string | URL) => boolean>().mockReturnValue(false);
vi.mock("node:fs", () => ({
  existsSync: (...args: [string | URL]) => mockExistsSync(...args),
}));

// Import after mocking
const { LspServerManager } = await import("../../core/lsp/lsp-server-manager.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createManager(keepAliveMs = 60_000): InstanceType<typeof LspServerManager> {
  const registry = new ServerRegistry();
  return new LspServerManager(registry, "file:///project", keepAliveMs);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LspServerManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: all binaries are installed
    mockExecAsync.mockResolvedValue({ stdout: "/usr/bin/tool", stderr: "" });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // 1. ensureServer returns null for unknown language
  // -----------------------------------------------------------------------
  it("should return null for unknown language", async () => {
    const manager = createManager();
    const client = await manager.ensureServer("fortran");

    expect(client).toBeNull();
  });

  // -----------------------------------------------------------------------
  // 2. ensureServer starts server lazily; second call returns same instance
  // -----------------------------------------------------------------------
  it("should start server lazily and return same instance on second call", async () => {
    const manager = createManager();

    const client1 = await manager.ensureServer("typescript");
    expect(client1).not.toBeNull();
    expect(client1).toBeInstanceOf(MockLspClient);

    const client2 = await manager.ensureServer("typescript");
    expect(client2).toBe(client1);
  });

  // -----------------------------------------------------------------------
  // 3. getClientForFile routes by extension
  // -----------------------------------------------------------------------
  it("should route main.py to python server", async () => {
    const manager = createManager();

    const pyClient = await manager.getClientForFile("/project/main.py");
    expect(pyClient).not.toBeNull();

    // Verify it's the python server by checking status
    const status = manager.getStatus();
    const pythonState = status.get("python");
    expect(pythonState?.status).toBe("ready");
  });

  it("should route app.ts to typescript server", async () => {
    const manager = createManager();

    const tsClient = await manager.getClientForFile("/project/app.ts");
    expect(tsClient).not.toBeNull();

    const status = manager.getStatus();
    const tsState = status.get("typescript");
    expect(tsState?.status).toBe("ready");
  });

  // -----------------------------------------------------------------------
  // 4. getClientForFile returns null for unknown extension
  // -----------------------------------------------------------------------
  it("should return null for unknown file extension", async () => {
    const manager = createManager();
    const client = await manager.getClientForFile("/project/file.xyz");

    expect(client).toBeNull();
  });

  // -----------------------------------------------------------------------
  // 5. shutdownAll stops all running servers
  // -----------------------------------------------------------------------
  it("should stop all running servers on shutdownAll", async () => {
    const manager = createManager();

    const ts = await manager.ensureServer("typescript");
    const py = await manager.ensureServer("python");
    expect(ts).not.toBeNull();
    expect(py).not.toBeNull();

    const stopSpyTs = vi.spyOn(ts as unknown as MockLspClient, "stop");
    const stopSpyPy = vi.spyOn(py as unknown as MockLspClient, "stop");

    await manager.shutdownAll();

    expect(stopSpyTs).toHaveBeenCalled();
    expect(stopSpyPy).toHaveBeenCalled();

    // Status map should be empty after clear
    const status = manager.getStatus();
    // Servers from registry still show as "stopped"
    expect(status.get("typescript")?.status).toBe("stopped");
    expect(status.get("python")?.status).toBe("stopped");
  });

  // -----------------------------------------------------------------------
  // 6. getStatus returns all server states
  // -----------------------------------------------------------------------
  it("should return ready for started and stopped for not-started servers", async () => {
    const manager = createManager();

    await manager.ensureServer("typescript");
    const status = manager.getStatus();

    expect(status.get("typescript")?.status).toBe("ready");
    expect(status.get("python")?.status).toBe("stopped");
    expect(status.get("rust")?.status).toBe("stopped");
  });

  // -----------------------------------------------------------------------
  // 7. keep-alive timer stops server after timeout
  // -----------------------------------------------------------------------
  it("should stop server after keep-alive timeout", async () => {
    vi.useFakeTimers();

    const keepAliveMs = 5_000;
    const manager = createManager(keepAliveMs);

    const client = await manager.ensureServer("typescript");
    expect(client).not.toBeNull();

    const stopSpy = vi.spyOn(client as unknown as MockLspClient, "stop");

    // Advance past the keep-alive timeout
    await vi.advanceTimersByTimeAsync(keepAliveMs + 100);

    expect(stopSpy).toHaveBeenCalled();

    const status = manager.getStatus();
    // After stop + deletion, it should show as "stopped" from registry
    expect(status.get("typescript")?.status).toBe("stopped");
  });

  // -----------------------------------------------------------------------
  // 8. auto-restart on crash up to 3 times
  // -----------------------------------------------------------------------
  it("should auto-restart on crash with increasing delay", async () => {
    vi.useFakeTimers();

    const manager = createManager(60_000);
    const client = await manager.ensureServer("typescript");
    expect(client).not.toBeNull();

    const mockClient = client as unknown as MockLspClient;

    // First crash
    mockClient.simulateCrash(1);

    // Wait for 1s exponential backoff (1000 * 2^0)
    await vi.advanceTimersByTimeAsync(1100);

    // Should have restarted — status should be "ready" again
    const status1 = manager.getStatus();
    expect(status1.get("typescript")?.status).toBe("ready");
  });

  // -----------------------------------------------------------------------
  // 9. no restart after max attempts
  // -----------------------------------------------------------------------
  it("should not restart after max restart attempts", async () => {
    vi.useFakeTimers();

    const manager = createManager(60_000);
    const client = await manager.ensureServer("typescript");
    expect(client).not.toBeNull();

    // Simulate 3 crashes (max attempts)
    for (let i = 0; i < MAX_RESTART_ATTEMPTS; i++) {
      const currentStatus = manager.getStatus();
      const tsState = currentStatus.get("typescript");

      if (tsState?.status === "ready") {
        // Get the current managed server's client to crash it
        const currentClient = await manager.ensureServer("typescript");
        if (currentClient) {
          (currentClient as unknown as MockLspClient).simulateCrash(1);
          // Wait for exponential backoff: 1000 * 2^i
          const delay = 1000 * Math.pow(2, i);
          await vi.advanceTimersByTimeAsync(delay + 100);
        }
      }
    }

    // Now simulate one more crash — should NOT restart
    const lastClient = await manager.ensureServer("typescript");
    if (lastClient) {
      (lastClient as unknown as MockLspClient).simulateCrash(1);
      await vi.advanceTimersByTimeAsync(10_000);
    }

    const finalStatus = manager.getStatus();
    const tsState = finalStatus.get("typescript");
    expect(tsState?.status).toBe("error");
  });

  // -----------------------------------------------------------------------
  // 10. isServerInstalled returns false for missing binary
  // -----------------------------------------------------------------------
  it("should return false when server binary is not installed", async () => {
    mockExecAsync.mockRejectedValue(new Error("not found"));

    const manager = createManager();
    const installed = await manager.isServerInstalled("typescript");

    expect(installed).toBe(false);
  });

  it("should return true when server binary is installed", async () => {
    mockExecAsync.mockResolvedValue({ stdout: "/usr/bin/typescript-language-server", stderr: "" });

    const manager = createManager();
    const installed = await manager.isServerInstalled("typescript");

    expect(installed).toBe(true);
  });

  it("should return null from ensureServer when binary is not installed", async () => {
    mockExecAsync.mockRejectedValue(new Error("not found"));

    const manager = createManager();
    const client = await manager.ensureServer("typescript");

    expect(client).toBeNull();
  });

  it("should return false for isServerInstalled with unknown language", async () => {
    const manager = createManager();
    const installed = await manager.isServerInstalled("brainfuck");

    expect(installed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Constant used in tests — must match the source
// ---------------------------------------------------------------------------
const MAX_RESTART_ATTEMPTS = 3;
