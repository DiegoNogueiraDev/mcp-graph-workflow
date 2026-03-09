# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
