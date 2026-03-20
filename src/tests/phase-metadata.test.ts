import { describe, it, expect } from "vitest";
import { getPhaseBoost, applyPhaseBoost, PHASE_BOOST_WEIGHTS } from "../core/rag/phase-metadata.js";

describe("phase-metadata", () => {
  describe("getPhaseBoost", () => {
    it("should return 2.0 for same-phase documents in IMPLEMENT", () => {
      expect(getPhaseBoost("IMPLEMENT", "IMPLEMENT")).toBe(2.0);
    });

    it("should return 1.5 for PLAN docs in IMPLEMENT phase", () => {
      expect(getPhaseBoost("IMPLEMENT", "PLAN")).toBe(1.5);
    });

    it("should return 1.0 for unrelated phase", () => {
      expect(getPhaseBoost("IMPLEMENT", "LISTENING")).toBe(1.0);
    });

    it("should return 1.0 for undefined phase", () => {
      expect(getPhaseBoost("IMPLEMENT", undefined)).toBe(1.0);
    });

    it("should boost ANALYZE docs in VALIDATE phase", () => {
      expect(getPhaseBoost("VALIDATE", "ANALYZE")).toBe(1.3);
    });

    it("should boost IMPLEMENT docs in VALIDATE phase", () => {
      expect(getPhaseBoost("VALIDATE", "IMPLEMENT")).toBe(2.0);
    });
  });

  describe("applyPhaseBoost", () => {
    it("should increase positive score (higher = better) with boost > 1", () => {
      const originalScore = 10;
      const boostedScore = applyPhaseBoost(originalScore, 2.0);
      expect(boostedScore).toBe(20);
      expect(boostedScore).toBeGreaterThan(originalScore);
    });

    it("should not change score with boost = 1", () => {
      expect(applyPhaseBoost(10, 1.0)).toBe(10);
    });

    it("should handle zero score", () => {
      expect(applyPhaseBoost(0, 2.0)).toBe(0);
    });
  });

  describe("PHASE_BOOST_WEIGHTS", () => {
    it("should have weights for all 8 lifecycle phases", () => {
      const phases = ["ANALYZE", "DESIGN", "PLAN", "IMPLEMENT", "VALIDATE", "REVIEW", "HANDOFF", "LISTENING"];
      for (const phase of phases) {
        expect(PHASE_BOOST_WEIGHTS).toHaveProperty(phase);
      }
    });

    it("should always have self-boost of 2.0", () => {
      for (const [phase, weights] of Object.entries(PHASE_BOOST_WEIGHTS)) {
        expect(weights[phase as keyof typeof weights]).toBe(2.0);
      }
    });
  });
});
