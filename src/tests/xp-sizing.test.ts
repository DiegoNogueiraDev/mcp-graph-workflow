import { describe, it, expect } from "vitest";
import { XP_SIZE_ORDER, XP_SIZE_POINTS } from "../core/utils/xp-sizing.js";

describe("XP sizing constants", () => {
  describe("XP_SIZE_ORDER", () => {
    it("should have ascending ordinal values", () => {
      expect(XP_SIZE_ORDER.XS).toBe(1);
      expect(XP_SIZE_ORDER.S).toBe(2);
      expect(XP_SIZE_ORDER.M).toBe(3);
      expect(XP_SIZE_ORDER.L).toBe(4);
      expect(XP_SIZE_ORDER.XL).toBe(5);
    });

    it("should maintain strict ordering XS < S < M < L < XL", () => {
      expect(XP_SIZE_ORDER.XS).toBeLessThan(XP_SIZE_ORDER.S);
      expect(XP_SIZE_ORDER.S).toBeLessThan(XP_SIZE_ORDER.M);
      expect(XP_SIZE_ORDER.M).toBeLessThan(XP_SIZE_ORDER.L);
      expect(XP_SIZE_ORDER.L).toBeLessThan(XP_SIZE_ORDER.XL);
    });

    it("should have exactly 5 entries", () => {
      expect(Object.keys(XP_SIZE_ORDER)).toHaveLength(5);
    });
  });

  describe("XP_SIZE_POINTS", () => {
    it("should use fibonacci-like story points", () => {
      expect(XP_SIZE_POINTS.XS).toBe(1);
      expect(XP_SIZE_POINTS.S).toBe(2);
      expect(XP_SIZE_POINTS.M).toBe(3);
      expect(XP_SIZE_POINTS.L).toBe(5);
      expect(XP_SIZE_POINTS.XL).toBe(8);
    });

    it("should have exactly 5 entries", () => {
      expect(Object.keys(XP_SIZE_POINTS)).toHaveLength(5);
    });
  });

  describe("ORDER vs POINTS distinction", () => {
    it("ORDER and POINTS should agree for XS, S, M", () => {
      expect(XP_SIZE_ORDER.XS).toBe(XP_SIZE_POINTS.XS);
      expect(XP_SIZE_ORDER.S).toBe(XP_SIZE_POINTS.S);
      expect(XP_SIZE_ORDER.M).toBe(XP_SIZE_POINTS.M);
    });

    it("ORDER and POINTS should diverge for L and XL (by design)", () => {
      // ORDER uses sequential: L=4, XL=5 (for sorting)
      // POINTS uses fibonacci: L=5, XL=8 (for velocity)
      expect(XP_SIZE_ORDER.L).not.toBe(XP_SIZE_POINTS.L);
      expect(XP_SIZE_ORDER.XL).not.toBe(XP_SIZE_POINTS.XL);
    });
  });
});
