import { logger } from "../utils/logger.js";

export interface ExtractionOptions {
  /** CSS selector to extract content from (defaults to full body) */
  selector?: string;
}

export interface ExtractionResult {
  /** Extracted text in markdown format */
  text: string;
  /** Page title (from h1 or <title>) */
  title: string | null;
  /** Meta description if available */
  description: string | null;
  /** Word count of extracted text */
  wordCount: number;
}

const HEADING_MAP: Record<string, string> = {
  h1: "#",
  h2: "##",
  h3: "###",
  h4: "####",
  h5: "#####",
  h6: "######",
};

/**
 * Extract structured text content from raw HTML.
 * Converts headings to markdown, strips non-content elements,
 * and normalizes whitespace.
 */
export async function extractContent(
  html: string,
  options?: ExtractionOptions,
): Promise<ExtractionResult> {
  if (!html.trim()) {
    return { text: "", title: null, description: null, wordCount: 0 };
  }

  const { load } = await import("cheerio");
  logger.info("Extracting content from HTML", { sizeChars: html.length, selector: options?.selector });

  const $ = load(html);

  // Extract metadata before stripping
  const titleTag = $("title").first().text().trim() || null;
  const h1Text = $("h1").first().text().trim() || null;
  const title = h1Text ?? titleTag;
  const description = $('meta[name="description"]').attr("content") ?? null;

  // Remove non-content elements
  $("script, style, nav, footer, header, noscript, iframe, svg").remove();

  // Scope to selector if provided — extract scoped HTML and reload
  let scopedHtml: string;
  if (options?.selector) {
    const selected = $(options.selector);
    if (selected.length > 0) {
      scopedHtml = selected.html() ?? "";
    } else {
      logger.info("Selector matched nothing, falling back to body", { selector: options.selector });
      scopedHtml = $("body").length ? ($("body").html() ?? "") : $.html();
    }
  } else {
    scopedHtml = $("body").length ? ($("body").html() ?? "") : $.html();
  }

  // Reload scoped content for transformation
  const $scoped = load(scopedHtml);

  // Convert headings to markdown
  for (const [tag, prefix] of Object.entries(HEADING_MAP)) {
    $scoped(tag).each(function (this: unknown) {
      const el = $scoped(this as string);
      const text = el.text().trim();
      el.replaceWith(`\n\n${prefix} ${text}\n\n`);
    });
  }

  // Convert list items to markdown bullets
  $scoped("li").each(function (this: unknown) {
    const el = $scoped(this as string);
    const text = el.text().trim();
    el.replaceWith(`\n- ${text}`);
  });

  // Add line breaks for block elements
  $scoped("p, div, section, article, blockquote, pre, br, tr").each(function (this: unknown) {
    $scoped(this as string).prepend("\n");
    $scoped(this as string).append("\n");
  });

  const rawText = $scoped.root().text();
  const text = rawText
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const wordCount = text ? text.split(/\s+/).length : 0;

  logger.info("Content extracted", { textLength: text.length, wordCount });

  return { text, title, description, wordCount };
}
