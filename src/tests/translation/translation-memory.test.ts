/**
 * TDD tests for Translation Memory.
 * Task 4.7: Queryable decision memory that influences rule ranking.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { TranslationMemory, type MemoryEntry } from "../../core/translation/memory/translation-memory.js";

describe("TranslationMemory", () => {
  let memory: TranslationMemory;

  beforeEach(() => {
    memory = new TranslationMemory();
  });

  it("should record an accepted translation", () => {
    memory.recordAccepted({
      constructId: "uc_if_else",
      sourceLanguage: "typescript",
      targetLanguage: "python",
      ruleId: "ts_py_if",
      confidence: 1.0,
    });

    const entries = memory.query("uc_if_else", "typescript", "python");
    expect(entries).toHaveLength(1);
    expect(entries[0].accepted).toBe(true);
    expect(entries[0].ruleId).toBe("ts_py_if");
  });

  it("should record a corrected translation", () => {
    memory.recordCorrected({
      constructId: "uc_arrow_fn",
      sourceLanguage: "typescript",
      targetLanguage: "python",
      ruleId: "ts_py_arrow",
      originalConfidence: 0.7,
      correctionReason: "Lambda not suitable for multi-line; used def instead",
    });

    const entries = memory.query("uc_arrow_fn", "typescript", "python");
    expect(entries).toHaveLength(1);
    expect(entries[0].accepted).toBe(false);
    expect(entries[0].correctionReason).toBeDefined();
  });

  it("should boost confidence for accepted rules", () => {
    memory.recordAccepted({
      constructId: "uc_fn_def",
      sourceLanguage: "typescript",
      targetLanguage: "python",
      ruleId: "ts_py_fn",
      confidence: 0.9,
    });
    memory.recordAccepted({
      constructId: "uc_fn_def",
      sourceLanguage: "typescript",
      targetLanguage: "python",
      ruleId: "ts_py_fn",
      confidence: 0.9,
    });

    const boost = memory.getConfidenceBoost("ts_py_fn");
    expect(boost).toBeGreaterThan(0); // positive boost for accepted
  });

  it("should reduce confidence for corrected rules", () => {
    memory.recordCorrected({
      constructId: "uc_arrow_fn",
      sourceLanguage: "typescript",
      targetLanguage: "python",
      ruleId: "ts_py_arrow",
      originalConfidence: 0.7,
      correctionReason: "Not suitable",
    });

    const boost = memory.getConfidenceBoost("ts_py_arrow");
    expect(boost).toBeLessThan(0); // negative boost for corrected
  });

  it("should be queryable by construct + language pair", () => {
    memory.recordAccepted({ constructId: "uc_fn_def", sourceLanguage: "typescript", targetLanguage: "python", ruleId: "r1", confidence: 1.0 });
    memory.recordAccepted({ constructId: "uc_fn_def", sourceLanguage: "python", targetLanguage: "typescript", ruleId: "r2", confidence: 1.0 });
    memory.recordAccepted({ constructId: "uc_class_def", sourceLanguage: "typescript", targetLanguage: "python", ruleId: "r3", confidence: 1.0 });

    const tsPy = memory.query("uc_fn_def", "typescript", "python");
    expect(tsPy).toHaveLength(1);
    expect(tsPy[0].ruleId).toBe("r1");
  });

  it("should return empty for unknown queries", () => {
    expect(memory.query("unknown", "typescript", "python")).toHaveLength(0);
  });

  it("should return all entries", () => {
    memory.recordAccepted({ constructId: "uc_fn_def", sourceLanguage: "typescript", targetLanguage: "python", ruleId: "r1", confidence: 1.0 });
    memory.recordCorrected({ constructId: "uc_class_def", sourceLanguage: "typescript", targetLanguage: "python", ruleId: "r2", originalConfidence: 0.8, correctionReason: "Bad" });

    expect(memory.getAllEntries()).toHaveLength(2);
  });

  it("should report stats", () => {
    memory.recordAccepted({ constructId: "a", sourceLanguage: "ts", targetLanguage: "py", ruleId: "r1", confidence: 1.0 });
    memory.recordAccepted({ constructId: "b", sourceLanguage: "ts", targetLanguage: "py", ruleId: "r2", confidence: 1.0 });
    memory.recordCorrected({ constructId: "c", sourceLanguage: "ts", targetLanguage: "py", ruleId: "r3", originalConfidence: 0.5, correctionReason: "Bad" });

    const stats = memory.getStats();
    expect(stats.totalEntries).toBe(3);
    expect(stats.accepted).toBe(2);
    expect(stats.corrected).toBe(1);
  });
});
