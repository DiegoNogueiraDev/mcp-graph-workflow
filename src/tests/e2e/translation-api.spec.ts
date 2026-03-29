/**
 * Translation API + MCP Tool E2E Tests
 *
 * Covers:
 * - POST /translation/analyze (language detection, construct analysis, scores)
 * - Translation Jobs CRUD (create, list, get, delete)
 * - Translation Finalize (evidence pack)
 * - Translation Stats
 * - MCP translate_code tool (prepare + finalize phases)
 * - MCP analyze_translation tool (language detection, constructs, scores, ambiguity)
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

const JAVA_FIBONACCI = `public class MathUtils {
    public static int fibonacci(int n) {
        if (n <= 1) return n;
        return fibonacci(n - 1) + fibonacci(n - 2);
    }
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

const PY_CLASS = `class Calculator:
    def __init__(self, precision: int = 2):
        self.precision = precision
        self._history: list[float] = []

    def add(self, a: float, b: float) -> float:
        result = round(a + b, self.precision)
        self._history.append(result)
        return result

    def get_history(self) -> list[float]:
        return self._history.copy()`;

const RUST_STRUCT = `struct Point {
    x: f64,
    y: f64,
}

impl Point {
    fn new(x: f64, y: f64) -> Self {
        Point { x, y }
    }

    fn distance(&self, other: &Point) -> f64 {
        ((self.x - other.x).powi(2) + (self.y - other.y).powi(2)).sqrt()
    }
}`;

const CSHARP_LINQ = `using System.Linq;

public class DataProcessor
{
    public async Task<List<string>> GetActiveUsers(IEnumerable<User> users)
    {
        return users
            .Where(u => u.IsActive && u.Age >= 18)
            .OrderBy(u => u.Name)
            .Select(u => u.Name)
            .ToList();
    }
}`;

const MINIMAL_SNIPPET = `const x = 1;`;

const PY_FIBONACCI_GENERATED = `def fibonacci(n: int) -> int:
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)`;

const GO_FIBONACCI_GENERATED = `func fibonacci(n int) int {
    if n <= 1 {
        return n
    }
    return fibonacci(n-1) + fibonacci(n-2)
}`;

const RUST_FIBONACCI_GENERATED = `fn fibonacci(n: i32) -> i32 {
    if n <= 1 {
        return n;
    }
    fibonacci(n - 1) + fibonacci(n - 2)
}`;

const API = "/api/v1/translation";

// ===========================================================================
// POST /translation/analyze — Language Detection
// ===========================================================================

test.describe("POST /translation/analyze — Language Detection", () => {
  test("should detect TypeScript correctly", async ({ request }) => {
    const res = await request.post(`${API}/analyze`, {
      data: { code: TS_FIBONACCI },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.detectedLanguage).toBe("typescript");
    expect(body.totalConstructs).toBeGreaterThan(0);
  });

  test("should detect Python correctly", async ({ request }) => {
    const res = await request.post(`${API}/analyze`, {
      data: { code: PY_FIBONACCI },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.detectedLanguage).toBe("python");
    expect(body.totalConstructs).toBeGreaterThan(0);
  });

  test("should detect Go correctly", async ({ request }) => {
    const res = await request.post(`${API}/analyze`, {
      data: { code: GO_FIBONACCI },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.detectedLanguage).toBe("go");
  });

  test("should detect Java correctly", async ({ request }) => {
    const res = await request.post(`${API}/analyze`, {
      data: { code: JAVA_FIBONACCI },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.detectedLanguage).toBe("java");
  });

  test("should return complexity and translatability scores", async ({ request }) => {
    const res = await request.post(`${API}/analyze`, {
      data: { code: TS_COMPLEX },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.complexityScore).toBe("number");
    expect(body.complexityScore).toBeGreaterThanOrEqual(0);
    expect(body.complexityScore).toBeLessThanOrEqual(1);
    expect(typeof body.estimatedTranslatability).toBe("number");
    expect(body.estimatedTranslatability).toBeGreaterThanOrEqual(0);
    expect(body.estimatedTranslatability).toBeLessThanOrEqual(1);
  });

  test("should return construct list with canonical names", async ({ request }) => {
    const res = await request.post(`${API}/analyze`, {
      data: { code: TS_FIBONACCI },
    });
    const body = await res.json();
    expect(Array.isArray(body.constructs)).toBe(true);
    for (const c of body.constructs) {
      expect(typeof c.canonicalName).toBe("string");
      expect(typeof c.count).toBe("number");
      expect(typeof c.confidence).toBe("number");
    }
  });

  test("should accept languageHint parameter", async ({ request }) => {
    const res = await request.post(`${API}/analyze`, {
      data: { code: PY_FIBONACCI, languageHint: "python" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.detectedLanguage).toBe("python");
  });

  test("should accept targetLanguage for scoring", async ({ request }) => {
    const res = await request.post(`${API}/analyze`, {
      data: { code: TS_FIBONACCI, targetLanguage: "python" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.estimatedTranslatability).toBe("number");
  });

  test("should return 400 for empty code string", async ({ request }) => {
    const res = await request.post(`${API}/analyze`, {
      data: { code: "" },
    });
    expect(res.status()).toBe(400);
  });

  test("should return 400 for missing code field", async ({ request }) => {
    const res = await request.post(`${API}/analyze`, {
      data: {},
    });
    expect(res.status()).toBe(400);
  });
});

// ===========================================================================
// Translation Jobs — CRUD
// ===========================================================================

test.describe("Translation Jobs — CRUD", () => {
  test("should create a TS-to-Python snippet job", async ({ request }) => {
    const res = await request.post(`${API}/jobs`, {
      data: {
        sourceCode: TS_FIBONACCI,
        targetLanguage: "python",
        scope: "snippet",
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(typeof body.jobId).toBe("string");
    expect(body.jobId.length).toBeGreaterThan(0);
    expect(typeof body.prompt).toBe("string");
    expect(body.prompt.toLowerCase()).toContain("python");
    expect(body.analysis).toBeTruthy();
    expect(body.analysis.detectedLanguage).toBe("typescript");
  });

  test("should create a Python-to-Go function job", async ({ request }) => {
    const res = await request.post(`${API}/jobs`, {
      data: {
        sourceCode: PY_FIBONACCI,
        targetLanguage: "go",
        scope: "function",
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.prompt.toLowerCase()).toContain("go");
    expect(body.analysis.detectedLanguage).toBe("python");
  });

  test("should create a Go-to-Rust module job", async ({ request }) => {
    const res = await request.post(`${API}/jobs`, {
      data: {
        sourceCode: GO_FIBONACCI,
        targetLanguage: "rust",
        scope: "module",
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(typeof body.jobId).toBe("string");
  });

  test("should list jobs after creation", async ({ request }) => {
    await request.post(`${API}/jobs`, {
      data: { sourceCode: TS_FIBONACCI, targetLanguage: "python" },
    });
    await request.post(`${API}/jobs`, {
      data: { sourceCode: PY_FIBONACCI, targetLanguage: "go" },
    });

    const listRes = await request.get(`${API}/jobs`);
    expect(listRes.status()).toBe(200);
    const body = await listRes.json();
    expect(Array.isArray(body.jobs)).toBe(true);
    expect(body.jobs.length).toBeGreaterThanOrEqual(2);
  });

  test("should get a job by ID", async ({ request }) => {
    const createRes = await request.post(`${API}/jobs`, {
      data: { sourceCode: TS_FIBONACCI, targetLanguage: "java" },
    });
    const { jobId } = await createRes.json();

    const getRes = await request.get(`${API}/jobs/${jobId}`);
    expect(getRes.status()).toBe(200);
    const job = await getRes.json();
    expect(job.id).toBe(jobId);
    expect(job.sourceLanguage).toBe("typescript");
    expect(job.targetLanguage).toBe("java");
    expect(job.sourceCode).toBe(TS_FIBONACCI);
  });

  test("should delete a job", async ({ request }) => {
    const createRes = await request.post(`${API}/jobs`, {
      data: { sourceCode: TS_FIBONACCI, targetLanguage: "csharp" },
    });
    const { jobId } = await createRes.json();

    const deleteRes = await request.delete(`${API}/jobs/${jobId}`);
    expect(deleteRes.status()).toBe(204);

    const getRes = await request.get(`${API}/jobs/${jobId}`);
    expect(getRes.status()).toBe(404);
  });

  test("should return 400 when targetLanguage is missing", async ({ request }) => {
    const res = await request.post(`${API}/jobs`, {
      data: { sourceCode: TS_FIBONACCI },
    });
    expect(res.status()).toBe(400);
  });

  test("should return 404 for non-existent job", async ({ request }) => {
    const res = await request.get(`${API}/jobs/nonexistent-id-12345`);
    expect(res.status()).toBe(404);
  });
});

// ===========================================================================
// Translation Finalize — Evidence Pack
// ===========================================================================

test.describe("Translation Finalize — Evidence Pack", () => {
  test("should finalize a TS-to-Python job with valid code", async ({ request }) => {
    const prepRes = await request.post(`${API}/jobs`, {
      data: {
        sourceCode: TS_FIBONACCI,
        targetLanguage: "python",
        scope: "snippet",
      },
    });
    expect(prepRes.status()).toBe(201);
    const { jobId } = await prepRes.json();

    const finRes = await request.post(`${API}/jobs/${jobId}/finalize`, {
      data: { generatedCode: PY_FIBONACCI_GENERATED },
    });
    expect(finRes.status()).toBe(200);
    const body = await finRes.json();

    expect(body.job.id).toBe(jobId);
    expect(body.job.status).toBe("done");
    expect(typeof body.job.confidenceScore).toBe("number");
    expect(body.job.confidenceScore).toBeGreaterThan(0);
    expect(body.evidence).toBeTruthy();
    expect(typeof body.evidence.confidenceScore).toBe("number");
  });

  test("should return translated constructs in evidence", async ({ request }) => {
    const prepRes = await request.post(`${API}/jobs`, {
      data: { sourceCode: TS_FIBONACCI, targetLanguage: "python" },
    });
    const { jobId } = await prepRes.json();

    const finRes = await request.post(`${API}/jobs/${jobId}/finalize`, {
      data: { generatedCode: PY_FIBONACCI_GENERATED },
    });
    const body = await finRes.json();

    expect(Array.isArray(body.evidence.translatedConstructs)).toBe(true);
    for (const c of body.evidence.translatedConstructs) {
      expect(typeof c.source).toBe("string");
      expect(typeof c.target).toBe("string");
      expect(typeof c.method).toBe("string");
    }
  });

  test("should return risks array in evidence", async ({ request }) => {
    const prepRes = await request.post(`${API}/jobs`, {
      data: { sourceCode: TS_FIBONACCI, targetLanguage: "python" },
    });
    const { jobId } = await prepRes.json();

    const finRes = await request.post(`${API}/jobs/${jobId}/finalize`, {
      data: { generatedCode: PY_FIBONACCI_GENERATED },
    });
    const body = await finRes.json();

    expect(Array.isArray(body.evidence.risks)).toBe(true);
    for (const r of body.evidence.risks) {
      expect(["low", "medium", "high"]).toContain(r.severity);
      expect(typeof r.construct).toBe("string");
      expect(typeof r.message).toBe("string");
    }
  });

  test("should return humanReviewPoints in evidence", async ({ request }) => {
    const prepRes = await request.post(`${API}/jobs`, {
      data: { sourceCode: TS_FIBONACCI, targetLanguage: "go" },
    });
    const { jobId } = await prepRes.json();

    const finRes = await request.post(`${API}/jobs/${jobId}/finalize`, {
      data: { generatedCode: GO_FIBONACCI_GENERATED },
    });
    const body = await finRes.json();

    expect(Array.isArray(body.evidence.humanReviewPoints)).toBe(true);
  });

  test("should return error for non-existent job finalize", async ({ request }) => {
    const res = await request.post(`${API}/jobs/nonexistent-job-999/finalize`, {
      data: { generatedCode: "print('hello')" },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test("should complete Python-to-Go translation cycle", async ({ request }) => {
    const prepRes = await request.post(`${API}/jobs`, {
      data: {
        sourceCode: PY_FIBONACCI,
        targetLanguage: "go",
        scope: "function",
      },
    });
    expect(prepRes.status()).toBe(201);
    const { jobId, analysis } = await prepRes.json();
    expect(analysis.detectedLanguage).toBe("python");

    const finRes = await request.post(`${API}/jobs/${jobId}/finalize`, {
      data: { generatedCode: GO_FIBONACCI_GENERATED },
    });
    expect(finRes.status()).toBe(200);
    const body = await finRes.json();
    expect(body.job.status).toBe("done");
    expect(body.job.targetCode).toBe(GO_FIBONACCI_GENERATED);
  });
});

// ===========================================================================
// Translation Stats
// ===========================================================================

test.describe("Translation Stats", () => {
  test("should return stats with all required fields", async ({ request }) => {
    const res = await request.get(`${API}/stats`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.totalJobs).toBe("number");
    expect(typeof body.done).toBe("number");
    expect(typeof body.failed).toBe("number");
    expect(typeof body.pending).toBe("number");
    expect(typeof body.avgConfidence).toBe("number");
  });

  test("should reflect created jobs in stats", async ({ request }) => {
    const baseRes = await request.get(`${API}/stats`);
    const baseStats = await baseRes.json();

    await request.post(`${API}/jobs`, {
      data: { sourceCode: TS_FIBONACCI, targetLanguage: "python" },
    });
    await request.post(`${API}/jobs`, {
      data: { sourceCode: TS_FIBONACCI, targetLanguage: "go" },
    });

    const afterRes = await request.get(`${API}/stats`);
    const afterStats = await afterRes.json();
    expect(afterStats.totalJobs).toBeGreaterThanOrEqual(baseStats.totalJobs + 2);
  });

  test("should reflect finalized jobs in done count", async ({ request }) => {
    const baseRes = await request.get(`${API}/stats`);
    const baseStats = await baseRes.json();

    const prepRes = await request.post(`${API}/jobs`, {
      data: { sourceCode: TS_FIBONACCI, targetLanguage: "python" },
    });
    const { jobId } = await prepRes.json();

    await request.post(`${API}/jobs/${jobId}/finalize`, {
      data: { generatedCode: PY_FIBONACCI_GENERATED },
    });

    const afterRes = await request.get(`${API}/stats`);
    const afterStats = await afterRes.json();
    expect(afterStats.done).toBeGreaterThanOrEqual(baseStats.done + 1);
  });
});

// ===========================================================================
// MCP translate_code — Phase 1: Prepare
// ===========================================================================

test.describe("MCP translate_code — Phase 1: Prepare", () => {
  test("TS -> Python: detects typescript, returns prompt with python instructions", async ({
    request,
  }) => {
    const res = await request.post(`${API}/jobs`, {
      data: { sourceCode: TS_FIBONACCI, targetLanguage: "python", scope: "snippet" },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();

    expect(body.jobId).toBeTruthy();
    expect(body.prompt).toContain("python");
    expect(body.analysis.detectedLanguage).toBe("typescript");
    expect(body.analysis.totalConstructs).toBeGreaterThan(0);
    expect(body.analysis.complexityScore).toBeGreaterThanOrEqual(0);
    expect(body.analysis.estimatedTranslatability).toBeGreaterThan(0);
  });

  test("Python -> Go: detects python, prompt references go", async ({ request }) => {
    const res = await request.post(`${API}/jobs`, {
      data: { sourceCode: PY_FIBONACCI, targetLanguage: "go", scope: "function" },
    });
    const body = await res.json();
    expect(body.analysis.detectedLanguage).toBe("python");
    expect(body.prompt.toLowerCase()).toContain("go");
  });

  test("Go -> Rust: detects go, scope module", async ({ request }) => {
    const res = await request.post(`${API}/jobs`, {
      data: { sourceCode: GO_FIBONACCI, targetLanguage: "rust", scope: "module" },
    });
    const body = await res.json();
    expect(body.analysis.detectedLanguage).toBe("go");
    expect(body.prompt.toLowerCase()).toContain("rust");
  });

  test("Java -> Python: detects java", async ({ request }) => {
    const res = await request.post(`${API}/jobs`, {
      data: { sourceCode: JAVA_FIBONACCI, targetLanguage: "python" },
    });
    const body = await res.json();
    expect(body.analysis.detectedLanguage).toBe("java");
  });

  test("Complex TS -> Python: handles interfaces, generics, async", async ({ request }) => {
    const res = await request.post(`${API}/jobs`, {
      data: { sourceCode: TS_COMPLEX, targetLanguage: "python", scope: "module" },
    });
    const body = await res.json();
    expect(body.analysis.detectedLanguage).toBe("typescript");
    expect(body.analysis.totalConstructs).toBeGreaterThan(3);
    expect(body.analysis.complexityScore).toBeGreaterThan(0);
  });

  test("Python class -> TypeScript", async ({ request }) => {
    const res = await request.post(`${API}/jobs`, {
      data: { sourceCode: PY_CLASS, targetLanguage: "typescript" },
    });
    const body = await res.json();
    expect(body.analysis.detectedLanguage).toBe("python");
    expect(body.analysis.totalConstructs).toBeGreaterThan(0);
  });

  test("Rust struct -> Python", async ({ request }) => {
    const res = await request.post(`${API}/jobs`, {
      data: { sourceCode: RUST_STRUCT, targetLanguage: "python" },
    });
    const body = await res.json();
    expect(body.analysis.detectedLanguage).toBe("rust");
  });

  test("C# LINQ -> Java", async ({ request }) => {
    const res = await request.post(`${API}/jobs`, {
      data: { sourceCode: CSHARP_LINQ, targetLanguage: "java" },
    });
    const body = await res.json();
    expect(body.analysis.detectedLanguage).toBe("csharp");
  });

  test("Minimal snippet -> Go", async ({ request }) => {
    const res = await request.post(`${API}/jobs`, {
      data: { sourceCode: MINIMAL_SNIPPET, targetLanguage: "go" },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.jobId).toBeTruthy();
  });

  test("Prompt contains construct analysis table", async ({ request }) => {
    const res = await request.post(`${API}/jobs`, {
      data: { sourceCode: TS_FIBONACCI, targetLanguage: "python" },
    });
    const body = await res.json();
    expect(body.prompt).toContain("Construct");
    expect(body.prompt).toContain("Confidence");
  });

  test("sourceLanguage hint is respected", async ({ request }) => {
    const res = await request.post(`${API}/jobs`, {
      data: {
        sourceCode: TS_FIBONACCI,
        targetLanguage: "python",
        sourceLanguage: "typescript",
      },
    });
    const body = await res.json();
    expect(body.analysis.detectedLanguage).toBe("typescript");
  });
});

// ===========================================================================
// MCP translate_code — Phase 2: Finalize
// ===========================================================================

test.describe("MCP translate_code — Phase 2: Finalize", () => {
  test("TS -> Python: finalize returns done status + evidence", async ({ request }) => {
    const prep = await request.post(`${API}/jobs`, {
      data: { sourceCode: TS_FIBONACCI, targetLanguage: "python" },
    });
    const { jobId } = await prep.json();

    const fin = await request.post(`${API}/jobs/${jobId}/finalize`, {
      data: { generatedCode: PY_FIBONACCI_GENERATED },
    });
    expect(fin.status()).toBe(200);
    const body = await fin.json();

    expect(body.job.status).toBe("done");
    expect(body.job.confidenceScore).toBeGreaterThan(0);
    expect(body.job.targetCode).toBe(PY_FIBONACCI_GENERATED);
    expect(body.evidence).toBeTruthy();
    expect(body.evidence.confidenceScore).toBeGreaterThan(0);
    expect(Array.isArray(body.evidence.translatedConstructs)).toBe(true);
    expect(Array.isArray(body.evidence.risks)).toBe(true);
    expect(Array.isArray(body.evidence.humanReviewPoints)).toBe(true);
  });

  test("Python -> Go: finalize cycle", async ({ request }) => {
    const prep = await request.post(`${API}/jobs`, {
      data: { sourceCode: PY_FIBONACCI, targetLanguage: "go" },
    });
    const { jobId } = await prep.json();

    const fin = await request.post(`${API}/jobs/${jobId}/finalize`, {
      data: { generatedCode: GO_FIBONACCI_GENERATED },
    });
    const body = await fin.json();
    expect(body.job.status).toBe("done");
    expect(body.job.targetCode).toBe(GO_FIBONACCI_GENERATED);
  });

  test("Go -> Rust: finalize cycle", async ({ request }) => {
    const prep = await request.post(`${API}/jobs`, {
      data: { sourceCode: GO_FIBONACCI, targetLanguage: "rust" },
    });
    const { jobId } = await prep.json();

    const fin = await request.post(`${API}/jobs/${jobId}/finalize`, {
      data: { generatedCode: RUST_FIBONACCI_GENERATED },
    });
    const body = await fin.json();
    expect(body.job.status).toBe("done");
  });

  test("Finalize with empty code marks job as failed", async ({ request }) => {
    const prep = await request.post(`${API}/jobs`, {
      data: { sourceCode: TS_FIBONACCI, targetLanguage: "python" },
    });
    const { jobId } = await prep.json();

    const fin = await request.post(`${API}/jobs/${jobId}/finalize`, {
      data: { generatedCode: "" },
    });
    const body = await fin.json();
    expect(body.job.status).toBe("failed");
  });

  test("Evidence translatedConstructs map source -> target", async ({ request }) => {
    const prep = await request.post(`${API}/jobs`, {
      data: { sourceCode: TS_FIBONACCI, targetLanguage: "python" },
    });
    const { jobId } = await prep.json();

    const fin = await request.post(`${API}/jobs/${jobId}/finalize`, {
      data: { generatedCode: PY_FIBONACCI_GENERATED },
    });
    const body = await fin.json();

    for (const c of body.evidence.translatedConstructs) {
      expect(c).toHaveProperty("source");
      expect(c).toHaveProperty("target");
      expect(c).toHaveProperty("method");
      expect(typeof c.source).toBe("string");
      expect(typeof c.target).toBe("string");
    }
  });
});

// ===========================================================================
// MCP translate_code — Full Lifecycle
// ===========================================================================

test.describe("MCP translate_code — Full Lifecycle", () => {
  test("Complete lifecycle: prepare -> finalize -> verify in list -> delete", async ({
    request,
  }) => {
    const prep = await request.post(`${API}/jobs`, {
      data: { sourceCode: TS_FIBONACCI, targetLanguage: "python" },
    });
    const { jobId } = await prep.json();

    const list1 = await request.get(`${API}/jobs`);
    const jobs1 = (await list1.json()).jobs;
    expect(jobs1.some((j: { id: string }) => j.id === jobId)).toBe(true);

    await request.post(`${API}/jobs/${jobId}/finalize`, {
      data: { generatedCode: PY_FIBONACCI_GENERATED },
    });

    const getRes = await request.get(`${API}/jobs/${jobId}`);
    const job = await getRes.json();
    expect(job.status).toBe("done");
    expect(job.confidenceScore).toBeGreaterThan(0);

    const delRes = await request.delete(`${API}/jobs/${jobId}`);
    expect(delRes.status()).toBe(204);

    const getRes2 = await request.get(`${API}/jobs/${jobId}`);
    expect(getRes2.status()).toBe(404);
  });

  test("Stats update after complete lifecycle", async ({ request }) => {
    // Create and finalize a job
    const prep = await request.post(`${API}/jobs`, {
      data: { sourceCode: TS_FIBONACCI, targetLanguage: "go" },
    });
    const { jobId } = await prep.json();
    await request.post(`${API}/jobs/${jobId}/finalize`, {
      data: { generatedCode: GO_FIBONACCI_GENERATED },
    });

    // Verify stats reflect at least 1 done job and reasonable totals
    const stats = await (await request.get(`${API}/stats`)).json();
    expect(stats.totalJobs).toBeGreaterThanOrEqual(1);
    expect(stats.done).toBeGreaterThanOrEqual(1);
    expect(stats.avgConfidence).toBeGreaterThanOrEqual(0);
  });
});

// ===========================================================================
// MCP analyze_translation — Language Detection
// ===========================================================================

test.describe("MCP analyze_translation — Language Detection", () => {
  const fullParserCases = [
    { name: "TypeScript", code: TS_FIBONACCI, expected: "typescript" },
    { name: "Python", code: PY_FIBONACCI, expected: "python" },
    { name: "Python (class)", code: PY_CLASS, expected: "python" },
  ];

  for (const { name, code, expected } of fullParserCases) {
    test(`should detect ${name} correctly with constructs`, async ({ request }) => {
      const res = await request.post(`${API}/analyze`, { data: { code } });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.detectedLanguage).toBe(expected);
      expect(body.totalConstructs).toBeGreaterThan(0);
    });
  }

  const heuristicCases = [
    { name: "Go", code: GO_FIBONACCI, expected: "go" },
    { name: "Java", code: JAVA_FIBONACCI, expected: "java" },
    { name: "Rust", code: RUST_STRUCT, expected: "rust" },
    { name: "C#", code: CSHARP_LINQ, expected: "csharp" },
  ];

  for (const { name, code, expected } of heuristicCases) {
    test(`should detect ${name} language correctly`, async ({ request }) => {
      const res = await request.post(`${API}/analyze`, { data: { code } });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.detectedLanguage).toBe(expected);
      expect(body.totalConstructs).toBeGreaterThanOrEqual(0);
    });
  }
});

// ===========================================================================
// MCP analyze_translation — Construct Analysis
// ===========================================================================

test.describe("MCP analyze_translation — Construct Analysis", () => {
  test("returns constructs with canonical names and confidence", async ({ request }) => {
    const res = await request.post(`${API}/analyze`, {
      data: { code: TS_FIBONACCI },
    });
    const body = await res.json();

    expect(Array.isArray(body.constructs)).toBe(true);
    expect(body.constructs.length).toBeGreaterThan(0);
    for (const c of body.constructs) {
      expect(c.canonicalName).toMatch(/^uc_/);
      expect(typeof c.count).toBe("number");
      expect(c.count).toBeGreaterThan(0);
      expect(typeof c.confidence).toBe("number");
      expect(c.confidence).toBeGreaterThanOrEqual(0);
      expect(c.confidence).toBeLessThanOrEqual(1);
    }
  });

  test("complex code has more constructs than simple code", async ({ request }) => {
    const simple = await request.post(`${API}/analyze`, {
      data: { code: MINIMAL_SNIPPET },
    });
    const complex = await request.post(`${API}/analyze`, {
      data: { code: TS_COMPLEX },
    });
    const simpleBody = await simple.json();
    const complexBody = await complex.json();
    expect(complexBody.totalConstructs).toBeGreaterThan(simpleBody.totalConstructs);
  });

  test("TS fibonacci has function, if-else, and return constructs", async ({ request }) => {
    const res = await request.post(`${API}/analyze`, {
      data: { code: TS_FIBONACCI },
    });
    const body = await res.json();
    const names = body.constructs.map((c: { canonicalName: string }) => c.canonicalName);
    expect(names).toContain("uc_fn_def");
    expect(names).toContain("uc_return");
  });
});

// ===========================================================================
// MCP analyze_translation — Scores
// ===========================================================================

test.describe("MCP analyze_translation — Scores", () => {
  test("complexity score is between 0 and 1", async ({ request }) => {
    const res = await request.post(`${API}/analyze`, {
      data: { code: TS_FIBONACCI },
    });
    const body = await res.json();
    expect(body.complexityScore).toBeGreaterThanOrEqual(0);
    expect(body.complexityScore).toBeLessThanOrEqual(1);
  });

  test("translatability score is between 0 and 1", async ({ request }) => {
    const res = await request.post(`${API}/analyze`, {
      data: { code: TS_FIBONACCI, targetLanguage: "python" },
    });
    const body = await res.json();
    expect(body.estimatedTranslatability).toBeGreaterThanOrEqual(0);
    expect(body.estimatedTranslatability).toBeLessThanOrEqual(1);
  });

  test("complex code has higher complexity than simple code", async ({ request }) => {
    const simple = await request.post(`${API}/analyze`, {
      data: { code: MINIMAL_SNIPPET },
    });
    const complex = await request.post(`${API}/analyze`, {
      data: { code: TS_COMPLEX },
    });
    const simpleBody = await simple.json();
    const complexBody = await complex.json();
    expect(complexBody.complexityScore).toBeGreaterThanOrEqual(simpleBody.complexityScore);
  });
});

// ===========================================================================
// MCP analyze_translation — Language Hint & Target
// ===========================================================================

test.describe("MCP analyze_translation — Language Hint & Target", () => {
  test("languageHint forces detected language", async ({ request }) => {
    const res = await request.post(`${API}/analyze`, {
      data: { code: TS_FIBONACCI, languageHint: "typescript" },
    });
    const body = await res.json();
    expect(body.detectedLanguage).toBe("typescript");
  });

  test("targetLanguage enables translatability scoring", async ({ request }) => {
    const withTarget = await request.post(`${API}/analyze`, {
      data: { code: TS_FIBONACCI, targetLanguage: "python" },
    });
    const withoutTarget = await request.post(`${API}/analyze`, {
      data: { code: TS_FIBONACCI },
    });
    const withBody = await withTarget.json();
    const withoutBody = await withoutTarget.json();

    expect(typeof withBody.estimatedTranslatability).toBe("number");
    expect(typeof withoutBody.estimatedTranslatability).toBe("number");
  });
});

// ===========================================================================
// MCP analyze_translation — Ambiguity Detection
// ===========================================================================

test.describe("MCP analyze_translation — Ambiguity Detection", () => {
  test("returns ambiguousConstructs array", async ({ request }) => {
    const res = await request.post(`${API}/analyze`, {
      data: { code: TS_COMPLEX, targetLanguage: "python" },
    });
    const body = await res.json();
    expect(Array.isArray(body.ambiguousConstructs)).toBe(true);
  });
});

// ===========================================================================
// MCP analyze_translation — Error Cases
// ===========================================================================

test.describe("MCP analyze_translation — Error Cases", () => {
  test("returns 400 for empty code", async ({ request }) => {
    const res = await request.post(`${API}/analyze`, {
      data: { code: "" },
    });
    expect(res.status()).toBe(400);
  });

  test("returns 400 for missing code field", async ({ request }) => {
    const res = await request.post(`${API}/analyze`, {
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test("returns 400 for non-string code", async ({ request }) => {
    const res = await request.post(`${API}/analyze`, {
      data: { code: 123 },
    });
    expect(res.status()).toBe(400);
  });
});

// ===========================================================================
// Inventory Manager — Real-world Python → Multiple Targets
// ===========================================================================

const PY_INVENTORY_MANAGER = `from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional
import json
import math
import uuid

class ProductCategory(Enum):
    ELECTRONICS = "electronics"
    CLOTHING = "clothing"
    FOOD = "food"

class StockStatus(Enum):
    IN_STOCK = "in_stock"
    LOW_STOCK = "low_stock"
    OUT_OF_STOCK = "out_of_stock"

@dataclass
class Product:
    sku: str
    name: str
    category: ProductCategory
    unit_price: float
    weight_kg: float
    min_stock_level: int = 10
    max_stock_level: int = 1000
    is_perishable: bool = False
    expiry_days: Optional[int] = None

class InventoryManager:
    def __init__(self, warehouse_name: str, warehouse_capacity: int = 10000):
        self._warehouse_name = warehouse_name
        self._warehouse_capacity = warehouse_capacity
        self._products: dict[str, Product] = {}
        self._stock: dict[str, list] = {}

    @property
    def warehouse_name(self) -> str:
        return self._warehouse_name

    @property
    def total_items_in_stock(self) -> int:
        total = 0
        for entries in self._stock.values():
            for entry in entries:
                total += entry.quantity
        return total

    def register_product(self, product: Product) -> bool:
        if product.sku in self._products:
            return False
        if product.unit_price < 0:
            return False
        self._products[product.sku] = product
        self._stock[product.sku] = []
        return True

    def get_stock_level(self, sku: str) -> int:
        if sku not in self._stock:
            return 0
        return sum(entry.quantity for entry in self._stock[sku])

    def list_products(self, category: Optional[ProductCategory] = None) -> list[Product]:
        products = list(self._products.values())
        if category is not None:
            products = [p for p in products if p.category == category]
        return sorted(products, key=lambda p: p.name)

    def generate_stock_report(self) -> dict:
        total_value = 0.0
        for sku, product in self._products.items():
            level = self.get_stock_level(sku)
            total_value += level * product.unit_price
        return {
            "warehouse": self._warehouse_name,
            "total_products": len(self._products),
            "total_value": round(total_value, 2),
        }

    def export_to_json(self) -> str:
        return json.dumps(self.generate_stock_report(), indent=2)`;

const TS_INVENTORY_MANAGER_GENERATED = `enum ProductCategory {
  ELECTRONICS = "electronics",
  CLOTHING = "clothing",
  FOOD = "food",
}

interface Product {
  sku: string;
  name: string;
  category: ProductCategory;
  unitPrice: number;
  weightKg: number;
  minStockLevel: number;
  maxStockLevel: number;
  isPerishable: boolean;
  expiryDays?: number;
}

class InventoryManager {
  private warehouseName: string;
  private warehouseCapacity: number;
  private products: Map<string, Product> = new Map();
  private stock: Map<string, unknown[]> = new Map();

  constructor(warehouseName: string, warehouseCapacity: number = 10000) {
    this.warehouseName = warehouseName;
    this.warehouseCapacity = warehouseCapacity;
  }

  get name(): string {
    return this.warehouseName;
  }

  registerProduct(product: Product): boolean {
    if (this.products.has(product.sku)) return false;
    if (product.unitPrice < 0) return false;
    this.products.set(product.sku, product);
    this.stock.set(product.sku, []);
    return true;
  }

  getStockLevel(sku: string): number {
    const entries = this.stock.get(sku);
    if (!entries) return 0;
    return entries.reduce((sum: number, e: any) => sum + e.quantity, 0);
  }
}`;

test.describe("Inventory Manager — Python Analysis", () => {
  test("should detect Python with high construct count", async ({ request }) => {
    const res = await request.post(`${API}/analyze`, {
      data: { code: PY_INVENTORY_MANAGER },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.detectedLanguage).toBe("python");
    expect(body.totalConstructs).toBeGreaterThan(5);
    expect(body.complexityScore).toBeGreaterThan(0);
  });

  test("should detect class and function constructs", async ({ request }) => {
    const res = await request.post(`${API}/analyze`, {
      data: { code: PY_INVENTORY_MANAGER },
    });
    const body = await res.json();
    const names = body.constructs.map((c: { canonicalName: string }) => c.canonicalName);
    expect(names.some((n: string) => n.includes("class") || n.includes("fn"))).toBe(true);
  });

  test("should score translatability to TypeScript", async ({ request }) => {
    const res = await request.post(`${API}/analyze`, {
      data: { code: PY_INVENTORY_MANAGER, targetLanguage: "typescript" },
    });
    const body = await res.json();
    expect(body.estimatedTranslatability).toBeGreaterThan(0);
  });
});

test.describe("Inventory Manager — Python → TypeScript Full Cycle", () => {
  test("should prepare job with module scope", async ({ request }) => {
    const res = await request.post(`${API}/jobs`, {
      data: {
        sourceCode: PY_INVENTORY_MANAGER,
        targetLanguage: "typescript",
        scope: "module",
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.jobId).toBeTruthy();
    expect(body.prompt).toContain("typescript");
    expect(body.analysis.detectedLanguage).toBe("python");
    expect(body.analysis.totalConstructs).toBeGreaterThan(5);
  });

  test("should finalize with TypeScript code and return evidence", async ({ request }) => {
    const prep = await request.post(`${API}/jobs`, {
      data: {
        sourceCode: PY_INVENTORY_MANAGER,
        targetLanguage: "typescript",
        scope: "module",
      },
    });
    const { jobId } = await prep.json();

    const fin = await request.post(`${API}/jobs/${jobId}/finalize`, {
      data: { generatedCode: TS_INVENTORY_MANAGER_GENERATED },
    });
    expect(fin.status()).toBe(200);
    const body = await fin.json();
    expect(body.job.status).toBe("done");
    expect(body.job.confidenceScore).toBeGreaterThan(0);
    expect(body.evidence.translatedConstructs.length).toBeGreaterThan(0);
  });
});

test.describe("Inventory Manager — Python → Multiple Targets", () => {
  for (const target of ["typescript", "java", "go", "rust", "csharp"]) {
    test(`should create prepare job for Python → ${target}`, async ({ request }) => {
      const res = await request.post(`${API}/jobs`, {
        data: {
          sourceCode: PY_INVENTORY_MANAGER,
          targetLanguage: target,
          scope: "module",
        },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.prompt.toLowerCase()).toContain(target);
      expect(body.analysis.detectedLanguage).toBe("python");
    });
  }
});
