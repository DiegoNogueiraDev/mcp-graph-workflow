# Knowledge Pipeline

> From raw sources to token-efficient LLM context — fully local, zero external APIs.

## Overview

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────┐
│   Sources    │──▶│  Knowledge   │──▶│  Embedding   │──▶│   Tiered    │──▶│   LLM   │
│             │   │    Store     │   │  Pipeline    │   │  Context    │   │ Context │
│ • Memories    │   │             │   │             │   │             │   │         │
│ • Docs      │   │ • FTS5      │   │ • TF-IDF    │   │ • Tier 1-3  │   │ Token-  │
│ • Captures  │   │ • SHA-256   │   │ • Cosine    │   │ • BM25      │   │ budgeted│
│ • Uploads   │   │ • Chunking  │   │ • Local     │   │ • Assembler │   │ payload │
└─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘   └─────────┘
```

## Knowledge Store

**File:** `src/core/store/knowledge-store.ts`

SQLite-backed store for all knowledge documents with full-text search.

| Feature | Detail |
|---------|--------|
| Table | `knowledge_documents` |
| Search | FTS5 full-text index |
| Dedup | SHA-256 content hashing — same content is never stored twice |
| Source types | `upload`, `memory`, `serena` (legacy), `code_context`, `docs`, `web_capture` |
| Chunking | Large documents auto-split into ~500 token chunks with 50 token overlap |

### Schema

```typescript
{
  id: string           // nanoid
  title: string        // Document title
  content: string      // Full text content
  contentHash: string  // SHA-256 for deduplication
  sourceType: string   // One of 5 source types
  sourceId: string     // External reference ID
  metadata: object     // Arbitrary JSON metadata
  createdAt: string    // ISO timestamp
  updatedAt: string    // ISO timestamp
}
```

## Text Chunking

**File:** `src/core/rag/chunk-text.ts`

Splits large documents into semantic chunks suitable for embedding.

- **Strategy:** Sentence-aware splitting — never breaks mid-sentence
- **Target size:** ~500 tokens per chunk
- **Overlap:** 50 tokens between consecutive chunks for context continuity
- **Boundary detection:** Respects paragraph breaks, headers, and list items

## Cross-Source Indexers

Three specialized indexers feed documents into the Knowledge Store:

| Indexer | File | Sources | Trigger |
|---------|------|---------|---------|
| **MemoryIndexer** | `src/core/rag/memory-indexer.ts` | `workflow-graph/memories/` directory | `reindex_knowledge` / `write_memory` tools |
| **DocsIndexer** | `src/core/rag/docs-indexer.ts` | Context7 cached documentation | `sync_stack_docs` tool |
| **CaptureIndexer** | `src/core/rag/capture-indexer.ts` | Playwright web captures | `validate_task` tool |

Each indexer:
1. Reads source content
2. Chunks text into ~500 token segments
3. Deduplicates via SHA-256
4. Stores in `knowledge_documents`
5. Triggers embedding pipeline rebuild

## Embedding Pipeline

**Files:** `src/core/rag/rag-pipeline.ts`, `src/core/rag/embedding-store.ts`

100% local TF-IDF vectorization — no external embedding APIs.

| Feature | Detail |
|---------|--------|
| Algorithm | TF-IDF with unified vocabulary |
| Similarity | Cosine similarity |
| Storage | SQLite `embeddings` table |
| Sources | Graph nodes + Knowledge documents |
| Size | ~10 MB vs ~400 MB for transformer models |

### Pipeline Flow

```
Documents/Nodes → Tokenize → TF-IDF Vectorize → Store Embeddings
                                                        ↓
