import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { GraphEventBus } from "../core/events/event-bus.js";
import {
  categorizeError,
  generateErrorHash,
  buildHealingMemory,
  registerSelfHealingListener,
} from "../core/skills/self-healing-listener.js";

describe("categorizeError", () => {
  it("should categorize type errors", () => {
    expect(categorizeError("TypeError: Cannot read property")).toBe("type-error");
    expect(categorizeError("type mismatch in function")).toBe("type-error");
  });

  it("should categorize validation errors", () => {
    expect(categorizeError("Zod validation failed")).toBe("validation-error");
    expect(categorizeError("Invalid input parameter")).toBe("validation-error");
  });

  it("should categorize build errors", () => {
    expect(categorizeError("Build failed: tsc error")).toBe("build-error");
    expect(categorizeError("Compile error in module")).toBe("build-error");
  });

  it("should categorize test failures", () => {
    expect(categorizeError("Test failed: expected 3 but got 5")).toBe("test-failure");
    expect(categorizeError("AssertionError in test suite")).toBe("test-failure");
  });

  it("should categorize database errors", () => {
    expect(categorizeError("SQLite constraint violation")).toBe("database-error");
    expect(categorizeError("Migration 9 failed")).toBe("database-error");
  });

  it("should categorize module errors", () => {
    expect(categorizeError("Cannot import from ./missing.js")).toBe("module-error");
  });

  it("should fall back to general-error", () => {
    expect(categorizeError("something went wrong")).toBe("general-error");
  });
});

describe("generateErrorHash", () => {
  it("should produce consistent hashes for same input", () => {
    const h1 = generateErrorHash("type-error", "Cannot read property X");
    const h2 = generateErrorHash("type-error", "Cannot read property X");
    expect(h1).toBe(h2);
  });

  it("should produce different hashes for different categories", () => {
    const h1 = generateErrorHash("type-error", "some error");
    const h2 = generateErrorHash("build-error", "some error");
    expect(h1).not.toBe(h2);
  });

  it("should normalize timestamps out of the message", () => {
    const h1 = generateErrorHash("type-error", "Error at 2026-03-18T10:00:00.000Z");
    const h2 = generateErrorHash("type-error", "Error at 2026-03-19T15:30:00.000Z");
    expect(h1).toBe(h2);
  });

  it("should return 12-char hex string", () => {
    const hash = generateErrorHash("general-error", "test");
    expect(hash).toMatch(/^[a-f0-9]{12}$/);
  });
});

describe("buildHealingMemory", () => {
  it("should include error pattern and tool name", () => {
    const content = buildHealingMemory("type-error", "Cannot read X", "update_node");
    expect(content).toContain("# Self-Healing: type-error");
    expect(content).toContain("Cannot read X");
    expect(content).toContain("update_node");
    expect(content).toContain("## Prevention Rule");
  });
});

describe("registerSelfHealingListener", () => {
  let tempDir: string;
  let eventBus: GraphEventBus;
  let unsubscribe: () => void;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "healing-test-"));
    eventBus = new GraphEventBus();
    unsubscribe = registerSelfHealingListener({
      memoriesDir: tempDir,
      eventBus,
    });
  });

  afterEach(() => {
    unsubscribe();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should create a memory file when error:detected is emitted", () => {
    eventBus.emitTyped("error:detected", {
      toolName: "update_status",
      errorMessage: "Type error in node validation",
      errorCategory: "type-error",
      errorHash: "abc123def456",
    });

    const memoryPath = path.join(tempDir, "healing-type-error-abc123def456.md");
    expect(existsSync(memoryPath)).toBe(true);
    const content = readFileSync(memoryPath, "utf-8");
    expect(content).toContain("# Self-Healing: type-error");
    expect(content).toContain("update_status");
  });

  it("should deduplicate — not overwrite existing memory", () => {
    eventBus.emitTyped("error:detected", {
      toolName: "update_status",
      errorMessage: "Same error",
      errorCategory: "type-error",
      errorHash: "dedup123test",
    });

    const memoryPath = path.join(tempDir, "healing-type-error-dedup123test.md");
    const firstContent = readFileSync(memoryPath, "utf-8");

    // Emit again — should not overwrite
    eventBus.emitTyped("error:detected", {
      toolName: "delete_node",
      errorMessage: "Different tool same hash",
      errorCategory: "type-error",
      errorHash: "dedup123test",
    });

    const secondContent = readFileSync(memoryPath, "utf-8");
    expect(secondContent).toBe(firstContent);
  });

  it("should emit healing:memory_created event", () => {
    let emittedPayload: Record<string, unknown> | null = null;
    eventBus.on("healing:memory_created", (event) => {
      emittedPayload = event.payload;
    });

    eventBus.emitTyped("error:detected", {
      toolName: "import_prd",
      errorMessage: "Validation failed",
      errorCategory: "validation-error",
      errorHash: "heal123event",
    });

    expect(emittedPayload).not.toBeNull();
    expect(emittedPayload!.memoryName).toBe("healing-validation-error-heal123event");
  });

  it("should unsubscribe correctly", () => {
    unsubscribe();

    eventBus.emitTyped("error:detected", {
      toolName: "test",
      errorMessage: "After unsub",
      errorCategory: "general-error",
      errorHash: "unsub123test",
    });

    const memoryPath = path.join(tempDir, "healing-general-error-unsub123test.md");
    expect(existsSync(memoryPath)).toBe(false);
  });
});
