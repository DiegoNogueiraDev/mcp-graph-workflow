import { logger } from "../utils/logger.js";

const HEADING_MAP: Record<string, string> = {
  h1: "#",
  h2: "##",
  h3: "###",
  h4: "####",
  h5: "#####",
  h6: "######",
};

/**
 * Extract text content from an HTML string using cheerio.
 * Converts headings to markdown format so the parser pipeline can segment them.
 * Strips tags, scripts, styles, and normalizes whitespace.
 */
export async function readHtmlContent(html: string): Promise<string> {
  // Dynamic import — cheerio is heavy, lazy-load
  const { load } = await import("cheerio");

  logger.info("Parsing HTML content", { sizeChars: html.length });

  const $ = load(html);

  // Remove non-content elements
  $("script, style, nav, footer, header, noscript, iframe").remove();

  // Convert HTML headings to markdown headings
  for (const [tag, prefix] of Object.entries(HEADING_MAP)) {
    $(tag).each(function (this: unknown) {
      const el = $(this as string);
      const text = el.text().trim();
      el.replaceWith(`\n\n${prefix} ${text}\n\n`);
    });
  }

  // Convert list items to markdown bullets
  $("li").each(function (this: unknown) {
    const el = $(this as string);
    const text = el.text().trim();
    el.replaceWith(`\n- ${text}`);
  });

  // Add line breaks for block elements
  const blockElements = "p, div, section, article, blockquote, pre, br, tr";
  $(blockElements).each(function (this: unknown) {
    $(this as string).prepend("\n");
    $(this as string).append("\n");
  });

  // Extract text from body (or whole doc if no body)
  const rawText = $("body").length ? $("body").text() : $.root().text();

  const text = rawText
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  logger.info("HTML parsed", { textLength: text.length });

  return text;
}
