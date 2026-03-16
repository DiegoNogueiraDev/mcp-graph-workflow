# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [5.1.3](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.1.2...mcp-graph-v5.1.3) (2026-03-16)


### Bug Fixes

* add checkout step before gh pr merge in release workflow ([4e3aeac](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/4e3aeac57920f8ee4adcc7d0db91362a9af4d7ec))
* extract PR number from release-please JSON output ([759d985](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/759d985e1ab06415e6d049cce919422fa862b4c2))
* fallback to direct merge when no branch protection rules exist ([472eeb6](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/472eeb6c310ffa7f925cb72ae747c9d3bcdf2008))
* replace non-null assertion with explicit guard in docs-cache-store ([f7a1d86](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f7a1d8694fb6e557e4819a5a8e343f6cd8a2c2d1))

## [5.1.2](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.1.1...mcp-graph-v5.1.2) (2026-03-16)


### Bug Fixes

* increase doctor-checks test timeouts for slow CI runners ([e7a7b48](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/e7a7b482f034653d740981650a9ae9261e49c5d0))

## [5.1.1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.1.0...mcp-graph-v5.1.1) (2026-03-16)


### Bug Fixes

* relax findNextTask benchmark threshold for slow CI runners ([4184f11](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/4184f11574a3397c5a937e35e9319dc73e00fca9))

## [5.1.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.0.5...mcp-graph-v5.1.0) (2026-03-16)


### Features

* add `mcp-graph doctor` command and lifecycle MCP agent suggestions ([13b31b4](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/13b31b499424d8a44461a02543e9553cf6dfc86a))


### Bug Fixes

* make doctor and tool-status tests cross-platform (Windows CI) ([8c786c1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/8c786c1048c84a3bcfd8f79cbe534036f2b5a01b))

## [5.0.5](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.0.4...mcp-graph-v5.0.5) (2026-03-16)


### Bug Fixes

* correct token savings calculation in benchmark ([1f94e56](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/1f94e565f52eaef6c2d5d523a1e9fa3bad296190))

## [5.0.4](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.0.3...mcp-graph-v5.0.4) (2026-03-15)


### Bug Fixes

