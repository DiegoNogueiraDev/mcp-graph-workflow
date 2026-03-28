# RAG Architecture — mcp-graph

## Overview

mcp-graph implements a **full end-to-end RAG (Retrieval-Augmented Generation) pipeline** aligned with the Brij Kishore Pandey RAG architecture. All knowledge sources feed into a unified pipeline that maximizes context quality for LLM consumption.

## Architecture (4 Layers + 2 Cross-Cutting)

```
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 1: DATA + INGESTION (Enrichment)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Sources (9+)          Preprocessing        Enrichment          │
│  ┌──────────┐   ┌─────────────────┐   ┌──────────────────┐    │
│  │ CodeGraph │   │ normalize       │   │ keywords (TF-IDF)│    │
│  │ PRD       │──▶│ segment         │──▶│ entities (regex) │    │
│  │ Siebel    │   │ classify        │   │ summary (auto)   │    │
│  │ Journey   │   │ extract         │   │ parent-child     │    │
│  │ Skills    │   │ chunk (smart)   │   │ linking          │    │
│  │ Docs      │   └─────────────────┘   └──────────────────┘    │
│  │ Memories  │                                                  │
│  │ Benchmark │   14 Indexers → knowledge_documents (unified)    │
│  │ Captures  │                                                  │
│  └──────────┘                                                   │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 2: EMBEDDING + STORAGE                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SQLite (local-first)                                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ knowledge_documents  │ FTS5 virtual table │ embeddings   │  │
│  │ (unified, 22+ types) │ (BM25 ranking)     │ (TF-IDF)     │  │
│  ├──────────────────────┼────────────────────┼──────────────┤  │
│  │ knowledge_relations  │ knowledge_usage_log│ query_cache  │  │
│  │ (graph linking)      │ (feedback tracking)│ (in-memory)  │  │
│  └──────────────────────┴────────────────────┴──────────────┘  │
│                                                                 │
│  Deduplication: SHA-256 content hash                           │
│  Quality scoring: freshness × reliability × usage × richness  │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 3: RETRIEVAL PIPELINE                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Query Understanding          Multi-Strategy Retrieval          │
│  ┌───────────────────┐   ┌──────────────────────────────────┐  │
│  │ intent detection   │   │ FTS5 + BM25         (weight 0.4)│  │
│  │ entity extraction  │──▶│ Graph traversal      (weight 0.3)│  │
│  │ source filtering   │   │ Recency boost        (weight 0.2)│  │
│  │ query expansion    │   │ Quality multiplier   (weight 0.1)│  │
│  │ query rewriting    │   │                                  │  │
│  └───────────────────┘   │ → Reciprocal Rank Fusion (RRF)   │  │
│                           └──────────────────────────────────┘  │
│                                       ↓                         │
│  Post-Retrieval Pipeline                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 1. Deduplication (content-level)                         │  │
│  │ 2. Reranking (keyword overlap + original score)          │  │
│  │ 3. Chunk stitching (merge adjacent from same source)     │  │
│  │ 4. Limit enforcement                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Phase-aware boosting per lifecycle stage                       │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 4: GENERATION + OUTPUT                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Context Assembly              Citations & Traceability         │
│  ┌────────────────────┐   ┌──────────────────────────────┐    │
│  │ 60% graph context   │   │ [N] citation markers          │    │
│  │ 30% knowledge       │   │ source breakdown per type     │    │
│  │ 10% metadata        │   │ snippet extraction            │    │
│  │                     │   │ relevance scores              │    │
│  │ Tiered:             │   └──────────────────────────────┘    │
│  │  summary (20 tok)   │                                        │
│  │  standard (150 tok) │   Token Budget: configurable           │
│  │  deep (500+ tok)    │   Compression: BM25 filtering          │
│  └────────────────────┘                                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ CROSS-CUTTING: Observability                                    │
├─────────────────────────────────────────────────────────────────┤
│  RAG Traces: per-stage timing, input/output counts, sources    │
│  Source Contribution: hit rate, relevance, feedback per source  │
│  Knowledge Feedback: helpful/unhelpful → quality score update  │
│  Underutilized detection: flag sources rarely retrieved         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ CROSS-CUTTING: Performance                                      │
├─────────────────────────────────────────────────────────────────┤
│  Query Cache: in-memory, TTL, LRU eviction, invalidation       │
│  Benchmark Indexer: performance metrics as knowledge            │
│  SLA targets: FTS <100ms, context <200ms, post-retrieval <50ms │
└─────────────────────────────────────────────────────────────────┘
```

## Knowledge Sources (All Feed Into RAG)

| Source | Indexer | sourceType | What It Contributes |
|--------|---------|------------|---------------------|
| **CodeGraph** | `code-context-indexer.ts` | `code_context` | Symbols, relations, impact analysis |
| **PRD** | `prd-indexer.ts` | `prd` | Requirements, acceptance criteria, constraints |
| **Codebase Graph** | (execution graph nodes) | (FTS on nodes) | Task status, dependencies, progress |
| **Siebel** | `siebel-indexer.ts` | `siebel_sif`, `siebel_composer` | SIF configs, Composer objects |
| **Journey** | `journey-indexer.ts` | `journey` | UX flows, screens, fields, CTAs |
| **Skills** | `skill-indexer.ts` | `skill` | 40 built-in + custom skills |
| **Docs** | `docs-indexer.ts` | `docs` | Context7 library documentation |
| **Memories** | `memory-indexer.ts` | `memory` | Project decisions, healing patterns |
| **Benchmark** | `benchmark-indexer.ts` | `benchmark` | Performance metrics, token economy |
| **Captures** | `capture-indexer.ts` | `web_capture` | Website content, screenshots |
| **Validations** | `validation-indexer.ts` | `validation_result` | Test outcomes, AC results |
| **Decisions** | `decision-indexer.ts` | `ai_decision` | AI task completion rationale |
| **Swagger** | `swagger-indexer.ts` | `swagger` | API endpoint documentation |

## New RAG Pipeline Modules

| Module | Layer | Purpose |
|--------|-------|---------|
| `enrichment-pipeline.ts` | L1 | Keyword extraction, entity detection, auto-summary |
| `query-understanding.ts` | L3 | Intent detection, source filtering, query expansion |
| `post-retrieval.ts` | L3 | Dedup, reranking, chunk stitching |
| `citation-mapper.ts` | L4 | [N] markers, source breakdown, traceability |
| `rag-trace.ts` | Cross | Per-stage timing, source contribution tracking |
| `query-cache.ts` | Cross | In-memory cache with TTL and LRU eviction |
| `source-contribution.ts` | Cross | Hit rate, relevance, feedback per source |
| `benchmark-indexer.ts` | L1 | Performance metrics as searchable knowledge |

## Principle

> **Every knowledge source influences the quality of every MCP response.**
> The RAG pipeline is the single path through which all context flows.
> No source is siloed — all are indexed, searched, ranked, and assembled together.
