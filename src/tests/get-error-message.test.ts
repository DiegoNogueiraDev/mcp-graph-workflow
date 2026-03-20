import { describe, it, expect } from "vitest";
import { getErrorMessage } from "../core/utils/errors.js";

describe("getErrorMessage", () => {
  it("should extract message from Error instance", () => {
    expect(getErrorMessage(new Error("test error"))).toBe("test error");
  });

  it("should convert string to string", () => {
    expect(getErrorMessage("raw string")).toBe("raw string");
  });

  it("should convert number to string", () => {
    expect(getErrorMessage(42)).toBe("42");
  });

  it("should convert null to string", () => {
    expect(getErrorMessage(null)).toBe("null");
  });

  it("should convert undefined to string", () => {
    expect(getErrorMessage(undefined)).toBe("undefined");
  });

  it("should handle custom Error subclasses", () => {
    class CustomError extends Error {
      constructor() {
        super("custom");
        this.name = "CustomError";
      }
    }
    expect(getErrorMessage(new CustomError())).toBe("custom");
  });
});
