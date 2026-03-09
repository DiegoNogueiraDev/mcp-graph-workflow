# Architecture Guide — mcp-graph

## Overview

mcp-graph is a local-first tool that transforms PRD text files into persistent execution graphs stored in SQLite, with an integrated knowledge store, RAG pipeline, and multi-agent integration mesh. It provides structured, token-efficient context for agentic workflows.

## Layers

### Layer 1: CLI — `src/cli/`

**Framework:** Commander.js v14

Thin orchestration layer. Commands call core functions and format output. No business logic.

| Command | File | Description |
|---------|------|-------------|
| `init` | `commands/init.ts` | Initialize project + SQLite DB |
| `import` | `commands/import-cmd.ts` | Import PRD file into graph |
| `index` | `commands/index-cmd.ts` | Rebuild knowledge indexes and embeddings |
| `stats` | `commands/stats.ts` | Show graph statistics |
| `serve` | `commands/serve.ts` | Start HTTP server + MCP + dashboard |

### Layer 2: MCP Server — `src/mcp/`

**Protocol:** Model Context Protocol (Streamable HTTP + Stdio)

31 tools registered via `@modelcontextprotocol/sdk`. Two transport modes:

- **HTTP** (`server.ts`) — Express server with `/mcp` endpoint + REST API + static dashboard
- **Stdio** (`stdio.ts`) — Standard I/O transport for direct MCP client integration

Tool categories:
- **Graph CRUD** (12) — init, import_prd, add_node, update_node, delete_node, add_edge, delete_edge, list_edges, move_node, clone_node, export_graph, export_mermaid
- **Querying** (4) — list, show, search, rag_context
- **Planning & Execution** (7) — next, update_status, bulk_update_status, decompose, velocity, dependencies, plan_sprint
- **Knowledge & RAG** (3) — context, reindex_knowledge, sync_stack_docs
- **Validation** (1) — validate_task
- **Snapshots & Stats** (4) — stats, create_snapshot, restore_snapshot, list_snapshots

See [MCP Tools Reference](./MCP-TOOLS-REFERENCE.md) for full parameter documentation.

### Layer 3: REST API — `src/api/`

**Framework:** Express v5

17 routers, 44 endpoints. Modular router architecture:

```
router.ts                # Main router composition
routes/
  project.ts             # GET/POST /project
  nodes.ts               # GET/POST/PATCH/DELETE /nodes
  edges.ts               # GET/POST/DELETE /edges
  stats.ts               # GET /stats
  search.ts              # GET /search
  graph.ts               # GET /graph, /graph/mermaid
  import.ts              # POST /import (multipart file upload)
  knowledge.ts           # GET/POST/DELETE /knowledge
  rag.ts                 # POST /rag/query, /rag/reindex, GET /rag/stats
  gitnexus.ts            # GET /gitnexus/status, POST /gitnexus/query|context|impact
  integrations.ts        # GET /integrations/status|serena|enriched-context|knowledge-status
  insights.ts            # GET /insights/bottlenecks|recommendations|metrics
  context.ts             # GET /context/preview
  capture.ts             # POST /capture
  docs-cache.ts          # GET/POST /docs
  events.ts              # GET /events (SSE stream)
  skills.ts              # GET /skills
middleware/
  error-handler.ts       # Centralized error handling
  validate.ts            # Zod-based request validation
```

See [REST API Reference](./REST-API-REFERENCE.md) for full endpoint documentation.

### Layer 4: Core — `src/core/`

Pure functions with explicit dependencies. No framework coupling. 16 subdirectories.

#### Parser (`core/parser/`)

Pipeline: `readFile → segment → classify → extract`

| Module | Purpose |
|--------|---------|
| `file-reader.ts` | Read .md, .txt, .pdf, .html files with format detection |
| `read-file.ts` | Legacy PRD reader |
| `read-pdf.ts` | PDF extraction via pdf-parse |
| `read-html.ts` | HTML to markdown extraction |
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
| `enhanced-next.ts` | Augments next-task with knowledge coverage + velocity context |
| `decompose.ts` | Detect large tasks, suggest subtask breakdown |
| `dependency-chain.ts` | Analyze dependency graphs, detect cycles, compute critical paths |
| `velocity.ts` | Calculate historical sprint velocity and time estimates |
| `planning-report.ts` | Generate sprint planning reports (capacity, blockers, risk) |

