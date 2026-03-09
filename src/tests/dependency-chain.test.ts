import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import {
  findTransitiveBlockers,
  detectCycles,
  findCriticalPath,
} from "../core/planner/dependency-chain.js";
import { makeNode, makeEdge } from "./helpers/factories.js";

describe("dependency-chain", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Deps Test");
  });

  afterEach(() => {
    store.close();
  });

  describe("findTransitiveBlockers", () => {
    it("finds linear chain blockers A→B→C", () => {
      const a = makeNode({ title: "A" });
      const b = makeNode({ title: "B" });
      const c = makeNode({ title: "C" });
      store.insertNode(a);
      store.insertNode(b);
      store.insertNode(c);

      // C depends_on B, B depends_on A
      store.insertEdge(makeEdge(c.id, b.id)); // c depends_on b
      store.insertEdge(makeEdge(b.id, a.id)); // b depends_on a

      const doc = store.toGraphDocument();
      const blockers = findTransitiveBlockers(doc, c.id);

      const ids = blockers.map((n) => n.id);
      expect(ids).toContain(a.id);
      expect(ids).toContain(b.id);
      expect(blockers).toHaveLength(2);
    });

    it("finds diamond dependency blockers", () => {
      const a = makeNode({ title: "A" });
      const b = makeNode({ title: "B" });
      const c = makeNode({ title: "C" });
      const d = makeNode({ title: "D" });
      store.insertNode(a);
      store.insertNode(b);
      store.insertNode(c);
      store.insertNode(d);

      // D depends_on B, D depends_on C, B depends_on A, C depends_on A
      store.insertEdge(makeEdge(d.id, b.id));
      store.insertEdge(makeEdge(d.id, c.id));
      store.insertEdge(makeEdge(b.id, a.id));
      store.insertEdge(makeEdge(c.id, a.id));

      const doc = store.toGraphDocument();
      const blockers = findTransitiveBlockers(doc, d.id);

      const ids = blockers.map((n) => n.id);
      expect(ids).toContain(a.id);
      expect(ids).toContain(b.id);
      expect(ids).toContain(c.id);
      expect(blockers).toHaveLength(3);
    });
  });

  describe("detectCycles", () => {
    it("detects a simple cycle A↔B", () => {
      const a = makeNode({ title: "A" });
      const b = makeNode({ title: "B" });
      store.insertNode(a);
      store.insertNode(b);

      store.insertEdge(makeEdge(a.id, b.id)); // a depends_on b
      store.insertEdge(makeEdge(b.id, a.id)); // b depends_on a

      const doc = store.toGraphDocument();
      const cycles = detectCycles(doc);

      expect(cycles.length).toBeGreaterThan(0);
      // At least one cycle should contain both a and b
      const hasCycle = cycles.some(
        (c) => c.includes(a.id) && c.includes(b.id),
      );
      expect(hasCycle).toBe(true);
    });

    it("returns empty for DAG", () => {
      const a = makeNode({ title: "A" });
      const b = makeNode({ title: "B" });
      const c = makeNode({ title: "C" });
      store.insertNode(a);
      store.insertNode(b);
      store.insertNode(c);

      store.insertEdge(makeEdge(b.id, a.id)); // b depends_on a
      store.insertEdge(makeEdge(c.id, b.id)); // c depends_on b

      const doc = store.toGraphDocument();
      const cycles = detectCycles(doc);

      expect(cycles).toHaveLength(0);
    });
  });

  describe("findCriticalPath", () => {
    it("picks the longest estimate chain", () => {
      const a = makeNode({ title: "A", estimateMinutes: 30 });
      const b = makeNode({ title: "B", estimateMinutes: 120 });
      const c = makeNode({ title: "C", estimateMinutes: 10 });
      store.insertNode(a);
      store.insertNode(b);
      store.insertNode(c);

      // b depends_on a (chain: a→b = 30+120=150)
      // c is standalone (10)
      store.insertEdge(makeEdge(b.id, a.id));

      const doc = store.toGraphDocument();
      const path = findCriticalPath(doc);

      expect(path.length).toBeGreaterThanOrEqual(2);
      expect(path[0].id).toBe(a.id);
      expect(path[1].id).toBe(b.id);
    });
  });
});
