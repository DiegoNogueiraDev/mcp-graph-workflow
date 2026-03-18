# User Guide — mcp-graph

> Complete guide for day-to-day usage. Prerequisite: complete the [Getting Started](GETTING-STARTED.md) tutorial first.

---

## 1. Sprint Planning & Velocity

### Planning a Sprint

Use `plan_sprint` to generate a structured sprint report with task recommendations:

```
plan_sprint { sprintName: "Sprint 1", capacityMinutes: 2400 }
```

The report includes:
- **Recommended tasks** — sorted by priority and dependency readiness
- **Capacity analysis** — estimated hours vs available capacity
- **Risk assessment** — blocked tasks, missing AC, oversized items
- **Velocity context** — historical completion rate if available

**Example output:**
```
📋 Sprint Planning: Sprint 1
   Capacity: 2400 min (40h)
   Recommended: 6 tasks (est. 1800 min)
   Risks: 1 task missing AC, 1 blocked
   Velocity: 2.3h avg/task (from previous sprints)
```

### Tracking Velocity

```
velocity
```

Returns sprint metrics:
- **Completed tasks** — count and total points
- **Average completion time** — per task
- **Burn rate** — tasks per day/week
- **Trend** — improving, stable, or declining

Use `analyze { mode: "progress" }` during a sprint for a live burndown view with ETA.

### Assigning Tasks to Sprints

When creating or updating tasks, set the sprint field:

```
update_node { nodeId: "<ID>", sprint: "Sprint 1" }
```

Then filter by sprint:

```
list { sprint: "Sprint 1" }
```

---

## 2. Knowledge Pipeline

The knowledge pipeline automatically indexes content from multiple sources into a unified, searchable store.

### 2.1 Project Memories

Memories are persistent project knowledge stored in `workflow-graph/memories/`.

**Write a memory:**
```
write_memory { name: "auth-patterns", content: "We use JWT with httpOnly refresh tokens..." }
```

**Read a memory:**
```
read_memory { name: "auth-patterns" }
```

**List all memories:**
```
list_memories
```

**Delete a memory:**
```
delete_memory { name: "auth-patterns" }
```

**Naming conventions:**
- Use descriptive kebab-case names: `auth-patterns`, `db-migration-notes`, `api-design-decisions`
- Group by topic with directory prefixes: `architecture/layer-boundaries`, `decisions/jwt-vs-session`, `patterns/error-handling`
- Memories are auto-indexed into the knowledge store immediately after writing

**Recommended organization:**
```
workflow-graph/memories/
  architecture/       # System design decisions
  decisions/          # ADRs and tradeoffs
  patterns/           # Recurring patterns and conventions
  bugs/               # Known issues and workarounds
  onboarding/         # Team knowledge transfer
```

### 2.2 Stack Documentation (Context7)

`sync_stack_docs` automatically detects your project stack and fetches documentation:

```
sync_stack_docs
```

**How it works:**
1. **Detect stack** — scans `package.json`, `requirements.txt`, `go.mod`, `Cargo.toml`
2. **Resolve libraries** — maps each dependency to Context7's library registry
3. **Fetch docs** — downloads relevant documentation pages
4. **Cache** — stores locally to avoid redundant fetches
5. **Index** — adds to knowledge store for RAG queries

This runs automatically during `import_prd`, but you can trigger it manually anytime.

### 2.3 Reindexing

```
reindex_knowledge
```

Rebuilds the entire knowledge index from scratch:
- **FTS5** — full-text search indexes for BM25 ranking
- **TF-IDF embeddings** — vector representations for semantic similarity
- **Deduplication** — SHA-256 ensures no duplicate entries

**When to reindex:**
- After manually editing files in `workflow-graph/memories/`
- If search results seem stale or incomplete
- After upgrading mcp-graph to a new version
- After restoring a snapshot

---

## 3. Search & RAG

mcp-graph provides three complementary ways to find information.

### 3.1 Full-Text Search (search)

