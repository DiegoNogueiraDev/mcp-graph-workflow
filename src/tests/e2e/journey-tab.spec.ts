import { test, expect } from "@playwright/test";

test.describe("Journey Tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // Navigate to Journey tab
    const journeyTab = page.locator("nav button", { hasText: "Journey" });
    await journeyTab.click();
    await page.waitForTimeout(1500);
  });

  // ── Tab presence & badge ─────────────────────────

  test("should display Journey tab in navigation with Beta badge", async ({ page }) => {
    const tab = page.locator("nav button", { hasText: "Journey" });
    await expect(tab).toBeVisible();
    // Beta badge should be present inside the tab button
    await expect(tab.locator("text=Beta")).toBeVisible();
  });

  // ── Empty state ──────────────────────────────────

  test("should show empty state when no journey maps exist", async ({ page }) => {
    await expect(page.getByText("No journey maps yet")).toBeVisible();
  });

  test("should show explanation text in empty state", async ({ page }) => {
    await expect(page.getByText(/Import a journey map/)).toBeVisible();
  });

  test("should show Import Journey Map button in empty state", async ({ page }) => {
    const importBtn = page.getByRole("button", { name: "Import Journey Map" });
    await expect(importBtn).toBeVisible();
  });

  // ── Import modal ─────────────────────────────────

  test("should open import modal when clicking Import button", async ({ page }) => {
    await page.getByRole("button", { name: "Import Journey Map" }).click();
    await page.waitForTimeout(300);

    // Modal heading
    await expect(page.locator("h2", { hasText: "Import Journey Map" })).toBeVisible();
    // Textarea for JSON
    await expect(page.getByPlaceholder(/journey/)).toBeVisible();
    // Cancel and Import buttons
    await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Import" })).toBeVisible();
  });

  test("should close import modal on Cancel", async ({ page }) => {
    await page.getByRole("button", { name: "Import Journey Map" }).click();
    await page.waitForTimeout(300);

    await page.getByRole("button", { name: "Cancel" }).click();
    await page.waitForTimeout(300);

    // Modal heading should not be visible
    await expect(page.locator("h2", { hasText: "Import Journey Map" })).not.toBeVisible();
  });

  test("Import button should be disabled when textarea is empty", async ({ page }) => {
    await page.getByRole("button", { name: "Import Journey Map" }).click();
    await page.waitForTimeout(300);

    // The Import button inside the modal (not the empty state one)
    const importBtn = page.locator(".fixed button", { hasText: "Import" }).last();
    await expect(importBtn).toHaveClass(/disabled:opacity-50/);
    await expect(importBtn).toBeDisabled();
  });

  test("should show error for invalid JSON in import", async ({ page }) => {
    await page.getByRole("button", { name: "Import Journey Map" }).click();
    await page.waitForTimeout(300);

    // Type invalid JSON
    await page.getByPlaceholder(/journey/).fill("not valid json");
    // Click the Import button
    await page.locator(".fixed button", { hasText: "Import" }).last().click();
    await page.waitForTimeout(500);

    // Error message should appear
    await expect(page.locator(".fixed").getByText(/JSON|parse|failed|import/i)).toBeVisible();
  });

  test("should import valid journey map and show map selector", async ({ page }) => {
    await page.getByRole("button", { name: "Import Journey Map" }).click();
    await page.waitForTimeout(300);

    const validJson = JSON.stringify({
      journey: { name: "Test Journey E2E" },
      screens: [
        { id: "s1", title: "Home Page", screenType: "landing", url: "/home" },
        { id: "s2", title: "Login Form", screenType: "form", url: "/login" },
      ],
      edges: [
        { id: "e1", from: "s1", to: "s2", type: "navigation", label: "Click Login" },
      ],
    });

    await page.getByPlaceholder(/journey/).fill(validJson);
    await page.locator(".fixed button", { hasText: "Import" }).last().click();
    await page.waitForTimeout(2000);

    // After successful import, MapSelector should appear with "Journey:" label
    await expect(page.getByText("Journey:")).toBeVisible();
    // Import button in the selector bar
    await expect(page.getByText("+ Import")).toBeVisible();
  });
});
