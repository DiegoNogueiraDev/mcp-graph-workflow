import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { validateAcQuality } from "../core/analyzer/ac-validator.js";
import { makeNode } from "./helpers/factories.js";

describe("validateAcQuality", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("AC Validator Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should return empty report when no nodes have AC", () => {
    store.insertNode(makeNode({ type: "task", title: "No AC" }));

    const doc = store.toGraphDocument();
    const report = validateAcQuality(doc);

    expect(report.nodes).toHaveLength(0);
    expect(report.overallScore).toBe(0);
  });

  it("should validate a node with good GWT AC", () => {
    store.insertNode(makeNode({
      type: "task",
      title: "Login feature",
      acceptanceCriteria: [
        "Given a registered user\nWhen they submit valid credentials\nThen they should be redirected to dashboard",
      ],
    }));

    const doc = store.toGraphDocument();
    const report = validateAcQuality(doc);

    expect(report.nodes).toHaveLength(1);
    expect(report.nodes[0].score).toBeGreaterThan(0);
    expect(report.nodes[0].parsedAcs[0].format).toBe("gwt");
  });

  it("should detect vague terms", () => {
    store.insertNode(makeNode({
      type: "task",
      title: "Vague task",
      acceptanceCriteria: ["The page should load fast and be easy to use"],
    }));

    const doc = store.toGraphDocument();
    const report = validateAcQuality(doc);

    expect(report.nodes[0].vagueTerms.length).toBeGreaterThan(0);
  });

  it("should run INVEST checks", () => {
    store.insertNode(makeNode({
      type: "task",
      title: "Well-defined task",
      acceptanceCriteria: [
        "O sistema deve retornar status 200 com JSON contendo o campo 'id'",
        "O sistema deve rejeitar requests sem token de autenticação com status 401",
      ],
    }));

    const doc = store.toGraphDocument();
    const report = validateAcQuality(doc);

    expect(report.nodes[0].investChecks.length).toBe(6); // I, N, V, E, S, T
    const criteriaNames = report.nodes[0].investChecks.map((c) => c.criterion);
    expect(criteriaNames).toContain("Independent");
    expect(criteriaNames).toContain("Testable");
  });

  it("should filter by nodeId", () => {
    const target = makeNode({
      type: "task",
      title: "Target",
      acceptanceCriteria: ["Must return data"],
    });
    store.insertNode(target);
    store.insertNode(makeNode({
      type: "task",
      title: "Other",
      acceptanceCriteria: ["Other AC"],
    }));

    const doc = store.toGraphDocument();
    const report = validateAcQuality(doc, target.id);

    expect(report.nodes).toHaveLength(1);
    expect(report.nodes[0].nodeId).toBe(target.id);
  });

  it("should flag implementation details in AC", () => {
    store.insertNode(makeNode({
      type: "task",
      title: "Implementation-heavy AC",
      acceptanceCriteria: [
        "Execute SQL query SELECT * FROM users WHERE id = :id",
      ],
    }));

    const doc = store.toGraphDocument();
    const report = validateAcQuality(doc);

    const negotiableCheck = report.nodes[0].investChecks.find((c) => c.criterion === "Negotiable");
    expect(negotiableCheck!.passed).toBe(false);
  });
});
