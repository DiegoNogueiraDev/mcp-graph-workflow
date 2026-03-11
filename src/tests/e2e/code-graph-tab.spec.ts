import { test, expect } from "@playwright/test";

/**
 * Legacy "Code Graph" tab was split into two dedicated tabs:
 *   - GitNexus tab (gitnexus-tab.spec.ts) — code intelligence, queries, impact
 *   - Serena tab (serena-tab.spec.ts) — memories, file explorer
 *
 * This spec validates that the old "Code Graph" tab is no longer rendered
 * and that both new tabs exist in the navigation.
 */
test.describe("Code Graph Tab — Migration to GitNexus + Serena", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
  });

  test("should NOT show 'Code Graph' tab in navigation", async ({ page }) => {
    const codeGraphTab = page.locator("nav button", { hasText: "Code Graph" });
    await expect(codeGraphTab).toHaveCount(0);
  });

  test("should show 'GitNexus' tab in navigation", async ({ page }) => {
    const gitNexusTab = page.locator("nav button", { hasText: "GitNexus" });
    await expect(gitNexusTab).toBeVisible();
  });

  test("should show 'Serena' tab in navigation", async ({ page }) => {
    const serenaTab = page.locator("nav button", { hasText: "Serena" });
    await expect(serenaTab).toBeVisible();
  });

  test("navigation should have 6 tabs total", async ({ page }) => {
    const tabs = page.locator("nav button");
    await expect(tabs).toHaveCount(6);
  });
});
