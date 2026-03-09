import { describe, it, expect, vi } from "vitest";
import { runValidation, type ValidateResult } from "../core/capture/validate-runner.js";

// Mock the web-capture module since Playwright is heavy
vi.mock("../core/capture/web-capture.js", () => ({
  captureWebPage: vi.fn(),
}));

import { captureWebPage } from "../core/capture/web-capture.js";
const mockCapture = vi.mocked(captureWebPage);

describe("ValidateRunner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should capture a single URL", async () => {
    mockCapture.mockResolvedValue({
      text: "Hello world content",
      title: "Test Page",
      description: null,
      wordCount: 3,
      url: "https://example.com",
      capturedAt: new Date().toISOString(),
    });

    const result = await runValidation("https://example.com");

    expect(result.primary.url).toBe("https://example.com");
    expect(result.primary.wordCount).toBe(3);
    expect(result.comparison).toBeUndefined();
    expect(result.diff).toBeUndefined();
    expect(result.timestamp).toBeTruthy();
  });

  it("should capture two URLs for A/B comparison", async () => {
    mockCapture
      .mockResolvedValueOnce({
        text: "Version A content",
        title: "Page A",
        description: null,
        wordCount: 3,
        url: "https://a.com",
        capturedAt: new Date().toISOString(),
      })
      .mockResolvedValueOnce({
        text: "Version B content with more text added here",
        title: "Page B",
        description: null,
        wordCount: 8,
        url: "https://b.com",
        capturedAt: new Date().toISOString(),
      });

    const result = await runValidation("https://a.com", { compareUrl: "https://b.com" });

    expect(result.primary.url).toBe("https://a.com");
    expect(result.comparison).toBeDefined();
    expect(result.comparison!.url).toBe("https://b.com");
    expect(result.diff).toBeDefined();
    expect(result.diff!.wordCountDelta).toBe(5); // 8 - 3
  });

  it("should compute content diff correctly", async () => {
    mockCapture
      .mockResolvedValueOnce({
        text: "Short text",
        title: "A",
        description: null,
        wordCount: 2,
        url: "https://a.com",
        capturedAt: new Date().toISOString(),
      })
      .mockResolvedValueOnce({
        text: "Much longer text with additional content",
        title: "B",
        description: null,
        wordCount: 6,
        url: "https://b.com",
        capturedAt: new Date().toISOString(),
      });

    const result = await runValidation("https://a.com", { compareUrl: "https://b.com" });

    expect(result.diff!.primaryWordCount).toBe(2);
    expect(result.diff!.comparisonWordCount).toBe(6);
    expect(result.diff!.lengthDelta).toBeGreaterThan(0);
  });
});
