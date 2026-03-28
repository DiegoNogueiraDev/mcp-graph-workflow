# Integrations Guide

> Three MCP agents (mcp-graph, Context7, Playwright) plus two native systems (Code Intelligence, Native Memories) — coordinated by mcp-graph as the orchestrator. No Python dependencies required.

## Overview

| Integration | Role | When Used |
|------------|------|-----------|
| **Native Memories** | Project memory persistence + RAG | Storing/retrieving project knowledge, architecture decisions, patterns |
| **Code Intelligence** | Native code analysis (AST, FTS5) | Impact analysis, symbol search, dependency visualization |
| **Context7** | Library documentation fetching | Stack-aware docs sync, API reference lookup |
| **Playwright** | Browser automation, web capture | Task validation, A/B testing, content capture |

## MCP Client Compatibility

mcp-graph works with any MCP client that supports stdio transport:

| Client | Config File | Status |
|--------|-------------|--------|
| **GitHub Copilot** (VS Code) | `.vscode/mcp.json` | Tested |
| **Claude Code** | `.mcp.json` | Tested |
| **Cursor** | `.mcp.json` | Tested |
| **Windsurf** | Client-specific | Compatible (stdio) |
| **Zed** | Client-specific | Compatible (stdio) |
| **IntelliJ / JetBrains** | `.mcp.json` | Compatible (stdio) |

All clients use the same command: `npx -y @mcp-graph-workflow/mcp-graph`. The entry point auto-detects whether it's being called by an MCP client (piped stdin) or as a CLI (interactive terminal).

## Integration Orchestrator

**File:** `src/core/integrations/integration-orchestrator.ts`

The orchestrator is an event-driven mesh that listens to `GraphEventBus` events and triggers cross-integration workflows automatically.

```
GraphEventBus
  ├── import:completed  → Trigger reindex (Memories + Docs)
  ├── knowledge:indexed → Rebuild embeddings
  ├── docs:synced       → Index into knowledge store
  └── capture:completed → Index captured content
```

Key behaviors:
- Reacts to graph mutations without polling
- Cascading triggers: import → reindex → embed
- Graceful degradation: if an integration is unavailable, others continue

## Native Memory System

The native memory system replaces the former Serena MCP dependency with a zero-dependency TypeScript implementation. Memories are stored as `.md` files in `workflow-graph/memories/` for human readability and version control.

### Memory Reader

**File:** `src/core/memory/memory-reader.ts`

CRUD operations for project memories in `workflow-graph/memories/`:

- `listMemories()` — List all memory names (supports nested directories)
- `readMemory()` — Read a specific memory by name
- `readAllMemories()` — Read all memories at once
- `writeMemory()` — Write/overwrite a memory file (creates parent dirs)
- `deleteMemory()` — Delete a memory file

### Memory Indexer

**File:** `src/core/rag/memory-indexer.ts`

Indexes memories into the Knowledge Store and embedding pipeline.

- Chunks memory content for embedding
- SHA-256 deduplication prevents re-indexing unchanged memories
- Source type: `memory` (backward compatible with legacy `serena` source type)

### Memory RAG Query

**File:** `src/core/rag/memory-rag-query.ts`

Three search modes over project memories:
- **FTS** — Exact keyword matching via SQLite FTS5
- **Semantic** — TF-IDF cosine similarity
- **Hybrid** — Combined scoring for best relevance

Queries both `memory` and `serena` source types for backward compatibility.

### Memory Migrator

**File:** `src/core/memory/memory-migrator.ts`

Automatically migrates memories from the legacy `.serena/memories/` directory to `workflow-graph/memories/`. Triggered lazily on first access. Existing files are never overwritten.

### MCP Tools

| Tool | Description |
|------|-------------|
| `write_memory` | Write memory to `workflow-graph/memories/{name}.md` + auto-index |
| `read_memory` | Read a specific memory by name |
| `list_memories` | List all available memories |
| `delete_memory` | Delete memory from filesystem + knowledge store |

## Code Intelligence

Native code analysis engine at `src/core/code/`. Provides symbol-level understanding of the codebase without external MCP dependencies.

### Capabilities

- **Symbol analysis** — Extracts functions, classes, methods, and interfaces from TypeScript source via AST parsing
- **Relationship tracking** — Maps calls, imports, exports, and implements relationships between symbols
- **Impact analysis** — Graph traversal to find upstream/downstream dependents (blast radius)
- **FTS5 search** — Full-text search across all indexed symbols
- **Execution flow detection** — Identifies process flows (e.g., CLI command → core function → store)

### Module Layout

| File | Purpose |
|------|---------|
| `ts-analyzer.ts` | TypeScript AST analysis — extracts symbols and relationships |
| `code-indexer.ts` | Indexes the entire codebase into SQLite (symbols + relationships) |
| `code-store.ts` | SQLite storage and queries for symbols and relationships |
| `code-search.ts` | FTS5 search + graph-based queries across indexed symbols |
| `graph-traversal.ts` | Upstream/downstream traversal for impact analysis |
| `process-detector.ts` | Detects execution flows across the codebase |

### API Routes

Code Intelligence is exposed via REST at `/api/v1/code-graph/*`:
- `GET /symbols` — List/search indexed symbols
- `GET /symbols/:name` — Symbol detail with relationships
- `GET /impact/:name` — Upstream/downstream impact analysis
- `GET /flows` — Detected execution flows
- `POST /reindex` — Trigger reindexing

### Automatic MCP Enforcement

**File:** `src/mcp/code-intelligence-wrapper.ts`

