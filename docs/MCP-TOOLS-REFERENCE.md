# MCP Tools Reference

> 32 tools organized in 8 categories — complete parameter reference.
>
> **v5.5.0:** `node` (3 actions) and `validate` (2 actions) consolidate 5 individual tools. The old names (`add_node`, `update_node`, `delete_node`, `validate_task`, `validate_ac`) still work as deprecated shims — they will be removed in v7.0.

## Summary

| Category | Tools | Count |
|----------|-------|-------|
| [Graph CRUD](#graph-crud) | init, import_prd, import_graph, **node** *(add/update/delete)*, edge, move_node, clone_node, export | 8 |
| [Querying](#querying) | list, show, search, rag_context | 4 |
| [Planning & Execution](#planning--execution) | next, update_status, decompose, velocity, dependencies, plan_sprint | 6 |
| [Knowledge & RAG](#knowledge--rag) | context, reindex_knowledge, sync_stack_docs | 3 |
| [Validation](#validation) | **validate** *(ac/task)* | 1 |
| [Snapshots & Stats](#snapshots--stats) | stats, snapshot | 2 |
| [User Journeys](#user-journeys) | journey | 1 |
| [Deprecated](#deprecated-tools) | add_node, update_node, delete_node, validate_task, validate_ac | 5 |

---

## Graph CRUD

### `init`

Initialize a new project graph.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `projectName` | string | No | — | Name for the project |

### `import_prd`

Import a PRD file and convert it into graph nodes and edges.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `filePath` | string | Yes | — | Path to the PRD text file (.md, .txt, .pdf, .html) |
| `force` | boolean | No | `false` | Force re-import: delete nodes from previous import before importing |

### `import_graph`

Import and merge an external graph (JSON) into the current project. Uses INSERT OR IGNORE semantics — existing local nodes/edges win on conflict.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `graph` | string | No | — | JSON string of a GraphDocument (nodes + edges) |
| `filePath` | string | No | — | Path to a JSON file containing a GraphDocument |
| `dry_run` | boolean | No | `false` | Preview merge counts without writing to the database |

> One of `graph` or `filePath` must be provided. Returns counts of inserted nodes and edges.

### `node`

Unified CRUD for graph nodes. Replaces `add_node`, `update_node`, and `delete_node` (v5.5.0).

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `action` | "add"\|"update"\|"delete" | Yes | — | Action to perform |

**action: "add"** — Create a new node:

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `type` | NodeType | Yes | — | Node type |
| `title` | string | Yes | — | Node title |
| `description` | string | No | — | Node description |
| `status` | NodeStatus | No | `backlog` | Node status |
| `priority` | 1-5 | No | `3` | Priority (1=highest) |
| `xpSize` | XpSize | No | — | Size estimate: XS, S, M, L, XL |
| `estimateMinutes` | number | No | — | Time estimate in minutes |
| `tags` | string[] | No | — | Tags for categorization |
| `parentId` | string\|null | No | — | Parent node ID (auto-creates parent_of/child_of edges) |
| `sprint` | string\|null | No | — | Sprint identifier |
| `acceptanceCriteria` | string[] | No | — | Acceptance criteria |
| `blocked` | boolean | No | — | Whether the node is blocked |
| `metadata` | object | No | — | Custom metadata |

**action: "update"** — Update fields of an existing node:

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | Yes | — | Node ID to update |
| `title` | string | No | — | New title |
| `description` | string | No | — | New description |
| `type` | NodeType | No | — | New node type |
| `priority` | 1-5 | No | — | New priority |
| `xpSize` | XpSize | No | — | New size estimate |
| `estimateMinutes` | number | No | — | New time estimate |
| `tags` | string[] | No | — | New tags array |
| `sprint` | string\|null | No | — | Sprint assignment (null to clear) |
| `parentId` | string\|null | No | — | New parent node ID (null to clear; auto-updates edges) |
| `acceptanceCriteria` | string[] | No | — | New acceptance criteria |

**action: "delete"** — Delete a node with cascade:

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | Yes | — | Node ID to delete (cascades to children and edges) |

### `edge`

Manage edges (relationships) between nodes: add, delete, or list.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `action` | "add"\|"delete"\|"list" | Yes | — | Action to perform |
| `from` | string | No | — | Source node ID (required for add) |
| `to` | string | No | — | Target node ID (required for add) |
| `relationType` | RelationType | No | — | Relationship type (required for add, optional filter for list) |
| `reason` | string | No | — | Why this relationship exists (add only) |
| `weight` | number | No | — | Edge weight 0-1 (add only) |
| `id` | string | No | — | Edge ID (required for delete) |
| `nodeId` | string | No | — | Filter edges by node ID (list only) |
| `direction` | "from"\|"to"\|"both" | No | `both` | Edge direction relative to nodeId (list only) |

### `move_node`

Move a node to a new parent in the hierarchy.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | Yes | — | Node ID to move |
| `newParentId` | string\|null | Yes | — | New parent ID (null to make root) |

### `clone_node`

Clone a node (optionally with all children).

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | Yes | — | Node ID to clone |
| `deep` | boolean | No | `false` | Clone children recursively |
| `newParentId` | string | No | — | Parent ID for the cloned node |

### `export`

Export the graph as JSON or Mermaid diagram.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `action` | "json"\|"mermaid" | Yes | — | Export format |
| `format` | "flowchart"\|"mindmap" | No | `flowchart` | Mermaid diagram format (mermaid only) |
| `direction` | "TD"\|"LR" | No | `TD` | Flow direction (mermaid flowchart only) |
| `filterStatus` | NodeStatus[] | No | — | Only include nodes with these statuses (mermaid only) |
| `filterType` | NodeType[] | No | — | Only include nodes with these types (mermaid only) |

---

## Querying

### `list`

List graph nodes with optional filters.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `type` | NodeType | No | — | Filter by node type |
| `status` | NodeStatus | No | — | Filter by node status |
| `sprint` | string | No | — | Filter by sprint name |

### `show`

Show detailed information about a node, including edges and children.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | Yes | — | Node ID to inspect |

### `search`

Full-text search across graph nodes using BM25 ranking.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `query` | string | Yes | — | Search query text |
| `limit` | number | No | `20` | Maximum results (1-100) |
| `rerank` | boolean | No | `false` | Apply TF-IDF reranking |

### `rag_context`

Build RAG context from a natural language query with token budgeting.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `query` | string | Yes | — | Natural language query |
| `tokenBudget` | number | No | `4000` | Max token budget (500-32000) |
| `detail` | "summary"\|"standard"\|"deep" | No | `standard` | Context detail level |

---

## Planning & Execution

### `next`

Suggest the next best task to work on based on priority, dependencies, and size. No parameters.

### `update_status`

Update the status of a node.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string \| string[] | Yes | — | Node ID or array of IDs for bulk update |
| `status` | NodeStatus | Yes | — | New status |

### `decompose`

Detect large tasks that should be decomposed into subtasks.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `nodeId` | string | No | — | Filter to a specific node |

### `velocity`

Calculate sprint velocity metrics.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `sprint` | string | No | — | Filter to a specific sprint |

### `dependencies`

Analyze dependency chains: blockers, cycles, or critical path.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `mode` | "blockers"\|"cycles"\|"critical_path" | Yes | — | Analysis mode |
| `nodeId` | string | No | — | Node ID (required for blockers mode) |

### `plan_sprint`

Generate a sprint planning report with task order, missing docs, risk assessment, and velocity estimates.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `mode` | "report"\|"next" | No | `report` | Full report or enhanced next task |

---

## Knowledge & RAG

### `context`

Get a compact, AI-optimized context payload for a task (parent, children, blockers, dependencies, acceptance criteria, source references, token metrics).

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | Yes | — | Node ID to build context for |

### `reindex_knowledge`

Reindex all knowledge sources into the unified store and rebuild embeddings.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `basePath` | string | No | cwd | Project base path for finding memories |
| `sources` | ("memory"\|"serena"\|"docs"\|"skills"\|"embeddings")[] | No | all | Which sources to reindex. "serena" is an alias for "memory". |

### `write_memory`

Write a project memory to `workflow-graph/memories/{name}.md`. Auto-indexes into the knowledge store for RAG search.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | — | Memory name (supports nested paths like "architecture/overview") |
| `content` | string | Yes | — | Memory content (markdown) |

### `read_memory`

Read a project memory from `workflow-graph/memories/{name}.md`.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | — | Memory name (without .md extension) |

### `list_memories`

List all project memories available in `workflow-graph/memories/`.

No parameters.

### `delete_memory`

Delete a project memory from `workflow-graph/memories/{name}.md` and remove from knowledge store.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | — | Memory name to delete (without .md extension) |

### `sync_stack_docs`

Auto-detect project stack and sync documentation via Context7.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `basePath` | string | No | cwd | Project base path |
| `libraries` | string[] | No | — | Specific libraries (overrides auto-detection) |

---

## Validation

### `validate`

Unified validation tool. Replaces `validate_task` and `validate_ac` (v5.5.0).

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `action` | "task"\|"ac" | Yes | — | Action to perform |

**action: "task"** — Browser-based validation with optional A/B comparison:

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `url` | string (URL) | Yes | — | URL to validate |
| `compareUrl` | string (URL) | No | — | Second URL for A/B comparison |
| `selector` | string | No | — | CSS selector to scope extraction |
| `nodeId` | string | No | — | Associate validation with a graph node |

**action: "ac"** — Validate acceptance criteria quality:

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `nodeId` | string | No | — | Specific node to validate (if omitted, validates all nodes with AC) |
| `all` | boolean | No | `true` | Validate all nodes with AC (only when nodeId is omitted) |

---

## Snapshots & Stats

### `stats`

Show aggregate statistics for the project graph, including context compression metrics. No parameters.

### `snapshot`

Manage graph snapshots: create, list, or restore.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `action` | "create"\|"list"\|"restore" | Yes | — | Action to perform |
| `snapshotId` | number | No | — | Snapshot ID (required for restore) |

---

## Analysis (via `analyze` tool)

The `analyze` tool is a gateway for all project analysis modes. Each mode provides a different lens on the graph.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `mode` | string | Yes | — | Analysis mode (see below) |
| `nodeId` | string | No | — | Node ID or sprint filter depending on mode |

### IMPLEMENT modes

| Mode | Phase | Description |
|------|-------|-------------|
| `implement_done` | IMPLEMENT | Definition of Done checklist (8 checks: 4 required + 4 recommended). Requires `nodeId`. |
| `tdd_check` | IMPLEMENT | TDD adherence report with testability score and suggested test specs from AC. Optional `nodeId` filter. |
| `progress` | IMPLEMENT | Sprint burndown + velocity trend + blockers + critical path + ETA. Optional `nodeId` as sprint filter. |

### Other modes

| Mode | Phase | Description |
|------|-------|-------------|
| `prd_quality` | ANALYZE | PRD quality assessment (score + grade) |
| `scope` | ANALYZE | Scope analysis: orphans, cycles, coverage |
| `ready` | ANALYZE | Definition of Ready check |
| `risk` | ANALYZE | Risk matrix assessment |
| `blockers` | ANY | Transitive blockers for a node (requires `nodeId`) |
| `cycles` | ANY | Dependency cycle detection |
| `critical_path` | ANY | Critical path through dependency DAG |
| `decompose` | PLAN | Detect large tasks needing decomposition |
| `adr` | DESIGN | ADR validation quality |
| `traceability` | DESIGN | Requirement→decision traceability matrix |
| `coupling` | DESIGN | Fan-in/out coupling analysis |
| `interfaces` | DESIGN | Interface-first quality check |
| `tech_risk` | DESIGN | Technical risk scoring |
| `design_ready` | DESIGN | DESIGN→PLAN gate readiness |

---

## User Journeys

### `journey`

Manage and query website journey maps — screen flows, form fields, CTAs, A/B variants. Indexes journey data into the knowledge store for RAG queries.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `action` | `"list"` \| `"get"` \| `"search"` \| `"index"` | Yes | — | Action to perform |
| `mapId` | string | For `get` | — | Journey map ID |
| `query` | string | For `search` | — | Search query for screens |

**Actions:**

- **`list`** — Returns all journey maps with id, name, url, description.
- **`get`** — Returns a compact AI-optimized representation of a specific map: screens with fields, CTAs, navigation edges (navigatesTo), variants, and summary stats.
- **`search`** — Full-text search across all screens by title, description, fields, CTAs, and URL.
- **`index`** — Indexes all journey maps into the knowledge store. Each screen becomes a searchable document with form fields, CTAs, navigation context, and metadata. Makes journey data discoverable via `rag_context`.

---

## Deprecated Tools

> **These tools still work but are deprecated since v5.5.0 and will be removed in v7.0.** Migrate to the consolidated tools shown below.

| Deprecated Tool | Migrate To | Notes |
|----------------|------------|-------|
| `add_node` | `node { action: "add", ... }` | Same parameters |
| `update_node` | `node { action: "update", ... }` | Same parameters |
| `delete_node` | `node { action: "delete", ... }` | Now supports cascade delete of children |
| `validate_task` | `validate { action: "task", ... }` | Same parameters |
| `validate_ac` | `validate { action: "ac", ... }` | Same parameters |

Deprecated tools log a warning on each call and include a `_deprecated` field in their response.

---

## Type Reference

**NodeType:** `epic`, `task`, `subtask`, `requirement`, `constraint`, `milestone`, `acceptance_criteria`, `risk`, `decision`

**NodeStatus:** `backlog`, `ready`, `in_progress`, `blocked`, `done`

**RelationType:** `parent_of`, `child_of`, `depends_on`, `blocks`, `related_to`, `priority_over`, `implements`, `derived_from`

**XpSize:** `XS`, `S`, `M`, `L`, `XL`

**Priority:** `1` (highest) to `5` (lowest)
