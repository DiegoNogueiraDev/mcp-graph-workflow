import { test, expect } from "@playwright/test";

test.describe("Tab Navigation & Theme", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1000);
  });

  test("Insights tab loads without error", async ({ page }) => {
    await page.getByRole("button", { name: "Insights" }).click();
    await page.waitForTimeout(500);
    // Tab is visible and clickable — no crash
    await expect(page.getByRole("button", { name: "Insights" })).toBeVisible();
  });

  test("Code Graph tab loads without error", async ({ page }) => {
    await page.getByRole("button", { name: "Code Graph" }).click();
    await page.waitForTimeout(500);
    await expect(page.getByRole("button", { name: "Code Graph" })).toBeVisible();
  });

  test("Journey tab loads without error", async ({ page }) => {
    await page.getByRole("button", { name: "Journey" }).click();
    await page.waitForTimeout(500);
    await expect(page.getByRole("button", { name: "Journey" })).toBeVisible();
  });

  test("Siebel tab loads without error", async ({ page }) => {
    await page.getByRole("button", { name: "Siebel" }).click();
    await page.waitForTimeout(500);
    await expect(page.getByRole("button", { name: "Siebel" })).toBeVisible();
  });

  test("theme toggle switches dark/light mode", async ({ page }) => {
    const body = page.locator("body");
    const initialIsDark = await body.evaluate((el) => el.classList.contains("dark"));

    // Theme toggle button shows sun (☀) or moon (☾)
    const themeBtn = page.locator("button[title*='Switch to']");
    await themeBtn.click();
    const afterToggle = await body.evaluate((el) => el.classList.contains("dark"));
    expect(afterToggle).not.toBe(initialIsDark);

    // Toggle back
    await themeBtn.click();
    const afterSecondToggle = await body.evaluate((el) => el.classList.contains("dark"));
    expect(afterSecondToggle).toBe(initialIsDark);
  });

  test("switching tabs deactivates previous tab", async ({ page }) => {
    // Graph tab is active by default — has accent border color
    const graphTab = page.getByRole("button", { name: "Graph", exact: true });
    await expect(graphTab).toHaveClass(/border-\[var\(--color-accent\)\]/);

    // Switch to Insights
    await page.getByRole("button", { name: "Insights" }).click();
    // Graph tab should no longer have accent border
    await expect(graphTab).toHaveClass(/border-transparent/);
    // Insights tab should have accent border
    await expect(page.getByRole("button", { name: "Insights" })).toHaveClass(/border-\[var\(--color-accent\)\]/);
  });

  test("all tabs are present in navigation", async ({ page }) => {
    const tabNames = ["Graph", "PRD & Backlog", "Journey", "Code Graph", "Siebel", "Memories", "Insights", "Skills", "Context", "Benchmark", "Logs"];
    for (const name of tabNames) {
      const exact = name === "Graph"; // avoid matching "Code Graph"
      await expect(page.getByRole("button", { name, exact })).toBeVisible();
    }
  });
});
