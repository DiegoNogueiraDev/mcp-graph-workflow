import { test, expect } from "@playwright/test";

test.describe("PRD & Backlog Tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);
    // Navigate to PRD & Backlog tab
    await page.locator('.tab[data-tab="prd-backlog"]').click();
    await page.waitForTimeout(500);
  });

  test("clicking tab shows PRD & Backlog content", async ({ page }) => {
    await expect(page.locator("#tab-prd-backlog")).toHaveClass(/active/);
  });

  test("backlog list shows nodes", async ({ page }) => {
    const backlogList = page.locator("#backlog-list");
    await expect(backlogList).toBeVisible();
  });

  test("next task badge is visible", async ({ page }) => {
    const badge = page.locator("#next-task-badge");
    await expect(badge).toBeVisible();
  });

  test("progress bars render", async ({ page }) => {
    const progressBars = page.locator("#progress-bars");
    await expect(progressBars).toBeVisible();
  });

  test("PRD source section visible", async ({ page }) => {
    const prdSource = page.locator("#prd-source-content");
    await expect(prdSource).toBeVisible();
  });

  test("backlog header visible", async ({ page }) => {
    await expect(page.locator(".backlog-header")).toBeVisible();
  });
});
