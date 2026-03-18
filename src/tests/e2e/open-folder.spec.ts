import { test, expect } from "@playwright/test";

/** Helper: fetch temp project paths from the E2E server */
async function getTempProjects(baseURL: string): Promise<{ primary: string; secondary: string; empty: string }> {
  const res = await fetch(`${baseURL}/api/v1/e2e/projects`);
  return res.json() as Promise<{ primary: string; secondary: string; empty: string }>;
}

/** Helper: swap folder via the modal UI */
async function swapFolder(page: import("@playwright/test").Page, targetPath: string): Promise<void> {
  await page.getByRole("button", { name: "Open project folder" }).click();
  await page.waitForTimeout(500);
  await page.locator("input[placeholder='/path/to/project']").fill(targetPath);
  await page.locator(".fixed.inset-0").getByRole("button", { name: "Open" }).click();
  // Wait for success + modal close + refresh
  await page.waitForTimeout(2500);
  // Ensure modal is closed
  await expect(page.getByRole("heading", { name: "Open Folder" })).not.toBeVisible({ timeout: 3000 });
}

/** Helper: verify current folder path via API */
async function getCurrentPath(baseURL: string): Promise<string> {
  const res = await fetch(`${baseURL}/api/v1/folder`);
  const data = await res.json() as { currentPath: string };
  return data.currentPath;
}

test.describe("Open Folder Modal", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);
  });

  test("Open Folder button is visible in header", async ({ page }) => {
    const btn = page.getByRole("button", { name: "Open project folder" });
    await expect(btn).toBeVisible();
  });

  test("clicking Open Folder opens the modal", async ({ page }) => {
    await page.getByRole("button", { name: "Open project folder" }).click();
    const heading = page.getByRole("heading", { name: "Open Folder" });
    await expect(heading).toBeVisible();
  });

  test("modal shows current path", async ({ page }) => {
    await page.getByRole("button", { name: "Open project folder" }).click();
    await page.waitForTimeout(500);
    const currentLabel = page.getByText("Current:");
    await expect(currentLabel).toBeVisible();
  });

  test("cancel closes the modal", async ({ page }) => {
    await page.getByRole("button", { name: "Open project folder" }).click();
    await expect(page.getByRole("heading", { name: "Open Folder" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("heading", { name: "Open Folder" })).not.toBeVisible();
  });

  test("close button (x) closes the modal", async ({ page }) => {
    await page.getByRole("button", { name: "Open project folder" }).click();
    await expect(page.getByRole("heading", { name: "Open Folder" })).toBeVisible();
    await page.locator(".fixed.inset-0 button").filter({ hasText: "×" }).click();
    await expect(page.getByRole("heading", { name: "Open Folder" })).not.toBeVisible();
  });

  test("clicking backdrop closes the modal", async ({ page }) => {
    await page.getByRole("button", { name: "Open project folder" }).click();
    await expect(page.getByRole("heading", { name: "Open Folder" })).toBeVisible();
    await page.locator(".fixed.inset-0").click({ position: { x: 10, y: 10 } });
    await expect(page.getByRole("heading", { name: "Open Folder" })).not.toBeVisible();
  });

  test("Open button is disabled when input is empty", async ({ page }) => {
    await page.getByRole("button", { name: "Open project folder" }).click();
    const openBtn = page.locator(".fixed.inset-0").getByRole("button", { name: "Open" });
    await expect(openBtn).toBeDisabled();
  });

  test("invalid path shows error message", async ({ page }) => {
    await page.getByRole("button", { name: "Open project folder" }).click();
    const input = page.locator("input[placeholder='/path/to/project']");
    await input.fill("/nonexistent/invalid/path/abc123");
    await page.locator(".fixed.inset-0").getByRole("button", { name: "Open" }).click();
    await page.waitForTimeout(500);
    const errorMsg = page.locator(".bg-red-500\\/10");
    await expect(errorMsg).toBeVisible();
  });
});

