import { test, expect } from "@playwright/test";

/**
 * E2E tests for the Skills API endpoints.
 * Validates that built-in skills are accessible via REST API
 * and that the reindex_knowledge endpoint includes skills.
 */
test.describe("Skills API", () => {
  // ── GET /skills — list all ────────────────────────

  test("GET /api/v1/skills returns built-in skills", async ({ request }) => {
    const res = await request.get("/api/v1/skills");
    expect(res.ok()).toBe(true);

    const skills = await res.json();
    expect(Array.isArray(skills)).toBe(true);
    expect(skills.length).toBeGreaterThanOrEqual(19);

    // Verify structure of first skill
    const first = skills[0];
    expect(first).toHaveProperty("name");
    expect(first).toHaveProperty("description");
    expect(first).toHaveProperty("category");
    expect(first).toHaveProperty("source");
  });

  test("GET /api/v1/skills?source=built-in returns only built-in skills", async ({ request }) => {
    const res = await request.get("/api/v1/skills?source=built-in");
    expect(res.ok()).toBe(true);

    const skills = await res.json();
    expect(skills.length).toBe(19);
    expect(skills.every((s: { source: string }) => s.source === "built-in")).toBe(true);
  });

  // ── GET /skills?phase= — filter by phase ──────────

  test("GET /api/v1/skills?phase=ANALYZE returns 3 skills", async ({ request }) => {
    const res = await request.get("/api/v1/skills?phase=ANALYZE");
    expect(res.ok()).toBe(true);

    const skills = await res.json();
    expect(skills.length).toBe(3);

    const names = skills.map((s: { name: string }) => s.name);
    expect(names).toContain("create-prd-chat-mode");
    expect(names).toContain("business-analyst");
    expect(names).toContain("product-manager");
  });

  test("GET /api/v1/skills?phase=IMPLEMENT returns 2 skills", async ({ request }) => {
    const res = await request.get("/api/v1/skills?phase=IMPLEMENT");
    expect(res.ok()).toBe(true);

    const skills = await res.json();
    expect(skills.length).toBe(2);

    const names = skills.map((s: { name: string }) => s.name);
    expect(names).toContain("subagent-driven-development");
    expect(names).toContain("xp-bootstrap");
  });

  test("GET /api/v1/skills?phase=VALIDATE returns 4 skills", async ({ request }) => {
    const res = await request.get("/api/v1/skills?phase=VALIDATE");
    expect(res.ok()).toBe(true);

    const skills = await res.json();
    expect(skills.length).toBe(4);

    const names = skills.map((s: { name: string }) => s.name);
    expect(names).toContain("playwright-explore-website");
    expect(names).toContain("e2e-testing");
  });

  test("GET /api/v1/skills?phase=REVIEW returns 5 skills", async ({ request }) => {
    const res = await request.get("/api/v1/skills?phase=REVIEW");
    expect(res.ok()).toBe(true);

    const skills = await res.json();
    expect(skills.length).toBe(5);

    const names = skills.map((s: { name: string }) => s.name);
    expect(names).toContain("code-reviewer");
    expect(names).toContain("observability-engineer");
  });

  test("GET /api/v1/skills?phase=HANDOFF returns 0 skills", async ({ request }) => {
    const res = await request.get("/api/v1/skills?phase=HANDOFF");
    expect(res.ok()).toBe(true);

    const skills = await res.json();
    expect(skills.length).toBe(0);
  });

  // ── Skill structure validation ────────────────────

  test("built-in skills include phases array", async ({ request }) => {
    const res = await request.get("/api/v1/skills?source=built-in");
    const skills = await res.json();

    for (const skill of skills) {
      expect(skill.phases).toBeDefined();
      expect(Array.isArray(skill.phases)).toBe(true);
      expect(skill.phases.length).toBeGreaterThan(0);
    }
  });

  // ── Knowledge reindex includes skills ─────────────

  test("GET /api/v1/knowledge/stats/summary returns knowledge stats", async ({ request }) => {
    const res = await request.get("/api/v1/knowledge/stats/summary");
    expect(res.ok()).toBe(true);

    const stats = await res.json();
    expect(stats).toHaveProperty("total");
    expect(typeof stats.total).toBe("number");
  });
});