```
search { query: "authentication JWT" }
```

Uses FTS5 with BM25 ranking. Fast keyword-based search across all graph nodes.

- Matches against titles, descriptions, and acceptance criteria
- Results ranked by relevance (BM25 scoring)
- Supports standard search operators

### 3.2 Semantic Search (rag_context)

```
rag_context { query: "how to implement JWT authentication", maxTokens: 2000 }
```

Uses TF-IDF + cosine similarity for semantic matching across the knowledge store.

**Parameters:**
- `query` — natural language question
- `maxTokens` — token budget for the response (default varies by tier)

**Tiers:**
| Tier | Tokens/node | When used |
|------|-------------|-----------|
| Summary | ~20 | Quick overview, many nodes |
| Standard | ~150 | Normal usage, balanced detail |
| Deep | ~500+ | Detailed analysis, few nodes |

### 3.3 Compact Context (context)

```
context { nodeId: "<ID>" }
```

Generates a token-budgeted context payload specifically for a task:
- **60%** — graph context (task details, dependencies, status tree)
- **30%** — knowledge store (BM25-ranked relevant chunks)
- **10%** — header and metadata (phase, sprint, lifecycle)

Achieves 70-85% token reduction compared to raw data.

**When to use which:**

| Tool | Best for | Token cost |
|------|----------|------------|
| `search` | Finding specific nodes by keyword | Low (IDs + titles) |
| `rag_context` | Getting knowledge-enriched answers | Medium (controlled by maxTokens) |
| `context` | Full implementation context for a task | Medium (auto-budgeted) |

---

## 4. Dashboard Deep Dive

Start the dashboard with `mcp-graph serve` and open `http://localhost:3000`. For the complete visual guide, see [DASHBOARD-GUIDE.md](DASHBOARD-GUIDE.md).

### 4.1 Graph Tab

The main visualization — an interactive React Flow diagram of your execution graph.

- **Filters** — narrow by status (backlog/ready/in_progress/blocked/done), type (epic/task/subtask), layout direction
- **Node table** — searchable list below the graph, click any row to select
- **Detail panel** — shows full node info: description, AC, metadata, dependencies, edges
- **Layout toggle** — switch between top-down and left-right views
- **Show all nodes** — expand to see child nodes (tasks within epics)

### 4.2 PRD & Backlog

Organized view of imported PRDs with hierarchy tracking.

- **Simplified graph** showing the PRD structure
- **Progress bars** per epic (X/Y done, percentage)
- **Next task** recommendation highlighted
- **Hierarchical list** with color-coded status indicators

### 4.3 Code Graph

Visualizes your codebase's symbol relationships (native Code Intelligence).

- **Status indicator** — shows if the code index is current
- **Reindex button** — triggers `reindex_knowledge` for code symbols
- **Symbol search** — FTS5 search across functions, classes, methods, interfaces
- **Impact analysis** — click a symbol to see upstream (who calls it) and downstream (what it calls)

### 4.4 Memories Tab

File-tree explorer for project knowledge.

- **Tree view** — memories organized by directory structure
- **Content viewer** — markdown rendering of selected memory
- **CRUD operations** — create, read, and delete via the interface
- Reflects `workflow-graph/memories/` contents in real-time

### 4.5 Insights

Analytics and actionable recommendations.

- **Health score** — overall project health metric
- **Status distribution** — bar chart of backlog/ready/in_progress/blocked/done
- **Bottlenecks** — blocked tasks, missing AC, oversized items
- **Velocity trend** — chart showing completion rate over time
- **Recommendations** — suggested skills and actions per lifecycle phase

### 4.6 Benchmark

Context compression performance metrics.

- **Token economy** — average compression ratio, tokens saved per task
- **Cost savings** — estimated dollar savings per task (Opus vs Sonnet pricing)
- **Per-task breakdown** — individual compression metrics
- **Dependency intelligence** — edges inferred, cycles detected

### 4.7 Logs

