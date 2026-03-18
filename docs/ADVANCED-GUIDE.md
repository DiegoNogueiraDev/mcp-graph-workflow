# Advanced Guide — mcp-graph

> For power users and developers. Covers the full lifecycle methodology, all analyze modes, RAG tuning, architecture, and extensibility.
>
> Prerequisites: [Getting Started](GETTING-STARTED.md) and [User Guide](USER-GUIDE.md).

---

## 1. Lifecycle Methodology (8 Phases)

mcp-graph follows an 8-phase development lifecycle inspired by XP (Extreme Programming) anti-vibe-coding principles. For the complete methodology reference, see [LIFECYCLE.md](LIFECYCLE.md).

### 1.1 Phase Overview

```
ANALYZE → DESIGN → PLAN → IMPLEMENT → VALIDATE → REVIEW → HANDOFF → LISTENING
    ↑                                                                    |
    └────────────────────── feedback loop ──────────────────────────────┘
```

**Auto-detection:** mcp-graph infers the current phase from graph state (node types, statuses, completion %). Every MCP tool response includes a `_lifecycle` block with the detected phase and suggested actions.

**Manual override:**
```
set_phase { phase: "IMPLEMENT", mode: "strict" }
```

Modes:
- **strict** — blocks tools that don't belong to the current phase
- **advisory** — suggests the correct phase but allows all tools

### 1.2 Phase Details

#### ANALYZE — Discover what to build

**Objective:** Transform a vague idea into a structured PRD with user stories and acceptance criteria.

