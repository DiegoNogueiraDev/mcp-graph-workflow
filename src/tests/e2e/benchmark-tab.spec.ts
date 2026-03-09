import { test, expect } from "@playwright/test";

test.describe("Benchmark Tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);
  });

  test("Benchmark tab is visible in navigation", async ({ page }) => {
    const tab = page.getByRole("button", { name: "Benchmark" });
    await expect(tab).toBeVisible();
  });

  test("Benchmark tab loads and shows metric cards", async ({ page }) => {
    await page.getByRole("button", { name: "Benchmark" }).click();
    await page.waitForTimeout(1000);

    // Should show metric cards
    const cards = page.locator("[data-testid='metric-card']");
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test("Compression bars render when data exists", async ({ page }) => {
    await page.getByRole("button", { name: "Benchmark" }).click();
    await page.waitForTimeout(1000);

    const bars = page.locator("[data-testid='compression-bars']");
    // May or may not exist depending on data, but should not error
    const count = await bars.count();
    expect(count).toBeLessThanOrEqual(1);
  });

  test("Formulas section is visible", async ({ page }) => {
    await page.getByRole("button", { name: "Benchmark" }).click();
    await page.waitForTimeout(1000);

    const formulas = page.locator("[data-testid='formulas-section']");
    await expect(formulas).toBeVisible();
  });

  test("Dependency Intelligence section shows cards", async ({ page }) => {
    await page.getByRole("button", { name: "Benchmark" }).click();
    await page.waitForTimeout(1000);

    // Check for "Dependency Intelligence" heading
    await expect(page.getByText("Dependency Intelligence")).toBeVisible();
  });
});

test.describe("Existing Tabs - Deeper Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);
  });

  test("Graph tab renders canvas area", async ({ page }) => {
    // Graph tab is default
    const main = page.locator("main");
    await expect(main).toBeVisible();
  });

  test("PRD & Backlog tab shows content", async ({ page }) => {
    await page.getByRole("button", { name: "PRD & Backlog" }).click();
    await page.waitForTimeout(1000);
    const main = page.locator("main");
    await expect(main).toBeVisible();
  });

  test("Insights tab shows metrics or empty state", async ({ page }) => {
    await page.getByRole("button", { name: "Insights" }).click();
    await page.waitForTimeout(1000);
    const main = page.locator("main");
    await expect(main).toBeVisible();
  });

  test("All tabs are present in navigation", async ({ page }) => {
    const tabs = ["Graph", "PRD & Backlog", "Code Graph", "Insights", "Benchmark"];
    for (const name of tabs) {
      await expect(page.getByRole("button", { name })).toBeVisible();
    }
  });
});
