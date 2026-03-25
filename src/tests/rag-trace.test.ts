import { describe, it, expect, beforeEach } from "vitest";
import { RagTracer, type RagTrace, type RagStageTrace } from "../core/rag/rag-trace.js";

describe("rag-trace", () => {
  let tracer: RagTracer;

  beforeEach(() => {
    tracer = new RagTracer("test query");
  });

  describe("stage tracking", () => {
    it("should record a stage with latency", () => {
      tracer.startStage("query_understanding");
      tracer.endStage("query_understanding", { inputCount: 1, outputCount: 1 });

      const trace = tracer.finalize();

      expect(trace.stages).toHaveLength(1);
      expect(trace.stages[0].stage).toBe("query_understanding");
      expect(trace.stages[0].latencyMs).toBeGreaterThanOrEqual(0);
      expect(trace.stages[0].inputCount).toBe(1);
      expect(trace.stages[0].outputCount).toBe(1);
    });

    it("should track multiple stages sequentially", () => {
      tracer.startStage("query_understanding");
      tracer.endStage("query_understanding", { inputCount: 1, outputCount: 3 });

      tracer.startStage("retrieval");
      tracer.endStage("retrieval", { inputCount: 3, outputCount: 10 });

      tracer.startStage("post_retrieval");
      tracer.endStage("post_retrieval", { inputCount: 10, outputCount: 7 });

      const trace = tracer.finalize();

      expect(trace.stages).toHaveLength(3);
      expect(trace.stages.map((s) => s.stage)).toEqual([
        "query_understanding",
        "retrieval",
        "post_retrieval",
      ]);
    });
  });

  describe("finalize", () => {
    it("should compute total latency from all stages", () => {
      tracer.startStage("retrieval");
      tracer.endStage("retrieval", { inputCount: 1, outputCount: 5 });

      const trace = tracer.finalize();

      expect(trace.totalLatencyMs).toBeGreaterThanOrEqual(0);
      expect(trace.query).toBe("test query");
      expect(trace.traceId).toBeTruthy();
      expect(trace.timestamp).toBeTruthy();
    });

    it("should record sources contributed", () => {
      tracer.recordSourceContribution("prd", 3);
      tracer.recordSourceContribution("docs", 2);

      const trace = tracer.finalize();

      expect(trace.sourcesContributed["prd"]).toBe(3);
      expect(trace.sourcesContributed["docs"]).toBe(2);
    });

    it("should record citation count", () => {
      tracer.setCitationCount(5);

      const trace = tracer.finalize();

      expect(trace.citationCount).toBe(5);
    });

    it("should record total tokens used", () => {
      tracer.setTokensUsed(1500);

      const trace = tracer.finalize();

      expect(trace.totalTokensUsed).toBe(1500);
    });
  });

  describe("serialization", () => {
    it("should produce valid JSON from trace", () => {
      tracer.startStage("retrieval");
      tracer.endStage("retrieval", { inputCount: 1, outputCount: 5 });
      tracer.recordSourceContribution("memory", 1);

      const trace = tracer.finalize();
      const json = JSON.stringify(trace);

      expect(() => JSON.parse(json)).not.toThrow();
      const parsed = JSON.parse(json) as RagTrace;
      expect(parsed.stages).toHaveLength(1);
      expect(parsed.sourcesContributed["memory"]).toBe(1);
    });
  });
});