Real-time server log viewer.

- **Level filters** — info, warn, error, debug
- **Text search** — filter by log content
- **Auto-scroll** — new entries stream in via SSE
- **Clear** — reset the log view

### 4.8 Import PRD & Capture Modals

**Import PRD** (header button):
1. Drag-and-drop or click to select a file (.md, .txt, .pdf, .html)
2. Optional: check "Force re-import" to reimport an already-imported file
3. Click Import — the graph updates automatically

**Capture** (header button):
1. Enter a URL to capture
2. Optional: CSS selector for targeted extraction, wait-for selector
3. Click Capture — content is extracted and indexed into the knowledge store

---

## 5. Code Graph & Impact Analysis

Code Intelligence is a native engine (no external MCP dependencies) that provides symbol-level understanding of your codebase.

### What It Does

- **Symbol extraction** — functions, classes, methods, interfaces from TypeScript AST
- **Relationship mapping** — calls, imports, exports, implements relationships
- **Impact analysis** — find all upstream/downstream dependents of a symbol
- **FTS5 search** — full-text search across all indexed symbols

### Workflow

1. **Index the codebase:**
   ```
   reindex_knowledge
   ```
   Or click "Reindex" in the Code Graph dashboard tab.

2. **Search for symbols:**
   Use the Code Graph tab's search bar or:
   ```
   search { query: "AuthService" }
   ```

3. **Analyze impact:**
   Click a symbol in the Code Graph tab to see:
   - **Upstream** — who depends on this symbol (callers, importers)
   - **Downstream** — what this symbol depends on (callees, imports)

### When to Use

- **Before refactoring** — check blast radius of a change
- **During code review** — verify no unintended dependents are affected
- **Architecture exploration** — understand module boundaries and coupling
- **Onboarding** — visualize how the codebase is structured

---

## 6. Multi-Project

mcp-graph supports managing multiple projects at two levels.

### 6.1 Projects in the Same DB

A single `workflow-graph/graph.db` can contain multiple projects. Switch between them using the **project selector dropdown** in the dashboard header.

**Via API:**
```
GET  /api/v1/project/list           # List all projects
POST /api/v1/project/:id/activate   # Switch active project
```

### 6.2 Projects in Different Directories

Each directory with `workflow-graph/graph.db` is an independent project.

**Initialize multiple projects:**
```bash
cd ~/project-a && npx mcp-graph init
cd ~/project-b && npx mcp-graph init
```

**Switch via dashboard:**
1. Click **Open Folder** in the header
2. Browse to or type the path of another project directory
3. Click Open — the dashboard refreshes with that project's data

**Switch via serve command:**
```bash
mcp-graph serve --port 3000    # serves current directory's graph
```

---

## 7. Exports & Snapshots

### 7.1 Export Mermaid

Generate a Mermaid diagram for documentation, GitHub READMEs, or Notion pages:

```
export { format: "mermaid" }
```

Paste the output into any Mermaid renderer. The diagram shows nodes with status colors and dependency edges.

### 7.2 Export JSON

Full graph backup in JSON format:

```
export { format: "json" }
```

Contains all nodes, edges, metadata, and knowledge entries. Useful for:
- Backup before major changes
- Sharing graph state with teammates
- Programmatic analysis

### 7.3 Snapshots

Snapshots create timestamped copies of the entire graph database.

**Create a snapshot:**
```
snapshot { action: "create", name: "before-refactor" }
```

**List available snapshots:**
```
snapshot { action: "list" }
```

**Restore a snapshot:**
```
snapshot { action: "restore", name: "before-refactor" }
```

**When to snapshot:**
- Before a major refactor or re-import
- Before starting a new sprint (preserve the baseline)
- Before experimenting with `decompose` on multiple tasks
- Anytime you want a safe rollback point

---

## 8. Task Decomposition

Large tasks slow down sprints and make progress hard to track. The `decompose` tool helps break them down.

### Detecting Large Tasks

