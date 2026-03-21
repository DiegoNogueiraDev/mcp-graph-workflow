import { describe, it, expect } from "vitest";
import path from "node:path";
import { readFileContent, isSupportedFormat } from "../core/parser/file-reader.js";

const FIXTURES = path.join(import.meta.dirname, "fixtures");

describe("isSupportedFormat", () => {
  it("should accept .md files", () => {
    expect(isSupportedFormat("doc.md")).toBe(true);
  });

  it("should accept .txt files", () => {
    expect(isSupportedFormat("doc.txt")).toBe(true);
  });

  it("should accept .html files", () => {
    expect(isSupportedFormat("page.html")).toBe(true);
  });

  it("should accept .htm files", () => {
    expect(isSupportedFormat("page.htm")).toBe(true);
  });

  it("should accept .pdf files", () => {
    expect(isSupportedFormat("doc.pdf")).toBe(true);
  });

  it("should reject unsupported formats", () => {
    expect(isSupportedFormat("image.png")).toBe(false);
    expect(isSupportedFormat("code.ts")).toBe(false);
    expect(isSupportedFormat("archive.zip")).toBe(false);
  });
});

describe("readFileContent", () => {
  it("should read a markdown file", async () => {
    const result = await readFileContent(path.join(FIXTURES, "sample.md"));

    expect(result.format).toBe(".md");
    expect(result.originalName).toBe("sample.md");
    expect(result.text).toContain("Payment Processing");
    expect(result.text).toContain("Stripe SDK Setup");
    expect(result.sizeBytes).toBeGreaterThan(0);
  });

  it("should read an HTML file and extract text", async () => {
    const result = await readFileContent(path.join(FIXTURES, "sample.html"));

    expect(result.format).toBe(".html");
    expect(result.text).toContain("Authentication Module");
    expect(result.text).toContain("Login Endpoint");
    expect(result.text).not.toContain("<h1>");
    expect(result.text).not.toContain("alert");
  });

  it("should use originalName when provided", async () => {
    const result = await readFileContent(
      path.join(FIXTURES, "sample.md"),
      "custom-name.txt",
    );

    expect(result.originalName).toBe("custom-name.txt");
    expect(result.format).toBe(".txt");
  });

  it("should throw for unsupported format", async () => {
    await expect(
      readFileContent(path.join(FIXTURES, "sample.md"), "file.xyz"),
    ).rejects.toThrow("Unsupported file format");
  });
});
