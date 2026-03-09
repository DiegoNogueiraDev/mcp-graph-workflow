# CLAUDE.md — mcp-graph

## Overview

`mcp-graph` is a local-first CLI tool (TypeScript) that converts PRD text files into persistent execution graphs (SQLite), with an integrated knowledge store, RAG pipeline, and multi-agent integration mesh — enabling structured, token-efficient agentic workflows.

## Stack

- **Language:** TypeScript 5.x — strict mode, ESNext modules
- **Runtime:** Node.js ≥ 18 (no Docker, no external infra)
- **CLI:** Commander.js v14
- **Validation:** Zod v4 (`import { z } from 'zod/v4'`)
- **Testing:** Vitest v4
- **Search:** FTS5 + BM25 + TF-IDF (100% local)
- **Dashboard:** React 19 + Tailwind CSS + React Flow
- **Build:** `tsc` → `dist/` | Dev: `tsx`

## Commands

```bash
npm run build          # tsc → dist/
npm run dev            # tsx src/cli/index.ts
npm test               # vitest run
npm run test:watch     # vitest --watch
npm run test:e2e       # playwright browser tests
npm run test:coverage  # V8 coverage report
npm run test:bench     # performance benchmarks
npm run lint           # eslint
```

## Architecture

```
src/
  cli/               # Commander.js commands (5) — thin orchestration, NO business logic
  core/
    capture/         # web-capture, validate-runner, content-extractor
    config/          # config-schema, config-loader
    context/         # compact, tiered, bm25-compressor, context-assembler, rag-context, token-estimator
    docs/            # stack-detector, mcp-context7-fetcher, docs-cache-store, docs-syncer
    events/          # event-bus, event-types (GraphEventBus)
    graph/           # graph-types, graph-indexes, mermaid-export
    importer/        # import-prd, prd-to-graph
    insights/        # bottleneck-detector, metrics-calculator, skill-recommender
    integrations/    # integration-orchestrator, serena-reader, gitnexus-launcher, enriched-context, mcp-servers-config, mcp-deps-installer, tool-status
    parser/          # classify, extract, normalize, read-file, segment, file-reader, read-pdf, read-html
    planner/         # next-task, enhanced-next, decompose, dependency-chain, velocity, planning-report
    rag/             # embedding-store, rag-pipeline, serena-indexer, docs-indexer, capture-indexer, serena-rag-query, chunk-text
    search/          # fts-search, tfidf, tokenizer
    store/           # sqlite-store, migrations, knowledge-store
    utils/           # errors, fs, id, logger, time
  api/               # Express REST API — 17 routers, 44 endpoints
  mcp/tools/         # MCP tool wrappers (31 tools)
  schemas/           # Zod schemas (node, edge, graph, knowledge)
  web/dashboard/     # React + Tailwind + React Flow dashboard
```

## Capabilities

| Capability | Key Modules | Docs |
|------------|-------------|------|
| PRD Import | parser/, importer/ | — |
| 31 MCP Tools | mcp/tools/ | [MCP Tools Reference](docs/MCP-TOOLS-REFERENCE.md) |
| 17 REST API Routers | api/routes/ | [REST API Reference](docs/REST-API-REFERENCE.md) |
| Knowledge Store + RAG | store/knowledge-store, rag/ | [Knowledge Pipeline](docs/KNOWLEDGE-PIPELINE.md) |
| Tiered Context Compression | context/ | [Knowledge Pipeline](docs/KNOWLEDGE-PIPELINE.md) |
| Sprint Planning + Velocity | planner/ | — |
| Integration Mesh | integrations/, docs/, capture/ | [Integrations Guide](docs/INTEGRATIONS-GUIDE.md) |

## Integration Agents

4 MCP agents coordinated by `IntegrationOrchestrator` via `GraphEventBus`:
**Serena** (code analysis + memory), **GitNexus** (git graph), **Context7** (library docs), **Playwright** (browser validation).
See [docs/INTEGRATIONS-GUIDE.md](docs/INTEGRATIONS-GUIDE.md).

