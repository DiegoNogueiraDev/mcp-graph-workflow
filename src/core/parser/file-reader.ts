import { readFile } from "node:fs/promises";
import path from "node:path";
import { readPdfBuffer } from "./read-pdf.js";
import { readHtmlContent } from "./read-html.js";
import { logger } from "../utils/logger.js";

const SUPPORTED_EXTENSIONS = new Set([".md", ".txt", ".pdf", ".html", ".htm"]);

export interface FileReadResult {
  text: string;
  originalName: string;
  format: string;
  sizeBytes: number;
}

/**
 * Read a file and extract its text content based on extension.
 * Supports: .md, .txt, .pdf, .html, .htm
 */
export async function readFileContent(
  filePath: string,
  originalName?: string,
): Promise<FileReadResult> {
  const name = originalName ?? path.basename(filePath);
  const ext = path.extname(name).toLowerCase();

  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    throw new Error(
      `Unsupported file format: "${ext}". Supported: ${[...SUPPORTED_EXTENSIONS].join(", ")}`,
    );
  }

  logger.info("Reading file", { name, ext });

  const buffer = await readFile(filePath);
  const sizeBytes = buffer.length;
  let text: string;

  switch (ext) {
    case ".pdf": {
      const result = await readPdfBuffer(buffer);
      text = result.text;
      break;
    }
    case ".html":
    case ".htm": {
      const html = buffer.toString("utf-8");
      text = await readHtmlContent(html);
      break;
    }
    case ".md":
    case ".txt":
    default: {
      text = buffer.toString("utf-8");
      break;
    }
  }

  logger.info("File read complete", { name, format: ext, textLength: text.length });

  return {
    text,
    originalName: name,
    format: ext,
    sizeBytes,
  };
}

export function isSupportedFormat(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}
