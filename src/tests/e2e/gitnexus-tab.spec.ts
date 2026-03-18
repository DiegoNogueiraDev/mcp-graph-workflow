import { test, expect } from "@playwright/test";

test.describe("Code Graph Tab — Code Intelligence", () => {
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

  test("should display Code Graph header", async ({ page }) => {
    await expect(page.getByText("Code Graph — Code Intelligence")).toBeVisible();
  });

  test("should show Code Graph status badge", async ({ page }) => {
    await expect(page.getByText(/Code Graph:/)).toBeVisible();
  });

  // ── Sidebar: Explorer / Filters ────────────────

  test("should show Explorer and Filters sidebar tabs", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Explorer" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Filters" })).toBeVisible();
  });

  test("Explorer tab should show search box with placeholder", async ({ page }) => {
    await expect(page.getByPlaceholder("Search files...")).toBeVisible();
  });

  test("Explorer tab should show file tree or empty state", async ({ page }) => {
    // Either shows indexed files or empty state
    const hasTree = await page.locator("text=/No files indexed|No files match/").count();
    const hasFiles = await page.locator("button:has-text('.ts')").count();
    expect(hasTree + hasFiles).toBeGreaterThan(0);
  });

  test("Filters tab should show NODE TYPES section with toggles", async ({ page }) => {
    await page.getByRole("button", { name: "Filters" }).click();
    await page.waitForTimeout(300);

    await expect(page.getByText("Node Types")).toBeVisible();
    await expect(page.getByText("Toggle visibility of node types in the graph")).toBeVisible();
  });

  test("Filters tab should show EDGE TYPES section with toggles", async ({ page }) => {
    await page.getByRole("button", { name: "Filters" }).click();
    await page.waitForTimeout(300);

    await expect(page.getByText("Edge Types")).toBeVisible();
    await expect(page.getByText("Toggle visibility of relationship types")).toBeVisible();
  });

  test("Filters tab should show Focus Depth buttons", async ({ page }) => {
    await page.getByRole("button", { name: "Filters" }).click();
    await page.waitForTimeout(300);

    await expect(page.getByText("Focus Depth")).toBeVisible();
    await expect(page.getByRole("button", { name: "All" })).toBeVisible();
    await expect(page.getByRole("button", { name: "1 hop" })).toBeVisible();
    await expect(page.getByRole("button", { name: "2 hops" })).toBeVisible();
    await expect(page.getByRole("button", { name: "3 hops" })).toBeVisible();
  });

  test("Filters tab should show COLOR LEGEND", async ({ page }) => {
    await page.getByRole("button", { name: "Filters" }).click();
    await page.waitForTimeout(300);

    await expect(page.getByText("Color Legend")).toBeVisible();
  });

  // ── Symbol Graph Panel (right) ─────────────────

  test("should show empty state in symbol graph panel", async ({ page }) => {
    await expect(page.getByText("No symbol graph")).toBeVisible();
    await expect(page.getByText("Query or select a symbol to see its graph")).toBeVisible();
  });

  // ── Collapsible sections ───────────────────────

  test("symbol explorer should be accessible as collapsible section", async ({ page }) => {
    // Click to expand the Symbol Explorer collapsible
    const symbolSection = page.getByRole("button", { name: "Symbol Explorer" });
    await expect(symbolSection).toBeVisible();
    await symbolSection.click();
    await page.waitForTimeout(200);

    await expect(page.getByPlaceholder(/SqliteStore/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Context" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Impact" })).toBeVisible();
  });

  test("query section should be accessible as collapsible section", async ({ page }) => {
    const querySection = page.getByRole("button", { name: "Query" });
    await expect(querySection).toBeVisible();
    await querySection.click();
    await page.waitForTimeout(200);

    await expect(page.getByText("Query Code Graph")).toBeVisible();
  });

  // ── Reindex button ─────────────────────────────

  test("should show Reindex button", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Reindex" })).toBeVisible();
  });

  // ── Path bar / Open Folder ───────────────────

  test("should display current path or 'No project path'", async ({ page }) => {
    const pathLabel = page.locator("text=/Current:|No project path/");
    await expect(pathLabel).toBeVisible();
  });

  test("should show 'Open Folder...' button", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Open Folder..." })).toBeVisible();
  });

  test("clicking 'Open Folder...' should open the folder browser modal", async ({ page }) => {
    await page.getByRole("button", { name: "Open Folder..." }).click();
    await expect(page.getByText("Open Folder")).toBeVisible();
    await expect(page.getByPlaceholder("/path/to/project")).toBeVisible();
  });

  // ── Layout integrity ──────────────────────────

  test("2-panel layout should be visible (controls + graph)", async ({ page }) => {
    // Graph panel (right) — shows empty state
    const hasGraph = await page.getByText("No symbol graph").count();
    expect(hasGraph).toBeGreaterThan(0);
  });
});
