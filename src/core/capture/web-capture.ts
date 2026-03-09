import { logger } from "../utils/logger.js";
import { extractContent, type ExtractionResult } from "./content-extractor.js";

export interface CaptureOptions {
  /** CSS selector to scope extraction */
  selector?: string;
  /** Navigation timeout in ms (default 30000) */
  timeout?: number;
  /** Wait for this selector before extracting */
  waitForSelector?: string;
}

export interface CaptureResult extends ExtractionResult {
  /** The URL that was captured */
  url: string;
  /** Timestamp of capture */
  capturedAt: string;
}

/**
 * Capture a web page using Playwright headless browser and extract structured content.
 */
export async function captureWebPage(
  url: string,
  options?: CaptureOptions,
): Promise<CaptureResult> {
  if (!url) {
    throw new Error("URL is required");
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`Only HTTP and HTTPS URLs are supported, got: ${parsed.protocol}`);
  }

  const timeout = options?.timeout ?? 30_000;

  logger.info("Capturing web page", { url, timeout, selector: options?.selector });

  // Dynamic import — Playwright may not be installed
  let chromium: typeof import("playwright").chromium;
  try {
    const pw = await import("playwright");
    chromium = pw.chromium;
  } catch {
    throw new Error(
      "Playwright is not installed. Run 'npx playwright install chromium' to enable web capture.",
    );
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { timeout, waitUntil: "domcontentloaded" });

    if (options?.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, { timeout });
    }

    const html = await page.content();

    const extraction = await extractContent(html, { selector: options?.selector });

    logger.info("Web page captured", { url, wordCount: extraction.wordCount });

    return {
      ...extraction,
      url,
      capturedAt: new Date().toISOString(),
    };
  } finally {
    await browser.close();
  }
}
