# MCP Tools Reference

> 31 tools organized in 6 categories — complete parameter reference.

## Summary

| Category | Tools | Count |
|----------|-------|-------|
| [Graph CRUD](#graph-crud) | init, import_prd, add_node, update_node, delete_node, add_edge, delete_edge, list_edges, move_node, clone_node, export_graph, export_mermaid | 12 |
| [Querying](#querying) | list, show, search, rag_context | 4 |
| [Planning & Execution](#planning--execution) | next, update_status, bulk_update_status, decompose, velocity, dependencies, plan_sprint | 7 |
| [Knowledge & RAG](#knowledge--rag) | context, reindex_knowledge, sync_stack_docs | 3 |
| [Validation](#validation) | validate_task | 1 |
| [Snapshots & Stats](#snapshots--stats) | stats, create_snapshot, restore_snapshot, list_snapshots | 4 |

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

### `add_node`

Create a single node in the graph.

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
| `parentId` | string\|null | No | — | Parent node ID |
| `sprint` | string\|null | No | — | Sprint identifier |
| `acceptanceCriteria` | string[] | No | — | Acceptance criteria |
| `blocked` | boolean | No | — | Whether the node is blocked |
| `metadata` | object | No | — | Custom metadata |

### `update_node`

Update arbitrary fields of a node.

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
| `parentId` | string\|null | No | — | New parent node ID (null to clear) |
| `acceptanceCriteria` | string[] | No | — | New acceptance criteria |

### `delete_node`

Delete a node and all its associated edges.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | Yes | — | Node ID to delete |

### `add_edge`

Create an edge (relationship) between two nodes.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `from` | string | Yes | — | Source node ID |
| `to` | string | Yes | — | Target node ID |
| `relationType` | RelationType | Yes | — | Type of relationship |
| `reason` | string | No | — | Why this relationship exists |
| `weight` | number | No | — | Edge weight (0-1) |

### `delete_edge`

Delete an edge from the graph.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | Yes | — | Edge ID to delete |

### `list_edges`

List and filter edges in the graph.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `nodeId` | string | No | — | Filter edges by node ID |
| `direction` | "from"\|"to"\|"both" | No | `both` | Edge direction relative to nodeId |
| `relationType` | RelationType | No | — | Filter by relationship type |

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

### `export_graph`

Export the complete graph as a JSON document. No parameters.

### `export_mermaid`

Export the graph as a Mermaid diagram.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `format` | "flowchart"\|"mindmap" | No | `flowchart` | Diagram format |
| `direction` | "TD"\|"LR" | No | `TD` | Flow direction (flowchart only) |
| `filterStatus` | NodeStatus[] | No | — | Only include nodes with these statuses |
| `filterType` | NodeType[] | No | — | Only include nodes with these types |

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
| `id` | string | Yes | — | Node ID to update |
| `status` | NodeStatus | Yes | — | New status |

### `bulk_update_status`

Update the status of multiple nodes at once.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `ids` | string[] | Yes | — | Array of node IDs |
| `status` | NodeStatus | Yes | — | New status to set |

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
| `basePath` | string | No | cwd | Project base path for Serena memories |
| `sources` | ("serena"\|"docs"\|"embeddings")[] | No | all | Which sources to reindex |

### `sync_stack_docs`

Auto-detect project stack and sync documentation via Context7.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `basePath` | string | No | cwd | Project base path |
| `libraries` | string[] | No | — | Specific libraries (overrides auto-detection) |

---

## Validation

### `validate_task`

Run browser-based validation for a task with optional A/B comparison.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `url` | string (URL) | Yes | — | URL to validate |
| `compareUrl` | string (URL) | No | — | Second URL for A/B comparison |
| `selector` | string | No | — | CSS selector to scope extraction |
| `nodeId` | string | No | — | Associate validation with a graph node |

---

## Snapshots & Stats

### `stats`

Show aggregate statistics for the project graph, including context compression metrics. No parameters.

### `create_snapshot`

Create a snapshot of the current graph state. No parameters.

### `list_snapshots`

List all available snapshots for the current project. No parameters.

### `restore_snapshot`

Restore the graph to a previous snapshot state.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `snapshotId` | number | Yes | — | Snapshot ID to restore |

---

## Type Reference

**NodeType:** `epic`, `task`, `subtask`, `requirement`, `constraint`, `milestone`, `acceptance_criteria`, `risk`, `decision`

**NodeStatus:** `backlog`, `ready`, `in_progress`, `blocked`, `done`

**RelationType:** `parent_of`, `child_of`, `depends_on`, `blocks`, `related_to`, `priority_over`, `implements`, `derived_from`

**XpSize:** `XS`, `S`, `M`, `L`, `XL`

**Priority:** `1` (highest) to `5` (lowest)
