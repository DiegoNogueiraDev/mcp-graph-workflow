import { describe, it, expect, vi } from "vitest";

// Mock pdf-parse before importing the module
vi.mock("pdf-parse", () => ({
  default: vi.fn(async (buffer: Buffer) => {
    const text = buffer.toString("utf-8");
    if (text.includes("CORRUPT_PDF")) {
      throw new Error("Invalid PDF structure");
    }
    return {
      text: `parsed: ${text}`,
      numpages: 1,
      info: {},
    };
  }),
}));

import { readPdfBuffer } from "../core/parser/read-pdf.js";

describe("readPdfBuffer", () => {
  it("should return text and page count from a valid buffer", async () => {
    const buffer = Buffer.from("Hello PDF content");

    const result = await readPdfBuffer(buffer);

    expect(result.text).toBe("parsed: Hello PDF content");
    expect(result.pages).toBe(1);
  });

  it("should pass buffer to pdf-parse", async () => {
    const pdfParse = (await import("pdf-parse")).default as ReturnType<typeof vi.fn>;
    pdfParse.mockClear();

    const buffer = Buffer.from("test content");
    await readPdfBuffer(buffer);

    expect(pdfParse).toHaveBeenCalledWith(buffer);
  });

  it("should propagate errors from pdf-parse", async () => {
    const buffer = Buffer.from("CORRUPT_PDF");

    await expect(readPdfBuffer(buffer)).rejects.toThrow("Invalid PDF structure");
  });

  it("should handle empty buffer", async () => {
    const buffer = Buffer.from("");

    const result = await readPdfBuffer(buffer);

    expect(result.text).toBe("parsed: ");
    expect(result.pages).toBe(1);
  });
});
