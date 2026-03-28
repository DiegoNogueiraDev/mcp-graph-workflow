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
  cli/               # Commander.js commands (6) — thin orchestration, NO business logic
  core/
    capture/         # web-capture, validate-runner, content-extractor
    doctor/          # doctor-checks, doctor-runner, doctor-types (environment validation)
    config/          # config-schema, config-loader
    context/         # compact, tiered, bm25-compressor, context-assembler, rag-context, token-estimator
    docs/            # stack-detector, mcp-context7-fetcher, docs-cache-store, docs-syncer
    events/          # event-bus, event-types (GraphEventBus)
    graph/           # graph-types, graph-indexes, mermaid-export
    importer/        # import-prd, prd-to-graph
    journey/         # journey-store (website journey mapping)
    insights/        # bottleneck-detector, metrics-calculator, skill-recommender
    integrations/    # integration-orchestrator, enriched-context, mcp-servers-config, mcp-deps-installer, tool-status
    parser/          # classify, extract, normalize, read-file, segment, file-reader, read-pdf, read-html
    planner/         # next-task, enhanced-next, decompose, dependency-chain, velocity, planning-report
    rag/             # embedding-store, rag-pipeline, memory-indexer, docs-indexer, capture-indexer, memory-rag-query, chunk-text, query-understanding, post-retrieval, enrichment-pipeline, citation-mapper, query-cache, rag-trace, source-contribution, benchmark-indexer
    search/          # fts-search, tfidf, tokenizer
    store/           # sqlite-store, migrations, knowledge-store
    utils/           # errors, fs, id, logger, time
  api/               # Express REST API — 17 routers, 44 endpoints
  mcp/tools/         # MCP tool wrappers (32 tools)
  schemas/           # Zod schemas (node, edge, graph, knowledge)
  web/dashboard/     # React + Tailwind + React Flow dashboard
