import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { indexSkills } from "../core/rag/skill-indexer.js";
import { BUILT_IN_SKILLS } from "../core/skills/built-in-skills.js";

describe("indexSkills", () => {
  let sqliteStore: SqliteStore;
  let knowledgeStore: KnowledgeStore;

  beforeEach(() => {
    sqliteStore = SqliteStore.open(":memory:");
    sqliteStore.initProject("Test Project");
    knowledgeStore = new KnowledgeStore(sqliteStore.getDb());
  });

  afterEach(() => {
    sqliteStore.close();
  });

  it("should index all built-in skills", async () => {
    const result = await indexSkills(knowledgeStore, "/nonexistent-path");

    expect(result.builtInIndexed).toBe(BUILT_IN_SKILLS.length);
    expect(result.skippedDuplicates).toBe(0);
  });

  it("should store skills with sourceType 'skill'", async () => {
    await indexSkills(knowledgeStore, "/nonexistent-path");

    const count = knowledgeStore.count("skill");
    expect(count).toBe(BUILT_IN_SKILLS.length);
  });

  it("should store correct metadata for built-in skills", async () => {
    await indexSkills(knowledgeStore, "/nonexistent-path");

    const docs = knowledgeStore.list({ sourceType: "skill" });
    const codeReviewer = docs.find((d) => d.sourceId === "skill:code-reviewer");

    expect(codeReviewer).toBeDefined();
    expect(codeReviewer!.metadata).toBeDefined();
    expect(codeReviewer!.metadata!.category).toBe("review");
    expect(codeReviewer!.metadata!.phases).toContain("REVIEW");
    expect(codeReviewer!.metadata!.source).toBe("built-in");
  });

  it("should deduplicate on re-index", async () => {
    await indexSkills(knowledgeStore, "/nonexistent-path");
    const firstCount = knowledgeStore.count("skill");

    const result = await indexSkills(knowledgeStore, "/nonexistent-path");

    expect(knowledgeStore.count("skill")).toBe(firstCount);
    expect(result.skippedDuplicates).toBe(BUILT_IN_SKILLS.length);
    expect(result.builtInIndexed).toBe(0);
  });

  it("should be searchable via FTS", async () => {
    await indexSkills(knowledgeStore, "/nonexistent-path");

    const results = knowledgeStore.search("code review checklist", 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.sourceId.startsWith("skill:"))).toBe(true);
  });
});