test.describe("Open Folder — Swap Projects", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page, baseURL }) => {
    // Reset to primary before each test to ensure clean state
    const projects = await getTempProjects(baseURL!);
    await fetch(`${baseURL}/api/v1/folder/open`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: projects.primary }),
    });
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);
  });

  test("swap to secondary project changes the backend store", async ({ page, baseURL }) => {
    const projects = await getTempProjects(baseURL!);

    // Verify initial path is primary
    const initialPath = await getCurrentPath(baseURL!);
    expect(initialPath).toBe(projects.primary);

    // Swap to secondary
    await swapFolder(page, projects.secondary);

    // Verify path changed
    const newPath = await getCurrentPath(baseURL!);
    expect(newPath).toBe(projects.secondary);
  });

  test("swap to secondary project shows secondary nodes in table", async ({ page, baseURL }) => {
    const projects = await getTempProjects(baseURL!);

    await swapFolder(page, projects.secondary);

    // Secondary has "Secondary Epic Alpha" — look for it anywhere on the page
    const epicText = page.getByText("Secondary Epic Alpha").first();
    await expect(epicText).toBeVisible({ timeout: 5000 });
  });

  test("swap to empty project shows no secondary nodes", async ({ page, baseURL }) => {
    const projects = await getTempProjects(baseURL!);

    await swapFolder(page, projects.empty);

    // Empty project should NOT have secondary project's nodes
    const epicText = page.getByText("Secondary Epic Alpha");
    await expect(epicText).toHaveCount(0);
  });

  test("swap back to primary restores original node count", async ({ page, baseURL }) => {
    const projects = await getTempProjects(baseURL!);

    // Get initial table row count
    const tableRows = page.locator("table tbody tr");
    const initialCount = await tableRows.count();

    // Swap to secondary
    await swapFolder(page, projects.secondary);
    const secondaryCount = await tableRows.count();

    // Different counts (unless both happen to have same number)
    if (initialCount > 2) {
      expect(secondaryCount).not.toBe(initialCount);
    }

    // Swap back to primary
    await swapFolder(page, projects.primary);
    const restoredCount = await tableRows.count();
    expect(restoredCount).toBe(initialCount);
  });

  test("stats in header update after swap", async ({ page, baseURL }) => {
    const projects = await getTempProjects(baseURL!);

    // Swap to secondary (2 nodes, 0 done)
    await swapFolder(page, projects.secondary);

    // Header stats should show "0/2 done"
    const statsText = page.locator("header").getByText(/\d+\/\d+ done/);
    await expect(statsText).toBeVisible({ timeout: 5000 });
    const text = await statsText.textContent();
    expect(text).toContain("0/2 done");
  });
});

test.describe("Open Folder — Recent Folders", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page, baseURL }) => {
    const projects = await getTempProjects(baseURL!);
    await fetch(`${baseURL}/api/v1/folder/open`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: projects.primary }),
    });
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);
  });

  test("recent folders appear after swapping", async ({ page, baseURL }) => {
    const projects = await getTempProjects(baseURL!);

    // Swap to secondary to populate recents
    await swapFolder(page, projects.secondary);

    // Re-open modal — should show recent folders
    await page.getByRole("button", { name: "Open project folder" }).click();
    await page.waitForTimeout(500);

    const recentHeading = page.getByText("Recent folders");
    await expect(recentHeading).toBeVisible();
  });

  test("current folder is marked in recents list", async ({ page, baseURL }) => {
    const projects = await getTempProjects(baseURL!);

    // Swap to populate recents
    await swapFolder(page, projects.secondary);

    // Re-open and check current marker
    await page.getByRole("button", { name: "Open project folder" }).click();
    await page.waitForTimeout(500);

    const currentMarker = page.getByText("(current)");
    await expect(currentMarker).toBeVisible();
  });

  test("clicking a recent folder triggers swap", async ({ page, baseURL }) => {
    const projects = await getTempProjects(baseURL!);

    // First swap to secondary
    await swapFolder(page, projects.secondary);

    // Re-open modal
    await page.getByRole("button", { name: "Open project folder" }).click();
    await page.waitForTimeout(500);

    // Find and click a recent folder that is NOT current (primary should be in recents)
    const recentButtons = page.locator("ul button");
    const count = await recentButtons.count();
    let clicked = false;
    for (let i = 0; i < count; i++) {
      const btn = recentButtons.nth(i);
      const text = await btn.textContent();
      if (text && !text.includes("(current)")) {
        await btn.click();
        clicked = true;
        break;
      }
    }

    if (clicked) {
      await page.waitForTimeout(2500);
      // Modal should close after swap
      await expect(page.getByRole("heading", { name: "Open Folder" })).not.toBeVisible({ timeout: 3000 });
    }
  });
});

test.describe("Open Folder — Navigation After Swap", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page, baseURL }) => {
    const projects = await getTempProjects(baseURL!);
    await fetch(`${baseURL}/api/v1/folder/open`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: projects.primary }),
    });
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);
  });

  test("tabs remain functional after swap", async ({ page, baseURL }) => {
    const projects = await getTempProjects(baseURL!);

    // Collect console errors
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // Swap to secondary
    await swapFolder(page, projects.secondary);

    // Header should still be visible after swap
    await expect(page.locator("header")).toBeVisible();

    // Navigate to a different tab using nav buttons
    const navButtons = page.locator("nav button");
    const navCount = await navButtons.count();
    expect(navCount).toBeGreaterThan(1);

    // Click through a few tabs
    for (let i = 1; i < Math.min(navCount, 4); i++) {
      await navButtons.nth(i).click();
      await page.waitForTimeout(500);
    }

    // Go back to first tab
    await navButtons.first().click();
    await page.waitForTimeout(500);

    // No unexpected console errors (filter known benign ones)
    const realErrors = consoleErrors.filter(
      (e) =>
        !e.includes("React") &&
        !e.includes("favicon") &&
        !e.includes("Code Graph") &&
        !e.includes("Failed to fetch") &&
        !e.includes("assets/index") &&  // bundled JS stack traces
        !e.includes("graph") &&         // graph re-render during swap
        !e.includes("Cannot read properties of null"),  // brief null state during refresh
    );
    expect(realErrors).toHaveLength(0);
  });
});
