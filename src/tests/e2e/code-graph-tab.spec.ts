import { test, expect } from "@playwright/test";

test.describe("Code Graph Tab — 3-Panel Layout", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // Navigate to Code Graph tab
    const codeGraphTab = page.locator("nav button", { hasText: "Code Graph" });
    await codeGraphTab.click();
    await page.waitForTimeout(1000);
  });

  // ── Header ─────────────────────────────────────

  test("should display Code Intelligence header", async ({ page }) => {
    await expect(page.getByText("Code Intelligence")).toBeVisible();
  });

  test("should show GitNexus and Serena status badges", async ({ page }) => {
    await expect(page.getByText(/GitNexus:/)).toBeVisible();
    await expect(page.getByText(/Serena:/)).toBeVisible();
  });

  test("should show Explorer, Query, Symbol view tabs", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Explorer" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Query" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Symbol" })).toBeVisible();
  });

  // ── File Explorer Panel (left) ─────────────────

  test("should show file explorer panel with Files header", async ({ page }) => {
    const filesHeader = page.getByText("FILES", { exact: false });
    await expect(filesHeader).toBeVisible();
  });

  test("should have search input in file explorer", async ({ page }) => {
    const searchInput = page.getByPlaceholder("Search files...");
    await expect(searchInput).toBeVisible();
  });

  test("file explorer should be collapsible", async ({ page }) => {
    // Find collapse button (✕)
    const collapseBtn = page.locator("button[title='Collapse']");
    if (await collapseBtn.count() === 0) return;

    await collapseBtn.click();
    await page.waitForTimeout(300);

    // After collapse, the "Files" vertical text should appear
    const expandBtn = page.locator("button[title='Expand file explorer']");
    await expect(expandBtn).toBeVisible();

    // Re-expand
    await expandBtn.click();
    await page.waitForTimeout(300);
    await expect(page.getByPlaceholder("Search files...")).toBeVisible();
  });

  // ── Symbol Graph Panel (right) ─────────────────

  test("should show empty state in symbol graph panel", async ({ page }) => {
    await expect(page.getByText("No symbol graph")).toBeVisible();
    await expect(page.getByText("Query or select a symbol to see its graph")).toBeVisible();
  });

  // ── View Mode: Explorer ────────────────────────

  test("explorer mode should show empty state when no memory selected", async ({ page }) => {
    await expect(page.getByText("Select a file from the explorer")).toBeVisible();
  });

  // ── View Mode: Query ───────────────────────────

  test("query mode should show query input and button", async ({ page }) => {
    const queryBtn = page.getByRole("button", { name: "Query" });
    await queryBtn.click();
    await page.waitForTimeout(300);

    await expect(page.getByText("Query Code Graph")).toBeVisible();
    await expect(page.getByPlaceholder(/find all functions/)).toBeVisible();
  });

  test("query input should be disabled when GitNexus not running", async ({ page }) => {
    const queryBtn = page.getByRole("button", { name: "Query" });
    await queryBtn.click();
    await page.waitForTimeout(300);

    const input = page.getByPlaceholder(/find all functions/);
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
    const modes = ["Explorer", "Query", "Symbol"];

    for (const mode of modes) {
      await page.getByRole("button", { name: mode }).click();
      await page.waitForTimeout(200);
    }

    // App should still be responsive
    await expect(page.getByText("Code Intelligence")).toBeVisible();
  });

  // ── Layout integrity ──────────────────────────

  test("3-panel layout should be visible (explorer + content + graph)", async ({ page }) => {
    // File explorer (left)
    const hasExplorer = await page.getByPlaceholder("Search files...").count();
    // Content area (center) — shows explorer content by default
    const hasContent = await page.getByText("Select a file from the explorer").count();
    // Graph panel (right) — shows empty state
    const hasGraph = await page.getByText("No symbol graph").count();

    expect(hasExplorer).toBeGreaterThan(0);
    expect(hasContent).toBeGreaterThan(0);
    expect(hasGraph).toBeGreaterThan(0);
  });
});
