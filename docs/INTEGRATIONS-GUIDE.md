# Integrations Guide

> Four external MCP agents (Serena, GitNexus, Context7, Playwright) coordinated by mcp-graph as the orchestrator — 5 MCPs total working together through an event-driven mesh.

## Overview

| Integration | Role | When Used |
|------------|------|-----------|
| **Serena** | Code analysis, memory, symbol navigation | Reading codebase structure, collecting agent memories |
| **GitNexus** | Git graph analysis, code dependencies | Impact analysis, dependency visualization |
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
  ├── import:completed  → Trigger reindex (Serena + Docs)
  ├── knowledge:indexed → Rebuild embeddings
  ├── docs:synced       → Index into knowledge store
  └── capture:completed → Index captured content
```

Key behaviors:
- Reacts to graph mutations without polling
- Cascading triggers: import → reindex → embed
- Graceful degradation: if an integration is unavailable, others continue

## Serena

### SerenaReader

**File:** `src/core/integrations/serena-reader.ts`

Reads `.serena/memories/` directory for collected agent memory documents.

- Traverses nested directories recursively
- Parses memory files (markdown, JSON)
- Extracts metadata (title, tags, timestamps)

### SerenaIndexer

**File:** `src/core/rag/serena-indexer.ts`

Indexes Serena memories into the Knowledge Store and embedding pipeline.

- Chunks memory content for embedding
- SHA-256 deduplication prevents re-indexing unchanged memories
- Source type: `serena`

### Serena RAG Query

**File:** `src/core/rag/serena-rag-query.ts`

Three search modes over Serena memories:
- **FTS** — Exact keyword matching via SQLite FTS5
- **Semantic** — TF-IDF cosine similarity
- **Hybrid** — Combined scoring for best relevance

## GitNexus

### Launcher

**File:** `src/core/integrations/gitnexus-launcher.ts`

Manages GitNexus lifecycle as a child process:

1. **Analyze** — Index git repository structure
2. **Serve** — Start GitNexus HTTP server on a local port
3. **Cleanup** — Graceful shutdown on process exit

### Capabilities

- **Query** — Search code symbols and relationships
- **Context** — Get detailed context for a specific symbol
- **Impact** — Analyze blast radius of changes to a symbol

### Enriched Context

**File:** `src/core/integrations/enriched-context.ts`

Combines outputs from multiple integrations for a single symbol:

```
Symbol Query
  ├── Serena → Memory context + code structure
  ├── GitNexus → Dependency graph + impact analysis
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

Manages `.mcp.json` configuration for MCP server registrations.

### MCP Deps Installer

**File:** `src/core/integrations/mcp-deps-installer.ts`

Auto-installs MCP server dependencies:
- Detects required packages from server configs
- Runs `npm install` or `pip install` as needed
- Validates installation success

## Tool Status

**File:** `src/core/integrations/tool-status.ts`

Tracks availability and health of all integrated tools:
- Serena: connected / disconnected
- GitNexus: indexed / running / stopped
- Context7: available / unavailable
- Playwright: installed / not installed

## Related Documentation

- [Knowledge Pipeline](./KNOWLEDGE-PIPELINE.md) — How knowledge flows from sources to LLM context
- [Architecture Guide](./ARCHITECTURE-GUIDE.md) — System layers and data flow
- [MCP Tools Reference](./MCP-TOOLS-REFERENCE.md) — Tools that expose integration features
