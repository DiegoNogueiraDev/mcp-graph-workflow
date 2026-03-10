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
    await page.getByRole("button", { name: "Import PRD" }).click();
    const modal = page.getByRole("heading", { name: "Import PRD" });
    await expect(modal).toBeVisible();
  });

  test("drop zone is visible in modal", async ({ page }) => {
    await page.getByRole("button", { name: "Import PRD" }).click();
    const dropZone = page.getByText("Drag & drop a file here");
    await expect(dropZone).toBeVisible();
  });

  test("cancel closes the dialog", async ({ page }) => {
    await page.getByRole("button", { name: "Import PRD" }).click();
    await expect(page.getByRole("heading", { name: "Import PRD" })).toBeVisible();

    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("heading", { name: "Import PRD" })).not.toBeVisible();
  });

  test("close button closes the dialog", async ({ page }) => {
    await page.getByRole("button", { name: "Import PRD" }).click();
    await expect(page.getByRole("heading", { name: "Import PRD" })).toBeVisible();

    // Close button is the × in the modal header
    await page.locator(".fixed.inset-0 button").filter({ hasText: "×" }).click();
    await expect(page.getByRole("heading", { name: "Import PRD" })).not.toBeVisible();
  });

  test("file upload via setInputFiles triggers import", async ({ page }) => {
    await page.getByRole("button", { name: "Import PRD" }).click();

    const fixturePath = path.join(__dirname, "..", "fixtures", "sample.md");
    const fileInput = page.locator("input[type='file']");
    await fileInput.setInputFiles(fixturePath);

    // Wait for file selection to register
    await page.waitForTimeout(1000);

    // Either the file name is shown or status message appears
    const hasSelectedFile = await page.getByText("Selected:").count();
    const importBtn = page.getByRole("button", { name: "Import" }).last();
    const isEnabled = !(await importBtn.isDisabled());
    expect(hasSelectedFile > 0 || isEnabled).toBeTruthy();
  });
});
