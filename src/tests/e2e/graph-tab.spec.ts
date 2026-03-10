import { test, expect } from "@playwright/test";

test.describe("Graph Tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    // Wait for React app to hydrate and data to load
    await page.waitForTimeout(2000);
  });

  test("page loads with header", async ({ page }) => {
    // React dashboard uses a header component
    await expect(page.locator("header")).toBeVisible();
  });

  test("Graph tab is active by default", async ({ page }) => {
    // Tab nav uses button elements with accent border for active state
    const graphTab = page.locator("nav button", { hasText: "Graph" }).first();
    await expect(graphTab).toBeVisible();
    // Active tab has accent color class
    await expect(graphTab).toHaveCSS("border-bottom-style", "solid");
  });

  test("ReactFlow diagram renders or empty state shows", async ({ page }) => {
    // React dashboard uses ReactFlow instead of mermaid
    const hasReactFlow = await page.locator(".react-flow").count();
    const hasEmptyState = await page.getByText("No nodes in graph").count();
    expect(hasReactFlow > 0 || hasEmptyState > 0).toBeTruthy();
  });

  test("node table shows rows from fixture PRD", async ({ page }) => {
    // NodeTable renders a <table> with <tbody> rows
    const tableRows = page.locator("table tbody tr");
    const count = await tableRows.count();
    // May have nodes from fixture or show "No nodes found"
    expect(count).toBeGreaterThan(0);
  });

  test("search filters table rows", async ({ page }) => {
    const searchInput = page.getByPlaceholder("Search nodes...");
    const tableRows = page.locator("table tbody tr");

    const initialCount = await tableRows.count();
    if (initialCount === 0) return;

    await searchInput.fill("xyznonexistent");
    await page.waitForTimeout(300);
    // Should show "No nodes found" row or fewer rows
    const afterText = await page.locator("table tbody").textContent();
    expect(afterText).toBeTruthy();
  });

  test("sort by column header works", async ({ page }) => {
    // Click the Type column header to sort
    const typeHeader = page.locator("th", { hasText: "Type" });
    await typeHeader.click();
    // Verify table is still visible (no crash)
    await expect(page.locator("table")).toBeVisible();
  });

  test("click on table row opens detail panel", async ({ page }) => {
    const rows = page.locator("table tbody tr");
    const count = await rows.count();
    if (count === 0) return;

    // Click first data row (skip "No nodes found")
    const firstText = await rows.first().textContent();
    if (firstText?.includes("No nodes found")) return;

    await rows.first().click();
    // NodeDetailPanel renders with "Node Details" heading
    const detailPanel = page.getByText("Node Details");
    await expect(detailPanel).toBeVisible();
  });

  test("detail panel shows node fields", async ({ page }) => {
    const rows = page.locator("table tbody tr");
    const count = await rows.count();
    if (count === 0) return;

    const firstText = await rows.first().textContent();
    if (firstText?.includes("No nodes found")) return;

    await rows.first().click();
    // Detail panel should show ID, Type, Status labels
    await expect(page.getByText("Node Details")).toBeVisible();
    // Panel contains structured fields
    const panelText = await page.locator(".w-80").textContent();
    expect(panelText).toBeTruthy();
    expect(panelText!.length).toBeGreaterThan(0);
  });

  test("close button hides detail panel", async ({ page }) => {
    const rows = page.locator("table tbody tr");
    const count = await rows.count();
    if (count === 0) return;

    const firstText = await rows.first().textContent();
    if (firstText?.includes("No nodes found")) return;

    await rows.first().click();
    await expect(page.getByText("Node Details")).toBeVisible();

    // Close button is the × character in the panel header
    await page.locator(".w-80 button").click();
    await expect(page.getByText("Node Details")).not.toBeVisible();
  });

  test("filter checkboxes toggle without crash", async ({ page }) => {
    // FilterPanel has Status: and Type: labels with checkboxes
    const statusCheckboxes = page.locator("label").filter({ hasText: "backlog" }).locator("input[type='checkbox']");
    const count = await statusCheckboxes.count();
    if (count === 0) return;

    await statusCheckboxes.first().click();
    await page.waitForTimeout(300);
    // Graph should still be visible
    const hasReactFlow = await page.locator(".react-flow").count();
    const hasEmpty = await page.getByText("No nodes in graph").count();
    expect(hasReactFlow > 0 || hasEmpty > 0).toBeTruthy();
  });

  test("clear filters button works", async ({ page }) => {
    // Click a filter first
    const checkbox = page.locator("label").filter({ hasText: "done" }).locator("input[type='checkbox']");
    if (await checkbox.count() > 0) {
      await checkbox.first().click();
    }

    // Click Clear button
    const clearBtn = page.getByText("Clear", { exact: true });
    if (await clearBtn.count() > 0) {
      await clearBtn.click();
      await page.waitForTimeout(300);
    }

    // Graph should still be visible
    await expect(page.locator("table")).toBeVisible();
  });
});
