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

describe("tool completeness", () => {
  it("should include consolidated tools", () => {
    const section = generateClaudeMdSection("test");
    expect(section).toContain("node");
    expect(section).toContain("validate");
    expect(section).toContain("manage_skill");
  });

  it("should include core tools", () => {
    const section = generateClaudeMdSection("test");
    expect(section).toContain("set_phase");
    expect(section).toContain("analyze");
    expect(section).toContain("metrics");
    expect(section).toContain("bulk_update_status");
    expect(section).toContain("write_memory");
    expect(section).toContain("read_memory");
    expect(section).toContain("list_memories");
    expect(section).toContain("delete_memory");
  });

  it("should group tools by category", () => {
    const section = generateClaudeMdSection("test");
    expect(section).toContain("Projeto & Grafo");
    expect(section).toContain("Contexto & RAG");
    expect(section).toContain("Skills");
  });

  it("should claim correct tool count (28 + 6 deprecated)", () => {
    const section = generateClaudeMdSection("test");
    expect(section).toContain("28 tools + 6 deprecated");
  });

  it("should include deprecated tools reference", () => {
    const section = generateClaudeMdSection("test");
    expect(section).toContain("deprecated");
    expect(section).toContain("add_node");
    expect(section).toContain("update_node");
    expect(section).toContain("delete_node");
    expect(section).toContain("validate_task");
    expect(section).toContain("validate_ac");
    expect(section).toContain("list_skills");
  });
});

describe("analyze modes section", () => {
  it("should include analyze modes section", () => {
    const section = generateClaudeMdSection("test");
    expect(section).toContain("prd_quality");
    expect(section).toContain("implement_done");
    expect(section).toContain("design_ready");
    expect(section).toContain("backlog_health");
  });

  it("should group analyze modes by lifecycle phase", () => {
    const section = generateClaudeMdSection("test");
    expect(section).toContain("Modos do analyze por fase");
  });
});

describe("knowledge pipeline section", () => {
  it("should include knowledge pipeline section", () => {
    const section = generateClaudeMdSection("test");
    expect(section).toContain("Knowledge");
    expect(section).toContain("RAG");
    expect(section).toContain("reindex_knowledge");
  });
});

describe("doctor CLI command", () => {
  it("should include doctor command", () => {
    const section = generateClaudeMdSection("test");
    expect(section).toContain("doctor");
  });
});

describe("copilot instructions enrichment", () => {
  it("should include set_phase and validate_ac", () => {
    const content = generateCopilotInstructions("test");
    expect(content).toContain("set_phase");
    expect(content).toContain("validate_ac");
    expect(content).toContain("analyze");
  });

  it("copilot instructions should also be idempotent", () => {
    const s1 = generateCopilotInstructions("test");
    const s2 = generateCopilotInstructions("test");
    expect(s1).toBe(s2);
  });
});

describe("copilot instructions parity", () => {
  it("should include mandatory execution rule", () => {
    const content = generateCopilotInstructions("test");
    expect(content).toContain("fonte de verdade ABSOLUTA");
  });

  it("should include full tool table by category", () => {
    const content = generateCopilotInstructions("test");
    expect(content).toContain("Projeto & Grafo");
    expect(content).toContain("Contexto & RAG");
    expect(content).toContain("28 tools + 6 deprecated");
  });

  it("should include analyze modes", () => {
    const content = generateCopilotInstructions("test");
    expect(content).toContain("prd_quality");
    expect(content).toContain("implement_done");
  });

  it("should include knowledge pipeline", () => {
    const content = generateCopilotInstructions("test");
    expect(content).toContain("Knowledge");
    expect(content).toContain("reindex_knowledge");
  });

  it("should include skills section", () => {
    const content = generateCopilotInstructions("test");
    expect(content).toContain("Skills Built-in");
    expect(content).toContain("Self-Healing");
  });

  it("should include CLI commands", () => {
    const content = generateCopilotInstructions("test");
    expect(content).toContain("npx mcp-graph");
    expect(content).toContain("doctor");
  });
});

describe("skills section", () => {
  it("should include manage_skill tool in CLAUDE.md", () => {
    const section = generateClaudeMdSection("test");
    expect(section).toContain("manage_skill");
  });

  it("should include skills by phase table", () => {
    const section = generateClaudeMdSection("test");
    expect(section).toContain("create-prd-chat-mode");
    expect(section).toContain("subagent-driven-development");
    expect(section).toContain("code-reviewer");
    expect(section).toContain("self-healing-awareness");
  });

  it("should include custom skills reference", () => {
    const section = generateClaudeMdSection("test");
    expect(section).toContain("Custom Skills");
  });

  it("copilot instructions should mention manage_skill", () => {
    const content = generateCopilotInstructions("test");
    expect(content).toContain("manage_skill");
  });
});

describe("idempotency", () => {
  it("markers should be consistent for repeated calls", () => {
    const section1 = generateClaudeMdSection("test");
    const section2 = generateClaudeMdSection("test");

    expect(section1).toBe(section2);
  });
});

describe("structural parity (anti-drift)", () => {
  it("both outputs should have identical content between markers", () => {
    const claude = generateClaudeMdSection("test");
    const copilot = generateCopilotInstructions("test");

    const extractBody = (s: string): string => {
      const start = s.indexOf(MARKER_START) + MARKER_START.length;
      const end = s.indexOf(MARKER_END);
      return s.substring(start, end).trim();
    };

    expect(extractBody(copilot)).toBe(extractBody(claude));
  });
});
