import { describe, it, expect } from "vitest";
import { mcpText, mcpError } from "../mcp/response-helpers.js";

describe("mcpText", () => {
  it("should format data as JSON text response", () => {
    const result = mcpText({ ok: true, count: 5 });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ ok: true, count: 5 });
  });

  it("should pretty-print JSON with 2 spaces", () => {
    const result = mcpText({ a: 1 });
    expect(result.content[0].text).toBe(JSON.stringify({ a: 1 }, null, 2));
  });

  it("should not have isError flag", () => {
    const result = mcpText({ ok: true });
    expect(result).not.toHaveProperty("isError");
  });
});

describe("mcpError", () => {
  it("should format Error instance as error response", () => {
    const result = mcpError(new Error("something went wrong"));
    expect(result.isError).toBe(true);
    expect(result.content).toHaveLength(1);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe("something went wrong");
  });

  it("should format string as error response", () => {
    const result = mcpError("raw error");
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe("raw error");
  });

  it("should always set isError to true", () => {
    expect(mcpError("test").isError).toBe(true);
    expect(mcpError(new Error("test")).isError).toBe(true);
  });
});
