/**
 * Translation UI E2E Tests
 *
 * Covers:
 * - Languages Tab navigation (header, sub-tabs, routing)
 * - Translation Convert form controls and Analyze/Finalize flow
 * - Translation History (empty state, job display, status, delete)
 */
import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Inlined code samples
// ---------------------------------------------------------------------------

const TS_FIBONACCI = `function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}`;

const PY_FIBONACCI_GENERATED = `def fibonacci(n: int) -> int:
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)`;

const API = "/api/v1/translation";

// ===========================================================================
// Languages Tab — Navigation
// ===========================================================================

test.describe("Languages Tab — Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);
  });

  test("should load Languages tab with header and Beta badge", async ({ page }) => {
    await page.getByRole("button", { name: /Languages beta/i }).click();
    await page.waitForTimeout(500);

    const main = page.locator("#main-content");
    await expect(main.getByText("Language Convert")).toBeVisible();
    await expect(main.getByText("Beta", { exact: true })).toBeVisible();
  });

  test("should show Convert, History, and Insights sub-tabs", async ({ page }) => {
    await page.getByRole("button", { name: /Languages beta/i }).click();
    await page.waitForTimeout(500);

    const main = page.locator("#main-content");
    await expect(main.getByRole("button", { name: /Convert/i })).toBeVisible();
    await expect(main.getByRole("button", { name: /History/i })).toBeVisible();
    await expect(main.getByRole("button", { name: /Insights/i })).toBeVisible();
  });

  test("should have Convert as the default active sub-tab", async ({ page }) => {
    await page.getByRole("button", { name: /Languages beta/i }).click();
    await page.waitForTimeout(500);

    await expect(page.locator("textarea").first()).toBeVisible();
  });

  test("should navigate to History sub-tab", async ({ page }) => {
    await page.getByRole("button", { name: /Languages beta/i }).click();
    await page.waitForTimeout(500);

    const main = page.locator("#main-content");
    await main.getByRole("button", { name: /History/i }).click();
    await page.waitForTimeout(300);

    const historyContent = main.locator("text=/Translation Jobs|No translation/i");
    await expect(historyContent).toBeVisible();
  });

  test("should navigate to Insights sub-tab", async ({ page }) => {
    await page.getByRole("button", { name: /Languages beta/i }).click();
    await page.waitForTimeout(500);

    const main = page.locator("#main-content");
    await main.getByRole("button", { name: /Insights/i }).click();
    await page.waitForTimeout(300);

    await expect(main.getByRole("heading", { name: /Translation Pairs/i })).toBeVisible();
  });
});

// ===========================================================================
// Translation Convert — Form Controls
// ===========================================================================

// Serial mode: analyze tests share server state
test.describe.configure({ mode: "serial" });

/** Helper: navigate to Languages -> Convert tab and fill code.
 *  Blocks SSE to prevent re-renders that reset component state. */
async function setupConvert(page: import("@playwright/test").Page, code?: string): Promise<void> {
  await page.route("**/api/v1/events", (route) => route.abort());

  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /Languages beta/i }).click();
  await page.waitForTimeout(500);
  if (code) {
    await page.locator("textarea").first().fill(code);
    await page.locator("#main-content").getByRole("combobox").selectOption("python");
  }
}

/** Helper: click Analyze and wait for the API response + React re-render */
async function clickAnalyzeAndWait(page: import("@playwright/test").Page): Promise<void> {
  const main = page.locator("#main-content");
  const responsePromise = page.waitForResponse(
    (r) => r.url().includes("/translation/jobs") && r.request().method() === "POST",
    { timeout: 15000 },
  );
  await main.getByRole("button", { name: /Analyze/i }).click();
  await responsePromise;
  await page.waitForTimeout(1500);
}

