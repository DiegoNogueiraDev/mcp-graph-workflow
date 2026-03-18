import { test, expect } from "@playwright/test";

test.describe("Insights Tab — Redesigned", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: "Insights" }).click();
    await page.waitForTimeout(1500);
  });

  test("renders health gauge section", async ({ page }) => {
    // Health score number is visible
    await expect(page.getByText("Health Score")).toBeVisible();
  });

  test("renders KPI cards", async ({ page }) => {
    await expect(page.getByText("Total Tasks")).toBeVisible();
    await expect(page.getByText("Completion")).toBeVisible();
    await expect(page.getByText("Velocity")).toBeVisible();
    await expect(page.getByText("Blocked")).toBeVisible();
  });

  test("renders chart sections", async ({ page }) => {
    await expect(page.getByText("Status Distribution")).toBeVisible();
    await expect(page.getByText("Node Types")).toBeVisible();
    await expect(page.getByText("Sprint Progress")).toBeVisible();
    await expect(page.getByText("Knowledge Coverage")).toBeVisible();
  });

  test("renders bottlenecks section", async ({ page }) => {
    await expect(page.getByText("Bottlenecks")).toBeVisible();
  });

  test("has refresh button", async ({ page }) => {
    const refreshBtn = page.getByRole("button", { name: "Refresh" });
    await expect(refreshBtn).toBeVisible();
  });
});
