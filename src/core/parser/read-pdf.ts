import { logger } from "../utils/logger.js";

interface PdfReadResult {
  text: string;
  pages: number;
}

/**
 * Extract text content from a PDF buffer using pdf-parse.
 */
export async function readPdfBuffer(buffer: Buffer): Promise<PdfReadResult> {
  // Dynamic import — pdf-parse is CJS, lazy-load to avoid startup cost
  const pdfParse = (await import("pdf-parse")).default;

  logger.info("Parsing PDF buffer", { sizeBytes: buffer.length });

  const result = await pdfParse(buffer);

  logger.info("PDF parsed", { pages: result.numpages, textLength: result.text.length });

  return {
    text: result.text,
    pages: result.numpages,
  };
}