```
decompose { nodeId: "<ID>" }
```

Analyzes the task and reports:
- Whether it's too large (L/XL size without subtasks)
- Suggested breakdown into smaller subtasks
- Recommended dependency edges between subtasks

### Workflow

1. **Detect** — run `decompose` or `analyze { mode: "decompose" }` to find oversized tasks
2. **Review** — evaluate the suggested subtask breakdown
3. **Create subtasks** — use `add_node` for each subtask:
   ```
   add_node { title: "Setup auth middleware", type: "subtask", parentId: "<PARENT_ID>" }
   ```
4. **Add dependencies** — link subtasks:
   ```
   edge { from: "<SUBTASK_2>", to: "<SUBTASK_1>", relationType: "depends_on" }
   ```
5. **Re-check** — run `stats` to verify the updated structure

---

## 9. Browser Validation (Playwright)

The `validate_task` tool uses Playwright for browser-based validation.

### Single URL Validation

```
validate_task { nodeId: "<ID>", url: "http://localhost:3000/login" }
```

Captures the page (HTML, screenshot, accessibility tree) and auto-indexes the content into the knowledge store.

### A/B Comparison

```
validate_task { nodeId: "<ID>", url: "http://localhost:3000/login-v2", compareUrl: "http://localhost:3000/login-v1" }
```

Generates a diff report between two URLs — useful for comparing before/after states.

### CSS Selector Scoping

```
validate_task { nodeId: "<ID>", url: "http://localhost:3000", selector: ".main-content" }
```

Extracts only the targeted portion of the page.

### Knowledge Auto-Indexing

Every validation capture is automatically:
1. Stored in the knowledge store (source type: `web_capture`)
2. Indexed with FTS5 + TF-IDF embeddings
3. Available via `rag_context` and `search` queries

---

## 10. Productivity Tips

### The Optimal Workflow Loop

```
next → context → implement (TDD: Red → Green → Refactor) → update_status → next
```

This loop maximizes token efficiency and keeps the graph in sync with real work.

### Tagging for Organization

Use tags to categorize tasks across sprints and domains:

```
update_node { nodeId: "<ID>", tags: ["frontend", "auth", "high-priority"] }
```

Then filter: `list { tags: "frontend" }`.

### Batch Operations

Update multiple tasks at once:

```
bulk_update_status { nodeIds: ["ID1", "ID2", "ID3"], status: "done" }
```

### Maximizing Context

Combine search tools for comprehensive context:
1. `context { nodeId: "ID" }` — structured task context
2. `rag_context { query: "related topic" }` — semantic knowledge
3. `search { query: "keyword" }` — quick lookups

### Dashboard + MCP in Parallel

Keep the dashboard open (`mcp-graph serve`) while using MCP tools in your editor. Changes made via MCP tools are reflected in the dashboard in real-time via SSE.

### Useful Analyze Modes for Daily Work

| Mode | When to use |
|------|-------------|
| `progress` | Check sprint burndown and ETA |
| `tdd_check` | Verify test coverage before marking done |
| `implement_done` | Run Definition of Done checklist |
| `blockers` | Find what's blocking a specific task |
| `ready` | Check if tasks meet Definition of Ready |

For the complete list of 25 analyze modes, see the [Advanced Guide](ADVANCED-GUIDE.md).

---

## Next Steps

- **[Advanced Guide](ADVANCED-GUIDE.md)** — Lifecycle methodology, all 25 analyze modes, RAG tuning, architecture, and extensibility
- **[Getting Started](GETTING-STARTED.md)** — Quick-start tutorial and cheat sheet
- **[Dashboard Guide](DASHBOARD-GUIDE.md)** — Complete visual walkthrough of all dashboard features
- **[MCP Tools Reference](MCP-TOOLS-REFERENCE.md)** — Full reference for all 30 MCP tools
- **[Knowledge Pipeline](KNOWLEDGE-PIPELINE.md)** — Deep dive into RAG architecture
