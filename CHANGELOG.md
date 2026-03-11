# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.0.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v3.0.0...mcp-graph-v4.0.0) (2026-03-11)


### ⚠ BREAKING CHANGES

* Package renamed from @diegonogueiradev_/mcp-graph to @mcp-graph-workflow/mcp-graph. Version bumped to 3.0.0.

### Features

* add lifecycle management to MCP tools and enhance project handling in dashboard ([67870b0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/67870b01536991f7d42b96458366a7e517034255))
* add npm publish job to release workflow ([dbaaa39](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/dbaaa39230ba9995b08ef35d0373aa5b073cd1a1))
* add update notifier for CLI users ([f3a27a5](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f3a27a5a0ec5abf98df0093b1c8d25d874ade115))
* automate releases with release-please ([8748a8c](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/8748a8c2d08d99902a8e07bcadba6c791b123bc2))
* **cli:** improve stdio detection and update docs ([e5f15ba](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/e5f15ba96e78285866971bba4ff323cad39b5413))
* consolidate MCP tools (31→26), fix RAG budget, add Benchmark tab & API ([cb78bbc](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/cb78bbce6b59826139ca9f39678a24cee0bd0fc1))
* cross-platform support, logger instrumentation, and dashboard tab refactor ([66dcb75](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/66dcb759632201e92bd75c36a1dd5ace0b071916))
* **dashboard:** add GitNexus on-demand activation and edge relationship management ([656124a](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/656124a0d6aa3cbdbd8996ff41700f1e1385cff0))
* **dashboard:** GitNexus on-demand + edge relationships ([9597fde](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/9597fde1fd0855929845390d3c0246df52ac114f))
* enhance code graph tab with symbol exploration and impact analysis ([3534c41](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/3534c41e40fdc055d680435c97fb93ca756c5204))
* fix multi-project isolation and add parte-3 notebook (scenarios 25-35) ([8986a43](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/8986a431b46aaf739ad0be53315c732631a0fda0))
* migrate npm scope from [@diegonogueiradev](https://github.com/diegonogueiradev)_ to [@mcp-graph-workflow](https://github.com/mcp-graph-workflow) ([efa9d9a](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/efa9d9a7f5c203be8fc05320a58b40dd533ba942))
* **tests:** add 12 E2E benchmark scenarios with Playwright MCP (cenários 13-24) ([58d5c0f](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/58d5c0f8dfe007882023111c0684107ad29e8559))
* **tests:** enhance e2e tests for import modal, PRD backlog, and SSE events ([46a901c](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/46a901c028f34dcb3a705e4ffc710b0628d1ddcc))
* update .claudeignore to include additional build and test artifacts ([7e54ccc](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/7e54ccc95ca5c2a3d0a4175c7b365b267064fa63))


### Bug Fixes

* drop Node 18 from CI matrix (Tailwind v4 requires Node &gt;= 20) ([3bf5eda](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/3bf5eda964f429bbc535355f13d26a1ca1f3f1c6))
* **gitnexus:** cross-platform binary resolution and query proxy ([f79cc1e](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f79cc1edd4339ea5189363f40f3f3dea41993200))
* remove npm test from prepublishOnly to unblock publish ([dc4797b](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/dc4797b05cc1ef53dd9fd401f6d61244b865623f))
* update CI workflow trigger from main to master ([c29fed9](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/c29fed985e3db15391d9f212ef09b8d6348dd086))


### Performance

* optimize dashboard tab switching and reduce DOM overhead ([86e3ae2](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/86e3ae21642d539c34a265a54ee3f481ad9bf601))

## [Unreleased]

### Added
- Benchmark tab no dashboard com métricas de token economy
- `GET /api/v1/benchmark` endpoint na REST API
- Testes unitários para `graph-utils.ts` (24 testes: toFlowNodes, toFlowEdges, computeLayoutKey, shouldSkipLayout)
- Testes E2E de performance dos filtros do Graph tab (`graph-filters-perf.spec.ts`)
- GitNexus auto-analyze on startup (detecta `.git/`, indexa codebase, inicia serve)
- Configuração `gitnexusAutoStart` e variável de ambiente `GITNEXUS_AUTO_START`

### Changed
- MCP tools consolidados de 31 → 26 (edge, snapshot, export como multi-action)
- Dashboard Graph tab: `useDeferredValue` para filtros, `computeLayoutKey` (hash numérico), `shouldSkipLayout` (skip Dagre), ReactFlow `nodesDraggable=false`/`nodesConnectable=false`
- Dashboard PRD & Backlog tab: ReactFlow read-only props
- Dashboard node table: paginação (50/page)
- Testes E2E atualizados para seletores React (substituídos #mermaid-output, #btn-apply-filters, etc.)

### Fixed
- RAG budget enforcement: hard cap via `Math.min` em `ragBuildContext`
- Layout cache key: hash numérico em vez de string concatenation (evita alocação de strings grandes)

## [2.1.0] - 2026-03-09

### Added

- All 8 edge types fully active: `related_to`, `implements`, `derived_from`, `parent_of`, `child_of`, `priority_over` integrated across context builder, planner, and bottleneck detector
- CI/CD workflows (GitHub Actions) for build, test, lint, and release
- Issue and PR templates for structured community contributions
- Security policy (SECURITY.md)
- README badges (CI status, npm version, Node.js, license, TypeScript, PRs welcome)

### Changed

- CONTRIBUTING.md rewritten for code contributions (TDD, development workflow, code standards)
- CHANGELOG.md updated with full version history

## [2.0.1] - 2026-03-07

### Fixed

- Add missing shebang (`#!/usr/bin/env node`) to mcp-graph-server entry point

## [2.0.0] - 2026-03-06

### Added

- Web dashboard with 5 tabs (Graph, PRD & Backlog, Code Graph, Knowledge, Insights)
- REST API with Express (full CRUD + search + import + insights)
- SSE real-time event bus
- Configuration schema and loader
- Docs cache syncer
- FTS5 + TF-IDF search with reranking
- Bottleneck detection and metrics insights
- Dashboard build via Vite
- 54 tests with shared factory infrastructure covering LIFECYCLE phases
- Snapshot create/restore/list functionality
- Bulk status update, node clone, node move operations
- Velocity and dependency analysis tools
- Mermaid export (flowchart and mindmap)
- Graph export as JSON

### Changed

- **Breaking:** Project directory paths updated in configuration and README
- Test infrastructure rewritten with shared factories (breaking test compatibility)

### Fixed

- Project directory paths in configuration

## [1.0.0] - 2026-03-05

### Added

- MCP server with HTTP and Stdio transports
- 10 MCP tools: init, import_prd, list, show, next, update_status, update_node, delete_node, stats, context
- PRD parser pipeline: normalize, segment, classify, extract
- PRD to graph conversion with 5 passes (nodes, hierarchy, constraints, priority, dependency inference)
- SQLite persistence with WAL mode, migrations, and snapshots
- Next-task routing engine with 5-criteria sort (priority, blocked, xpSize, estimate, createdAt)
- Compact context builder with token reduction metrics (70-85% reduction)
- Node management: add, clone, move, delete, export
- Snapshot listing and restore functionality
- Initialization command with MCP config generation (.mcp.json, .vscode/mcp.json)
- Zod v4 validation schemas for nodes and edges
- 6 test suites with ~60+ assertions (Vitest)
- Full TypeScript strict mode with ESM modules

### Fixed

- Transitive blockers detection optimized to avoid redundant visits
- Package name updated in init command to include npm scope
