import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { indexCommand } from "../cli/commands/index-cmd.js";
import { SqliteStore } from "../core/store/sqlite-store.js";

// Mock the indexing modules
vi.mock("../core/rag/serena-indexer.js", () => ({
  indexSerenaMemories: vi.fn(async () => ({
    memoriesFound: 3,
    documentsIndexed: 2,
  })),
}));

vi.mock("../core/rag/docs-indexer.js", () => ({
  indexCachedDocs: vi.fn(() => ({
    docsFound: 5,
    documentsIndexed: 4,
  })),
}));

vi.mock("../core/rag/rag-pipeline.js", () => ({
  indexAllEmbeddings: vi.fn(async () => ({
    nodes: 10,
    knowledge: 7,
  })),
}));

describe("indexCommand", () => {
  let store: SqliteStore;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    store.close();
    stdoutSpy.mockRestore();
  });

  it("should create a Commander command with correct name and options", () => {
    const cmd = indexCommand();

    expect(cmd.name()).toBe("index");
    expect(cmd.description()).toContain("Reindex");
  });

  it("should have --dir and --json options", () => {
    const cmd = indexCommand();
    const options = cmd.options.map((o) => o.long);

    expect(options).toContain("--dir");
    expect(options).toContain("--json");
  });

  it("should execute indexing and print text output", async () => {
    // Patch SqliteStore.open to return our in-memory store
    const openSpy = vi.spyOn(SqliteStore, "open").mockReturnValue(store);
    const closeSpy = vi.spyOn(store, "close").mockImplementation(() => {});

    const cmd = indexCommand();
    await cmd.parseAsync(["node", "index", "--dir", "/tmp/test"]);

    const allOutput = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(allOutput).toContain("Knowledge indexing complete:");
    expect(allOutput).toContain("Serena memories: 3 found, 2 indexed");
    expect(allOutput).toContain("Docs cache: 5 found, 4 indexed");
    expect(allOutput).toContain("Embeddings: 10 nodes + 7 knowledge");

    openSpy.mockRestore();
    closeSpy.mockRestore();
  });

  it("should output JSON when --json flag is used", async () => {
    const openSpy = vi.spyOn(SqliteStore, "open").mockReturnValue(store);
    const closeSpy = vi.spyOn(store, "close").mockImplementation(() => {});

    const cmd = indexCommand();
    await cmd.parseAsync(["node", "index", "--dir", "/tmp/test", "--json"]);

    const allOutput = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    const output = JSON.parse(allOutput);
    expect(output.serena).toEqual({ memoriesFound: 3, documentsIndexed: 2 });
    expect(output.docs).toEqual({ docsFound: 5, documentsIndexed: 4 });
    expect(output.embeddings).toEqual({ nodes: 10, knowledge: 7 });
    expect(typeof output.totalKnowledge).toBe("number");

    openSpy.mockRestore();
    closeSpy.mockRestore();
  });
});
