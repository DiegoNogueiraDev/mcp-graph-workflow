# Test Guide — mcp-graph

## Test Pyramid

```
        /\
       /  \       E2E (Playwright) — 7 browser specs
      /    \      Full user flows against real server
     /------\
    /        \    Integration — API + store + pipeline tests
   /          \   Real SQLite, real Express, real parser
  /------------\
 /              \ Unit — isolated function tests
/________________\ Single module, in-memory data, minimal fixtures
```

**Total:** ~630 Vitest test cases across 69 files + 7 Playwright E2E specs

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

## Test Categories

### Core & Parser

| File | Cases | Coverage |
|------|-------|----------|
| `parser.test.ts` | 30 | Segment, classify, extract pipeline |
| `prd-to-graph.test.ts` | 12 | PRD to graph conversion |
| `read-html.test.ts` | 4 | HTML content extraction |
| `file-reader.test.ts` | 10 | Multi-format file reading |
| `content-extractor.test.ts` | 10 | Content extraction from captures |

### Graph Store & Mutations

| File | Cases | Coverage |
|------|-------|----------|
| `sqlite-store.test.ts` | 21 | CRUD, bulk ops, snapshots, FTS5 |
| `mutations.test.ts` | 18 | Node/edge mutations and cascades |
| `migrations.test.ts` | — | Schema migration compatibility |
| `mermaid-export.test.ts` | 13 | Mermaid diagram generation |
| `search.test.ts` | 14 | FTS5 + TF-IDF search |

### Knowledge Store

| File | Cases | Coverage |
|------|-------|----------|
| `knowledge-store.test.ts` | 27 | CRUD, FTS, dedup, source filtering |
| `knowledge-schema.test.ts` | 5 | Zod schema validation |
| `knowledge-events.test.ts` | 5 | Knowledge event emission |
| `chunk-text.test.ts` | 8 | Text chunking with overlap |

### RAG & Embeddings

| File | Cases | Coverage |
|------|-------|----------|
| `embedding-store.test.ts` | 8 | Vector storage and cosine search |
| `rag-semantic.test.ts` | 15 | Semantic search pipeline |
| `rag-all-embeddings.test.ts` | 5 | Full embedding index |
| `serena-indexer.test.ts` | 4 | Serena memory indexing |
| `docs-indexer.test.ts` | 6 | Documentation indexing |
| `capture-indexer.test.ts` | 4 | Web capture indexing |
| `serena-rag-query.test.ts` | 5 | Serena semantic query modes |

### Context Compression

| File | Cases | Coverage |
|------|-------|----------|
| `context.test.ts` | 20 | Compact context builder |
| `context-assembler.test.ts` | 8 | Multi-source context assembly |
| `tiered-context.test.ts` | 6 | Three-tier compression |
| `bm25-compressor.test.ts` | 8 | BM25 relevance filtering |
| `enriched-context.test.ts` | 5 | Multi-integration enrichment |

### Planner & Strategy

| File | Cases | Coverage |
|------|-------|----------|
| `next-task.test.ts` | 19 | Next task selection algorithm |
| `enhanced-next.test.ts` | 4 | Knowledge-aware next task |
| `planning-report.test.ts` | 7 | Sprint planning reports |
| `decompose.test.ts` | 5 | Task decomposition |
| `dependency-chain.test.ts` | 5 | Cycle detection, critical path |

### Integrations

| File | Cases | Coverage |
|------|-------|----------|
| `integration-orchestrator.test.ts` | 6 | Event-driven orchestration |
| `gitnexus-launcher.test.ts` | 9 | GitNexus lifecycle management |
| `mcp-context7-fetcher.test.ts` | 5 | Context7 doc fetching |
| `stack-detector.test.ts` | 6 | Tech stack detection |
| `mcp-deps-installer.test.ts` | 10 | MCP dependency installation |
| `init-project-mcp-servers.test.ts` | 9 | MCP server initialization |
| `serena-reader.test.ts` | 4 | Serena memory reading |

### API Endpoints

| File | Cases | Coverage |
|------|-------|----------|
| `api-nodes.test.ts` | 15 | Node CRUD via REST |
| `api-edges.test.ts` | 6 | Edge CRUD via REST |
| `api-graph.test.ts` | 8 | Graph export endpoints |
| `api-import.test.ts` | 7 | PRD import via REST |
| `api-project.test.ts` | 4 | Project endpoints |
| `api-knowledge.test.ts` | 14 | Knowledge CRUD via REST |
| `api-gitnexus.test.ts` | 8 | GitNexus control via REST |
| `api-capture.test.ts` | 4 | Web capture via REST |

### MCP Tools

| File | Cases | Coverage |
|------|-------|----------|
| `mcp-tools.test.ts` | 34 | All 26 MCP tools |
| `mcp-tool-validation.test.ts` | 8 | Parameter validation |

### CLI

| File | Cases | Coverage |
|------|-------|----------|
| `cli-import.test.ts` | 1 | CLI import command |
| `cli-serve.test.ts` | 4 | CLI serve command |
| `cli-stats.test.ts` | 2 | CLI stats command |

### Validation & Capture

| File | Cases | Coverage |
|------|-------|----------|
| `validate-runner.test.ts` | 3 | Browser-based task validation |
| `web-capture.test.ts` | 4 | Playwright page capture |

### Insights & Analytics

| File | Cases | Coverage |
|------|-------|----------|
| `bottleneck-detector.test.ts` | 9 | Bottleneck detection |
| `metrics-calculator.test.ts` | 4 | Sprint metrics |
| `skill-recommender.test.ts` | 4 | Skill recommendations |

### Smoke, Self-Test & Lifecycle

| File | Cases | Coverage |
|------|-------|----------|
| `smoke.test.ts` | 8 | API + CLI sanity checks |
| `self-test.test.ts` | 8 | Full pipeline self-test |
| `lifecycle-flow.test.ts` | 13 | Init → import → list → next → update |
| `e2e-integration.test.ts` | 7 | Cross-module integration |
| `import-dedup.test.ts` | 8 | Import deduplication |

### Benchmark

| File | Cases | Coverage |
|------|-------|----------|
| `benchmark.test.ts` | 6 | Performance assertions |

Benchmarks:
- Bulk insert: 1,000 nodes + 2,000 edges < 2s
- FTS search over 1,000 nodes < 500ms
- Next task with 500 tasks < 50ms
- Mermaid export with 200 nodes < 200ms
- toGraphDocument with 1,000 nodes < 500ms
- buildTaskContext < 100ms

### E2E Browser Tests (Playwright)

**Location:** `src/tests/e2e/*.spec.ts`
**Browser:** Chromium
**Base URL:** `http://localhost:3377`

| Spec | Coverage |
|------|----------|
| `graph-tab.spec.ts` | Graph visualization, node table, search, mermaid |
| `import-modal.spec.ts` | Import dialog functionality |
| `prd-backlog-tab.spec.ts` | Backlog tab display |
| `sse-events.spec.ts` | Real-time event streaming |
| `tabs.spec.ts` | Tab navigation and switching |

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

**`src/tests/helpers/factories.ts`** — Minimal object builders:

```typescript
import { createNode, createEdge } from "./helpers/factories.js";

const node = createNode({ title: "My task", type: "task" });
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