## Non-Regression Rule

**MANDATORY — applies to every change, no exceptions.**

### Verification Gate (run ALL before delivering)

1. **Build** — `npm run build` must succeed. Compilation passing ≠ type check passing (ESM resolution, missing exports, bundler issues are caught here, not by `tsc --noEmit`).
2. **Type check** — `npm run typecheck` (or `tsc --noEmit`) must report zero errors.
3. **Test suite** — `npm test` must pass with zero failures. Zero tolerance for regressions.
4. **Linter** — `npm run lint` (if configured) must report no new violations.
5. **Smoke test** — if the project has a CLI or server, run it once (`npm run dev -- --help` or equivalent) and confirm it starts without crashing.

### Behavioral Guardrails

6. **Do not remove, rename, or change the signature** of any existing public function, type, or export unless the task explicitly requires it. If you must change a public API, find and update ALL callers/importers first.
7. **Do not remove or modify re-exports** (barrel `index.ts` files) without verifying no external module depends on them.
8. **Do not delete tests** unless the feature they cover is being intentionally removed.
9. **Do not change behavior of code you didn't intend to touch.** If a refactor, bugfix, or new feature inadvertently alters unrelated behavior, revert the unintended change.

### Schema & Data Integrity

10. **Schema changes must be backward-compatible** with existing persisted data (JSON files, SQLite rows, API contracts). If a field is removed or renamed, provide migration or handle both old and new format.
11. **Do not remove or downgrade dependencies** without verifying no module imports them. Adding deps requires explicit user request.

### Configuration Guard

12. **Do not relax strictness settings** — never change `strict: true` to `false`, never disable linter rules, never lower test coverage thresholds. If a strict check blocks your work, fix the code, don't weaken the check.

### If anything fails

13. **Stop and fix before proceeding.** Never deliver code that breaks existing functionality. Never skip a failing check with `--no-verify`, `@ts-ignore`, `// eslint-disable`, or equivalent without explicit user approval.

> The bar is simple: **after your change, everything that worked before must still work identically.**

## Testing & Quality Methodology

**MANDATORY — applies to all code production.**

### TDD First

All new code MUST follow Test-Driven Development (Red → Green → Refactor). Write the failing test BEFORE writing the implementation. No exceptions.

### Test Pyramid

Every feature/fix must include the appropriate level(s) of testing:

| Level | Scope | When Required | Data Strategy |
|---|---|---|---|
| **Unit tests** | Single function/module in isolation | Always — every public function | Use factories/builders that create minimal valid objects. NO massive mock datasets. |
| **Integration tests** | Multiple modules working together (DB, file I/O, pipelines) | When the feature involves cross-module interaction | Use real (lightweight) instances — temp files, in-memory SQLite, test containers. Mocks only at external boundaries. |
| **E2E tests** | Full CLI invocation or API request → response | When the feature adds/changes a user-facing command or endpoint | Use fixture files and real project data. Validate actual output. |
| **E2E browser tests** | Full frontend flow via real browser (Playwright/Cypress) | When the feature has a UI. Include A/B variant testing when applicable. | Use real browser, real DOM. Test user flows, not implementation. |
| **Shadow tests** | Run new code path in parallel with old, compare outputs without affecting users | When replacing or rewriting critical logic (parsers, calculators, pipelines) | Feed identical input to both paths, diff outputs, log divergences. |

### Mock Data Policy — DO NOT over-mock

- **Unit tests:** Use factory functions that create ONE minimal valid object with sensible defaults. Override only the fields relevant to the test. Never generate large mock datasets "just in case."
- **Integration tests:** Prefer real lightweight instances (temp files, in-memory DB) over mocks. Mock ONLY external systems you don't control (third-party APIs, paid services).
- **E2E tests:** Use real fixtures. Zero mocks — the point is to test the real system.
- **General rule:** If you need more than 5 lines to set up mock data for a single test, the test or the code is too coupled. Refactor first.

### Observability & Log Coverage

