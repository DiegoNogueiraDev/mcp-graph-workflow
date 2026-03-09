import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { recommendSkills, type SkillInfo } from "../core/insights/skill-recommender.js";
import { makeNode } from "./helpers/factories.js";

const MOCK_SKILLS: SkillInfo[] = [
  { name: "polyglot-test-generator", description: "Generate tests", category: "testing", filePath: "/skills/test" },
  { name: "code-reviewer", description: "Review code", category: "review", filePath: "/skills/review" },
  { name: "dev-flow-orchestrator", description: "Orchestrate dev flow", category: "planning", filePath: "/skills/flow" },
  { name: "create-prd-chat-mode", description: "Create PRD", category: "design", filePath: "/skills/prd" },
];

describe("recommendSkills", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Skills Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should recommend test generator for in-progress tasks without tests", () => {
    store.insertNode(makeNode({ status: "in_progress" }));
    store.insertNode(makeNode({ status: "in_progress" }));

    const doc = store.toGraphDocument();
    const recs = recommendSkills(doc, MOCK_SKILLS);

    const testRec = recs.find((r) => r.skill === "polyglot-test-generator");
    expect(testRec).toBeDefined();
    expect(testRec!.phase).toBe("IMPLEMENT");
  });

  it("should recommend replanning when many tasks are blocked", () => {
    for (let i = 0; i < 5; i++) {
      store.insertNode(makeNode({ status: "blocked", blocked: true }));
    }

    const doc = store.toGraphDocument();
    const recs = recommendSkills(doc, MOCK_SKILLS);

    const planRec = recs.find((r) => r.skill === "dev-flow-orchestrator" && r.phase === "ANALYZE");
    expect(planRec).toBeDefined();
  });

  it("should recommend PRD tool when many tasks lack AC", () => {
    for (let i = 0; i < 7; i++) {
      store.insertNode(makeNode({ status: "backlog" }));
    }

    const doc = store.toGraphDocument();
    const recs = recommendSkills(doc, MOCK_SKILLS);

    const prdRec = recs.find((r) => r.skill === "create-prd-chat-mode");
    expect(prdRec).toBeDefined();
  });

  it("should return empty recommendations for clean graph", () => {
    store.insertNode(makeNode({
      status: "done",
      acceptanceCriteria: ["Tested"],
      tags: ["tested"],
    }));

    const doc = store.toGraphDocument();
    const recs = recommendSkills(doc, MOCK_SKILLS);

    expect(recs.length).toBe(0);
  });
});
