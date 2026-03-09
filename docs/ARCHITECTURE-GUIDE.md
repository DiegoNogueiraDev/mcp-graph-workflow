# Architecture Guide — mcp-graph

## Overview

mcp-graph is a local-first tool that transforms PRD text files into persistent execution graphs stored in SQLite. It provides structured, token-efficient context for agentic workflows.

## Layers

### Layer 1: CLI — `src/cli/`

**Framework:** Commander.js v14

Thin orchestration layer. Commands call core functions and format output. No business logic.

| Command | File | Description |
|---------|------|-------------|
| `init` | `commands/init.ts` | Initialize project + SQLite DB |
| `import` | `commands/import-cmd.ts` | Import PRD file into graph |
| `stats` | `commands/stats.ts` | Show graph statistics |
| `serve` | `commands/serve.ts` | Start HTTP server + dashboard |

### Layer 2: MCP Server — `src/mcp/`

**Protocol:** Model Context Protocol (Streamable HTTP + Stdio)

26 tools registered via `@modelcontextprotocol/sdk`. Two transport modes:

- **HTTP** (`server.ts`) — Express server with `/mcp` endpoint + REST API + static dashboard
- **Stdio** (`stdio.ts`) — Standard I/O transport for direct MCP client integration

Tool wrappers in `src/mcp/tools/` provide Zod-validated parameters and map to core functions.

### Layer 3: REST API — `src/api/`

**Framework:** Express v5

RESTful endpoints under `/api/v1/`. Modular router architecture:

```
router.ts                # Main router composition
routes/
  project.ts             # POST /project/init
  nodes.ts               # GET/POST/PATCH/DELETE /nodes
  edges.ts               # GET/POST/DELETE /edges
  stats.ts               # GET /stats
  search.ts              # GET /search
  graph.ts               # GET /graph/document, /graph/mermaid
  import.ts              # POST /import (multipart file upload)
  insights.ts            # GET /insights/bottlenecks
  context.ts             # GET /context/preview
  docs-cache.ts          # GET /docs
  events.ts              # GET /events (SSE stream)
  integrations.ts        # GET /integrations/status
  skills.ts              # GET /skills
  capture.ts             # POST /capture (web page capture)
middleware/
  error-handler.ts       # Centralized error handling
```

### Layer 4: Core — `src/core/`

Pure functions with explicit dependencies. No framework coupling.

#### Parser (`core/parser/`)

Pipeline: `readFile → segment → classify → extract`

| Module | Purpose |
|--------|---------|
| `file-reader.ts` | Read .md, .txt, .pdf, .html files |
| `read-file.ts` | Legacy PRD reader |
| `segment.ts` | Split text by headings into sections |
| `classify.ts` | Heuristic block classification (epic, task, requirement, etc.) |
| `extract.ts` | Extract structured entities from classified blocks |
| `normalize.ts` | Text normalization (whitespace, encoding) |

#### Importer (`core/importer/`)

| Module | Purpose |
|--------|---------|
| `prd-to-graph.ts` | Convert extraction results to graph nodes + edges with dependency inference |
| `import-prd.ts` | High-level import orchestration |

#### Planner (`core/planner/`)

| Module | Purpose |
|--------|---------|
| `next-task.ts` | Suggest next task: filter eligible → resolve dependencies → sort by priority/size/age |

#### Context Builder (`core/context/`)

| Module | Purpose |
|--------|---------|
| `compact-context.ts` | Build minimal context for a task (parent, children, deps, blockers, acceptance criteria) |
| `token-estimator.ts` | Estimate token count for context payloads |

#### Insights (`core/insights/`)

| Module | Purpose |
|--------|---------|
| `bottleneck-detector.ts` | Detect blocked tasks, critical paths, missing AC, oversized tasks |
| `metrics-calculator.ts` | Sprint velocity, completion rates, burndown |
| `skill-recommender.ts` | Recommend skills based on task context |