Query → Tokenize → TF-IDF Vectorize → Cosine Search → Top-K Results
```

## Memory RAG Query

**File:** `src/core/rag/memory-rag-query.ts`

Three query modes for searching project memories (supports both `memory` and legacy `serena` source types):

| Mode | Strategy | Use Case |
|------|----------|----------|
| `fts` | SQLite FTS5 full-text search | Exact keyword matching |
| `semantic` | TF-IDF cosine similarity | Conceptual/fuzzy matching |
| `hybrid` | FTS5 + semantic + score fusion | Best overall relevance |

## Tiered Context Compression

**File:** `src/core/context/tiered-context.ts`

Three compression tiers control token usage per node:

| Tier | Content | ~Tokens/Node | When Used |
|------|---------|-------------|-----------|
| **Tier 1 — Summary** | Title + status + type | ~20 | Large graphs, peripheral nodes |
| **Tier 2 — Standard** | + description + tags + dependencies | ~150 | Default for related nodes |
| **Tier 3 — Deep** | + acceptance criteria + knowledge + metadata | ~500+ | Target node, critical blockers |

## BM25 Compressor

**File:** `src/core/context/bm25-compressor.ts`

Filters and ranks knowledge chunks by relevance to the current query using BM25 (TF-IDF variant).

- Scores each chunk against the query
- Keeps only chunks above relevance threshold
- Orders by descending score
- Respects token budget allocation

## Context Assembler

**File:** `src/core/context/context-assembler.ts`

Combines all context sources into a single token-budgeted payload for the LLM.

### Token Budget Allocation

| Section | Budget | Content |
|---------|--------|---------|
| **Graph context** | 60% | Node hierarchy, dependencies, blockers |
| **Knowledge context** | 30% | Relevant knowledge chunks (BM25 ranked) |
| **Header/metadata** | 10% | Project info, node ID, query context |

### Assembly Flow

```
1. Build graph context (tiered compression)
2. Query knowledge store (BM25 ranked)
3. Allocate tokens per section
4. Truncate sections that exceed budget
5. Combine into structured payload
6. Report token usage metrics
```

The assembler achieves **70-85% token reduction** compared to sending raw context, while preserving the information most relevant to the current task.

## Advanced RAG Pipeline Modules

Eight additional modules extend the RAG pipeline with query understanding, post-retrieval processing, caching, and observability. See [RAG Architecture](./RAG-ARCHITECTURE.md) for the full diagram.

| Module | File | Purpose |
|--------|------|---------|
| **Query Understanding** | `src/core/rag/query-understanding.ts` | Intent detection, source filtering, query expansion |
| **Enrichment Pipeline** | `src/core/rag/enrichment-pipeline.ts` | Keyword/entity/summary extraction from text chunks |
| **Post-Retrieval** | `src/core/rag/post-retrieval.ts` | Deduplication, re-ranking, chunk stitching |
| **Citation Mapper** | `src/core/rag/citation-mapper.ts` | `[N]` markers for source traceability |
| **Query Cache** | `src/core/rag/query-cache.ts` | In-memory LRU cache with TTL for query results |
| **RAG Trace** | `src/core/rag/rag-trace.ts` | Per-stage timing and observability |
| **Source Contribution** | `src/core/rag/source-contribution.ts` | Hit rate, relevance, and feedback analytics |
| **Benchmark Indexer** | `src/core/rag/benchmark-indexer.ts` | Index performance metrics as knowledge documents |

## MCP Tools

| Tool | Purpose |
|------|---------|
| `write_memory` | Write project memory + auto-index into knowledge store |
| `read_memory` | Read a specific project memory |
| `list_memories` | List all available project memories |
| `delete_memory` | Delete memory from filesystem + knowledge store |
| `reindex_knowledge` | Rebuild knowledge indexes from all sources |
| `sync_stack_docs` | Auto-detect stack + fetch docs via Context7 |
| `rag_context` | Semantic search with token-budgeted context |
| `context` | Compact task context with knowledge integration |

## Related Documentation

- [Architecture Guide](./ARCHITECTURE-GUIDE.md) — System layers and data flow
- [Integrations Guide](./INTEGRATIONS-GUIDE.md) — Memories, Code Intelligence, Context7, Playwright
- [MCP Tools Reference](./MCP-TOOLS-REFERENCE.md) — Complete tool documentation
