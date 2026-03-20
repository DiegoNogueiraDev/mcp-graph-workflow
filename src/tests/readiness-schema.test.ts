import { describe, it, expect } from "vitest";
import {
  ReadinessSeveritySchema,
  BaseReadinessCheckSchema,
  BaseReadinessReportSchema,
} from "../schemas/readiness-schema.js";

describe("ReadinessSeveritySchema", () => {
  it("should accept valid severities", () => {
    expect(ReadinessSeveritySchema.parse("required")).toBe("required");
    expect(ReadinessSeveritySchema.parse("recommended")).toBe("recommended");
  });

  it("should reject invalid severities", () => {
    expect(() => ReadinessSeveritySchema.parse("optional")).toThrow();
  });
});

describe("BaseReadinessCheckSchema", () => {
  it("should parse a valid check", () => {
    const check = {
      name: "has_decisions",
      passed: true,
      details: "2 decisions found",
      severity: "required",
    };
    expect(BaseReadinessCheckSchema.parse(check)).toEqual(check);
  });

  it("should reject missing fields", () => {
    expect(() => BaseReadinessCheckSchema.parse({ name: "test" })).toThrow();
  });
});

describe("BaseReadinessReportSchema", () => {
  it("should parse a valid report", () => {
    const report = {
      checks: [
        { name: "test", passed: true, details: "ok", severity: "required" },
      ],
      ready: true,
      score: 100,
      grade: "A",
      summary: "All checks passed",
    };
    expect(BaseReadinessReportSchema.parse(report)).toEqual(report);
  });

  it("should reject score out of range", () => {
    const report = {
      checks: [],
      ready: true,
      score: 150,
      grade: "A",
      summary: "test",
    };
    expect(() => BaseReadinessReportSchema.parse(report)).toThrow();
  });

  it("should use GradeSchema for grade field", () => {
    const report = {
      checks: [],
      ready: true,
      score: 50,
      grade: "E",
      summary: "test",
    };
    expect(() => BaseReadinessReportSchema.parse(report)).toThrow();
  });
});
