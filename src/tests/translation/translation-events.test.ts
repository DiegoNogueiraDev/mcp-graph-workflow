import { describe, it, expect } from "vitest";
import type {
  TranslationJobCreatedEvent,
  TranslationAnalyzedEvent,
  TranslationFinalizedEvent,
  TranslationErrorEvent,
} from "../../core/events/event-types.js";

describe("translation event types", () => {
  it("should type-check TranslationJobCreatedEvent", () => {
    const event: TranslationJobCreatedEvent = {
      type: "translation:job_created",
      timestamp: new Date().toISOString(),
      payload: { jobId: "j1", sourceLanguage: "typescript", targetLanguage: "python" },
    };
    expect(event.type).toBe("translation:job_created");
    expect(event.payload.jobId).toBe("j1");
    expect(event.payload.sourceLanguage).toBe("typescript");
    expect(event.payload.targetLanguage).toBe("python");
  });

  it("should type-check TranslationAnalyzedEvent", () => {
    const event: TranslationAnalyzedEvent = {
      type: "translation:analyzed",
      timestamp: new Date().toISOString(),
      payload: { jobId: "j1", constructCount: 5, complexity: 0.6 },
    };
    expect(event.type).toBe("translation:analyzed");
    expect(event.payload.constructCount).toBe(5);
    expect(event.payload.complexity).toBe(0.6);
  });

  it("should type-check TranslationFinalizedEvent", () => {
    const event: TranslationFinalizedEvent = {
      type: "translation:finalized",
      timestamp: new Date().toISOString(),
      payload: { jobId: "j1", confidence: 0.85, evidenceCount: 3 },
    };
    expect(event.type).toBe("translation:finalized");
    expect(event.payload.confidence).toBe(0.85);
    expect(event.payload.evidenceCount).toBe(3);
  });

  it("should type-check TranslationErrorEvent", () => {
    const event: TranslationErrorEvent = {
      type: "translation:error",
      timestamp: new Date().toISOString(),
      payload: { jobId: "j1", errorMessage: "Parse failed" },
    };
    expect(event.type).toBe("translation:error");
    expect(event.payload.errorMessage).toBe("Parse failed");
  });
});
