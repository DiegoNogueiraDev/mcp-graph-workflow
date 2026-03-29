/**
 * Prompt Paginator — splits large translation prompts into numbered pages.
 *
 * When a prompt exceeds the token budget (default 8K tokens), it splits
 * at natural boundaries (code sections) and returns paginated results.
 * Each page is self-contained with construct context header.
 */

import { estimateTokens } from "../context/token-estimator.js";
import { logger } from "../utils/logger.js";

const DEFAULT_PAGE_TOKEN_BUDGET = 8000;

export interface PromptPage {
  content: string;
  currentPage: number;
  totalPages: number;
  tokenEstimate: number;
  truncated: boolean;
}

/**
 * Paginate a prompt if it exceeds the token budget.
 * Returns a single page if within budget (no pagination needed).
 */
export function paginatePrompt(
  prompt: string,
  pageTokenBudget: number = DEFAULT_PAGE_TOKEN_BUDGET,
  requestedPage: number = 1,
): PromptPage {
  const totalTokens = estimateTokens(prompt);

  // If within budget, return as single page
  if (totalTokens <= pageTokenBudget) {
    return {
      content: prompt,
      currentPage: 1,
      totalPages: 1,
      tokenEstimate: totalTokens,
      truncated: false,
    };
  }

  // Split prompt into sections at markdown headers or code block boundaries
  const sections = splitPromptSections(prompt);
  const pages = buildPages(sections, pageTokenBudget);
  const totalPages = pages.length;

  const pageIndex = Math.max(0, Math.min(requestedPage - 1, totalPages - 1));
  const page = pages[pageIndex];

  logger.debug("prompt:paginated", {
    totalTokens,
    totalPages,
    requestedPage,
    pageTokens: estimateTokens(page),
  });

  return {
    content: page,
    currentPage: pageIndex + 1,
    totalPages,
    tokenEstimate: estimateTokens(page),
    truncated: true,
  };
}

/**
 * Split a prompt into logical sections (headers, code blocks, tables).
 */
function splitPromptSections(prompt: string): string[] {
  const sections: string[] = [];
  const lines = prompt.split("\n");
  let current: string[] = [];

  for (const line of lines) {
    // Split at markdown headers (##, ###)
    if (/^#{2,3}\s/.test(line) && current.length > 0) {
      sections.push(current.join("\n"));
      current = [];
    }
    current.push(line);
  }
  if (current.length > 0) {
    sections.push(current.join("\n"));
  }

  return sections;
}

/**
 * Build pages from sections, respecting token budget per page.
 * First section (header/metadata) is included in every page.
 */
function buildPages(sections: string[], pageTokenBudget: number): string[] {
  if (sections.length === 0) return [""];
  if (sections.length === 1) return [sections[0]];

  const header = sections[0]; // Always include first section as context
  const headerTokens = estimateTokens(header);
  const availablePerPage = pageTokenBudget - headerTokens - 100; // 100 tokens for pagination metadata

  const pages: string[] = [];
  let currentPageSections: string[] = [];
  let currentTokens = 0;

  for (let i = 1; i < sections.length; i++) {
    const sectionTokens = estimateTokens(sections[i]);

    if (currentTokens + sectionTokens > availablePerPage && currentPageSections.length > 0) {
      // Flush current page
      const pageNum = pages.length + 1;
      const pageHeader = `${header}\n\n_Page ${pageNum} of translation prompt_\n`;
      pages.push(pageHeader + currentPageSections.join("\n\n"));
      currentPageSections = [];
      currentTokens = 0;
    }

    currentPageSections.push(sections[i]);
    currentTokens += sectionTokens;
  }

  // Flush remaining
  if (currentPageSections.length > 0) {
    const pageNum = pages.length + 1;
    const pageHeader = `${header}\n\n_Page ${pageNum} of translation prompt_\n`;
    pages.push(pageHeader + currentPageSections.join("\n\n"));
  }

  // If everything fit in one page, return as-is
  if (pages.length === 0) {
    return [sections.join("\n\n")];
  }

  // Update total pages count in each page
  return pages.map((p) =>
    p.replace(
      /Page (\d+) of translation prompt/,
      `Page $1 of ${pages.length} — translation prompt`,
    ),
  );
}