#### Context Builder (`core/context/`)

| Module | Purpose |
|--------|---------|
| `compact-context.ts` | Build minimal context for a task (parent, children, deps, blockers, AC) |
| `rag-context.ts` | Semantic RAG context builder with token budgeting |
| `tiered-context.ts` | Three-tier compression: summary (~20 tok) / standard (~150 tok) / deep (~500+ tok) |
| `bm25-compressor.ts` | BM25 ranking to filter knowledge chunks by relevance |
| `context-assembler.ts` | Combines graph (60%) + knowledge (30%) + header (10%) with token accounting |
| `token-estimator.ts` | Estimate token count for context payloads |

#### RAG (`core/rag/`)

| Module | Purpose |
|--------|---------|
| `embedding-store.ts` | Persist TF-IDF vectors in SQLite, cosine similarity search |
| `rag-pipeline.ts` | TF-IDF vectorizer: index nodes + knowledge as embeddings |
| `serena-indexer.ts` | Index Serena memory documents into embeddings |
| `docs-indexer.ts` | Index fetched documentation into embeddings |
| `capture-indexer.ts` | Index web-captured content into embeddings |
| `serena-rag-query.ts` | Query Serena memories via FTS / semantic / hybrid modes |
| `chunk-text.ts` | Split text into ~500 token chunks with overlap |

See [Knowledge Pipeline](./KNOWLEDGE-PIPELINE.md) for the full RAG documentation.

#### Integrations (`core/integrations/`)

| Module | Purpose |
|--------|---------|
| `integration-orchestrator.ts` | Event-driven mesh: auto-triggers reindex on import/sync events |
| `serena-reader.ts` | Read `.serena/memories/` directory recursively |
| `gitnexus-launcher.ts` | Manage GitNexus lifecycle (analyze, serve, cleanup) |
| `enriched-context.ts` | Combine Serena + GitNexus + Knowledge into unified context |
| `mcp-servers-config.ts` | Manage `.mcp.json` server configurations |
| `mcp-deps-installer.ts` | Auto-install MCP server dependencies |
| `tool-status.ts` | Track integration availability and health |

See [Integrations Guide](./INTEGRATIONS-GUIDE.md) for the full integrations documentation.

#### Docs (`core/docs/`)

| Module | Purpose |
|--------|---------|
| `stack-detector.ts` | Auto-detect project tech stack from manifest files |
| `mcp-context7-fetcher.ts` | Fetch docs from Context7 for detected libraries |
| `docs-cache-store.ts` | SQLite-backed documentation cache |
| `docs-syncer.ts` | Sync docs for detected libraries + trigger embedding pipeline |

#### Capture (`core/capture/`)

| Module | Purpose |
|--------|---------|
| `web-capture.ts` | Playwright-based page capture (HTML, screenshots, a11y tree) |
| `validate-runner.ts` | Task validation with A/B comparison support |
| `content-extractor.ts` | Extract clean text from captured HTML |

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
| `tokenizer.ts` | Text tokenization with stopword removal |

#### Events (`core/events/`)

| Module | Purpose |
|--------|---------|
| `event-bus.ts` | `GraphEventBus` — typed event emitter for real-time updates |
| `event-types.ts` | Event type definitions (node:created, knowledge:indexed, etc.) |

#### Store (`core/store/`)

| Module | Purpose |
|--------|---------|
| `sqlite-store.ts` | Main data access layer — CRUD, bulk ops, snapshots, FTS5 |
| `migrations.ts` | Schema migrations (additive, backward-compatible) |
| `knowledge-store.ts` | CRUD + FTS for knowledge_documents table |

#### Config (`core/config/`)

| Module | Purpose |
|--------|---------|
| `config-schema.ts` | Zod schema for project configuration |
| `config-loader.ts` | Load and validate config from filesystem |

#### Graph (`core/graph/`)

| Module | Purpose |
|--------|---------|
| `graph-types.ts` | Core interfaces (GraphNode, GraphEdge, NodeType, NodeStatus) |
| `graph-indexes.ts` | B-tree and FTS indexes for fast queries |
| `mermaid-export.ts` | Export graph as Mermaid flowchart/mindmap |

