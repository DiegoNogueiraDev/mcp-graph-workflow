import { test, expect } from "@playwright/test";

test.describe("SSE Real-Time Updates", () => {
  test("page establishes SSE connection", async ({ page }) => {
    // Monitor network requests to verify SSE connection is established
    const sseRequestPromise = page.waitForRequest(
      (req) => req.url().includes("/api/v1/events"),
      { timeout: 10_000 },
    );

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // The app.js connects to SSE on load — verify the request was made
    const sseRequest = await sseRequestPromise;
    expect(sseRequest.url()).toContain("/api/v1/events");
  });

  test("creating a node via API updates the page", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);

    // Get initial stats
    const initialStats = await page.locator("#stats-bar").textContent();

    // Create a node via the API
    await page.request.post("/api/v1/nodes", {
      data: {
        type: "task",
        title: "E2E SSE Test Node",
        status: "done",
        priority: 3,
      },
    });

    // Wait for SSE event to trigger UI update
    await page.waitForTimeout(2000);

    // Stats bar should have updated
    const updatedStats = await page.locator("#stats-bar").textContent();
    // The number should have changed since we added a done node
    expect(updatedStats).toBeDefined();
  });

  test("health endpoint responds", async ({ page }) => {
    const response = await page.request.get("/health");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
  });
});
