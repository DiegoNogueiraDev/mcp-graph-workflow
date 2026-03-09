/**
 * Validate Runner — runs Playwright-based validation for tasks.
 * Captures screenshots and content for comparison (A/B testing support).
 */

import { captureWebPage, type CaptureResult, type CaptureOptions } from "./web-capture.js";
import { logger } from "../utils/logger.js";

export interface ValidateOptions extends CaptureOptions {
  /** Second URL for A/B comparison */
  compareUrl?: string;
}

export interface ValidateResult {
  primary: CaptureResult;
  comparison?: CaptureResult;
  diff?: ContentDiff;
  timestamp: string;
}

export interface ContentDiff {
  primaryWordCount: number;
  comparisonWordCount: number;
  wordCountDelta: number;
  primaryLength: number;
  comparisonLength: number;
  lengthDelta: number;
}

/**
 * Run validation by capturing one or two URLs and computing diff.
 */
export async function runValidation(
  url: string,
  options?: ValidateOptions,
): Promise<ValidateResult> {
  logger.info("Running validation", { url, compareUrl: options?.compareUrl });

  const primary = await captureWebPage(url, options);

  const result: ValidateResult = {
    primary,
    timestamp: new Date().toISOString(),
  };

  if (options?.compareUrl) {
    const comparison = await captureWebPage(options.compareUrl, options);
    result.comparison = comparison;
    result.diff = computeDiff(primary, comparison);
  }

  logger.info("Validation complete", {
    url,
    wordCount: primary.wordCount,
    hasDiff: !!result.diff,
  });

  return result;
}

/**
 * Compute content diff between two captures.
 */
function computeDiff(a: CaptureResult, b: CaptureResult): ContentDiff {
  return {
    primaryWordCount: a.wordCount,
    comparisonWordCount: b.wordCount,
    wordCountDelta: b.wordCount - a.wordCount,
    primaryLength: a.text.length,
    comparisonLength: b.text.length,
    lengthDelta: b.text.length - a.text.length,
  };
}
