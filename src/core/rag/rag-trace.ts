/**
 * RAG Trace — observability for the RAG pipeline.
 *
 * Instruments each stage (query understanding, retrieval, post-retrieval,
 * assembly, citation) with timing, input/output counts, and source contributions.
 */

import { generateId } from "../utils/id.js";
import { now } from "../utils/time.js";

export type RagStageName =
  | "query_understanding"
  | "retrieval"
  | "post_retrieval"
  | "assembly"
  | "citation";

export interface RagStageTrace {
  stage: RagStageName;
  latencyMs: number;
  inputCount: number;
  outputCount: number;
  details: Record<string, unknown>;
}

export interface RagTrace {
  traceId: string;
  query: string;
  timestamp: string;
  stages: RagStageTrace[];
  totalLatencyMs: number;
  totalTokensUsed: number;
  sourcesContributed: Record<string, number>;
  citationCount: number;
}

/**
 * Tracer instance — tracks stages during a single RAG pipeline execution.
 */
export class RagTracer {
  private traceId: string;
  private query: string;
  private timestamp: string;
  private stages: RagStageTrace[] = [];
  private stageStartTimes: Map<string, number> = new Map();
  private sourcesContributed: Record<string, number> = {};
  private citationCount: number = 0;
  private totalTokensUsed: number = 0;

  constructor(query: string) {
    this.traceId = generateId("trace");
    this.query = query;
    this.timestamp = now();
  }

  /**
   * Mark the start of a pipeline stage.
   */
  startStage(stage: RagStageName): void {
    this.stageStartTimes.set(stage, performance.now());
  }

  /**
   * Mark the end of a pipeline stage with input/output counts.
   */
  endStage(
    stage: RagStageName,
    counts: { inputCount: number; outputCount: number; details?: Record<string, unknown> },
  ): void {
    const startTime = this.stageStartTimes.get(stage) ?? performance.now();
    const latencyMs = Math.round(performance.now() - startTime);

    this.stages.push({
      stage,
      latencyMs,
      inputCount: counts.inputCount,
      outputCount: counts.outputCount,
      details: counts.details ?? {},
    });

    this.stageStartTimes.delete(stage);
  }

  /**
   * Record how many results came from a specific source type.
   */
  recordSourceContribution(sourceType: string, count: number): void {
    this.sourcesContributed[sourceType] = (this.sourcesContributed[sourceType] ?? 0) + count;
  }

  /**
   * Set the number of citations produced.
   */
  setCitationCount(count: number): void {
    this.citationCount = count;
  }

  /**
   * Set total tokens consumed by the assembled context.
   */
  setTokensUsed(tokens: number): void {
    this.totalTokensUsed = tokens;
  }

  /**
   * Finalize the trace and return the complete record.
   */
  finalize(): RagTrace {
    const totalLatencyMs = this.stages.reduce((sum, s) => sum + s.latencyMs, 0);

    return {
      traceId: this.traceId,
      query: this.query,
      timestamp: this.timestamp,
      stages: [...this.stages],
      totalLatencyMs,
      totalTokensUsed: this.totalTokensUsed,
      sourcesContributed: { ...this.sourcesContributed },
      citationCount: this.citationCount,
    };
  }
}
