import { test, expect } from "@playwright/test";

test.describe("Tab Navigation & Theme", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1000);
  });

  test("Knowledge tab loads without error", async ({ page }) => {
    await page.locator('.tab[data-tab="knowledge"]').click();
    await page.waitForTimeout(500);
    await expect(page.locator("#tab-knowledge")).toHaveClass(/active/);
    // No crash, content area visible
    await expect(page.locator("#tab-knowledge")).toBeVisible();
  });

  test("Insights tab loads without error", async ({ page }) => {
    await page.locator('.tab[data-tab="insights"]').click();
    await page.waitForTimeout(500);
    await expect(page.locator("#tab-insights")).toHaveClass(/active/);
    await expect(page.locator("#tab-insights")).toBeVisible();
  });

  test("Code Graph tab loads without error", async ({ page }) => {
    await page.locator('.tab[data-tab="code-graph"]').click();
    await page.waitForTimeout(500);
    await expect(page.locator("#tab-code-graph")).toHaveClass(/active/);
    await expect(page.locator("#tab-code-graph")).toBeVisible();
  });

  test("theme toggle switches dark/light mode", async ({ page }) => {
    const body = page.locator("body");
    const initialIsDark = await body.evaluate((el) => el.classList.contains("dark"));

    await page.locator("#theme-toggle").click();
    const afterToggle = await body.evaluate((el) => el.classList.contains("dark"));
    expect(afterToggle).not.toBe(initialIsDark);

    // Toggle back
    await page.locator("#theme-toggle").click();
    const afterSecondToggle = await body.evaluate((el) => el.classList.contains("dark"));
    expect(afterSecondToggle).toBe(initialIsDark);
  });

  test("switching tabs deactivates previous tab", async ({ page }) => {
    // Start on Graph tab
    await expect(page.locator('.tab[data-tab="graph"]')).toHaveClass(/active/);

    // Switch to Knowledge
    await page.locator('.tab[data-tab="knowledge"]').click();
    await expect(page.locator('.tab[data-tab="graph"]')).not.toHaveClass(/active/);
    await expect(page.locator('.tab[data-tab="knowledge"]')).toHaveClass(/active/);
  });

  test("all tabs are present in navigation", async ({ page }) => {
    const tabNames = ["graph", "prd-backlog", "code-graph", "knowledge", "insights"];
    for (const name of tabNames) {
      await expect(page.locator(`.tab[data-tab="${name}"]`)).toBeVisible();
    }
  });
});
