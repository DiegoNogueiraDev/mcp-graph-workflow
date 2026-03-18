import { test, expect } from "@playwright/test";

test.describe("Memories Tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // Navigate to Memories tab
    const memoriesTab = page.locator("nav button", { hasText: "Memories" });
    await memoriesTab.click();
    await page.waitForTimeout(1000);
  });

  // ── Header ─────────────────────────────────────

  test("should display Memories header", async ({ page }) => {
    await expect(page.getByText("Memories")).toBeVisible();
  });

  test("should show Memories status badge", async ({ page }) => {
    await expect(page.getByText(/Memories:/)).toBeVisible();
  });

  test("should show memory count", async ({ page }) => {
    await expect(page.getByText(/\d+ memories/)).toBeVisible();
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
    // Find collapse button
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

  // ── Memory Content Viewer (right) ──────────────

  test("should show empty state when no memory selected", async ({ page }) => {
    await expect(page.getByText("Select a memory from the explorer")).toBeVisible();
  });

  // ── Layout integrity ──────────────────────────

  test("2-panel layout should be visible (explorer + content)", async ({ page }) => {
    // File explorer (left)
    const hasExplorer = await page.getByPlaceholder("Search files...").count();
    // Content area (right) — shows empty state
    const hasContent = await page.getByText("Select a memory from the explorer").count();

    expect(hasExplorer).toBeGreaterThan(0);
    expect(hasContent).toBeGreaterThan(0);
  });
});
