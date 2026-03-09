# Benchmark Results — mcp-graph MCP Tools

## Metadata

| Field | Value |
|-------|-------|
| **Date** | _YYYY-MM-DD_ |
| **Develop Commit** | _<git rev>_ |
| **Node.js Version** | _<node -v>_ |
| **OS** | _<uname -a>_ |
| **Executor** | Claude Code / Manual |

---

## Summary

| Metric | Count |
|--------|-------|
| **Total Steps** | 65 |
| **Passed** | _ |
| **Failed** | _ |
| **Skipped** | _ |
| **Pass Rate** | _% |

---

## Results by Scenario

| # | Scenario | Steps | Passed | Failed | Skipped | Status |
|---|----------|-------|--------|--------|---------|--------|
| 1 | Lifecycle Completo | 10 | | | | ⬜ |
| 2 | Graph CRUD | 10 | | | | ⬜ |
| 3 | Search & RAG | 5 | | | | ⬜ |
| 4 | Knowledge Pipeline | 3 | | | | ⬜ |
| 5 | Planning | 8 | | | | ⬜ |
| 6 | Snapshots | 8 | | | | ⬜ |
| 7 | Export | 4 | | | | ⬜ |
| 8 | Bulk Operations | 5 | | | | ⬜ |
| 9 | Clone & Move | 8 | | | | ⬜ |
| 10 | Validation | 2 | | | | ⬜ |
| 11 | Stack Docs | 2 | | | | ⬜ |

---

## Detailed Results

### Cenário 1: Lifecycle Completo

| Step | Tool | Result | Notes |
|------|------|--------|-------|
| 1.1 | `init` | ⬜ | |
| 1.2 | `import_prd` | ⬜ | |
| 1.3 | `stats` | ⬜ | |
| 1.4 | `list` | ⬜ | |
| 1.5 | `next` | ⬜ | |
| 1.6 | `context` | ⬜ | |
| 1.7 | `update_status` | ⬜ | |
| 1.8 | `update_status` | ⬜ | |
| 1.9 | `stats` | ⬜ | |
| 1.10 | `plan_sprint` | ⬜ | |

### Cenário 2: Graph CRUD

| Step | Tool | Result | Notes |
|------|------|--------|-------|
| 2.1 | `add_node` | ⬜ | |
| 2.2 | `add_node` | ⬜ | |
| 2.3 | `show` | ⬜ | |
| 2.4 | `update_node` | ⬜ | |
| 2.5 | `add_edge` | ⬜ | |
| 2.6 | `list_edges` | ⬜ | |
| 2.7 | `delete_edge` | ⬜ | |
| 2.8 | `list_edges` | ⬜ | |
| 2.9 | `delete_node` | ⬜ | |
| 2.10 | `show` | ⬜ | |

### Cenário 3: Search & RAG

| Step | Tool | Result | Notes |
|------|------|--------|-------|
| 3.1 | `search` | ⬜ | |
| 3.2 | `search` | ⬜ | |
| 3.3 | `rag_context` | ⬜ | |
| 3.4 | `rag_context` | ⬜ | |
| 3.5 | `rag_context` | ⬜ | |

### Cenário 4: Knowledge Pipeline

| Step | Tool | Result | Notes |
|------|------|--------|-------|
| 4.1 | `reindex_knowledge` | ⬜ | |
| 4.2 | `search` | ⬜ | |
| 4.3 | `rag_context` | ⬜ | |

### Cenário 5: Planning

| Step | Tool | Result | Notes |
|------|------|--------|-------|
| 5.1 | `decompose` | ⬜ | |
| 5.2 | `add_node` | ⬜ | |
| 5.3 | `decompose` | ⬜ | |
| 5.4 | `dependencies` | ⬜ | |
| 5.5 | `dependencies` | ⬜ | |
| 5.6 | `velocity` | ⬜ | |
| 5.7 | `plan_sprint` | ⬜ | |
| 5.8 | `plan_sprint` | ⬜ | |

### Cenário 6: Snapshots

| Step | Tool | Result | Notes |
|------|------|--------|-------|
| 6.1 | `create_snapshot` | ⬜ | |
| 6.2 | `list_snapshots` | ⬜ | |
| 6.3 | `stats` | ⬜ | |
| 6.4 | `add_node` | ⬜ | |
| 6.5 | `stats` | ⬜ | |
| 6.6 | `restore_snapshot` | ⬜ | |
| 6.7 | `stats` | ⬜ | |
| 6.8 | `list` | ⬜ | |

### Cenário 7: Export

| Step | Tool | Result | Notes |
|------|------|--------|-------|
| 7.1 | `export_graph` | ⬜ | |
| 7.2 | `export_mermaid` | ⬜ | |
| 7.3 | `export_mermaid` | ⬜ | |
| 7.4 | `export_mermaid` | ⬜ | |

### Cenário 8: Bulk Operations

| Step | Tool | Result | Notes |
|------|------|--------|-------|
| 8.1 | `add_node` | ⬜ | |
| 8.2 | `add_node` | ⬜ | |
| 8.3 | `add_node` | ⬜ | |
| 8.4 | `bulk_update_status` | ⬜ | |
| 8.5 | `list` | ⬜ | |

### Cenário 9: Clone & Move

| Step | Tool | Result | Notes |
|------|------|--------|-------|
| 9.1 | `add_node` | ⬜ | |
| 9.2 | `add_node` | ⬜ | |
| 9.3 | `clone_node` | ⬜ | |
| 9.4 | `clone_node` | ⬜ | |
| 9.5 | `add_node` | ⬜ | |
| 9.6 | `move_node` | ⬜ | |
| 9.7 | `show` | ⬜ | |
| 9.8 | `show` | ⬜ | |

### Cenário 10: Validation

| Step | Tool | Result | Notes |
|------|------|--------|-------|
| 10.1 | `validate_task` | ⬜ | |
| 10.2 | `validate_task` | ⬜ | |

### Cenário 11: Stack Docs

| Step | Tool | Result | Notes |
|------|------|--------|-------|
| 11.1 | `sync_stack_docs` | ⬜ | |
| 11.2 | `reindex_knowledge` | ⬜ | |

---

## Issues Found

| # | Step | Tool | Severity | Description | Resolution |
|---|------|------|----------|-------------|------------|
| | | | | | |

---

## Conclusions

_<Summary of findings, confidence level, and any follow-up actions needed>_
