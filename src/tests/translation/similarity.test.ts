import { describe, it, expect } from "vitest";
import { tokenize, jaccardSimilarity } from "../../core/utils/similarity.js";

describe("Similarity Utils", () => {
  describe("tokenize", () => {
    it("should split camelCase", () => {
      expect(tokenize("getUserProfile")).toEqual(["get", "user", "profile"]);
    });

    it("should split PascalCase", () => {
      expect(tokenize("GetUserProfile")).toEqual(["get", "user", "profile"]);
    });

    it("should split snake_case", () => {
      expect(tokenize("get_user_profile")).toEqual(["get", "user", "profile"]);
    });

    it("should split kebab-case", () => {
      expect(tokenize("get-user-profile")).toEqual(["get", "user", "profile"]);
    });

    it("should filter single-char tokens", () => {
      expect(tokenize("a_big_test")).toEqual(["big", "test"]);
    });

    it("should handle empty string", () => {
      expect(tokenize("")).toEqual([]);
    });
  });

  describe("jaccardSimilarity", () => {
    it("should return 1.0 for identical sets", () => {
      const a = new Set(["get", "user"]);
      const b = new Set(["get", "user"]);
      expect(jaccardSimilarity(a, b)).toBe(1.0);
    });

    it("should return 0 for disjoint sets", () => {
      const a = new Set(["foo", "bar"]);
      const b = new Set(["baz", "qux"]);
      expect(jaccardSimilarity(a, b)).toBe(0);
    });

    it("should return partial overlap score", () => {
      const a = new Set(["get", "user", "profile"]);
      const b = new Set(["get", "user", "data"]);
      // intersection: {get, user} = 2, union: {get, user, profile, data} = 4
      expect(jaccardSimilarity(a, b)).toBe(0.5);
    });

    it("should return 0 for two empty sets", () => {
      expect(jaccardSimilarity(new Set(), new Set())).toBe(0);
    });
  });
});
