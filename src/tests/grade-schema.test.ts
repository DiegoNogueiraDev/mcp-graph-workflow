import { describe, it, expect } from "vitest";
import { GradeSchema } from "../schemas/grade-schema.js";

describe("GradeSchema", () => {
  it("should accept valid grades", () => {
    for (const grade of ["A", "B", "C", "D", "F"]) {
      expect(GradeSchema.parse(grade)).toBe(grade);
    }
  });

  it("should reject invalid grades", () => {
    expect(() => GradeSchema.parse("E")).toThrow();
    expect(() => GradeSchema.parse("a")).toThrow();
    expect(() => GradeSchema.parse("")).toThrow();
    expect(() => GradeSchema.parse(1)).toThrow();
  });
});
