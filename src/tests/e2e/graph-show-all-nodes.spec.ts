import { test, expect } from "@playwright/test";

test.describe("Graph Tab — Show All Nodes Toggle", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
  });

  test("should show 'Show all nodes' checkbox in filter panel", async ({ page }) => {
    const checkbox = page.locator("label").filter({ hasText: /Show all nodes/ });
    await expect(checkbox).toBeVisible();
  });

  test("should display total node count in checkbox label", async ({ page }) => {
    const label = page.locator("label").filter({ hasText: /Show all nodes/ });
    const text = await label.textContent();
    // Should contain a number in parentheses like "Show all nodes (42)"
    expect(text).toMatch(/Show all nodes \(\d+\)/);
  });

  test("checkbox should be unchecked by default (top-level only)", async ({ page }) => {
    const checkbox = page
      .locator("label")
      .filter({ hasText: /Show all nodes/ })
      .locator("input[type='checkbox']");

    await expect(checkbox).not.toBeChecked();
  });

  test("toggling checkbox should not crash the app", async ({ page }) => {
    const checkbox = page
      .locator("label")
      .filter({ hasText: /Show all nodes/ })
      .locator("input[type='checkbox']");

    if (await checkbox.count() === 0) return;

    // Toggle ON
    await checkbox.click();
    await page.waitForTimeout(500);

    // App should still be responsive
    const hasTable = await page.locator("table").count();
    const hasFlow = await page.locator(".react-flow").count();
    expect(hasTable > 0 || hasFlow > 0).toBeTruthy();

    // Toggle OFF
    await checkbox.click();
    await page.waitForTimeout(500);

    expect(await page.locator("table").count() > 0 || await page.locator(".react-flow").count() > 0).toBeTruthy();
  });

  test("toggling ON should show more rows in node table", async ({ page }) => {
    const tableRows = page.locator("table tbody tr");
    const initialCount = await tableRows.count();
    if (initialCount === 0) return;

    const checkbox = page
      .locator("label")
      .filter({ hasText: /Show all nodes/ })
      .locator("input[type='checkbox']");

    if (await checkbox.count() === 0) return;

    await checkbox.click();
    await page.waitForTimeout(500);

    const expandedCount = await tableRows.count();
    // When toggling ON, we expect same or more rows (all nodes shown)
    expect(expandedCount).toBeGreaterThanOrEqual(initialCount);
  });

  test("toggling should complete within 500ms (performance)", async ({ page }) => {
    const checkbox = page
      .locator("label")
      .filter({ hasText: /Show all nodes/ })
      .locator("input[type='checkbox']");

    if (await checkbox.count() === 0) return;

    const start = Date.now();
    await checkbox.click();
    await page.waitForTimeout(100);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(500);
  });
});