```

## Capabilities

| Capability | Key Modules | Docs |
|------------|-------------|------|
| PRD Import | parser/, importer/ | — |
| 32 MCP Tools | mcp/tools/ | [MCP Tools Reference](docs/MCP-TOOLS-REFERENCE.md) |
| 17 REST API Routers | api/routes/ | [REST API Reference](docs/REST-API-REFERENCE.md) |
| Knowledge Store + RAG | store/knowledge-store, rag/ | [Knowledge Pipeline](docs/KNOWLEDGE-PIPELINE.md) |
| Tiered Context Compression | context/ | [Knowledge Pipeline](docs/KNOWLEDGE-PIPELINE.md) |
| Sprint Planning + Velocity | planner/ | — |
| Integration Mesh | integrations/, docs/, capture/ | [Integrations Guide](docs/INTEGRATIONS-GUIDE.md) |

## Integration Agents

3 MCP agents coordinated by `IntegrationOrchestrator` via `GraphEventBus`:
**mcp-graph** (execution graph), **Context7** (library docs), **Playwright** (browser validation).
Native systems: **Code Intelligence** (code analysis), **Native Memories** (project knowledge).
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

See [docs/LIFECYCLE.md](docs/LIFECYCLE.md) for the full methodology guide.

# Code Intelligence

Native code analysis engine at `src/core/code/`. Provides symbol-level understanding of the codebase without external MCP dependencies.

## What It Does

- **Symbol analysis** — Extracts functions, classes, methods, and interfaces from TypeScript source via AST parsing
- **Relationship tracking** — Maps calls, imports, exports, and implements relationships between symbols
- **Impact analysis** — Graph traversal to find upstream/downstream dependents (blast radius)
- **FTS5 search** — Full-text search across all indexed symbols
- **Execution flow detection** — Identifies process flows (e.g., CLI command → core function → store)

## Module Layout

| File | Purpose |
|------|---------|
| `ts-analyzer.ts` | TypeScript AST analysis — extracts symbols and relationships from source files |
| `code-indexer.ts` | Indexes the entire codebase into SQLite (symbols + relationships) |
| `code-store.ts` | SQLite storage and queries for symbols and relationships |
| `code-search.ts` | FTS5 search + graph-based queries across indexed symbols |
| `graph-traversal.ts` | Upstream/downstream traversal for impact analysis |
| `process-detector.ts` | Detects execution flows across the codebase |

## Dashboard

The **Code Graph** tab in the dashboard visualizes symbols, relationships, and execution flows. API routes at `src/api/routes/code-graph.ts`.

## Usage

The code index is stored in `workflow-graph/` alongside the execution graph. It is rebuilt by the `reindex_knowledge` MCP tool or via the dashboard.

## Automatic Enforcement (MCP Wrapper)

Code Intelligence is automatically enforced during MCP tool execution via `src/mcp/code-intelligence-wrapper.ts`. This wrapper appends a `_code_intelligence` block to every MCP tool response, providing automatic impact analysis and symbol context.

### Modes

Configure via `set_phase({codeIntelligence: "strict" | "advisory" | "off"})`:

| Mode | Behavior |
|------|----------|
| `strict` | **Blocks** mutating tools if code index is empty. Warns on stale index. Appends enrichment. |
| `advisory` | **Warns** on empty/stale index but never blocks. Appends enrichment. |
| `off` | No enrichment, no checks (default). |

### Phase-Aware Enrichment

| Phase | Enrichment Type | Query |
|-------|----------------|-------|
| IMPLEMENT | Impact analysis (upstream, depth 2) | `analyzeImpact()` for symbols in tool args |
| REVIEW | Blast radius (upstream, depth 3) | `analyzeImpact()` with deeper traversal |
| VALIDATE | Symbol context (1-hop neighbors) | `getSymbolContext()` |
| Others | Generic (index status only) | Index metadata |

### Setting (persisted per project)

Key: `code_intelligence_mode` in project settings. Set via `set_phase` tool or `store.setProjectSetting()`.

## mcp-graph Execution Rule

**MANDATORY — applies to every task the AI performs, no exceptions.**

mcp-graph is the **single source of truth** for all work. The execution graph must reflect reality at all times. No implementation happens outside the graph.

### Before ANY implementation (Gate de Entrada)

1. **Node must exist** — before writing ANY code, the corresponding task node MUST exist in mcp-graph. Use `search` or `list` to find it. If it doesn't exist, create it with `node` (action: `add`) BEFORE touching any source file.
2. **Epic structure first** — when starting a new Epic or feature, create ALL nodes (Epic + child tasks) and ALL edges (dependencies) BEFORE implementing the first task. Use `import_prd` for PRDs or `node` (action: `add`) + `edge` for manual creation.
3. **Status = in_progress** — call `update_status` → `in_progress` BEFORE writing the first line of code for a task.
4. **Load context** — call `context` for the task to load compressed context (dependencies, RAG knowledge, related nodes). This informs the implementation.
5. **Use `next`** — always use `next` to get the recommended task based on priority + dependencies + knowledge coverage. Do NOT cherry-pick tasks unless the user explicitly requests a specific one.

### During implementation (Ciclo Obrigatório)

6. **The mandatory flow is: `next → context → [implement with TDD] → update_status → next`**. This cycle is NOT optional, NOT "recommended" — it is REQUIRED for every task.
7. **Phase-aware analysis** — use `analyze` with the appropriate mode for the current lifecycle phase:
   - IMPLEMENT: `tdd_check` (before coding), `implement_done` (after coding), `progress` (mid-sprint)
   - VALIDATE: `validate_ready`, `done_integrity`, `status_flow`
   - REVIEW: `review_ready`
8. **Save decisions** — use `write_memory` for important technical decisions, architectural patterns, or error patterns discovered during implementation.
9. **Validate completion** — use `validate` (action: `ac`) after completing each task to verify acceptance criteria are met.

### After implementation (Gate de Saída)

10. **Status = done** — call `update_status` → `done` ONLY after the task passes: tests green, build passes, AC validated.
11. **Never leave tasks in_progress** — if you stop working on a task (blocked, context switch), update status to `blocked` or `ready` as appropriate.
12. **Sprint tracking** — periodically use `analyze` mode `progress` to check burndown and velocity.

### Structural rules (Integridade do Grafo)

13. **Zero untracked work** — if a task doesn't have a node, CREATE IT FIRST. Every file change must trace back to a graph node.
14. **Dependencies matter** — use `edge` to declare dependencies between tasks. Never implement a task whose dependencies are not `done`.
15. **Knowledge pipeline** — use `rag_context` for deep context when needed. Use `reindex_knowledge` if the knowledge index seems stale.
16. **Graph visualization** — use `export` (format: `mermaid`) for reviews, handoffs, and debugging.

### Integration with other MCPs

17. **Context7** — use `sync_stack_docs` to ensure library docs are indexed before implementing features that depend on external libraries.
18. **Playwright** — use `validate` (action: `task`) for browser-based validation of UI tasks. Results auto-index into knowledge store.
19. **Code Intelligence** — use impact analysis and blast radius before modifying shared modules.

### If mcp-graph is unavailable

20. **Stop and diagnose** — if the mcp-graph MCP server is not responding, diagnose the issue BEFORE proceeding. Never fall back to working without the graph. Check `npx mcp-graph doctor` for environment validation.

### Quick reference checklist (every task)

- [ ] Node exists in graph? → if not, `node` (action: `add`)
- [ ] Dependencies satisfied? → `show` node, check deps
- [ ] Status updated to `in_progress`? → `update_status`
- [ ] Context loaded? → `context` or `rag_context`
- [ ] TDD test written FIRST? → Red → Green → Refactor
- [ ] AC validated? → `validate` (action: `ac`)
- [ ] Status updated to `done`? → `update_status`
- [ ] Technical decisions saved? → `write_memory`

> The bar is simple: **no node in the graph = no code written. The graph IS the work.**

<!-- mcp-graph:start -->
## mcp-graph — mcp-graph-workflow

Este projeto usa **mcp-graph** para gestão de execução via grafo persistente (SQLite).
Dados armazenados em `workflow-graph/graph.db` (local, gitignored).

### ⚠️ Regra de Execução OBRIGATÓRIA

**O mcp-graph é a fonte de verdade ABSOLUTA. Nenhuma implementação acontece fora do grafo.**

1. **Node deve existir** — antes de escrever QUALQUER código, o node correspondente DEVE existir no grafo
2. **Fluxo obrigatório** — `next → context → [implementar com TDD] → update_status → next` — SEM EXCEÇÕES
3. **Epic = estrutura primeiro** — criar Epic + tasks filhas + edges ANTES de implementar
4. **Status tracking** — `update_status → in_progress` ANTES de codar, `→ done` APÓS completar
5. **Validação** — usar `validate` (action: `ac`) após cada task para checar critérios de aceitação
6. **Zero trabalho não-rastreado** — se não tem node no grafo, CRIAR PRIMEIRO

> **Sem node no grafo = sem código escrito.**

### Ferramentas MCP disponíveis (28 tools + 6 deprecated)

#### Projeto & Grafo

| Tool | Quando usar |
|------|-------------|
| `init` | Inicializar grafo do projeto (cria DB, AI memory files, detecta MCPs) |
| `list` | Listar nodes do grafo (filtrar por tipo/status/parent) |
| `show` | Ver detalhes de um node específico (metadata, deps, knowledge) |
| `search` | Busca full-text no grafo (FTS5 + BM25 ranking) |
| `export` | Exportar grafo (JSON completo ou Mermaid diagram) |
| `snapshot` | Criar/restaurar snapshots do grafo (backup/rollback) |
| `metrics` | Estatísticas do grafo (`stats`) ou velocidade por sprint (`velocity`) |

#### Nodes & Edges

| Tool | Quando usar |
|------|-------------|
| `node` | CRUD de nodes: action `add` (criar), `update` (atualizar), `delete` (remover) |
| `move_node` | Mover node para outro parent |
| `clone_node` | Clonar node com filhos (deep copy) |
| `edge` | Criar/remover relações entre nodes (depends_on, blocks, related_to) |
| `update_status` | Mudar status de um node (backlog→ready→in_progress→done) |
| `bulk_update_status` | Atualizar status de múltiplos nodes de uma vez |

#### PRD & Planejamento

| Tool | Quando usar |
|------|-------------|
| `import_prd` | Importar PRD → segmentar → classificar → extrair → inferir deps → criar grafo + indexar knowledge |
| `plan_sprint` | Gerar relatório de planejamento de sprint (capacity, velocity, recomendações) |
| `analyze` | 24 modos de análise por fase do lifecycle (ver modos abaixo) |
| `set_phase` | Forçar/resetar fase do lifecycle (strict/advisory, gate checks) + Code Intelligence mode (strict/advisory/off) |

#### Contexto & RAG

| Tool | Quando usar |
|------|-------------|
| `next` | Próxima task recomendada (prioridade + deps + knowledge coverage 0-1 + TDD hints + velocity) |
| `context` | Contexto comprimido da task (token-efficient, ~73% redução) |
| `rag_context` | Contexto RAG phase-aware (tiers: summary/standard/deep, budget 60/30/10) |
| `reindex_knowledge` | Rebuild completo do índice de knowledge (BM25 + TF-IDF) |
| `sync_stack_docs` | Sincronizar docs das libs do projeto via Context7 |

#### Memórias do Projeto

| Tool | Quando usar |
|------|-------------|
| `write_memory` | Escrever memória em workflow-graph/memories/{name}.md (auto-indexa no RAG) |
| `read_memory` | Ler conteúdo de uma memória específica |
| `list_memories` | Listar todas as memórias disponíveis |
| `delete_memory` | Remover memória do filesystem e do knowledge store |

#### Validação

| Tool | Quando usar |
|------|-------------|
| `validate` | Validação: action `task` (browser A/B com Playwright) ou `ac` (critérios de aceitação) |

#### Skills

| Tool | Quando usar |
|------|-------------|
| `manage_skill` | Gerenciar skills: action `list` (listar/filtrar por fase), `enable`/`disable`, CRUD de custom skills |

#### Tools Deprecated (backward compat, removidos na v7.0)

| Tool antigo | Usar no lugar |
|-------------|---------------|
| `add_node` | `node` com action:`add` |
| `update_node` | `node` com action:`update` |
| `delete_node` | `node` com action:`delete` |
| `validate_task` | `validate` com action:`task` |
| `validate_ac` | `validate` com action:`ac` |
| `list_skills` | `manage_skill` com action:`list` |

### Modos do analyze por fase

| Fase | Modo | O que verifica |
|------|------|----------------|
| ANALYZE | `prd_quality` | Qualidade do PRD (completude, user stories, AC) |
| ANALYZE | `scope` | Escopo do grafo (tipos, distribuição, cobertura) |
| ANALYZE | `ready` | Definition of Ready (bloqueios, dependências, AC) |
| ANALYZE | `risk` | Riscos (complexidade, deps, tamanho, AC faltantes) |
| ANALYZE | `blockers` | Bloqueios transitivos de um node |
| ANALYZE | `cycles` | Ciclos de dependência no grafo |
| ANALYZE | `critical_path` | Caminho crítico (sequência mais longa de deps) |
| PLAN | `decompose` | Tasks grandes que precisam ser decompostas |
| DESIGN | `adr` | Validação de ADRs (Architecture Decision Records) |
| DESIGN | `traceability` | Matriz de rastreabilidade (req → task → test) |
| DESIGN | `coupling` | Acoplamento entre módulos |
| DESIGN | `interfaces` | Verificação de interfaces e contratos |
| DESIGN | `tech_risk` | Riscos técnicos (complexidade, stack, deps externas) |
| DESIGN | `design_ready` | Gate DESIGN→PLAN (pré-requisitos atendidos?) |
| IMPLEMENT | `implement_done` | Definition of Done (8 checks: 4 required + 4 recommended) |
| IMPLEMENT | `tdd_check` | Aderência TDD (specs sugeridos por AC) |
| IMPLEMENT | `progress` | Sprint burndown + velocity trend + blockers + ETA |
| VALIDATE | `validate_ready` | Gate IMPLEMENT→VALIDATE |
| VALIDATE | `done_integrity` | Integridade dos nodes marcados done |
| VALIDATE | `status_flow` | Fluxo de status válido (sem pulos) |
| REVIEW | `review_ready` | Gate VALIDATE→REVIEW |
| HANDOFF | `handoff_ready` | Gate REVIEW→HANDOFF |
| HANDOFF | `doc_completeness` | Completude de documentação |
| LISTENING | `listening_ready` | Gate HANDOFF→LISTENING |
| LISTENING | `backlog_health` | Saúde do backlog (distribuição, aging) |

### Fluxo de trabalho OBRIGATÓRIO

```
next → context → [implementar com TDD] → update_status → next
```

### Lifecycle (8 fases)

1. **ANALYZE** — Criar PRD, definir requisitos (`import_prd`, `add_node`)
2. **DESIGN** — Arquitetura, decisões técnicas (`add_node`, `edge`, `analyze`)
3. **PLAN** — Sprint planning, decomposição (`plan_sprint`, `analyze`, `sync_stack_docs`)
4. **IMPLEMENT** — TDD Red→Green→Refactor (`next`, `context`, `update_status`, `analyze` — modes: implement_done, tdd_check, progress)
5. **VALIDATE** — Testes E2E, critérios de aceitação (`validate_task`, `metrics`)
6. **REVIEW** — Code review, blast radius (`export`, `metrics`)
7. **HANDOFF** — PR, documentação, entrega (`export`, `snapshot`)
8. **LISTENING** — Feedback, novo ciclo (`add_node`, `import_prd`)

### Pipeline de Conhecimento (Knowledge Store + RAG)

Fontes indexadas automaticamente:
- **Project memories** — ao escrever com `write_memory` (auto-indexa)
- **PRD imports** — ao importar com `import_prd`
- **Browser captures** — ao validar com `validate_task`
- **Stack docs** — ao sincronizar com `sync_stack_docs`
- **Sprint reports** — ao gerar com `plan_sprint`

Recuperação: `rag_context` monta contexto phase-aware com budget de tokens:
- 60% contexto do grafo (nodes, deps, status)
- 30% knowledge store (BM25 + TF-IDF)
- 10% metadata de fase

Manual: `reindex_knowledge` para rebuild completo do índice.

### Skills Built-in (40 skills)

40 skills mapeadas às fases do lifecycle. Use `list_skills` para descobrir por fase ou ver instruções completas.

#### Skills por fase

| Fase | Skills sugeridas |
|------|-----------------|
| ANALYZE | `create-prd-chat-mode`, `business-analyst`, `product-manager` |
| DESIGN | `breakdown-epic-arch`, `context-architect`, `backend-architect` |
| PLAN | `breakdown-feature-prd`, `track-with-mcp-graph` |
| IMPLEMENT | `subagent-driven-development`, `xp-bootstrap`, `self-healing-awareness` |
| VALIDATE | `playwright-explore-website`, `playwright-generate-test`, `e2e-testing` |
| REVIEW | `code-reviewer`, `code-review-checklist`, `review-and-refactor`, `observability-engineer` |

#### Categorias adicionais (multi-fase)

| Categoria | Skills |
|-----------|--------|
| software-design | SOLID, KISS, YAGNI, DRY, clean-architecture, composition-over-inheritance |
| security | `owasp-web-security`, `auth-and-secrets`, `database-and-deps-security` |
| ddd | `domain-driven-design` (DESIGN, PLAN) |
| testing | `comprehensive-testing-reference`, `self-healing-awareness` (IMPLEMENT, VALIDATE) |
| cost-reducer | `cloud-infra-cost`, `code-level-savings`, `finops-services` (DESIGN, REVIEW) |
| frontend-design | `ui-ux-patterns` (DESIGN, IMPLEMENT) |

#### Custom Skills

Crie skills específicas do projeto via `manage_skill` (create/enable/disable). Custom skills são armazenadas no grafo e aparecem junto com as built-in em `list_skills`.

#### Self-Healing Awareness

A skill `self-healing-awareness` monitora padrões de erro recorrentes e sugere correções automaticamente. Ativa nas fases IMPLEMENT e VALIDATE.

### Princípios XP Anti-Vibe-Coding

- **TDD obrigatório** — Teste antes do código. Sem teste = sem implementação.
- **Anti-one-shot** — Nunca gere sistemas inteiros em um prompt. Decomponha em tasks atômicas.
- **Decomposição atômica** — Cada task deve ser completável em ≤2h.
- **Code detachment** — Se a IA errou, explique o erro via prompt. Nunca edite manualmente.
- **CLAUDE.md como spec evolutiva** — Documente padrões e decisões aqui.

### Comandos essenciais

```bash
npx mcp-graph stats            # Estatísticas do grafo
npx mcp-graph list             # Listar nodes
npx mcp-graph update           # Atualizar configs para última versão
npx mcp-graph doctor           # Validar ambiente de execução
npx mcp-graph doctor --json    # Diagnóstico em JSON estruturado
npx mcp-graph serve --port 3000  # Dashboard visual
```
<!-- mcp-graph:end -->
