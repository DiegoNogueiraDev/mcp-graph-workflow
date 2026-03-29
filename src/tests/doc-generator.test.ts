import { describe, it, expect } from "vitest";
import path from "node:path";
import { introspectTools } from "../core/docs/tool-introspector.js";
import { introspectRoutes } from "../core/docs/route-introspector.js";
import {
  generateReadmeStats,
  generateArchToolSection,
  generateArchRouteSection,
  generateToolRefSummary,
} from "../core/docs/doc-generator.js";

const TOOLS_DIR = path.resolve(__dirname, "../mcp/tools");
const API_DIR = path.resolve(__dirname, "../api");

describe("doc-generator", () => {
  const tools = introspectTools(TOOLS_DIR);
  const routes = introspectRoutes(API_DIR);

  it("generateReadmeStats should include tool and endpoint counts", () => {
    const result = generateReadmeStats(tools, routes);

    expect(result).toContain("MCP Tools");
    expect(result).toContain("REST Endpoints");
    expect(result).toContain("deprecated");
    expect(result).toContain("routers");
  });

  it("generateArchToolSection should list categories", () => {
    const result = generateArchToolSection(tools);

    expect(result).toContain("Core");
    expect(result).toContain("Siebel CRM");
    expect(result).toContain("Translation");
    expect(result).toContain("tool registrations");
  });

  it("generateArchRouteSection should include router and endpoint counts", () => {
    const result = generateArchRouteSection(routes);

    expect(result).toContain("routers");
    expect(result).toContain("endpoints");
  });

  it("generateToolRefSummary should include summary table", () => {
    const result = generateToolRefSummary(tools);

    expect(result).toContain("Summary");
    expect(result).toContain("Category");
    expect(result).toContain("Count");
    expect(result).toContain("deprecated");
  });

  it("all generators should produce non-empty markdown", () => {
    expect(generateReadmeStats(tools, routes).length).toBeGreaterThan(100);
    expect(generateArchToolSection(tools).length).toBeGreaterThan(200);
    expect(generateArchRouteSection(routes).length).toBeGreaterThan(20);
    expect(generateToolRefSummary(tools).length).toBeGreaterThan(200);
  });
});
