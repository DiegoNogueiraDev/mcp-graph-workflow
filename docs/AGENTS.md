# Code Intelligence — Native Code Analysis

Native code analysis engine at `src/core/code/`. Provides symbol-level understanding of the codebase without external dependencies.

> To rebuild the index, use the `reindex_knowledge` MCP tool or `POST /api/v1/code-graph/reindex`.

## Always Do

- **MUST check impact before editing any symbol.** Before modifying a function, class, or method, check upstream/downstream dependents via the Code Graph dashboard tab or API (`GET /api/v1/code-graph/impact/:name`) and assess the blast radius.
- **MUST verify scope before committing** — review which symbols and execution flows are affected by your changes.
- **MUST warn the user** if impact analysis shows a high number of dependents before proceeding with edits.
- When exploring unfamiliar code, use the Code Graph search (`GET /api/v1/code-graph/symbols?q=concept`) to find symbols and execution flows instead of grepping.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `GET /api/v1/code-graph/symbols/:name`.

## When Debugging

1. Search for symbols related to the issue via Code Graph FTS5 search
2. Check the symbol's relationships (callers, callees, imports)
3. Trace execution flows via `GET /api/v1/code-graph/flows`
4. Use graph traversal to find upstream/downstream dependents

## When Refactoring

- **Renaming**: Check all callers/importers via impact analysis first. Update all dependents before renaming.
- **Extracting/Splitting**: Check all incoming/outgoing relationships, then find all external callers via upstream traversal before moving code.
- After any refactor: rebuild the index via `reindex_knowledge` to keep the code graph up to date.

## Never Do

- NEVER edit a function, class, or method without first checking its dependents.
- NEVER ignore high-impact warnings from the analysis.
- NEVER rename symbols with find-and-replace without first checking the call graph.

## Module Reference

| Module | File | Purpose |
|--------|------|---------|
| **TS Analyzer** | `src/core/code/ts-analyzer.ts` | TypeScript AST analysis — extracts symbols and relationships from source files |
| **Code Indexer** | `src/core/code/code-indexer.ts` | Indexes the entire codebase into SQLite (symbols + relationships) |
| **Code Store** | `src/core/code/code-store.ts` | SQLite storage and queries for symbols and relationships |
| **Code Search** | `src/core/code/code-search.ts` | FTS5 search + graph-based queries across indexed symbols |
| **Graph Traversal** | `src/core/code/graph-traversal.ts` | Upstream/downstream traversal for impact analysis |
| **Process Detector** | `src/core/code/process-detector.ts` | Detects execution flows across the codebase |

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/code-graph/symbols` | GET | List/search indexed symbols (query param: `q`) |
| `/api/v1/code-graph/symbols/:name` | GET | Symbol detail with relationships |
| `/api/v1/code-graph/impact/:name` | GET | Upstream/downstream impact analysis |
| `/api/v1/code-graph/flows` | GET | Detected execution flows |
| `/api/v1/code-graph/reindex` | POST | Trigger code reindexing |

## Dashboard

The **Code Graph** tab in the dashboard visualizes symbols, relationships, and execution flows interactively.

## Keeping the Index Fresh

After committing code changes, the code index becomes stale. Rebuild it via:

- **MCP tool**: `reindex_knowledge`
- **API**: `POST /api/v1/code-graph/reindex`
- **CLI**: `npx mcp-graph index`
- **Dashboard**: Click "Reindex" in the Code Graph tab