Code Intelligence can be automatically enforced during MCP tool execution. When enabled, a `_code_intelligence` block is appended to every tool response with:
- Index health status (available, stale, symbol count)
- Phase-aware enrichment (impact analysis in IMPLEMENT, blast radius in REVIEW, symbol context in VALIDATE)
- Warnings for stale/empty index

**Modes:** `set_phase({ codeIntelligence: "strict" | "advisory" | "off" })`
- `strict` — blocks mutating tools if index is empty
- `advisory` — warns but allows execution
- `off` — disabled (default)

### Tool Prerequisites Enforcement

**File:** `src/mcp/lifecycle-wrapper.ts` (pre-execution gate) + `src/core/store/tool-call-log.ts` (tracking)

Tracks MCP tool calls per node and enforces mandatory prerequisites before critical actions (e.g., `update_status(done)` requires `context` + `rag_context` + `analyze(implement_done)` to have been called first).

**Modes:** `set_phase({ prerequisites: "strict" | "advisory" | "off" })`
- `strict` — blocks tools if mandatory prerequisites not called
- `advisory` — warns but allows execution (default)
- `off` — disabled

**Scope types:**
- `node` — tool must be called for the specific nodeId (e.g., `context` for "task-1")
- `project` — tool must be called once globally (e.g., `next`, `plan_sprint`)

**Full enforcement:** `set_phase({ mode: "strict", codeIntelligence: "strict", prerequisites: "strict" })`

### Enriched Context

**File:** `src/core/integrations/enriched-context.ts`

Combines outputs from multiple sources for a single symbol:

```
Symbol Query
  ├── Memories → Relevant project context
  ├── Code Intelligence → Symbol graph + relations
  └── Knowledge Store → Related documentation
  ↓
Enriched Context (unified payload)
```

## Context7

### Stack Detector

**File:** `src/core/docs/stack-detector.ts`

Auto-detects project technology stack by reading manifest files:

| File | Stack |
|------|-------|
| `package.json` | Node.js dependencies (React, Next.js, Express, etc.) |
| `requirements.txt` / `pyproject.toml` | Python packages |
| `go.mod` | Go modules |
| `Cargo.toml` | Rust crates |

### McpContext7Fetcher

**File:** `src/core/docs/mcp-context7-fetcher.ts`

Fetches documentation for detected libraries via the Context7 MCP server.

- Resolves library identifiers
- Fetches relevant documentation pages
- Caches results locally in `docs_cache` table

### Sync Stack Docs

Triggered by `sync_stack_docs` MCP tool:

```
1. Detect stack (package.json, etc.)
2. For each library:
   a. Resolve Context7 library ID
   b. Fetch documentation
   c. Cache locally
   d. Index into Knowledge Store
3. Rebuild embeddings
```

## Playwright

### ValidateRunner

**File:** `src/core/capture/validate-runner.ts`

Runs browser-based validation for tasks:

- **Single URL** — Capture page content, screenshot, accessibility tree
- **A/B comparison** — Capture two URLs, compute content diff
- **Selective capture** — CSS selector scoping for targeted extraction

### Web Capture

**File:** `src/core/capture/web-capture.ts`

Low-level Playwright wrapper for page capture:

- HTML content extraction
- Screenshot capture
- Accessibility tree dump
- Timeout and error handling

### Content Extractor

**File:** `src/core/capture/content-extractor.ts`

Extracts clean text from captured HTML:

- Strips navigation, ads, boilerplate
- Preserves semantic structure (headings, lists, code blocks)
- Outputs markdown-ready text

### Capture Indexer

**File:** `src/core/rag/capture-indexer.ts`

Indexes captured web content into Knowledge Store:
- Source type: `web_capture`
- Chunks content for embedding
- Associates with graph node (if `nodeId` provided)

## MCP Servers Config

**File:** `src/core/integrations/mcp-servers-config.ts`

Manages `.mcp.json` configuration for MCP server registrations (3 servers: mcp-graph, context7, playwright).

### MCP Deps Installer

**File:** `src/core/integrations/mcp-deps-installer.ts`

Auto-verifies MCP server dependencies:
- Checks for `npx` availability (Context7, Playwright)
- No Python dependencies required

## Tool Status

**File:** `src/core/integrations/tool-status.ts`

Tracks availability and health of all integrated tools:
- Code Graph: indexed / not indexed (native, always available)
- Memories: available / count / directory
- Playwright: installed / not installed

## Doctor Command

The `mcp-graph doctor` CLI command validates the health of all integrations and the execution environment:

```bash
mcp-graph doctor          # Human-readable output with ✓/⚠/✗
mcp-graph doctor --json   # Structured JSON report
```

Checks performed:
- Node.js version (>= 20)
- Write permissions on `workflow-graph/`
- SQLite database exists and passes integrity check
- Graph project initialized
- Config file valid
- Dashboard build present
- `.mcp.json` exists and valid
- Code Graph indexed
- Memories available
- Playwright available

Exit code: 0 if all critical checks pass, 1 otherwise.

## Lifecycle MCP Suggestions

The lifecycle wrapper (`_lifecycle` block appended to every MCP tool response) now includes `suggestedMcpAgents` — contextual recommendations for which external MCPs to use in the current phase.

This enables AI agents to automatically leverage the right integration at the right time without manual prompting. See [Lifecycle](./LIFECYCLE.md#sugestões-de-mcps-externos-por-fase-lifecycle-wrapper) for the full mapping.

## Related Documentation

- [Knowledge Pipeline](../architecture/KNOWLEDGE-PIPELINE.md) — How knowledge flows from sources to LLM context
- [Architecture Guide](../architecture/ARCHITECTURE-GUIDE.md) — System layers and data flow
- [MCP Tools Reference](./MCP-TOOLS-REFERENCE.md) — Tools that expose integration features
