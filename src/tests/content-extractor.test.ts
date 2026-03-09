import { describe, it, expect } from "vitest";
import { extractContent, type ExtractionResult } from "../core/capture/content-extractor.js";

describe("extractContent", () => {
  it("should extract text from simple HTML", async () => {
    const html = "<html><body><h1>Title</h1><p>Hello world</p></body></html>";
    const result = await extractContent(html);

    expect(result.text).toContain("# Title");
    expect(result.text).toContain("Hello world");
    expect(result.title).toBe("Title");
  });

  it("should extract title from <title> tag when no h1", async () => {
    const html = "<html><head><title>Page Title</title></head><body><p>Content</p></body></html>";
    const result = await extractContent(html);

    expect(result.title).toBe("Page Title");
    expect(result.text).toContain("Content");
  });

  it("should strip nav, footer, scripts, and styles", async () => {
    const html = `<html><body>
      <nav>Navigation</nav>
      <script>alert('xss')</script>
      <style>.foo { color: red }</style>
      <main><p>Main content</p></main>
      <footer>Footer</footer>
    </body></html>`;
    const result = await extractContent(html);

    expect(result.text).toContain("Main content");
    expect(result.text).not.toContain("Navigation");
    expect(result.text).not.toContain("alert");
    expect(result.text).not.toContain("color: red");
    expect(result.text).not.toContain("Footer");
  });

  it("should convert headings to markdown format", async () => {
    const html = `<html><body>
      <h1>Main</h1>
      <h2>Sub</h2>
      <h3>Sub-sub</h3>
    </body></html>`;
    const result = await extractContent(html);

    expect(result.text).toContain("# Main");
    expect(result.text).toContain("## Sub");
    expect(result.text).toContain("### Sub-sub");
  });

  it("should convert list items to markdown bullets", async () => {
    const html = `<html><body>
      <ul>
        <li>Item one</li>
        <li>Item two</li>
      </ul>
    </body></html>`;
    const result = await extractContent(html);

    expect(result.text).toContain("- Item one");
    expect(result.text).toContain("- Item two");
  });

  it("should extract content from specific selector", async () => {
    const html = `<html><body>
      <div id="sidebar">Sidebar</div>
      <article class="main"><p>Article content</p></article>
    </body></html>`;
    const result = await extractContent(html, { selector: "article.main" });

    expect(result.text).toContain("Article content");
    expect(result.text).not.toContain("Sidebar");
  });

  it("should fall back to full body when selector matches nothing", async () => {
    const html = "<html><body><p>Body content</p></body></html>";
    const result = await extractContent(html, { selector: ".nonexistent" });

    expect(result.text).toContain("Body content");
  });

  it("should extract meta description", async () => {
    const html = `<html><head>
      <meta name="description" content="A test page description">
    </head><body><p>Content</p></body></html>`;
    const result = await extractContent(html);

    expect(result.description).toBe("A test page description");
  });

  it("should return word count", async () => {
    const html = "<html><body><p>One two three four five</p></body></html>";
    const result = await extractContent(html);

    expect(result.wordCount).toBe(5);
  });

  it("should handle empty HTML gracefully", async () => {
    const result = await extractContent("");

    expect(result.text).toBe("");
    expect(result.wordCount).toBe(0);
  });
});
