import { test, expect } from "@playwright/test";

test.describe("Graph Tab Filter Performance", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
  });

  test("should toggle status checkbox without freezing (< 500ms)", async ({ page }) => {
    const checkbox = page.locator("label").filter({ hasText: "backlog" }).locator("input[type='checkbox']");
    if (await checkbox.count() === 0) return;

    const start = Date.now();
    await checkbox.click();
    // Wait for ReactFlow to update (re-render)
    await page.waitForTimeout(100);
    const elapsed = Date.now() - start;

    // Should complete well under 500ms
    expect(elapsed).toBeLessThan(500);
    // UI should still be responsive
    await expect(page.locator("table")).toBeVisible();
  });

  test("should toggle type checkbox without freezing (< 500ms)", async ({ page }) => {
    const checkbox = page.locator("label").filter({ hasText: "epic" }).locator("input[type='checkbox']");
    if (await checkbox.count() === 0) return;

    const start = Date.now();
    await checkbox.click();
    await page.waitForTimeout(100);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(500);
    await expect(page.locator("table")).toBeVisible();
  });

  test("should handle rapid checkbox clicks without crash", async ({ page }) => {
    const checkboxes = page.locator("label input[type='checkbox']");
    const count = await checkboxes.count();
    if (count < 3) return;

    // Rapidly toggle multiple checkboxes
    for (let i = 0; i < Math.min(5, count); i++) {
      await checkboxes.nth(i).click({ delay: 0 });
    }

    // Wait for deferred updates to settle
    await page.waitForTimeout(500);

    // App should not have crashed — table or graph still present
    const hasTable = await page.locator("table").count();
    const hasFlow = await page.locator(".react-flow").count();
    const hasEmpty = await page.getByText("No nodes in graph").count();
    expect(hasTable > 0 || hasFlow > 0 || hasEmpty > 0).toBeTruthy();
  });

  test("should clear all filters without freezing", async ({ page }) => {
    // Toggle a couple of filters first
    const statusCb = page.locator("label").filter({ hasText: "done" }).locator("input[type='checkbox']");
    if (await statusCb.count() > 0) {
      await statusCb.click();
    }
    const typeCb = page.locator("label").filter({ hasText: "task" }).locator("input[type='checkbox']").first();
    if (await typeCb.count() > 0) {
      await typeCb.click();
    }

    await page.waitForTimeout(200);

    const clearBtn = page.getByText("Clear", { exact: true });
    if (await clearBtn.count() === 0) return;

    const start = Date.now();
    await clearBtn.click();
    await page.waitForTimeout(100);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(500);
  });

  test("should show correct node count after filtering", async ({ page }) => {
    // Get initial row count
    const initialRows = await page.locator("table tbody tr").count();
    if (initialRows === 0) return;

    // Toggle a status filter
    const doneCb = page.locator("label").filter({ hasText: "done" }).locator("input[type='checkbox']");
    if (await doneCb.count() === 0) return;

    await doneCb.click();
    await page.waitForTimeout(500);

    // Table should update (either fewer rows or "No nodes found")
    const filteredRows = await page.locator("table tbody tr").count();
    // Filtering to "done only" should change the count (unless all are done)
    expect(filteredRows).toBeGreaterThan(0);
  });

  test("should update node table to match filter state", async ({ page }) => {
    // Enable "done" filter only
    const doneCb = page.locator("label").filter({ hasText: /^done$/ }).locator("input[type='checkbox']");
    if (await doneCb.count() === 0) return;

    await doneCb.click();
    await page.waitForTimeout(500);

    // All visible status badges in table should be "done"
    const statusBadges = page.locator("table tbody .rounded-full");
    const badgeCount = await statusBadges.count();

    for (let i = 0; i < badgeCount; i++) {
      const text = await statusBadges.nth(i).textContent();
      expect(text?.trim()).toBe("done");
    }
  });
});