- Every new module must use the project logger — never raw `console.log`/`print`.
- Log coverage is part of the review: entry points (info), error paths (error + stack), external calls (debug with timing).
- Structured log fields must be queryable (key=value or JSON, not free-text sentences).

### Code Review Checklist (self-review before delivering)

Before marking any task as done, self-review against:
- [ ] Tests written BEFORE implementation (TDD)?
- [ ] All test levels appropriate for this change are covered?
- [ ] No unnecessary mocks — real instances where possible?
- [ ] Logger used in all significant code paths?
- [ ] Error handling includes typed errors + stack trace preservation?
- [ ] No dead code, no commented-out code, no TODO without a linked issue?
- [ ] Build + type check + test suite + linter all pass?

## Critical Conventions

1. **ESM only** — always use `.js` extension in relative imports
2. **Zod v4** — `import { z } from 'zod/v4'` (never `'zod'`)
3. **Strict TS** — no `any`, explicit return types on public functions
4. **Kebab-case files** — `graph-store.ts`, not `graphStore.ts`
5. **PascalCase types** — `GraphNode`, `NodeStatus`
6. **camelCase functions** — `findNextTask()`, `buildTaskContext()`
7. **Typed errors** — use `src/core/utils/errors.ts`, never throw raw strings
8. **Logger** — use `src/core/utils/logger.ts`, never `console.log`
9. **Infer from Zod** — `z.infer<typeof Schema>` instead of duplicating types
10. **Tests** — TDD, arrange-act-assert, files in `src/tests/`

## Path-Specific Rules

Detailed rules per directory are in `.claude/rules/`:

| Rule File | Scope |
|---|---|
| `typescript.md` | `src/**/*.ts` — strict mode, ESM, Zod |
| `cli.md` | `src/cli/**/*.ts` — thin orchestration |
| `core.md` | `src/core/**/*.ts` — pure functions, typed errors |
| `schemas.md` | `src/schemas/**/*.ts` — Zod v4 patterns |
| `tests.md` | `tests/**/*.test.ts` — Vitest, arrange-act-assert |

## XP Anti-Vibe-Coding Workflow

This project follows an anti-vibe-coding methodology based on XP (Extreme Programming):

- **New projects**: Use `/xp-bootstrap` for the sequential workflow (Isolation → Foundation → TDD → Implementation → Optimization → Interface → Deploy)
- **Project setup**: Use `/project-scaffold` to auto-generate `.mcp.json`, `CLAUDE.md` template, and `.claude/rules/`
- **Continuous cycle**: Use `/dev-flow-orchestrator` for ongoing iterations (ANALYZE → DESIGN → PLAN → IMPLEMENT → VALIDATE → REVIEW → HANDOFF → LISTENING)
- **Graph sync**: Use `/track-with-mcp-graph` to keep the execution graph in sync with real work
- **Dev lifecycle**: See [docs/LIFECYCLE.md](docs/LIFECYCLE.md) for the 8-phase cycle (ANALYZE → DESIGN → PLAN → IMPLEMENT → VALIDATE → REVIEW → HANDOFF → LISTENING)

Key principles:
1. **Build to Earning vs Learning** — Production code (Build to Earning) = full discipline, no shortcuts. Side projects (Build to Learning) = experimentation allowed. Know which mode you're in.
2. **Skeleton & Organs** — Dev defines architecture, AI implements. Never "create a SaaS" — define stack, services, domain first.
3. **Anti-one-shot** — Never use a single prompt to generate entire systems. Decompose into atomic tasks tracked in the graph.
4. **TDD enforced** — Tests before code. If AI suggests a feature without a test: REFUSE.
5. **Code detachment** — If the AI made a mistake, explain the error via prompt — never edit manually. Document error patterns in CLAUDE.md.
6. **CLAUDE.md as evolving spec** — Every error, pattern, or architectural decision must be documented to cumulatively train the agent.
7. **Graph visualization** — Use `export_mermaid` to visualize the execution graph in reviews, handoffs, and debugging.

See [docs/guia-xp-anti-vibe-coding.md](docs/guia-xp-anti-vibe-coding.md) for the full methodology guide.

