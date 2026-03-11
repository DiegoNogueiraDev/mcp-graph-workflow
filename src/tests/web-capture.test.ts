import { describe, it, expect } from "vitest";
import { captureWebPage, type CaptureOptions } from "../core/capture/web-capture.js";

// Web capture tests require Playwright browser binaries.
// These are integration tests — skip if Playwright is not available.
describe("captureWebPage", () => {
  it("should reject empty URL", async () => {
    await expect(captureWebPage("")).rejects.toThrow("URL is required");
  });

  it("should reject invalid URL", async () => {
    await expect(captureWebPage("not-a-url")).rejects.toThrow("Invalid URL");
  });

  it("should reject non-http(s) URLs", async () => {
    await expect(captureWebPage("ftp://example.com")).rejects.toThrow("Only HTTP");
  });

  it("should accept valid options shape", () => {
    // Type-level test: verify CaptureOptions and CaptureResult types compile
    const opts: CaptureOptions = {
      selector: "main",
      timeout: 5000,
      waitForSelector: ".loaded",
    };
    expect(opts.selector).toBe("main");
  });
});
