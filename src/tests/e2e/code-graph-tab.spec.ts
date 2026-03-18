import { test, expect } from "@playwright/test";

/**
 * Validates tab structure after migration:
 *   - "Code Graph" tab exists (native code intelligence, replaced GitNexus)
 *   - "Memories" tab exists (native memories, replaced Serena)
 *   - Navigation has 7 tabs total
 */
test.describe("Code Graph Tab — Post-Migration Validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
  });

  test("should show 'Code Graph' tab in navigation", async ({ page }) => {
    const codeGraphTab = page.locator("nav button", { hasText: "Code Graph" });
    await expect(codeGraphTab).toBeVisible();
  });

  test("should show 'Memories' tab in navigation", async ({ page }) => {
    const memoriesTab = page.locator("nav button", { hasText: "Memories" });
    await expect(memoriesTab).toBeVisible();
  });

  test("navigation should have 7 tabs total", async ({ page }) => {
    const tabs = page.locator("nav button");
    await expect(tabs).toHaveCount(7);
  });
});
