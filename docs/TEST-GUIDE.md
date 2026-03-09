# Test Guide — mcp-graph

## Test Pyramid

```
        /\
       /  \       E2E (Playwright) — 30 browser tests
      /    \      Full user flows against real server
     /------\
    /        \    Integration — API + store + pipeline tests
   /          \   Real SQLite, real Express, real parser
  /------------\
 /              \ Unit — isolated function tests
/________________\ Single module, in-memory data, minimal fixtures
```

## Running Tests

```bash
# Unit + Integration (Vitest)
npm test                    # Run all Vitest tests
npm run test:watch          # Watch mode
npm run test:coverage       # With V8 coverage report

# E2E Browser (Playwright)
npm run test:e2e            # Run Playwright tests (chromium)

# Benchmark
npm run test:bench          # Performance benchmarks

# All
npm run test:all            # Vitest + Playwright
```

## Test Types

### Unit Tests

**Location:** `src/tests/*.test.ts`
**Framework:** Vitest
**Data:** In-memory SQLite (`:memory:`), factory functions

Tests for individual modules:
- Parser (segment, classify, extract)
- Planner (next-task selection)
- Context builder (compact context)
- Mermaid export
- Search (FTS5 + TF-IDF)
- Insights (bottleneck detection, metrics)
- Store operations (CRUD, bulk, snapshots)

### Integration Tests

**Location:** `src/tests/api-*.test.ts`, `src/tests/e2e-integration.test.ts`
**Framework:** Vitest + Supertest
**Data:** In-memory SQLite via `createTestApp()`

Tests for API routes, import pipeline, cross-module interactions:
- Node/edge CRUD via REST API
- Import pipeline (file → parse → store)
- Search via API
- Event bus integration

### E2E Browser Tests

**Location:** `src/tests/e2e/*.spec.ts`
**Framework:** Playwright (chromium)
**Server:** `src/tests/e2e/test-server.ts` (in-memory store with fixture data)

Tests for the web dashboard:
- Graph tab (diagram, table, search, sort, detail panel, filters)
- PRD & Backlog tab (backlog list, progress bars, next task)
- Import modal (open, close, file upload)
- Tab navigation and theme toggle
- SSE real-time updates

### Smoke Tests

**Location:** `src/tests/smoke.test.ts`
**Framework:** Vitest + Supertest + child_process

Quick sanity checks:
- API endpoints respond correctly
- CLI `--help` and `--version` work
- Project initialization succeeds

### Self-Tests

**Location:** `src/tests/self-test.test.ts`
**Framework:** Vitest

mcp-graph indexes its own fixture PRD through the full pipeline:
- Import → Plan → Context → Export → Insights
- Validates end-to-end data flow

### Benchmark Tests

**Location:** `src/tests/benchmark.test.ts`
**Framework:** Vitest

Performance assertions:
- Bulk insert: 1,000 nodes + 2,000 edges < 2s
- FTS search over 1,000 nodes < 500ms
- Next task with 500 tasks < 50ms
- Mermaid export with 200 nodes < 200ms
- toGraphDocument with 1,000 nodes < 500ms
- buildTaskContext < 100ms

## Writing New Tests

### Pattern: Arrange-Act-Assert

```typescript
import { describe, it, expect } from "vitest";

describe("myModule", () => {
  it("should do something specific", () => {
    // Arrange
    const store = SqliteStore.open(":memory:");
    store.initProject("test");

    // Act
    const result = myFunction(store, "input");

    // Assert
    expect(result).toEqual(expectedValue);

    store.close();
  });
});
```

### Test Helpers

**`src/tests/helpers/test-app.ts`** — Creates an Express app with in-memory store:

```typescript
import { createTestApp } from "./helpers/test-app.js";

const { app, store } = createTestApp();
// Use `app` with supertest, `store` for direct assertions
```

### Fixture Data

**`src/tests/fixtures/`**:
- `sample-prd.txt` — Portuguese PRD with epics, tasks, requirements
- `sample.md` — Markdown PRD
- `sample.html` — HTML content

### Best Practices

1. **TDD first** — Write the failing test before the implementation
2. **Minimal fixtures** — Factory functions that create ONE minimal valid object
3. **In-memory SQLite** — Use `:memory:` for all store tests
4. **Isolation** — Each test creates its own store/state
5. **No unnecessary mocks** — Prefer real instances; mock only external boundaries
6. **Descriptive names** — `it('should return next unblocked task sorted by priority')`

## Coverage

Coverage is configured with V8 provider via `@vitest/coverage-v8`:

```bash
npm run test:coverage
```

Coverage includes: `src/core/**`, `src/api/**`, `src/mcp/**`, `src/cli/**`
Excludes: `src/tests/**`
Reports: text (terminal) + HTML (`coverage/`)
