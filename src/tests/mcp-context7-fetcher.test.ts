import { describe, it, expect, afterEach, vi } from "vitest";
import { createMcpContext7Fetcher } from "../core/docs/mcp-context7-fetcher.js";

describe("McpContext7Fetcher", () => {
  afterEach(() => {
    delete process.env.CONTEXT7_URL;
    vi.restoreAllMocks();
  });

  describe("resolveLibraryId", () => {
    it("should fall back to library name when CONTEXT7_URL not set", async () => {
      const fetcher = createMcpContext7Fetcher();
      const result = await fetcher.resolveLibraryId("express");
      expect(result).toBe("express");
    });

    it("should fall back to library name on fetch error", async () => {
      process.env.CONTEXT7_URL = "http://localhost:99999";
      const fetcher = createMcpContext7Fetcher({ timeout: 500 });
      const result = await fetcher.resolveLibraryId("react");
      expect(result).toBe("react");
    });
  });

  describe("queryDocs", () => {
    it("should return fallback message when CONTEXT7_URL not set", async () => {
      const fetcher = createMcpContext7Fetcher();
      const result = await fetcher.queryDocs("express");
      expect(result).toContain("[Context7]");
      expect(result).toContain("not available");
    });

    it("should return fallback on fetch error", async () => {
      process.env.CONTEXT7_URL = "http://localhost:99999";
      const fetcher = createMcpContext7Fetcher({ timeout: 500 });
      const result = await fetcher.queryDocs("zod");
      expect(result).toContain("[Context7]");
    });
  });

  it("should respect timeout option", async () => {
    const fetcher = createMcpContext7Fetcher({ timeout: 100 });
    // Should not hang — falls back quickly
    const result = await fetcher.resolveLibraryId("test-lib");
    expect(result).toBe("test-lib");
  });
});