#### Utils (`core/utils/`)

| Module | Purpose |
|--------|---------|
| `errors.ts` | Custom typed error classes |
| `logger.ts` | Structured logger (info, error, debug) |
| `id.ts` | ID generation (nanoid-based) |
| `time.ts` | Timestamp utilities |
| `fs.ts` | Filesystem utilities |

### Layer 5: Storage — SQLite

- **WAL mode** for concurrent reads
- **FTS5** virtual tables for full-text search (nodes + knowledge)
- **Indexes** on type, status, parentId, sprint
- **Snapshots** for graph versioning
- **Docs cache** table for external documentation
- **knowledge_documents** table with FTS5 + SHA-256 dedup
- **embeddings** table for TF-IDF vectors

Data stored in `.mcp-graph/graph.db` (local, gitignored).

### Layer 6: Web Dashboard — `src/web/dashboard/`

**Stack:** React 19 + TypeScript + Vite + Tailwind CSS + React Flow

| Component | Purpose |
|-----------|---------|
| `components/graph/` | Interactive workflow graph (React Flow + Dagre layout) |
| `components/tabs/graph-tab.tsx` | Graph visualization with filters and detail panel |
| `components/tabs/code-graph-tab.tsx` | Code dependency graph (D3-based) |
| `components/tabs/prd-backlog-tab.tsx` | PRD backlog list view |
| `components/tabs/insights-tab.tsx` | Metrics, bottlenecks, velocity |
| `components/modals/` | Import and capture modals |
| `hooks/` | Graph data, SSE, stats hooks |

4 tabs: Graph, Code Graph, PRD Backlog, Insights. Real-time updates via SSE. Dark/light theme.

### Layer 7: Skills & Agents

Skills are local workflow extensions stored in `copilot-ecosystem/`. Each skill is a directory with a `SKILL.md` containing frontmatter and instructions.

Key skills: `/xp-bootstrap`, `/project-scaffold`, `/dev-flow-orchestrator`, `/track-with-mcp-graph`.

### Layer 8: Integrations

| Integration | Purpose | Detection |
|-------------|---------|-----------|
| Serena | Semantic code analysis, memory | `.serena/` directory |
| GitNexus | Code graph, dependency analysis | `.gitnexus/` directory |
| Context7 | Library documentation fetching | MCP server config |
| Playwright | Browser automation, web capture | `@playwright/test` devDependency |

See [Integrations Guide](./INTEGRATIONS-GUIDE.md) for detailed documentation.

## Data Flow

### PRD Import Flow

```
PRD File (.md/.txt/.pdf/.html)
  → readFileContent()           # Parser
  → extractEntities()           # Parser
  → convertToGraph()            # Importer
  → store.bulkInsert()          # SQLite
  → eventBus.emit()             # Events
  → SSE → Dashboard update      # Web
```

### Knowledge Indexing Flow

```
Sources (Serena memories, Context7 docs, web captures)
  → Indexer (serena/docs/capture)  # RAG
  → chunkText()                     # RAG
  → knowledgeStore.upsert()         # Store
  → ragPipeline.buildIndex()        # RAG
  → embeddingStore.persist()        # RAG
```

### Context Assembly Flow

```
Query/Task ID
  → Tiered context (graph)          # Context
  → BM25 knowledge search           # Context
  → Token budget allocation          # Context
  → Assembled payload (70-85% reduction)
```

## Token Efficiency

The context system achieves 70-85% token reduction through:

1. **Tiered compression** — Summary/standard/deep per node relevance
2. **BM25 filtering** — Only relevant knowledge chunks included
3. **Token budgeting** — 60% graph, 30% knowledge, 10% header
4. **Structural summarization** — Key-value pairs instead of prose

## Design Principles

- **Local-first** — No external services, no Docker, no cloud dependencies
- **Pure functions** — Core modules are side-effect-free where possible
- **Typed boundaries** — Zod v4 schemas validate all external input
- **Strict TypeScript** — No `any`, explicit return types, ESM-only
- **Thin orchestration** — CLI/MCP/API layers only call core, never contain logic
- **Backward compatibility** — Schema changes are additive, old data formats supported
- **Event-driven** — Integration mesh reacts to graph mutations, no polling
