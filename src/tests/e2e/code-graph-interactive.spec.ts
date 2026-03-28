import { test, expect } from "@playwright/test";

test.describe("Code Graph — Interactive Functionality", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // Navigate to Code Graph tab
    const codeGraphTab = page.locator("nav button", { hasText: "Code Graph" });
    await codeGraphTab.click();
    await page.waitForTimeout(1000);
  });

  // ── Reindex Action ──────────────────────────────────

  test.describe("Reindex Action", () => {
    test("clicking Reindex should trigger indexing and complete", async ({ page }) => {
      const reindexBtn = page.getByRole("button", { name: "Reindex" });
      await expect(reindexBtn).toBeVisible();
      await reindexBtn.click();

      // Wait for the indexing to complete (temp dir has no files, should be fast)
      await page.waitForTimeout(3000);

      // Button should be visible again after indexing completes
      await expect(page.getByRole("button", { name: "Reindex" })).toBeVisible();
    });

    test("status badge should reflect state after reindex", async ({ page }) => {
      // Trigger reindex
      await page.getByRole("button", { name: "Reindex" }).click();
      await page.waitForTimeout(3000);

      // Status badge should still be present (may show "0 symbols" for empty dir)
      await expect(page.getByText(/Code Graph:/)).toBeVisible();
    });
  });

  // ── Symbol Query ────────────────────────────────────

  test.describe("Symbol Query", () => {
    test("should expand Query section and show query interface", async ({ page }) => {
      const queryBtn = page.getByRole("button", { name: "Query" });
      await expect(queryBtn).toBeVisible();
      await queryBtn.click();
      await page.waitForTimeout(300);

      await expect(page.getByText("Query Code Graph")).toBeVisible();
    });

    test("query submission should show results or empty state", async ({ page }) => {
      // Expand Query section
      await page.getByRole("button", { name: "Query" }).click();
      await page.waitForTimeout(300);

      // Find the query input and fill it
      const queryInput = page.locator("input[placeholder*='MATCH'], input[placeholder*='Search'], textarea").first();
      if (await queryInput.isVisible()) {
        await queryInput.fill("SqliteStore");
        await queryInput.press("Enter");
        await page.waitForTimeout(2000);
      }

      // Should not crash — Query section still visible
      await expect(page.getByText("Query Code Graph")).toBeVisible();
    });
  });

  // ── Symbol Explorer ─────────────────────────────────

  test.describe("Symbol Explorer", () => {
    test.beforeEach(async ({ page }) => {
      const symbolExplorer = page.getByRole("button", { name: "Symbol Explorer" });
      await expect(symbolExplorer).toBeVisible();
      await symbolExplorer.click();
      await page.waitForTimeout(300);
    });

    test("should show symbol input and action buttons", async ({ page }) => {
      await expect(page.getByPlaceholder(/SqliteStore/)).toBeVisible();
      await expect(page.getByRole("button", { name: "Context" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Impact" })).toBeVisible();
    });

    test("clicking Context with a symbol name should not crash", async ({ page }) => {
      const input = page.getByPlaceholder(/SqliteStore/);
      await input.fill("SqliteStore");
      await page.getByRole("button", { name: "Context" }).click();
      await page.waitForTimeout(2000);

      // Page should still be functional
      await expect(page.getByRole("button", { name: "Context" })).toBeVisible();
    });

    test("clicking Impact with a symbol name should not crash", async ({ page }) => {
      const input = page.getByPlaceholder(/SqliteStore/);
      await input.fill("SqliteStore");
      await page.getByRole("button", { name: "Impact" }).click();
      await page.waitForTimeout(2000);

      // Page should still be functional
      await expect(page.getByRole("button", { name: "Impact" })).toBeVisible();
    });
  });

  // ── Code Graph API via page.request ─────────────────

  test.describe("Code Graph API via UI", () => {
    test("GET /api/v1/code-graph/status returns valid JSON", async ({ request }) => {
      const res = await request.get("/api/v1/code-graph/status");
      expect(res.ok()).toBeTruthy();

      const body = await res.json();
      expect(body).toHaveProperty("indexed");
      expect(body).toHaveProperty("symbolCount");
      expect(body).toHaveProperty("typescriptAvailable");
      expect(typeof body.indexed).toBe("boolean");
      expect(typeof body.symbolCount).toBe("number");
    });

    test("POST /api/v1/code-graph/reindex returns success", async ({ request }) => {
      const res = await request.post("/api/v1/code-graph/reindex");
      expect(res.ok()).toBeTruthy();

      const body = await res.json();
      expect(body).toHaveProperty("success", true);
    });

    test("POST /api/v1/code-graph/search returns results array", async ({ request }) => {
      const res = await request.post("/api/v1/code-graph/search", {
        data: { query: "test" },
      });
      expect(res.ok()).toBeTruthy();

      const body = await res.json();
      expect(body).toHaveProperty("results");
      expect(Array.isArray(body.results)).toBe(true);
    });
  });
});
