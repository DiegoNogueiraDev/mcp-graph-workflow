# Benchmark Tests — mcp-graph

Real-world MCP tool validation notebook for the [mcp-graph](https://github.com/DiegoNogueiraDev/mcp-graph-workflow) project.

## Purpose

Validate that all 31 MCP tools work correctly via real MCP stdio transport — not just unit tests with in-memory SQLite.

## Structure

```
benchmark-tests/          (orphan branch)
├── README.md             # This file
├── .mcp.json             # MCP config pointing to develop source
├── sample-prd.txt        # Realistic PRD fixture (2 epics, 6 tasks)
├── NOTEBOOK.md           # Test notebook (11 scenarios, ~65 steps)
└── RESULTS.md            # Results template (pass/fail matrix)
```

## Prerequisites

1. The `develop` branch must be built:
   ```bash
   git checkout develop
   npm install
   npm run build
   git checkout benchmark-tests
   ```

2. Node.js >= 18

3. The `.mcp.json` points to the local source at `/Users/diegonogueira/mcp-graph-workflow`

## How to Execute

1. Open this project in Claude Code (the `.mcp.json` configures the MCP server)
2. Follow `NOTEBOOK.md` step by step
3. For each step:
   - Invoke the MCP tool with the specified input
   - Capture IDs from responses for use in subsequent steps
   - Paste actual output in the "Actual" field
   - Mark PASS/FAIL/SKIP based on assertions
4. Fill in `RESULTS.md` with the summary

## Scenarios

| # | Scenario | Tools Covered | Steps |
|---|----------|---------------|-------|
| 1 | Lifecycle Completo | init, import_prd, stats, list, next, context, update_status, plan_sprint | 10 |
| 2 | Graph CRUD | add_node, show, update_node, add_edge, list_edges, delete_edge, delete_node | 10 |
| 3 | Search & RAG | search, rag_context | 5 |
| 4 | Knowledge Pipeline | reindex_knowledge, search, rag_context | 3 |
| 5 | Planning | decompose, dependencies, velocity, plan_sprint | 8 |
| 6 | Snapshots | create_snapshot, list_snapshots, restore_snapshot, stats | 8 |
| 7 | Export | export_graph, export_mermaid | 4 |
| 8 | Bulk Operations | add_node, bulk_update_status, list | 5 |
| 9 | Clone & Move | clone_node, move_node, add_node, show | 8 |
| 10 | Validation | validate_task (SKIP if Playwright unavailable) | 2 |
| 11 | Stack Docs | sync_stack_docs (SKIP if Context7 unavailable) | 2 |

**Total: ~65 steps covering 31/31 tools (100%)**

## Notes

- Scenarios 10-11 depend on external MCP servers (Playwright, Context7) and are marked SKIP if unavailable
- The SQLite database is created in `cwd` — a `.graph-data/` directory will appear during execution
- Each full run starts fresh with `init` — delete `.graph-data/` between runs for clean state