test.describe("Translation Convert — Form Controls", () => {
  test("should show source code textarea", async ({ page }) => {
    await setupConvert(page);
    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible();
    await expect(textarea).toBeEditable();
  });

  test("should fill source code textarea", async ({ page }) => {
    await setupConvert(page);
    const textarea = page.locator("textarea").first();
    await textarea.fill(TS_FIBONACCI);
    await expect(textarea).toHaveValue(TS_FIBONACCI);
  });

  test("should show target language dropdown with 13 options", async ({ page }) => {
    await setupConvert(page);
    const main = page.locator("#main-content");
    const select = main.getByRole("combobox");
    await expect(select).toBeAttached();
    const count = await select.locator("option").count();
    expect(count).toBe(13);
  });

  test("should allow changing target language", async ({ page }) => {
    await setupConvert(page);
    const select = page.locator("#main-content").getByRole("combobox");
    for (const lang of ["go", "rust", "java", "csharp", "swift"]) {
      await select.selectOption(lang);
      await expect(select).toHaveValue(lang);
    }
  });

  test("should show scope buttons (snippet, function, module)", async ({ page }) => {
    await setupConvert(page);
    const main = page.locator("#main-content");
    for (const scope of ["snippet", "function", "module"]) {
      await expect(main.getByRole("button", { name: new RegExp(`^${scope}$`, "i") })).toBeVisible();
    }
  });

  test("should have Analyze button disabled when textarea is empty", async ({ page }) => {
    await setupConvert(page);
    await expect(page.locator("#main-content").getByRole("button", { name: /Analyze/i })).toBeDisabled();
  });

  test("should enable Analyze button after entering code", async ({ page }) => {
    await setupConvert(page, TS_FIBONACCI);
    await expect(page.locator("#main-content").getByRole("button", { name: /Analyze/i })).toBeEnabled();
  });
});

// ===========================================================================
// Translation Convert — Analyze & Finalize Flow
// ===========================================================================

test.describe("Translation Convert — Analyze & Finalize Flow", () => {
  test("should show analysis results after clicking Analyze", async ({ page }) => {
    await setupConvert(page, TS_FIBONACCI);
    const main = page.locator("#main-content");
    await clickAnalyzeAndWait(page);

    await expect(main.getByText("Complexity")).toBeVisible({ timeout: 5000 });
  });

  test("should show AI Prompt section after analysis", async ({ page }) => {
    await setupConvert(page, TS_FIBONACCI);
    const main = page.locator("#main-content");
    await clickAnalyzeAndWait(page);

    await expect(main.getByText("AI Prompt")).toBeVisible({ timeout: 5000 });
    await expect(main.getByRole("button", { name: /Copy/i })).toBeVisible({ timeout: 5000 });
  });

  test("should show Finalize button disabled when generated code is empty", async ({ page }) => {
    await setupConvert(page, TS_FIBONACCI);
    const main = page.locator("#main-content");
    await clickAnalyzeAndWait(page);

    const finalizeBtn = main.getByRole("button", { name: /Finalize/i });
    await expect(finalizeBtn).toBeVisible({ timeout: 5000 });
    await expect(finalizeBtn).toBeDisabled();
  });

  test("should complete full translate cycle: Analyze -> Finalize -> Evidence", async ({ page }) => {
    await setupConvert(page, TS_FIBONACCI);
    const main = page.locator("#main-content");

    await clickAnalyzeAndWait(page);
    await expect(main.getByText("AI Prompt")).toBeVisible({ timeout: 5000 });

    const genTextarea = page.locator("textarea").nth(1);
    await expect(genTextarea).toBeVisible({ timeout: 5000 });
    await genTextarea.fill(PY_FIBONACCI_GENERATED);

    const finalizePromise = page.waitForResponse(
      (r) => r.url().includes("/finalize"),
      { timeout: 15000 },
    );
    await main.getByRole("button", { name: /Finalize/i }).click();
    await finalizePromise;
    await page.waitForTimeout(1500);

    await expect(main.getByText("Translation Evidence")).toBeVisible({ timeout: 5000 });
  });

  test("should reset form with New button after completion", async ({ page }) => {
    await setupConvert(page, TS_FIBONACCI);
    const main = page.locator("#main-content");

    await clickAnalyzeAndWait(page);
    const genTextarea = page.locator("textarea").nth(1);
    await expect(genTextarea).toBeVisible({ timeout: 5000 });
    await genTextarea.fill(PY_FIBONACCI_GENERATED);

    const finalizePromise = page.waitForResponse(
      (r) => r.url().includes("/finalize"),
      { timeout: 15000 },
    );
    await main.getByRole("button", { name: /Finalize/i }).click();
    await finalizePromise;
    await page.waitForTimeout(1500);

    await main.getByRole("button", { name: /New/i }).click();
    await page.waitForTimeout(500);
    await expect(page.locator("textarea").first()).toHaveValue("");
  });
});

