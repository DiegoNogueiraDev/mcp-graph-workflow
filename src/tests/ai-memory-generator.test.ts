import { describe, it, expect } from "vitest";
import {
  generateClaudeMdSection,
  generateCopilotInstructions,
  MARKER_START,
  MARKER_END,
} from "../core/config/ai-memory-generator.js";

describe("generateClaudeMdSection", () => {
  it("should generate a non-empty section with markers", () => {
    const section = generateClaudeMdSection("my-project");

    expect(section).toContain(MARKER_START);
    expect(section).toContain(MARKER_END);
    expect(section).toContain("my-project");
  });

  it("should include tool reference", () => {
    const section = generateClaudeMdSection("test");

    expect(section).toContain("next");
    expect(section).toContain("context");
    expect(section).toContain("update_status");
    expect(section).toContain("import_prd");
  });

  it("should include lifecycle phases", () => {
    const section = generateClaudeMdSection("test");

    expect(section).toContain("ANALYZE");
    expect(section).toContain("IMPLEMENT");
    expect(section).toContain("VALIDATE");
  });

  it("should include XP Anti-Vibe-Coding principles", () => {
    const section = generateClaudeMdSection("test");

    expect(section).toContain("TDD");
    expect(section).toContain("Anti-Vibe-Coding");
  });
});

describe("generateCopilotInstructions", () => {
  it("should generate content with markers", () => {
    const content = generateCopilotInstructions("my-project");

    expect(content).toContain(MARKER_START);
    expect(content).toContain(MARKER_END);
    expect(content).toContain("my-project");
  });

  it("should include tool reference and lifecycle", () => {
    const content = generateCopilotInstructions("test");

    expect(content).toContain("next");
    expect(content).toContain("context");
    expect(content).toContain("ANALYZE");
    expect(content).toContain("IMPLEMENT");
  });
});

describe("idempotency", () => {
  it("markers should be consistent for repeated calls", () => {
    const section1 = generateClaudeMdSection("test");
    const section2 = generateClaudeMdSection("test");

    expect(section1).toBe(section2);
  });
});