**Tools:** None required (PRD doesn't exist in the graph yet).

**Gate → DESIGN:** PRD document exists with at least one user story and AC.

**Suggested skills:** `/create-prd-chat-mode`, `/business-analyst`, `/se-product-manager`

#### DESIGN — Define architecture

**Objective:** Define technical architecture before any code.

**Tools:** `add_node`, `edge`, `analyze`

**Native systems:** Code Intelligence for impact analysis of existing code.

**Gate → PLAN:** Architecture spec exists, ADRs documented.

**Analyze modes:** `adr`, `traceability`, `coupling`, `interfaces`, `tech_risk`, `design_ready`

#### PLAN — Decompose into atomic tasks

**Objective:** Transform PRD into trackable tasks in the execution graph.

**Tools:** `import_prd`, `plan_sprint`, `decompose`, `velocity`, `sync_stack_docs`, `stats`

**Gate → IMPLEMENT:** All tasks have AC, no circular dependencies, sprint planned.

**Analyze modes:** `decompose`

#### IMPLEMENT — Execute with TDD

**Objective:** Implement each task following Red → Green → Refactor.

**Tools:** `next`, `context`, `rag_context`, `update_status`, `reindex_knowledge`

**Native systems:** Code Intelligence (enriched context), Native Memories (read/write)

**Gate → VALIDATE:** All sprint tasks done, tests pass, build succeeds.

**Analyze modes:** `implement_done`, `tdd_check`, `progress`, `cycles`, `critical_path`

#### VALIDATE — E2E testing

**Objective:** Validate everything works end-to-end with real browser testing.

**Tools:** `validate_task`, `analyze`

**Gate → REVIEW:** All validation tasks pass, no regressions.

**Analyze modes:** `validate_ready`, `done_integrity`, `status_flow`

#### REVIEW — Quality and observability

**Objective:** Ensure code quality, security, and observability.

**Tools:** `export`, `analyze`

**Native systems:** Code Intelligence for blast radius analysis.

**Gate → HANDOFF:** Code review complete, no critical issues.

**Analyze modes:** `review_ready`, `doc_completeness`

#### HANDOFF — Deliver

**Objective:** Create PR, update docs, export graph.

**Tools:** `update_status` (bulk), `export`, `snapshot`

**Gate → LISTENING:** PR merged, documentation updated.

**Analyze modes:** `handoff_ready`

#### LISTENING — Feedback loop

**Objective:** Collect stakeholder feedback, feed next iteration.

**Tools:** `add_node`, `import_prd`

**Gate → ANALYZE:** New feedback registered as tasks.

**Analyze modes:** `listening_ready`, `backlog_health`

### 1.3 Phase Transitions & Gates

Each phase transition has an automatic gate check. Run the relevant analyze mode to check readiness:

```
analyze { mode: "design_ready" }     # DESIGN → PLAN
analyze { mode: "validate_ready" }   # IMPLEMENT → VALIDATE
analyze { mode: "review_ready" }     # VALIDATE → REVIEW
analyze { mode: "handoff_ready" }    # REVIEW → HANDOFF
analyze { mode: "listening_ready" }  # HANDOFF → LISTENING
```

**If a gate blocks:**
1. Run the corresponding analyze mode to see what's missing
2. Fix the issues (missing AC, unresolved blockers, etc.)
3. Re-run the gate check
4. Or use `set_phase { phase: "NEXT", mode: "advisory" }` to bypass (not recommended)

---

## 2. Analyze Tool — 25 Modes Reference

The `analyze` tool provides 25 specialized analysis modes organized by lifecycle phase.

### ANALYZE Phase (7 modes)

| Mode | What it checks | Parameters |
|------|---------------|------------|
| `prd_quality` | PRD completeness: user stories, AC, Given-When-Then format | — |
| `scope` | Graph scope: node type distribution, coverage gaps | — |
| `ready` | Definition of Ready: blockers, dependencies, AC presence | `nodeId` (optional) |
| `risk` | Risk assessment: complexity, external deps, size, missing AC | — |
| `blockers` | Transitive blockers of a specific node | `nodeId` (required) |
| `cycles` | Dependency cycles in the graph (circular references) | — |
| `critical_path` | Longest dependency chain (bottleneck sequence) | — |

### DESIGN Phase (6 modes)

| Mode | What it checks | Parameters |
|------|---------------|------------|
| `adr` | ADR (Architecture Decision Record) validation | — |
| `traceability` | Traceability matrix: requirement → task → test | — |
| `coupling` | Module coupling analysis | — |
| `interfaces` | Interface and contract verification | — |
| `tech_risk` | Technical risks: complexity, stack, external deps | — |
| `design_ready` | Gate check: DESIGN → PLAN prerequisites | — |

### PLAN Phase (1 mode)

| Mode | What it checks | Parameters |
|------|---------------|------------|
| `decompose` | Detects oversized tasks (L/XL) needing breakdown | `nodeId` (optional) |

### IMPLEMENT Phase (5 modes)

| Mode | What it checks | Parameters |
|------|---------------|------------|
| `implement_done` | Definition of Done: 8 checks (4 required + 4 recommended) | `nodeId` (required) |
| `tdd_check` | TDD adherence: suggested test specs from AC | — |
| `progress` | Sprint burndown + velocity trend + blockers + ETA | `sprint` (optional) |
| `cycles` | Dependency cycles (also available in ANALYZE) | — |
| `critical_path` | Critical path (also available in ANALYZE) | — |

**Definition of Done — 8 checks:**

| # | Check | Severity | Logic |
|---|-------|----------|-------|
| 1 | `has_acceptance_criteria` | required | Task or parent has AC |
| 2 | `ac_quality_pass` | required | AC score >= 60 (INVEST) |
| 3 | `no_unresolved_blockers` | required | No depends_on to non-done nodes |
| 4 | `status_flow_valid` | required | Passed through in_progress before done |
| 5 | `has_description` | recommended | Task has non-empty description |
| 6 | `not_oversized` | recommended | Not L/XL without subtasks |
| 7 | `has_testable_ac` | recommended | At least 1 AC is testable |
| 8 | `has_estimate` | recommended | xpSize or estimateMinutes defined |

### VALIDATE Phase (3 modes)

| Mode | What it checks | Parameters |
|------|---------------|------------|
| `validate_ready` | Gate check: IMPLEMENT → VALIDATE | — |
| `done_integrity` | Integrity of nodes marked done | — |
| `status_flow` | Valid status flow (no skipped states) | — |

### REVIEW Phase (2 modes)

| Mode | What it checks | Parameters |
|------|---------------|------------|
| `review_ready` | Gate check: VALIDATE → REVIEW | — |
| `doc_completeness` | Documentation completeness | — |

### HANDOFF Phase (2 modes)

| Mode | What it checks | Parameters |
|------|---------------|------------|
| `handoff_ready` | Gate check: REVIEW → HANDOFF | — |
| `backlog_health` | Backlog health: distribution, aging, stale items | — |

### LISTENING Phase (1 mode)

| Mode | What it checks | Parameters |
|------|---------------|------------|
| `listening_ready` | Gate check: HANDOFF → LISTENING | — |

### Usage Examples

```
analyze { mode: "risk" }
analyze { mode: "implement_done", nodeId: "TASK-abc123" }
analyze { mode: "progress", sprint: "Sprint 1" }
analyze { mode: "blockers", nodeId: "TASK-xyz789" }
analyze { mode: "cycles" }
```

---

## 3. RAG & Token Tuning

### 3.1 Token Budget Architecture

Every context response follows a strict budget allocation:

| Slice | Share | Content |
|-------|-------|---------|
| Graph context | 60% | Task details, dependencies, status tree (tiered compression) |
| Knowledge | 30% | BM25-ranked chunks from the knowledge store |
| Header/metadata | 10% | Phase, sprint, lifecycle info, integration suggestions |

The total budget is controlled by the `maxTokens` parameter (or auto-calculated).

### 3.2 Tiered Compression

The context assembler uses three compression tiers:

| Tier | Tokens/node | When used | What's included |
|------|-------------|-----------|-----------------|
| Summary | ~20 | Many nodes, tight budget | ID, title, status, type |
| Standard | ~150 | Normal usage | + description, AC summary, priority, size |
| Deep | ~500+ | Few nodes, generous budget | + full AC, metadata, tags, all edges |

The tier is selected automatically based on node count and available token budget.

### 3.3 BM25 Compressor

The BM25 compressor filters and ranks knowledge chunks by relevance:

1. **Query tokenization** — splits the query into terms
2. **BM25 scoring** — each chunk is scored against the query using BM25
3. **Threshold filtering** — chunks below relevance threshold are dropped
4. **Budget fitting** — top chunks are selected until the token budget is filled

### 3.4 Embedding Pipeline

100% local — no external API calls.

1. **TF-IDF vectorization** — each knowledge chunk is converted to a TF-IDF vector
2. **Cosine similarity** — queries are vectorized and compared against stored embeddings
3. **Storage** — vectors stored in SQLite embeddings table alongside content
4. **Deduplication** — SHA-256 hash ensures each unique chunk is stored once

### 3.5 Knowledge Sources

Five source types feed the knowledge store:

| Source type | How indexed | Trigger |
|-------------|-------------|---------|
| `upload` | PRD imports | `import_prd` |
| `memory` | Project memories | `write_memory` |
| `code_context` | Code symbols and relationships | `reindex_knowledge` |
| `docs` | Library documentation | `sync_stack_docs` |
| `web_capture` | Browser page captures | `validate_task` |

**Indexers:**
- **Memory indexer** — watches `workflow-graph/memories/` for changes
- **Docs indexer** — processes Context7 documentation cache
- **Capture indexer** — indexes Playwright-captured content
- **PRD indexer** — chunks and indexes imported PRD content

All indexers use chunking (~500 tokens per chunk) and SHA-256 deduplication.

---

## 4. Integration Mesh

### 4.1 IntegrationOrchestrator

The `IntegrationOrchestrator` coordinates all integrations via the `GraphEventBus` (event-driven architecture).

**Event cascade:**
```
import:completed   → Trigger reindex (Memories + Docs)
knowledge:indexed  → Rebuild embeddings
docs:synced        → Index into Knowledge Store
capture:completed  → Index captured content
```

**Graceful degradation:** If an integration is unavailable (e.g., Playwright not installed), the orchestrator skips it without failing the operation.

### 4.2 Context7 Integration

Provides up-to-date library documentation.

**Stack detection:** Scans `package.json`, `requirements.txt`, `go.mod`, `Cargo.toml` and more.

**Flow:**
1. Detect dependencies from manifest files
2. Resolve each library to a Context7 library ID
3. Fetch documentation pages
4. Cache locally (avoids redundant fetches)
5. Index into knowledge store

### 4.3 Playwright Integration

Browser automation for validation and content capture.

- **ValidateRunner** — orchestrates single URL capture, A/B comparison, CSS selector scoping
- **Web capture → knowledge** — captured content is auto-indexed (source type: `web_capture`)
- **Event trigger** — `capture:completed` fires reindex via IntegrationOrchestrator

**Requirements:** `npx playwright install` (one-time setup).

### 4.4 Code Intelligence (Native)

Symbol-level codebase analysis — no external MCP dependencies.

| Module | Purpose |
|--------|---------|
| `ts-analyzer.ts` | TypeScript AST parsing — extracts symbols and relationships |
| `code-indexer.ts` | Indexes codebase into SQLite (symbols + relationships) |
| `code-store.ts` | SQLite storage and queries for symbols/relationships |
| `code-search.ts` | FTS5 search + graph-based queries |
| `graph-traversal.ts` | Upstream/downstream traversal for impact analysis |
| `process-detector.ts` | Detects execution flows across the codebase |

**Symbol types:** function, class, method, interface
**Relationship types:** calls, imports, exports, implements

**Graph traversal:** BFS-based upstream (who depends on X?) and downstream (what does X depend on?) analysis — essential for blast radius checks before refactoring.

### 4.5 Tool Status & Health

**Tool status tracking:** `tool-status.ts` monitors availability of all integrations (Context7, Playwright, Code Intelligence).

**Doctor command:**
```bash
npx mcp-graph doctor         # Validate environment
npx mcp-graph doctor --json  # Structured JSON output
```

Checks: Node.js version, SQLite availability, Playwright installation, MCP server connectivity, disk space.

---

## 5. Architecture Overview

mcp-graph is organized in 8 layers with strict dependency direction (outer layers depend on inner, never the reverse).

```
CLI → MCP → API → Core → Store → Dashboard → Skills → Integrations
```

- **CLI layer** (`src/cli/`) — Commander.js commands, thin orchestration only
- **MCP layer** (`src/mcp/`) — 30 MCP tool wrappers with lifecycle annotations
- **API layer** (`src/api/`) — Express REST API with 17+ routers, 44+ endpoints
- **Core layer** (`src/core/`) — Pure business logic, typed errors, no framework coupling
- **Store layer** (`src/core/store/`) — SQLite persistence with migrations
- **Dashboard** (`src/web/dashboard/`) — React 19 + Tailwind + React Flow SPA
- **Skills** (`copilot-ecosystem/`) — SKILL.md-based extensible capabilities
- **Integrations** (`src/core/integrations/`) — Event-driven MCP orchestration

For the full architecture diagram, see [ARCHITECTURE-MERMAID.md](ARCHITECTURE-MERMAID.md).
For detailed layer documentation, see [ARCHITECTURE-GUIDE.md](ARCHITECTURE-GUIDE.md).

---

## 6. REST API Advanced Patterns

The REST API exposes 17+ routers and 44+ endpoints. Full reference: [REST-API-REFERENCE.md](REST-API-REFERENCE.md).

### Key Patterns

**SSE streaming:**
```
GET /api/v1/events
```
Real-time event stream for dashboard updates (node changes, imports, reindex).

**Multipart file upload:**
```
POST /api/v1/import
Content-Type: multipart/form-data
```
Upload PRD files (.md, .txt, .pdf, .html) for graph generation.

**Code Graph endpoints:**
```
GET  /api/v1/code-graph/symbols       # List all indexed symbols
GET  /api/v1/code-graph/search        # FTS5 search across symbols
GET  /api/v1/code-graph/impact/:id    # Upstream/downstream analysis
POST /api/v1/code-graph/reindex       # Trigger reindex
```

**Project management:**
```
GET  /api/v1/project/list             # List all projects in DB
POST /api/v1/project/:id/activate     # Switch active project
POST /api/v1/project/init             # Initialize new project
```

---

## 7. Extending mcp-graph

### 7.1 Custom Skills

Skills are markdown-based capability definitions stored in `copilot-ecosystem/`.

**Directory structure:**
```
copilot-ecosystem/
  agents/
    dev-flow-orchestrator/
      SKILL.md
  code-review/
    code-reviewer/
      SKILL.md
  testing/
    e2e-testing/
      SKILL.md
```

**SKILL.md format:**
```markdown
---
name: my-custom-skill
description: Does something useful
category: agents
risk: low
---

## Use this skill when
- Scenario A
- Scenario B

## Do not use when
- Scenario C

## Instructions
1. Step one...
2. Step two...
```

**Listing available skills:**
```
list_skills
```

### 7.2 MCP Server Configuration

The `.mcp.json` file in the project root defines MCP server connections.

**Structure:**
```json
{
  "mcpServers": {
    "mcp-graph": {
      "command": "npx",
      "args": ["-y", "@mcp-graph-workflow/mcp-graph"]
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    },
    "playwright": {
      "command": "npx",
      "args": ["@anthropic-ai/mcp-server-playwright"]
    }
  }
}
```

**Adding new MCP servers:** Add an entry to `.mcp.json` with the server's command and args. The `mcp-deps-installer` auto-verifies that required npm packages are available.

### 7.3 AI Memory Generation

mcp-graph auto-generates AI configuration files on `init`:

- **CLAUDE.md** — project instructions with auto-generated MCP tool reference (between `<!-- mcp-graph:start -->` and `<!-- mcp-graph:end -->` markers)
- **copilot-instructions.md** — GitHub Copilot instructions with tool reference

**Idempotent updates:** Running `init` again updates only the content between markers, preserving any manual additions outside the markers.

---

## 8. XP Anti-Vibe-Coding Methodology

mcp-graph embodies the anti-vibe-coding methodology — a structured approach to AI-assisted development.

### Core Principles

**Build to Earning vs Build to Learning:**
- **Build to Earning** (production) — full discipline, no shortcuts, TDD enforced, code review mandatory
- **Build to Learning** (experimentation) — relaxed rules, exploration allowed
- Always know which mode you're in

**Skeleton & Organs:**
- The developer defines the architecture (skeleton)
- The AI implements within that architecture (organs)
- Never "create a SaaS" in one prompt — define stack, services, domain first

**Anti-One-Shot:**
- Never use a single prompt to generate entire systems
- Decompose into atomic tasks tracked in the graph
- Each task should be completable in <= 2 hours

**TDD Enforced:**
- Red first — write the failing test
- Green — minimal code to pass
- Refactor — improve without changing behavior
- If AI suggests a feature without a test: REFUSE

**Code Detachment:**
- If the AI made a mistake, explain the error via prompt
- Never manually edit AI-generated code
- Document error patterns in CLAUDE.md

**CLAUDE.md as Evolving Spec:**
- Every error → document it
- Every pattern → register it
- Cumulatively train the agent across conversations

**Graph Visualization:**
- Use `export { format: "mermaid" }` in reviews, handoffs, and debugging
- Visual graphs make implicit dependencies explicit

---

## 9. Troubleshooting Advanced

### DB Mismatch (MCP stdio vs serve)

The MCP stdio server and `serve` command may read different databases if started from different directories. Always verify:

```bash
# Check which DB the serve command is using
curl http://localhost:3000/api/v1/stats

# Ensure your MCP server points to the same directory
```

**Fix:** Start both from the same project directory, or use Open Folder in the dashboard to switch.

### Stale Embeddings

If RAG results seem outdated after adding new content:

```
reindex_knowledge
```

This rebuilds all FTS5 indexes and TF-IDF embeddings from scratch.

### Phase Stuck

If the lifecycle auto-detection is stuck on the wrong phase:

```
set_phase { phase: "IMPLEMENT", mode: "advisory" }
```

Use `advisory` mode to override without blocking tools. Use `strict` only when you want enforcement.

### Token Budget Exceeded

If context responses are too large or too small, adjust `maxTokens`:

```
rag_context { query: "topic", maxTokens: 1000 }    # smaller
rag_context { query: "topic", maxTokens: 5000 }    # larger
```

The system enforces a hard cap on reported `tokenUsage.used`.

### Large Graphs: Performance Tips

- Use `list` with filters (`type`, `status`, `sprint`) instead of fetching everything
- Use `search` for targeted lookups instead of `list`
- Snapshot and archive completed sprints to keep the active graph lean
- The Code Graph reindex is the most expensive operation — avoid running it repeatedly

### Memory Migration (Legacy)

If migrating from the old Serena integration:
- Legacy memories in `.serena/memories/` are auto-migrated on first access
- Knowledge store queries accept both `"memory"` and `"serena"` source types for backward compatibility
- No manual migration needed

---

## 10. Reference Links

| Document | Description |
|----------|-------------|
| [MCP-TOOLS-REFERENCE.md](MCP-TOOLS-REFERENCE.md) | Full reference for all 30 MCP tools |
| [REST-API-REFERENCE.md](REST-API-REFERENCE.md) | 44+ REST API endpoints |
| [ARCHITECTURE-GUIDE.md](ARCHITECTURE-GUIDE.md) | System layers and design principles |
| [ARCHITECTURE-MERMAID.md](ARCHITECTURE-MERMAID.md) | Visual architecture diagram |
| [KNOWLEDGE-PIPELINE.md](KNOWLEDGE-PIPELINE.md) | RAG pipeline deep dive |
| [INTEGRATIONS-GUIDE.md](INTEGRATIONS-GUIDE.md) | All integration details |
| [LIFECYCLE.md](LIFECYCLE.md) | Full 8-phase methodology |
| [DASHBOARD-GUIDE.md](DASHBOARD-GUIDE.md) | Dashboard UI walkthrough |
| [AGENTS.md](AGENTS.md) | Code Intelligence documentation |
| [Getting Started](GETTING-STARTED.md) | Quick-start tutorial |
| [User Guide](USER-GUIDE.md) | Day-to-day usage guide |