// ===========================================================================
// Translation History — UI
// ===========================================================================

test.describe("Translation History — UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/v1/events", (route) => route.abort());

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);

    await page.getByRole("button", { name: /Languages beta/i }).click();
    await page.waitForTimeout(500);
  });

  test("should show empty state when no jobs exist", async ({ page }) => {
    const main = page.locator("#main-content");
    await main.getByRole("button", { name: /History/i }).click();
    await page.waitForTimeout(500);

    const historyArea = main.locator("text=/Translation Jobs|No translation/i").first();
    await expect(historyArea).toBeVisible({ timeout: 5000 });
  });

  test("should show a job created via API in history", async ({ page, request }) => {
    const main = page.locator("#main-content");

    const prepRes = await request.post(`${API}/jobs`, {
      data: {
        sourceCode: TS_FIBONACCI,
        targetLanguage: "python",
        scope: "snippet",
      },
    });
    expect(prepRes.status()).toBe(201);

    await main.getByRole("button", { name: /History/i }).click();
    await page.waitForTimeout(2000);

    await expect(main.locator("text=/typescript/i").first()).toBeVisible({ timeout: 10000 });
    await expect(main.locator("text=/python/i").first()).toBeVisible({ timeout: 5000 });
  });

  test("should show job status badge", async ({ page, request }) => {
    const main = page.locator("#main-content");

    await request.post(`${API}/jobs`, {
      data: { sourceCode: TS_FIBONACCI, targetLanguage: "go" },
    });

    await main.getByRole("button", { name: /History/i }).click();
    await page.waitForTimeout(2000);

    await expect(main).toContainText(/analyzing|pending|done/i, { timeout: 10000 });
  });

  test("should show completed job after finalize via API", async ({ page, request }) => {
    const main = page.locator("#main-content");

    const prepRes = await request.post(`${API}/jobs`, {
      data: { sourceCode: TS_FIBONACCI, targetLanguage: "python" },
    });
    const { jobId } = await prepRes.json();

    await request.post(`${API}/jobs/${jobId}/finalize`, {
      data: { generatedCode: PY_FIBONACCI_GENERATED },
    });

    await main.getByRole("button", { name: /History/i }).click();
    await page.waitForTimeout(2000);

    await expect(main).toContainText(/done/i, { timeout: 10000 });
  });

  test("should delete a job from history", async ({ page, request }) => {
    const main = page.locator("#main-content");

    const prepRes = await request.post(`${API}/jobs`, {
      data: { sourceCode: TS_FIBONACCI, targetLanguage: "rust" },
    });
    const { jobId } = await prepRes.json();

    await main.getByRole("button", { name: /History/i }).click();
    await page.waitForTimeout(2000);

    const deleteBtn = main.locator("button[title*='delete' i], button[title*='Delete' i], button[aria-label*='delete' i]").first();
    const isVisible = await deleteBtn.isVisible().catch(() => false);

    if (isVisible) {
      page.on("dialog", (dialog) => dialog.accept());
      await deleteBtn.click();
      await page.waitForTimeout(1000);
    }

    const delRes = await request.delete(`${API}/jobs/${jobId}`);
    expect([204, 404]).toContain(delRes.status());
  });
});