* allow dashboard to swap project DB at runtime via Open Folder ([#31](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/31)) ([a4d4ea7](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/a4d4ea795a699eb09aa6545ec8cb834ec6f3cd67))

## [5.0.3](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.0.2...mcp-graph-v5.0.3) (2026-03-15)


### Bug Fixes

* reset release manifest to re-trigger 5.0.3 publish ([6358944](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/6358944bb542c3e1ef47dbeac26141a8938522f1))
* sanitize all color paths in GitNexus nodeReducer and clean stale dashboard bundles ([ea95fc4](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/ea95fc43451adcfdc64f341612a28aeb7958a889))

## [5.0.3](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.0.2...mcp-graph-v5.0.3) (2026-03-15)


### Bug Fixes

* sanitize all color paths in GitNexus nodeReducer and clean stale dashboard bundles ([ea95fc4](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/ea95fc43451adcfdc64f341612a28aeb7958a889))

## [5.0.2](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.0.1...mcp-graph-v5.0.2) (2026-03-15)


### Bug Fixes

* resolve favicon 404 and GitNexus tab invalid canvas color ([31844a0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/31844a010d841376e2495bdbdbdba1f913f94cae))

## [5.0.1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v5.0.0...mcp-graph-v5.0.1) (2026-03-15)


### Bug Fixes

* prevent GitNexus tab blank screen on node click in Safari ([0d734a0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/0d734a0cc86c9267ac866412dca76abeebe20c29))
* prevent GitNexus tab blank screen on node click in Safari ([8056adc](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/8056adcbc8738477e5558d7ca67a627a5e60632f))

## [5.0.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v4.4.0...mcp-graph-v5.0.0) (2026-03-14)


### ⚠ BREAKING CHANGES

* Package renamed from @diegonogueiradev_/mcp-graph to @mcp-graph-workflow/mcp-graph. Version bumped to 3.0.0.

### Features

* add lifecycle management to MCP tools and enhance project handling in dashboard ([67870b0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/67870b01536991f7d42b96458366a7e517034255))
* add npm publish job to release workflow ([dbaaa39](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/dbaaa39230ba9995b08ef35d0373aa5b073cd1a1))
* add real-time logs tab to dashboard ([#15](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/15)) ([345fa20](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/345fa20ffc3db812bfeb81d93d5fbd5ef5302194))
* add update notifier for CLI users ([f3a27a5](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f3a27a5a0ec5abf98df0093b1c8d25d874ade115))
* auto-open dashboard in browser when MCP starts via stdio ([ed7fcf0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/ed7fcf04d600354fe649d1a2caaaaa55f0792926))
* automate releases with release-please ([8748a8c](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/8748a8c2d08d99902a8e07bcadba6c791b123bc2))
* CI security pipeline, ESLint + security plugin, code quality ([#10](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/10)) ([742490a](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/742490afdae5c0f9116ce18d3295abea2fbee376))
* **cli:** improve stdio detection and update docs ([e5f15ba](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/e5f15ba96e78285866971bba4ff323cad39b5413))
* consolidate MCP tools (31→26), fix RAG budget, add Benchmark tab & API ([cb78bbc](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/cb78bbce6b59826139ca9f39678a24cee0bd0fc1))
* cross-platform support, logger instrumentation, and dashboard tab refactor ([66dcb75](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/66dcb759632201e92bd75c36a1dd5ace0b071916))
* **dashboard:** add GitNexus on-demand activation and edge relationship management ([656124a](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/656124a0d6aa3cbdbd8996ff41700f1e1385cff0))
* **dashboard:** GitNexus on-demand + edge relationships ([9597fde](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/9597fde1fd0855929845390d3c0246df52ac114f))
* enhance code graph tab with symbol exploration and impact analysis ([3534c41](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/3534c41e40fdc055d680435c97fb93ca756c5204))
* enhance lifecycle system with HANDOFF/LISTENING auto-detection, warnings, and phase override ([29053e1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/29053e18ad97d0acd773e8761f257552cd177b67))
* fix multi-project isolation and add parte-3 notebook (scenarios 25-35) ([8986a43](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/8986a431b46aaf739ad0be53315c732631a0fda0))
* migrate npm scope from [@diegonogueiradev](https://github.com/diegonogueiradev)_ to [@mcp-graph-workflow](https://github.com/mcp-graph-workflow) ([efa9d9a](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/efa9d9a7f5c203be8fc05320a58b40dd533ba942))
* **tests:** add 12 E2E benchmark scenarios with Playwright MCP (cenários 13-24) ([58d5c0f](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/58d5c0f8dfe007882023111c0684107ad29e8559))
* **tests:** enhance e2e tests for import modal, PRD backlog, and SSE events ([46a901c](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/46a901c028f34dcb3a705e4ffc710b0628d1ddcc))
* update .claudeignore to include additional build and test artifacts ([7e54ccc](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/7e54ccc95ca5c2a3d0a4175c7b365b267064fa63))


### Bug Fixes

* drop Node 18 from CI matrix (Tailwind v4 requires Node &gt;= 20) ([3bf5eda](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/3bf5eda964f429bbc535355f13d26a1ca1f3f1c6))
* **gitnexus:** cross-platform binary resolution and query proxy ([f79cc1e](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f79cc1edd4339ea5189363f40f3f3dea41993200))
* platform tests use vi.resetModules for cross-platform support ([f279342](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f279342c2460cc153bb1189b0b27ef8de1948212))
* prevent data loss + auto-open dashboard on MCP start ([19ea018](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/19ea018b4f793a419cef9cfb56a84e7d5fc0cdad))
* prevent initProject from creating duplicate projects ([50bd7a8](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/50bd7a80cfdc2b0f35d83de5aeab1f78931f783b))
* remove npm test from prepublishOnly to unblock publish ([dc4797b](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/dc4797b05cc1ef53dd9fd401f6d61244b865623f))
* update CI workflow trigger from main to master ([c29fed9](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/c29fed985e3db15391d9f212ef09b8d6348dd086))
* update npm and node badges to correct scope ([1bf3404](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/1bf3404a0b189add3ce9347aa13f41f81fefcf82))
* update undici to patch high severity vulnerabilities ([#24](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/24)) ([ea43ff6](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/ea43ff68d91f6f73651bad259d37715a7de36ef1))
* use cross-platform copy-dashboard script for Windows CI ([c2792e5](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/c2792e540e712f077d208aaa4145b74b0168fd4c))
* use relative path in Serena MCP server config ([#19](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/19)) ([0fc62f0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/0fc62f076bb81091f29f14c3c4b9c7ed5b45bcde))


### Performance

* optimize dashboard tab switching and reduce DOM overhead ([86e3ae2](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/86e3ae21642d539c34a265a54ee3f481ad9bf601))

## [4.4.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v4.3.1...mcp-graph-v4.4.0) (2026-03-14)


### Features

* auto-open dashboard in browser when MCP starts via stdio ([ed7fcf0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/ed7fcf04d600354fe649d1a2caaaaa55f0792926))


### Bug Fixes

* prevent data loss + auto-open dashboard on MCP start ([19ea018](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/19ea018b4f793a419cef9cfb56a84e7d5fc0cdad))
* prevent initProject from creating duplicate projects ([50bd7a8](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/50bd7a80cfdc2b0f35d83de5aeab1f78931f783b))

## [4.3.1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v4.3.0...mcp-graph-v4.3.1) (2026-03-12)


### Bug Fixes

* use relative path in Serena MCP server config ([#19](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/19)) ([0fc62f0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/0fc62f076bb81091f29f14c3c4b9c7ed5b45bcde))

## [4.3.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v4.2.0...mcp-graph-v4.3.0) (2026-03-12)


### Features

* enhance lifecycle system with HANDOFF/LISTENING auto-detection, warnings, and phase override ([29053e1](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/29053e18ad97d0acd773e8761f257552cd177b67))

## [4.2.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v4.1.0...mcp-graph-v4.2.0) (2026-03-11)


### Features

* add real-time logs tab to dashboard ([#15](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/15)) ([345fa20](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/345fa20ffc3db812bfeb81d93d5fbd5ef5302194))

## [4.1.0](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/compare/mcp-graph-v4.0.0...mcp-graph-v4.1.0) (2026-03-11)


### Features

* CI security pipeline, ESLint + security plugin, code quality ([#10](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/issues/10)) ([742490a](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/742490afdae5c0f9116ce18d3295abea2fbee376))


### Bug Fixes

* platform tests use vi.resetModules for cross-platform support ([f279342](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/f279342c2460cc153bb1189b0b27ef8de1948212))
* update npm and node badges to correct scope ([1bf3404](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/1bf3404a0b189add3ce9347aa13f41f81fefcf82))
* use cross-platform copy-dashboard script for Windows CI ([c2792e5](https://github.com/DiegoNogueiraDev/mcp-graph-workflow/commit/c2792e540e712f077d208aaa4145b74b0168fd4c))

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
