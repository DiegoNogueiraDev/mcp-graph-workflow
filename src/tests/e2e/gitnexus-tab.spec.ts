import { test, expect } from "@playwright/test";

test.describe("GitNexus Tab — Code Intelligence", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // Navigate to GitNexus tab
    const gitNexusTab = page.locator("nav button", { hasText: "GitNexus" });
    await gitNexusTab.click();
    await page.waitForTimeout(1000);
  });

  // ── Header ─────────────────────────────────────

  test("should display GitNexus header", async ({ page }) => {
    await expect(page.getByText("GitNexus — Code Intelligence")).toBeVisible();
  });

  test("should show GitNexus status badge", async ({ page }) => {
    await expect(page.getByText(/GitNexus:/)).toBeVisible();
  });

  test("should show Query and Symbol view tabs", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Query" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Symbol" })).toBeVisible();
  });

  // ── Symbol Graph Panel (right) ─────────────────

  test("should show empty state in symbol graph panel", async ({ page }) => {
    await expect(page.getByText("No symbol graph")).toBeVisible();
    await expect(page.getByText("Query or select a symbol to see its graph")).toBeVisible();
  });

  // ── View Mode: Query ───────────────────────────

  test("query mode should show query input and button", async ({ page }) => {
    // Query mode is the default
    await expect(page.getByText("Query Code Graph")).toBeVisible();
    await expect(page.getByPlaceholder(/MATCH/)).toBeVisible();
  });

  test("query input should be disabled when GitNexus not running", async ({ page }) => {
    const input = page.getByPlaceholder(/MATCH/);
    // GitNexus is not running in test environment
    await expect(input).toBeDisabled();
  });

  // ── View Mode: Symbol ──────────────────────────

  test("symbol mode should show symbol input with Context and Impact buttons", async ({ page }) => {
    const symbolBtn = page.getByRole("button", { name: "Symbol" });
    await symbolBtn.click();
    await page.waitForTimeout(300);

    await expect(page.getByText("Symbol Explorer")).toBeVisible();
    await expect(page.getByPlaceholder(/SqliteStore/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Context" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Impact" })).toBeVisible();
  });

  test("Context and Impact buttons should be disabled without input", async ({ page }) => {
    const symbolBtn = page.getByRole("button", { name: "Symbol" });
    await symbolBtn.click();
    await page.waitForTimeout(300);

    await expect(page.getByRole("button", { name: "Context" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Impact" })).toBeDisabled();
  });

  // ── Tab switching ──────────────────────────────

  test("switching between view modes should not crash", async ({ page }) => {
    const modes = ["Query", "Symbol"];

    for (const mode of modes) {
      await page.getByRole("button", { name: mode }).click();
      await page.waitForTimeout(200);
    }

    // App should still be responsive
    await expect(page.getByText("GitNexus — Code Intelligence")).toBeVisible();
  });

  // ── Layout integrity ──────────────────────────

  test("2-panel layout should be visible (controls + graph)", async ({ page }) => {
    // Content area (left) — shows query content by default
    const hasContent = await page.getByText("Query Code Graph").count();
    // Graph panel (right) — shows empty state
    const hasGraph = await page.getByText("No symbol graph").count();

    expect(hasContent).toBeGreaterThan(0);
    expect(hasGraph).toBeGreaterThan(0);
  });
});
