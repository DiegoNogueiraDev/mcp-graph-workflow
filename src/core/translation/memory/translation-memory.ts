/**
 * Translation Memory — tracks accepted/corrected translations for rule ranking.
 *
 * Records which rule/template/AI choice was accepted or corrected.
 * Accepted translations boost confidence; corrected ones reduce it.
 * Queryable by construct + language pair.
 */

// ── Types ──────────────────────────────────────────

export interface MemoryEntry {
  constructId: string;
  sourceLanguage: string;
  targetLanguage: string;
  ruleId: string;
  accepted: boolean;
  confidence: number;
  correctionReason?: string;
  timestamp: string;
}

export interface AcceptedInput {
  constructId: string;
  sourceLanguage: string;
  targetLanguage: string;
  ruleId: string;
  confidence: number;
}

export interface CorrectedInput {
  constructId: string;
  sourceLanguage: string;
  targetLanguage: string;
  ruleId: string;
  originalConfidence: number;
  correctionReason: string;
}

export interface MemoryStats {
  totalEntries: number;
  accepted: number;
  corrected: number;
}

// ── Translation Memory ─────────────────────────────

export class TranslationMemory {
  private entries: MemoryEntry[] = [];

  /**
   * Record an accepted translation (positive signal).
   */
  recordAccepted(input: AcceptedInput): void {
    this.entries.push({
      constructId: input.constructId,
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
      ruleId: input.ruleId,
      accepted: true,
      confidence: input.confidence,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Record a corrected translation (negative signal).
   */
  recordCorrected(input: CorrectedInput): void {
    this.entries.push({
      constructId: input.constructId,
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
      ruleId: input.ruleId,
      accepted: false,
      confidence: input.originalConfidence,
      correctionReason: input.correctionReason,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Query entries by construct + language pair.
   */
  query(constructId: string, sourceLanguage: string, targetLanguage: string): MemoryEntry[] {
    return this.entries.filter(
      (e) =>
        e.constructId === constructId &&
        e.sourceLanguage === sourceLanguage &&
        e.targetLanguage === targetLanguage,
    );
  }

  /**
   * Get confidence boost for a rule based on historical acceptance/correction.
   * Positive = rule works well. Negative = rule has been corrected.
   */
  getConfidenceBoost(ruleId: string): number {
    const ruleEntries = this.entries.filter((e) => e.ruleId === ruleId);
    if (ruleEntries.length === 0) return 0;

    let boost = 0;
    for (const entry of ruleEntries) {
      if (entry.accepted) {
        boost += 0.05; // small positive boost per acceptance
      } else {
        boost -= 0.1; // larger negative boost per correction
      }
    }

    return boost;
  }

  /**
   * Get all entries.
   */
  getAllEntries(): MemoryEntry[] {
    return [...this.entries];
  }

  /**
   * Get statistics.
   */
  getStats(): MemoryStats {
    return {
      totalEntries: this.entries.length,
      accepted: this.entries.filter((e) => e.accepted).length,
      corrected: this.entries.filter((e) => !e.accepted).length,
    };
  }
}
