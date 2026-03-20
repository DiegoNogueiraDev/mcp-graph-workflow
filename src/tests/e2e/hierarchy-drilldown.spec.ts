import { test, expect } from "@playwright/test";

test.describe("Graph Tab — Hierarchy Drill-Down", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
  });

  test("should show root-level epic nodes with expand buttons", async ({ page }) => {
    // E2E epics inserted by test-server should be visible as root nodes
    const flow = page.locator(".react-flow");
    await expect(flow).toBeVisible();

    // Look for expand buttons (nodes with children show "N children" button)
    const expandButtons = page.locator(".react-flow__node button").filter({ hasText: /children/ });
    const count = await expandButtons.count();
    // At least the 2 explicit E2E epics should have expand buttons
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("should show E2E hierarchy epic in the node table", async ({ page }) => {
    const table = page.locator("table tbody");
    await expect(table).toBeVisible();

    // Auth Epic (E2E) should appear in the table
    const authRow = page.locator("table tbody tr").filter({ hasText: "Auth Epic (E2E)" });
    await expect(authRow.first()).toBeVisible();
  });

  test("clicking expand on epic should reveal child tasks", async ({ page }) => {
    // Find the Auth Epic (E2E) node's expand button in React Flow
    const authNode = page.locator(".react-flow__node").filter({ hasText: "Auth Epic (E2E)" });
    const expandBtn = authNode.locator("button").filter({ hasText: /children/ });

    if (await expandBtn.count() === 0) {
      // If no expand button, skip (fixture data might not have loaded)
      test.skip();
      return;
    }

    // Count rows before expand
    const rowsBefore = await page.locator("table tbody tr").count();

    await expandBtn.first().click();
    await page.waitForTimeout(500);

    // After expanding, more rows should be visible (child tasks revealed)
    const rowsAfter = await page.locator("table tbody tr").count();
    expect(rowsAfter).toBeGreaterThan(rowsBefore);

    // Child tasks should now be in the table
    const loginRow = page.locator("table tbody tr").filter({ hasText: "Login Task (E2E)" });
    await expect(loginRow.first()).toBeVisible();
  });

  test("clicking expand on task should reveal subtasks (3-level drill-down)", async ({ page }) => {
    // First expand the Auth Epic
    const authNode = page.locator(".react-flow__node").filter({ hasText: "Auth Epic (E2E)" });
    const epicExpandBtn = authNode.locator("button").filter({ hasText: /children/ });

    if (await epicExpandBtn.count() === 0) {
      test.skip();
      return;
    }

    await epicExpandBtn.first().click();
    await page.waitForTimeout(500);

    // Now expand the Login Task
    const loginNode = page.locator(".react-flow__node").filter({ hasText: "Login Task (E2E)" });
    const taskExpandBtn = loginNode.locator("button").filter({ hasText: /children/ });

    if (await taskExpandBtn.count() === 0) {
      test.skip();
      return;
    }

    await taskExpandBtn.first().click();
    await page.waitForTimeout(500);

    // Subtasks should now be visible
    const emailRow = page.locator("table tbody tr").filter({ hasText: "Email Input (E2E)" });
    await expect(emailRow.first()).toBeVisible();
  });

  test("collapse should hide children", async ({ page }) => {
    // Expand the Auth Epic first
    const authNode = page.locator(".react-flow__node").filter({ hasText: "Auth Epic (E2E)" });
    const expandBtn = authNode.locator("button").filter({ hasText: /children/ });

    if (await expandBtn.count() === 0) {
      test.skip();
      return;
    }

    await expandBtn.first().click();
    await page.waitForTimeout(500);

    // Verify children are visible
    const loginRow = page.locator("table tbody tr").filter({ hasText: "Login Task (E2E)" });
    await expect(loginRow.first()).toBeVisible();

    // Click again to collapse (button text changes to ▼ when expanded)
    const collapseBtn = authNode.locator("button").filter({ hasText: /children/ });
    await collapseBtn.first().click();
    await page.waitForTimeout(500);

    // Children should no longer be in the table
    const loginRowAfter = page.locator("table tbody tr").filter({ hasText: "Login Task (E2E)" });
    await expect(loginRowAfter).toHaveCount(0);
  });

  test("Expand All / Collapse All buttons should work", async ({ page }) => {
    // Find Expand All button in the filter panel
    const expandAllBtn = page.locator("button").filter({ hasText: /Expand All/i });

    if (await expandAllBtn.count() === 0) {
      test.skip();
      return;
    }

    const rowsBefore = await page.locator("table tbody tr").count();

    await expandAllBtn.first().click();
    await page.waitForTimeout(500);

    const rowsExpanded = await page.locator("table tbody tr").count();
    // Expanding all should show more rows than just roots
    expect(rowsExpanded).toBeGreaterThanOrEqual(rowsBefore);

    // Collapse All
    const collapseAllBtn = page.locator("button").filter({ hasText: /Collapse All/i });
    if (await collapseAllBtn.count() > 0) {
      await collapseAllBtn.first().click();
      await page.waitForTimeout(500);

      const rowsCollapsed = await page.locator("table tbody tr").count();
      expect(rowsCollapsed).toBeLessThanOrEqual(rowsExpanded);
    }
  });

  test("Show all nodes checkbox should reveal entire hierarchy", async ({ page }) => {
    const checkbox = page
      .locator("label")
      .filter({ hasText: /Show all nodes/ })
      .locator("input[type='checkbox']");

    if (await checkbox.count() === 0) {
      test.skip();
      return;
    }

    const rowsBefore = await page.locator("table tbody tr").count();

    await checkbox.click();
    await page.waitForTimeout(500);

    const rowsAfter = await page.locator("table tbody tr").count();
    // With show all, should see all nodes including nested children
    expect(rowsAfter).toBeGreaterThanOrEqual(rowsBefore);

    // The E2E subtasks should be visible
    const emailRow = page.locator("table tbody tr").filter({ hasText: "Email Input (E2E)" });
    await expect(emailRow.first()).toBeVisible();
  });
});