#### Search (`core/search/`)

| Module | Purpose |
|--------|---------|
| `fts-search.ts` | FTS5 full-text search with BM25 ranking |
| `tfidf.ts` | TF-IDF reranking for improved relevance |

#### Events (`core/events/`)

| Module | Purpose |
|--------|---------|
| `event-bus.ts` | `GraphEventBus` — typed event emitter for SSE real-time updates |

#### Store (`core/store/`)

| Module | Purpose |
|--------|---------|
| `sqlite-store.ts` | Main data access layer — CRUD, bulk ops, snapshots, FTS5 |
| `migrations.ts` | Schema migrations (additive, backward-compatible) |

### Layer 5: Storage — SQLite

- **WAL mode** for concurrent reads
- **FTS5** virtual table for full-text search
- **Indexes** on type, status, parentId, sprint
- **Snapshots** for graph versioning
- **Docs cache** for external documentation

Data stored in `.mcp-graph/graph.db` (local, gitignored).

### Layer 6: Web Dashboard — `src/web/public/`

**Stack:** Vanilla JS (~1,500 lines, 12 files), CSS, Mermaid.js

Modular IIFE pattern: each module exposes `{ init, load }`.

| File | Purpose |
|------|---------|
| `app.js` | Bootstrap, tab routing, theme, SSE connection |
| `api-client.js` | REST API wrapper |
| `graph-renderer.js` | Mermaid diagram rendering |
| `filters.js` | Filter panel (status, type, direction, format) |
| `node-detail.js` | Node detail side panel |
| `import-form.js` | Import modal with drag-and-drop |
| `capture-form.js` | Web page capture form |
| `tabs/graph-tab.js` | Graph tab with node table |
| `tabs/prd-backlog-tab.js` | PRD & Backlog tab |
| `tabs/code-graph-tab.js` | Code graph integration |
| `tabs/knowledge-tab.js` | Knowledge base / docs cache |
| `tabs/insights-tab.js` | Insights and metrics |

Real-time updates via EventSource (SSE) — the dashboard auto-refreshes when nodes/edges change.

### Layer 7: Skills & Agents

Skills are local workflow extensions stored in `copilot-ecosystem/`. Each skill is a directory with a `SKILL.md` containing frontmatter and instructions.

Key skills: `/xp-bootstrap`, `/project-scaffold`, `/dev-flow-orchestrator`, `/track-with-mcp-graph`.

### Layer 8: Integrations

| Integration | Purpose | Detection |
|-------------|---------|-----------|
| Serena | Semantic code analysis | `.serena/` directory |
| Playwright | Browser E2E testing | `@playwright/test` devDependency |
| GitNexus | Code graph visualization | `.gitnexus/` directory |
| Context7 | Library documentation | MCP server config |

## Data Flow

```
PRD File (.md/.txt/.pdf/.html)
  → readFileContent()           # Layer 4: Parser
  → extractEntities()           # Layer 4: Parser
  → convertToGraph()            # Layer 4: Importer
  → store.bulkInsert()          # Layer 5: SQLite
  → eventBus.emit()             # Layer 4: Events
  → SSE → Dashboard update      # Layer 6: Web
```

## Token Efficiency

The compact context builder achieves 70-85% token reduction by:

1. Summarizing parent/child relationships instead of including full trees
2. Including only relevant blockers and dependencies
3. Omitting metadata not needed for task execution
4. Structuring output as key-value pairs instead of prose

## Design Principles

- **Local-first** — No external services, no Docker, no cloud dependencies
- **Pure functions** — Core modules are side-effect-free where possible
- **Typed boundaries** — Zod v4 schemas validate all external input
- **Strict TypeScript** — No `any`, explicit return types, ESM-only
- **Thin orchestration** — CLI/MCP/API layers only call core, never contain logic
- **Backward compatibility** — Schema changes are additive, old data formats supported
