import { describe, it, expect } from "vitest";
import {
  applySection,
  generateClaudeMdSection,
  MARKER_START,
  MARKER_END,
} from "../core/config/ai-memory-generator.js";

describe("applySection — idempotent append/replace", () => {
  it("should append to empty content", () => {
    const section = generateClaudeMdSection("test");
    const result = applySection("", section);

    expect(result).toContain(MARKER_START);
    expect(result).toContain(MARKER_END);
  });

  it("should append to existing content without markers", () => {
    const existing = "# My Project\n\nSome content here.\n";
    const section = generateClaudeMdSection("test");
    const result = applySection(existing, section);

    expect(result).toContain("# My Project");
    expect(result).toContain(MARKER_START);
    expect(result.indexOf("# My Project")).toBeLessThan(result.indexOf(MARKER_START));
  });

  it("should replace existing section between markers (idempotent)", () => {
    const existing = `# My Project

${MARKER_START}
old content
${MARKER_END}

## Other section
`;
    const section = generateClaudeMdSection("updated");
    const result = applySection(existing, section);

    // Should have new content, not old
    expect(result).toContain("updated");
    expect(result).not.toContain("old content");
    // Should preserve surrounding content
    expect(result).toContain("# My Project");
    expect(result).toContain("## Other section");
    // Should have exactly one pair of markers
    expect(result.split(MARKER_START).length).toBe(2);
    expect(result.split(MARKER_END).length).toBe(2);
  });

  it("should be truly idempotent — applying twice yields same result", () => {
    const existing = "# My Project\n";
    const section = generateClaudeMdSection("test");

    const first = applySection(existing, section);
    const second = applySection(first, section);

    expect(first).toBe(second);
  });
});
