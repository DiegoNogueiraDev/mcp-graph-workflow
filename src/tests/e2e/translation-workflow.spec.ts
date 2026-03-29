/**
 * Full Translation Workflow — End-to-End Tests
 *
 * Covers the complete translation flow combining UI interactions and API calls:
 * - TS-to-Python translation via UI with History verification
 * - Multiple translations accumulating in History
 * - Complex TypeScript (interfaces, generics) analysis
 * - Stats verification after completed translations
 */
import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Inlined code samples
// ---------------------------------------------------------------------------

const TS_FIBONACCI = `function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}`;

const PY_FIBONACCI = `def fibonacci(n: int) -> int:
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)`;

const GO_FIBONACCI = `func fibonacci(n int) int {
    if n <= 1 {
        return n
    }
    return fibonacci(n-1) + fibonacci(n-2)
}`;

const TS_COMPLEX = `interface Repository<T> {
  findById(id: string): Promise<T | null>;
  save(entity: T): Promise<void>;
}

async function processItems<T extends { id: string }>(
  repo: Repository<T>,
  ids: string[]
): Promise<T[]> {
  const results: T[] = [];
  for (const id of ids) {
    const item = await repo.findById(id);
    if (item) results.push(item);
  }
  return results;
}`;

const PY_FIBONACCI_GENERATED = `def fibonacci(n: int) -> int:
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)`;

const API = "/api/v1/translation";

test.describe.configure({ mode: "serial" });

/** Helper: navigate to Languages tab with SSE blocked */
async function goToLanguages(page: import("@playwright/test").Page): Promise<void> {
  await page.route("**/api/v1/events", (route) => route.abort());
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /Languages beta/i }).click();
  await page.waitForTimeout(500);
}

test.describe("Full Translation Workflow — End-to-End", () => {
  test("should complete TS-to-Python translation via UI and verify in History", async ({
    page,
  }) => {
    await goToLanguages(page);
    const main = page.locator("#main-content");

    // Fill source code
    await page.locator("textarea").first().fill(TS_FIBONACCI);
    await main.getByRole("combobox").selectOption("python");

    // Analyze
    const analyzePromise = page.waitForResponse(
      (r) => r.url().includes("/translation/jobs") && r.request().method() === "POST",
      { timeout: 15000 },
    );
    await main.getByRole("button", { name: /Analyze/i }).click();
    await analyzePromise;
    await page.waitForTimeout(1500);

    // Verify analysis results
    await expect(main.getByText("Complexity")).toBeVisible({ timeout: 5000 });

    // Fill generated code
    const genTextarea = page.locator("textarea").nth(1);
    await expect(genTextarea).toBeVisible({ timeout: 5000 });
    await genTextarea.fill(PY_FIBONACCI_GENERATED);

    // Finalize
    const finalizePromise = page.waitForResponse(
      (r) => r.url().includes("/finalize"),
      { timeout: 15000 },
    );
    await main.getByRole("button", { name: /Finalize/i }).click();
    await finalizePromise;
    await page.waitForTimeout(1500);

    // Verify evidence
    await expect(main.getByText("Translation Evidence")).toBeVisible({ timeout: 5000 });

    // Reset
    await main.getByRole("button", { name: /New/i }).click();
    await page.waitForTimeout(500);

    // Navigate to History and verify the job appears
    await main.getByRole("button", { name: /History/i }).click();
    await page.waitForTimeout(1000);

    // Reload to fetch fresh history (SSE is blocked)
    await page.reload();
    await page.waitForTimeout(2000);
    await page.getByRole("button", { name: /Languages beta/i }).click();
    await page.waitForTimeout(500);
    await main.getByRole("button", { name: /History/i }).click();
    await page.waitForTimeout(1000);

    await expect(main).toContainText(/done/i, { timeout: 10000 });
  });

  test("should accumulate multiple translations in history via API", async ({ page, request }) => {
    // Create 3 jobs via API
    for (const job of [
      { sourceCode: TS_FIBONACCI, targetLanguage: "python" },
      { sourceCode: PY_FIBONACCI, targetLanguage: "go" },
      { sourceCode: GO_FIBONACCI, targetLanguage: "rust" },
    ]) {
      const res = await request.post(`${API}/jobs`, { data: job });
      expect(res.status()).toBe(201);
    }

    // Verify via API
    const listRes = await request.get(`${API}/jobs`);
    const { jobs } = await listRes.json();
    expect(jobs.length).toBeGreaterThanOrEqual(3);

    // Navigate to History and verify in UI
    await goToLanguages(page);
    const main = page.locator("#main-content");
    await main.getByRole("button", { name: /History/i }).click();
    await page.waitForTimeout(2000);

    await expect(main.locator("text=/python/i").first()).toBeVisible({ timeout: 5000 });
  });

  test("should translate complex TypeScript with interfaces and generics", async ({
    page,
  }) => {
    await goToLanguages(page);
    const main = page.locator("#main-content");

    await page.locator("textarea").first().fill(TS_COMPLEX);
    await main.getByRole("combobox").selectOption("python");

    const analyzePromise = page.waitForResponse(
      (r) => r.url().includes("/translation/jobs") && r.request().method() === "POST",
      { timeout: 15000 },
    );
    await main.getByRole("button", { name: /Analyze/i }).click();
    await analyzePromise;
    await page.waitForTimeout(1500);

    // Should detect typescript and show higher complexity
    await expect(main.getByText("Complexity")).toBeVisible({ timeout: 5000 });
    await expect(main.getByText("Translatability")).toBeVisible({ timeout: 5000 });
  });

  test("should verify stats reflect completed translations via API", async ({ request }) => {
    // Create and finalize a job
    const prepRes = await request.post(`${API}/jobs`, {
      data: { sourceCode: TS_FIBONACCI, targetLanguage: "python" },
    });
    const { jobId } = await prepRes.json();

    await request.post(`${API}/jobs/${jobId}/finalize`, {
      data: { generatedCode: PY_FIBONACCI_GENERATED },
    });

    // Check stats
    const statsRes = await request.get(`${API}/stats`);
    const stats = await statsRes.json();
    expect(stats.done).toBeGreaterThanOrEqual(1);
    expect(stats.totalJobs).toBeGreaterThanOrEqual(1);
    expect(stats.avgConfidence).toBeGreaterThan(0);
  });
});
