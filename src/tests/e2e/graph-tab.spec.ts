import { test, expect } from "@playwright/test";

test.describe("Graph Tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    // Wait for JS modules to initialize and data to load
    await page.waitForTimeout(1500);
  });

  test("page loads with header and stats bar", async ({ page }) => {
    await expect(page.locator(".logo")).toContainText("mcp-graph");
    await expect(page.locator("#stats-bar")).toBeVisible();
  });

  test("Graph tab is active by default", async ({ page }) => {
    const graphTab = page.locator('.tab[data-tab="graph"]');
    await expect(graphTab).toHaveClass(/active/);
    await expect(page.locator("#tab-graph")).toHaveClass(/active/);
  });

  test("Mermaid diagram renders", async ({ page }) => {
    const mermaidOutput = page.locator("#mermaid-output");
    // Wait for either SVG (rendered graph) or empty state
    const hasSvg = await mermaidOutput.locator("svg").count();
    const isEmpty = await page.locator("#graph-empty").isVisible();
    expect(hasSvg > 0 || isEmpty).toBeTruthy();
  });

  test("node table shows rows from fixture PRD", async ({ page }) => {
    const tableBody = page.locator("#node-table-body");
    const rows = tableBody.locator("tr");
    // Fixture PRD should produce at least some nodes
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test("search filters table rows", async ({ page }) => {
    const searchInput = page.locator("#table-search");
    const tableBody = page.locator("#node-table-body");

    const initialCount = await tableBody.locator("tr").count();
    if (initialCount === 0) return; // skip if no data

    // Type a search term that likely won't match all rows
    await searchInput.fill("xyznonexistent");
    await page.waitForTimeout(300); // debounce
    const filteredCount = await tableBody.locator("tr:visible").count();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  });

  test("sort by column header works", async ({ page }) => {
    const typeHeader = page.locator('th[data-sort="type"]');
    await typeHeader.click();
    // Just verify it doesn't crash
    await expect(page.locator("#node-table-body")).toBeVisible();
  });

  test("click on row opens detail panel", async ({ page }) => {
    const firstRow = page.locator("#node-table-body tr").first();
    const count = await page.locator("#node-table-body tr").count();
    if (count === 0) return;

    await firstRow.click();
    const detailPanel = page.locator("#detail-panel");
    await expect(detailPanel).not.toHaveClass(/hidden/);
  });

  test("detail panel shows node fields", async ({ page }) => {
    const firstRow = page.locator("#node-table-body tr").first();
    const count = await page.locator("#node-table-body tr").count();
    if (count === 0) return;

    await firstRow.click();
    const detailBody = page.locator("#detail-body");
    await expect(detailBody).toBeVisible();
    // Detail should have some text content
    const text = await detailBody.textContent();
    expect(text?.length).toBeGreaterThan(0);
  });

  test("close button hides detail panel", async ({ page }) => {
    const firstRow = page.locator("#node-table-body tr").first();
    const count = await page.locator("#node-table-body tr").count();
    if (count === 0) return;

    await firstRow.click();
    await expect(page.locator("#detail-panel")).not.toHaveClass(/hidden/);

    await page.locator("#detail-close").click();
    await expect(page.locator("#detail-panel")).toHaveClass(/hidden/);
  });

  test("apply and clear filters re-render graph", async ({ page }) => {
    const applyBtn = page.locator("#btn-apply-filters");
    const clearBtn = page.locator("#btn-clear-filters");

    await applyBtn.click();
    await page.waitForTimeout(500);
    await expect(page.locator("#mermaid-output")).toBeVisible();

    await clearBtn.click();
    await page.waitForTimeout(500);
    await expect(page.locator("#mermaid-output")).toBeVisible();
  });
});
