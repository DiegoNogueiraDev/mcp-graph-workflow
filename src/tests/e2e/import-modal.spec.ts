import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe("Import Modal", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1000);
  });

  test("Import PRD button opens the dialog", async ({ page }) => {
    await page.locator("#btn-import-prd").click();
    const modal = page.locator("#import-modal");
    await expect(modal).toBeVisible();
  });

  test("drop zone is visible in modal", async ({ page }) => {
    await page.locator("#btn-import-prd").click();
    const dropZone = page.locator("#drop-zone");
    await expect(dropZone).toBeVisible();
  });

  test("cancel closes the dialog", async ({ page }) => {
    await page.locator("#btn-import-prd").click();
    await expect(page.locator("#import-modal")).toBeVisible();

    await page.locator("#import-cancel").click();
    await expect(page.locator("#import-modal")).not.toBeVisible();
  });

  test("close button closes the dialog", async ({ page }) => {
    await page.locator("#btn-import-prd").click();
    await expect(page.locator("#import-modal")).toBeVisible();

    await page.locator("#modal-close").click();
    await expect(page.locator("#import-modal")).not.toBeVisible();
  });

  test("file upload via setInputFiles triggers import", async ({ page }) => {
    await page.locator("#btn-import-prd").click();

    const fixturePath = path.join(__dirname, "..", "fixtures", "sample.md");
    const fileInput = page.locator("#file-input");
    await fileInput.setInputFiles(fixturePath);

    // Wait for import submit button to become enabled or status to update
    await page.waitForTimeout(1000);
    const status = page.locator("#import-status");
    const submitBtn = page.locator("#import-submit");

    // Either the submit is enabled or the status shows a result
    const isEnabled = !(await submitBtn.isDisabled());
    const statusText = await status.textContent();
    expect(isEnabled || (statusText && statusText.length > 0)).toBeTruthy();
  });
});
