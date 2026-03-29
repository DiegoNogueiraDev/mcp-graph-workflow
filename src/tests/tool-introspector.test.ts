import { describe, it, expect } from "vitest";
import path from "node:path";
import { introspectTools, type ToolInfo } from "../core/docs/tool-introspector.js";

const TOOLS_DIR = path.resolve(__dirname, "../mcp/tools");

describe("tool-introspector", () => {
  let tools: ToolInfo[];

  it("should extract tools from source files", () => {
    tools = introspectTools(TOOLS_DIR);

    expect(tools.length).toBeGreaterThanOrEqual(46);
  });

  it("should include known core tools", () => {
    tools = introspectTools(TOOLS_DIR);
    const names = tools.map((t) => t.name);

    expect(names).toContain("init");
    expect(names).toContain("next");
    expect(names).toContain("analyze");
    expect(names).toContain("help");
    expect(names).toContain("node");
    expect(names).toContain("validate");
  });

  it("should include siebel tools", () => {
    tools = introspectTools(TOOLS_DIR);
    const siebelTools = tools.filter((t) => t.name.startsWith("siebel_"));

    expect(siebelTools.length).toBe(8);
  });

  it("should include translation tools", () => {
    tools = introspectTools(TOOLS_DIR);
    const names = tools.map((t) => t.name);

    expect(names).toContain("translate_code");
    expect(names).toContain("analyze_translation");
    expect(names).toContain("translation_jobs");
  });

  it("should include deprecated tools", () => {
    tools = introspectTools(TOOLS_DIR);
    const deprecated = tools.filter((t) => t.deprecated);

    expect(deprecated.length).toBeGreaterThanOrEqual(5);
    expect(deprecated.map((t) => t.name)).toContain("add_node");
  });

  it("should have name, description, category, sourceFile for each tool", () => {
    tools = introspectTools(TOOLS_DIR);

    for (const tool of tools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.category).toBeTruthy();
      expect(tool.sourceFile).toBeTruthy();
      expect(typeof tool.deprecated).toBe("boolean");
    }
  });

  it("should assign categories based on index.ts groupings", () => {
    tools = introspectTools(TOOLS_DIR);

    const initTool = tools.find((t) => t.name === "init");
    expect(initTool?.category).toBe("Core");

    const siebelTool = tools.find((t) => t.name === "siebel_analyze");
    expect(siebelTool?.category).toBe("Siebel CRM");

    const translateTool = tools.find((t) => t.name === "translate_code");
    expect(translateTool?.category).toBe("Translation");
  });

  it("should extract memory tools (4 from one file)", () => {
    tools = introspectTools(TOOLS_DIR);
    const memoryTools = tools.filter((t) => t.sourceFile.includes("memory.ts"));

    expect(memoryTools.length).toBe(4);
    const names = memoryTools.map((t) => t.name);
    expect(names).toContain("write_memory");
    expect(names).toContain("read_memory");
    expect(names).toContain("list_memories");
    expect(names).toContain("delete_memory");
  });
});
