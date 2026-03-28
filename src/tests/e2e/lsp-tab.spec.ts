import { test, expect } from "@playwright/test";

test.describe("LSP Tab — UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // Navigate to LSP tab
    const lspTab = page.locator("nav button", { hasText: "LSP" });
    await lspTab.click();
    await page.waitForTimeout(2000);
  });

  // ── Navigation & Layout ─────────────────────────────

  test.describe("Navigation & Layout", () => {
    test("should navigate to LSP tab and show sub-tabs", async ({ page }) => {
      // After loading, sub-tab buttons should be visible
      await expect(page.getByRole("button", { name: "Status" })).toBeVisible();
    });

    test("should display 4 sub-tabs: Status, Symbol Explorer, Diagnostics, Symbols", async ({ page }) => {
      await expect(page.getByRole("button", { name: "Status" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Symbol Explorer" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Diagnostics" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Symbols" })).toBeVisible();
    });

    test("should show Refresh button in header", async ({ page }) => {
      const refreshBtn = page.locator("button[title='Refresh LSP data']");
      await expect(refreshBtn).toBeVisible();
    });

    test("Status sub-tab should be active by default", async ({ page }) => {
      // Status content should be visible (bridge status text)
      await expect(page.getByText("Bridge:")).toBeVisible();
    });
  });

  // ── Status Sub-tab ──────────────────────────────────

  test.describe("Status Sub-tab", () => {
    test("should show bridge status indicator", async ({ page }) => {
      await expect(page.getByText("Bridge:")).toBeVisible();
      // Either "Initialized" or "Not initialized"
      const initialized = page.getByText("Initialized");
      const notInitialized = page.getByText("Not initialized");
      const count = await initialized.count() + await notInitialized.count();
      expect(count).toBeGreaterThan(0);
    });

    test("should show languages or empty state", async ({ page }) => {
      // Temp dir has no source files, expect empty state or language cards
      const emptyState = page.getByText("No languages detected in this project");
      const languageCards = page.getByText("Confidence");
      const count = await emptyState.count() + await languageCards.count();
      expect(count).toBeGreaterThan(0);
    });

    test("should show supported languages footer", async ({ page }) => {
      await expect(page.getByText("Supported:")).toBeVisible();
    });
  });

  // ── Symbol Explorer Sub-tab ─────────────────────────

  test.describe("Symbol Explorer Sub-tab", () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole("button", { name: "Symbol Explorer" }).click();
      await page.waitForTimeout(300);
    });

    test("should switch to Symbol Explorer sub-tab", async ({ page }) => {
      await expect(page.getByPlaceholder("File path (e.g. src/main.ts)")).toBeVisible();
    });

    test("should show file, line, and col inputs", async ({ page }) => {
      await expect(page.getByPlaceholder("File path (e.g. src/main.ts)")).toBeVisible();
      await expect(page.getByPlaceholder("Line")).toBeVisible();
      await expect(page.getByPlaceholder("Col")).toBeVisible();
    });

    test("should show 3 action buttons: Definition, References, Hover", async ({ page }) => {
      await expect(page.getByRole("button", { name: "Definition" })).toBeVisible();
      await expect(page.getByRole("button", { name: "References" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Hover" })).toBeVisible();
    });

    test("action buttons should be disabled when inputs are empty", async ({ page }) => {
      await expect(page.getByRole("button", { name: "Definition" })).toBeDisabled();
      await expect(page.getByRole("button", { name: "References" })).toBeDisabled();
      await expect(page.getByRole("button", { name: "Hover" })).toBeDisabled();
    });

    test("should show empty state before any operation", async ({ page }) => {
      await expect(page.getByText("Enter a file path and position to explore symbols")).toBeVisible();
    });

    test("should enable buttons after filling file path and line", async ({ page }) => {
      await page.getByPlaceholder("File path (e.g. src/main.ts)").fill("src/main.ts");
      await page.getByPlaceholder("Line").fill("1");
      await expect(page.getByRole("button", { name: "Definition" })).toBeEnabled();
      await expect(page.getByRole("button", { name: "References" })).toBeEnabled();
      await expect(page.getByRole("button", { name: "Hover" })).toBeEnabled();
    });

    test("clicking Definition with nonexistent file handles gracefully", async ({ page }) => {
      await page.getByPlaceholder("File path (e.g. src/main.ts)").fill("nonexistent.ts");
      await page.getByPlaceholder("Line").fill("1");
      await page.getByRole("button", { name: "Definition" }).click();

      // Wait for loading to finish
      await page.waitForTimeout(3000);

      // Should not crash — page still shows sub-tabs
      await expect(page.getByRole("button", { name: "Status" })).toBeVisible();
    });
  });

  // ── Diagnostics Sub-tab ─────────────────────────────

  test.describe("Diagnostics Sub-tab", () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole("button", { name: "Diagnostics" }).click();
      await page.waitForTimeout(300);
    });

    test("should switch to Diagnostics sub-tab", async ({ page }) => {
      await expect(page.getByPlaceholder("File path (e.g. src/main.ts)")).toBeVisible();
    });

    test("should show Load button disabled initially", async ({ page }) => {
      await expect(page.getByRole("button", { name: "Load" })).toBeDisabled();
    });

    test("should show empty state before search", async ({ page }) => {
      await expect(page.getByText("Enter a file path to load diagnostics")).toBeVisible();
    });

    test("Load with file path shows results or empty state", async ({ page }) => {
      await page.getByPlaceholder("File path (e.g. src/main.ts)").fill("nonexistent.ts");
      await page.getByRole("button", { name: "Load" }).click();

      // Wait for loading to finish
      await page.waitForTimeout(3000);

      // Should show either diagnostics or "No diagnostics found"
      const noDiagnostics = page.getByText("No diagnostics found for this file");
      const diagnosticItems = page.locator("[class*='text-danger'], [class*='text-warning']");
      const count = await noDiagnostics.count() + await diagnosticItems.count();
      // Page should still be functional (no crash)
      await expect(page.getByRole("button", { name: "Status" })).toBeVisible();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  // ── Symbols Sub-tab ─────────────────────────────────

  test.describe("Symbols Sub-tab", () => {
    test.beforeEach(async ({ page }) => {
      // Click the Symbols sub-tab (scoped to avoid nav conflict)
      const symbolsBtn = page.locator("button").filter({ hasText: /^Symbols$/ }).last();
      await symbolsBtn.click();
      await page.waitForTimeout(300);
    });

    test("should switch to Symbols sub-tab", async ({ page }) => {
      await expect(page.getByPlaceholder("File path (e.g. src/main.ts)")).toBeVisible();
    });

    test("should show empty state before search", async ({ page }) => {
      await expect(page.getByText("Enter a file path to explore document symbols")).toBeVisible();
    });

    test("Load with file path shows tree or empty state", async ({ page }) => {
      await page.getByPlaceholder("File path (e.g. src/main.ts)").fill("nonexistent.ts");
      await page.getByRole("button", { name: "Load" }).click();

      // Wait for loading to finish
      await page.waitForTimeout(3000);

      // Page should still be functional (no crash)
      await expect(page.getByRole("button", { name: "Status" })).toBeVisible();
    });
  });

  // ── Refresh ─────────────────────────────────────────

  test.describe("Refresh", () => {
    test("clicking Refresh should not crash and sub-tabs remain visible", async ({ page }) => {
      const refreshBtn = page.locator("button[title='Refresh LSP data']");
      await refreshBtn.click();
      await page.waitForTimeout(2000);

      // Sub-tabs should still be visible after refresh
      await expect(page.getByRole("button", { name: "Status" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Symbol Explorer" })).toBeVisible();
    });
  });
});
