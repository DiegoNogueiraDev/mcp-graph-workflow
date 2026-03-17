/**
 * Integration tests for the 8 new analyze modes added in VALIDATE/REVIEW/HANDOFF/LISTENING gates.
 * Tests the full flow: SqliteStore → core function → report format.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { makeNode, makeEdge, makeDoneTask } from "./helpers/factories.js";
import { checkValidationReadiness } from "../core/validator/definition-of-ready.js";
import { checkDoneIntegrity } from "../core/validator/done-integrity-checker.js";
import { checkStatusFlow } from "../core/validator/status-flow-checker.js";
import { checkReviewReadiness } from "../core/reviewer/review-readiness.js";
import { checkHandoffReadiness } from "../core/handoff/delivery-checklist.js";
import { checkDocCompleteness } from "../core/handoff/doc-completeness.js";
import { checkListeningReadiness } from "../core/listener/feedback-readiness.js";
import { analyzeBacklogHealth } from "../core/listener/backlog-health.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";

describe("Analyze modes integration (store → core → report)", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test Project");
  });

  afterEach(() => {
    store.close();
  });

  // ── validate_ready ──

  describe("validate_ready", () => {
    it("should return not ready when no tasks exist", () => {
      const doc = store.toGraphDocument();
      const report = checkValidationReadiness(doc);
      expect(report.ready).toBe(false);
      expect(report.checks).toBeDefined();
      expect(report.score).toBeGreaterThanOrEqual(0);
      expect(report.grade).toBeDefined();
      expect(report.summary).toBeDefined();
    });

    it("should return ready when ≥50% done with AC and no issues", () => {
      store.insertNode(makeNode({
        status: "done",
        acceptanceCriteria: ["Given X When Y Then Z"],
        updatedAt: new Date(Date.now() + 1000).toISOString(),
      }));
      store.insertNode(makeNode({ status: "backlog" }));

      const doc = store.toGraphDocument();
      const report = checkValidationReadiness(doc);
      expect(report.ready).toBe(true);
      expect(report.checks.filter((c) => c.severity === "required").every((c) => c.passed)).toBe(true);
    });

    it("should block when done task has integrity issue (blocked=true)", () => {
      store.insertNode(makeNode({
        status: "done",
        blocked: true,
        acceptanceCriteria: ["Given X When Y Then Z"],
      }));

      const doc = store.toGraphDocument();
      const report = checkValidationReadiness(doc);
      const check = report.checks.find((c) => c.name === "done_integrity");
      expect(check?.passed).toBe(false);
    });
  });

  // ── done_integrity ──

  describe("done_integrity", () => {
    it("should pass with clean done tasks", () => {
      store.insertNode(makeDoneTask());
      const doc = store.toGraphDocument();
      const report = checkDoneIntegrity(doc);
      expect(report.passed).toBe(true);
      expect(report.issues).toHaveLength(0);
    });

    it("should detect blocked done task via store data", () => {
      store.insertNode(makeNode({ status: "done", blocked: true }));
      const doc = store.toGraphDocument();
      const report = checkDoneIntegrity(doc);
      expect(report.passed).toBe(false);
      expect(report.issues.some((i) => i.issueType === "blocked_but_done")).toBe(true);
    });

    it("should detect done task with non-done dependency", () => {
      const t1 = makeNode({ status: "done" });
      const t2 = makeNode({ status: "in_progress" });
      store.insertNode(t1);
      store.insertNode(t2);
      store.insertEdge(makeEdge(t1.id, t2.id, { relationType: "depends_on" }));

      const doc = store.toGraphDocument();
      const report = checkDoneIntegrity(doc);
      expect(report.passed).toBe(false);
      expect(report.issues.some((i) => i.issueType === "dependency_not_done")).toBe(true);
    });
  });

  // ── status_flow ──

  describe("status_flow", () => {
    it("should return 100% compliance when no done tasks", () => {
      store.insertNode(makeNode({ status: "backlog" }));
      const doc = store.toGraphDocument();
      const report = checkStatusFlow(doc);
      expect(report.complianceRate).toBe(100);
    });

    it("should detect task that never transitioned", () => {
      const ts = "2025-01-01T00:00:00Z";
      store.insertNode(makeNode({ status: "done", createdAt: ts, updatedAt: ts }));
      const doc = store.toGraphDocument();
      const report = checkStatusFlow(doc);
      expect(report.violations.length).toBeGreaterThan(0);
    });

    it("should pass when done task has different updatedAt", () => {
      store.insertNode(makeNode({
        status: "done",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-02T00:00:00Z",
      }));
      const doc = store.toGraphDocument();
      const report = checkStatusFlow(doc);
      expect(report.violations).toHaveLength(0);
      expect(report.complianceRate).toBe(100);
    });
  });

  // ── review_ready ──

  describe("review_ready", () => {
    it("should return not ready when <80% done", () => {
      store.insertNode(makeNode({ status: "done", acceptanceCriteria: ["AC1"] }));
      store.insertNode(makeNode({ status: "backlog" }));
      store.insertNode(makeNode({ status: "backlog" }));

      const doc = store.toGraphDocument();
      const report = checkReviewReadiness(doc);
      expect(report.ready).toBe(false);
    });

    it("should return ready when ≥80% done with AC and no blockers", () => {
      for (let i = 0; i < 4; i++) {
        store.insertNode(makeNode({ status: "done", acceptanceCriteria: ["AC1"] }));
      }
      store.insertNode(makeNode({ status: "backlog" }));

      const doc = store.toGraphDocument();
      const report = checkReviewReadiness(doc);
      expect(report.ready).toBe(true);
    });

    it("should have 10 checks with correct severity split", () => {
      store.insertNode(makeNode({ status: "done", acceptanceCriteria: ["AC1"] }));
      const doc = store.toGraphDocument();
      const report = checkReviewReadiness(doc);
      expect(report.checks).toHaveLength(10);
      expect(report.checks.filter((c) => c.severity === "required")).toHaveLength(5);
      expect(report.checks.filter((c) => c.severity === "recommended")).toHaveLength(5);
    });
  });

  // ── handoff_ready ──

  describe("handoff_ready", () => {
    it("should return not ready when tasks incomplete", () => {
      store.insertNode(makeNode({ status: "done", acceptanceCriteria: ["AC1"] }));
      store.insertNode(makeNode({ status: "in_progress" }));

      const doc = store.toGraphDocument();
      const report = checkHandoffReadiness(doc);
      expect(report.ready).toBe(false);
    });

    it("should pass knowledgeCount from opts", () => {
      store.insertNode(makeNode({ status: "done", acceptanceCriteria: ["AC1"] }));
      const doc = store.toGraphDocument();

      const reportWithout = checkHandoffReadiness(doc);
      const knowledgeCheck = reportWithout.checks.find((c) => c.name === "knowledge_captured");
      expect(knowledgeCheck?.passed).toBe(false);

      const reportWith = checkHandoffReadiness(doc, { knowledgeCount: 5 });
      const knowledgeCheckWith = reportWith.checks.find((c) => c.name === "knowledge_captured");
      expect(knowledgeCheckWith?.passed).toBe(true);
    });

    it("should integrate with real KnowledgeStore for count", () => {
      store.insertNode(makeNode({ status: "done", acceptanceCriteria: ["AC1"] }));
      const ks = new KnowledgeStore(store.getDb());
      const knowledgeCount = ks.count();
      const doc = store.toGraphDocument();
      const report = checkHandoffReadiness(doc, { knowledgeCount });
      expect(report.checks.find((c) => c.name === "knowledge_captured")).toBeDefined();
    });
  });

  // ── doc_completeness ──

  describe("doc_completeness", () => {
    it("should calculate coverage from store nodes", () => {
      store.insertNode(makeNode({ description: "Has description" }));
      store.insertNode(makeNode({}));

      const doc = store.toGraphDocument();
      const report = checkDocCompleteness(doc);
      expect(report.totalNodes).toBe(2);
      expect(report.descriptionsPresent).toBe(1);
      expect(report.coverageRate).toBe(50);
    });

    it("should list nodes without description", () => {
      const node = makeNode({ title: "No desc node" });
      store.insertNode(node);

      const doc = store.toGraphDocument();
      const report = checkDocCompleteness(doc);
      expect(report.nodesWithoutDescription.length).toBeGreaterThan(0);
    });
  });

  // ── listening_ready ──

  describe("listening_ready", () => {
    it("should return ready when all tasks done and no in_progress/blocked", () => {
      store.insertNode(makeDoneTask());
      store.insertNode(makeDoneTask());

      const doc = store.toGraphDocument();
      const report = checkListeningReadiness(doc);
      expect(report.ready).toBe(true);
    });

    it("should not be ready when in_progress tasks exist", () => {
      store.insertNode(makeDoneTask());
      store.insertNode(makeNode({ status: "in_progress" }));

      const doc = store.toGraphDocument();
      const report = checkListeningReadiness(doc);
      expect(report.ready).toBe(false);
    });

    it("should pass hasSnapshots from opts", () => {
      store.insertNode(makeDoneTask());
      const doc = store.toGraphDocument();

      const without = checkListeningReadiness(doc);
      expect(without.checks.find((c) => c.name === "has_snapshot")?.passed).toBe(false);

      const withSnap = checkListeningReadiness(doc, { hasSnapshots: true });
      expect(withSnap.checks.find((c) => c.name === "has_snapshot")?.passed).toBe(true);
    });

    it("should integrate with real listSnapshots", () => {
      store.insertNode(makeDoneTask());
      const snapshots = store.listSnapshots();
      const hasSnapshots = snapshots.length > 0;
      const doc = store.toGraphDocument();
      const report = checkListeningReadiness(doc, { hasSnapshots });
      expect(report.checks.find((c) => c.name === "has_snapshot")?.passed).toBe(hasSnapshots);
    });

    it("should have 8 checks with correct severity split", () => {
      store.insertNode(makeDoneTask());
      const doc = store.toGraphDocument();
      const report = checkListeningReadiness(doc);
      expect(report.checks).toHaveLength(8);
      expect(report.checks.filter((c) => c.severity === "required")).toHaveLength(3);
      expect(report.checks.filter((c) => c.severity === "recommended")).toHaveLength(5);
    });
  });

  // ── backlog_health ──

  describe("backlog_health", () => {
    it("should count backlog tasks from store", () => {
      store.insertNode(makeNode({ status: "backlog" }));
      store.insertNode(makeNode({ status: "backlog" }));
      store.insertNode(makeNode({ status: "ready" }));
      store.insertNode(makeDoneTask());

      const doc = store.toGraphDocument();
      const report = analyzeBacklogHealth(doc);
      expect(report.backlogCount).toBe(2);
      expect(report.readyCount).toBe(1);
    });

    it("should detect tech debt indicators from store data", () => {
      store.insertNode(makeNode({ title: "Refactor auth module", status: "backlog" }));
      store.insertNode(makeNode({ title: "Add feature X", status: "backlog" }));

      const doc = store.toGraphDocument();
      const report = analyzeBacklogHealth(doc);
      expect(report.techDebtIndicators.length).toBeGreaterThan(0);
      expect(report.techDebtIndicators[0].keywords).toContain("refactor");
    });

    it("should report cleanForNewCycle status", () => {
      store.insertNode(makeNode({ status: "backlog" }));
      const doc = store.toGraphDocument();
      const report = analyzeBacklogHealth(doc);
      expect(typeof report.cleanForNewCycle).toBe("boolean");
    });
  });
});
