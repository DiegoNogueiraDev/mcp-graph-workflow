# Getting Started — mcp-graph

Step-by-step guide for new users. For API reference, see [MCP-TOOLS-REFERENCE.md](MCP-TOOLS-REFERENCE.md).

---

## 1. Installation

### Via MCP Server (recommended)

Requirements: Node.js >= 18.

#### GitHub Copilot (VS Code)

Create `.vscode/mcp.json` in your project root:

```json
{
  "servers": {
    "mcp-graph": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@diegonogueiradev_/mcp-graph"]
    }
  }
}
```

Then open **Copilot Chat** in Agent Mode (`@workspace` or Ctrl+Shift+I) — the 26 MCP tools will be available automatically.

#### Claude Code / Cursor / IntelliJ (JetBrains)

Add to `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "mcp-graph": {
      "command": "npx",
      "args": ["-y", "@diegonogueiradev_/mcp-graph"]
    }
  }
}
```

> **IntelliJ/JetBrains**: Go to Settings → Tools → AI Assistant → Model Context Protocol (MCP) and add the server. Uses the same `.mcp.json` format. Requires IntelliJ 2025.1+.

#### Windsurf / Zed / Other MCP Clients

Any MCP client that supports stdio transport can connect using:

```
npx -y @diegonogueiradev_/mcp-graph
```

Refer to your client's documentation for the exact config format.

### From Source (development)

```bash
git clone https://github.com/DiegoNogueiraDev/mcp-graph-workflow.git
cd mcp-graph-workflow
npm install
npm run build
npm run dev              # HTTP server + dashboard + GitNexus auto-analyze
npm run dev:stdio        # MCP Stdio server (no dashboard)
```

---

## 2. Your First Project (Tutorial)

### Step 1: Initialize

```
init { projectName: "my-project" }
```

Creates a SQLite database in `workflow-graph/` and generates AI configuration files (CLAUDE.md markers, copilot-instructions).

### Step 2: Prepare your PRD

Write a Markdown file with hierarchical structure:

```markdown
# My Product — Vision

## Non-Functional Requirements
- Performance: < 200ms response time
- Security: JWT authentication

## Epic 1: User Authentication
### Task 1.1: Login endpoint
- Accept email + password
- Return JWT token
- Acceptance Criteria: returns 200 with valid token

### Task 1.2: Registration endpoint
- Accept name + email + password
- Validate unique email
- Acceptance Criteria: returns 201 with user object
```

Supported formats: `.md`, `.txt`, `.pdf`, `.html`. See `sample-prd.txt` for a complete example.

### Step 3: Import PRD

```
import_prd { filePath: "./my-prd.md" }
```

The parser automatically classifies, extracts, and segments the content. It generates a hierarchy: PRD > Feature/Epic > Story > Task > Subtask, with automatic edges (`parent_of`, `depends_on`).

### Step 4: See what was generated

```
stats
```

Shows: total nodes, edges, nodes by type/status, compression ratio.

```
list { type: "task" }
```

Lists all tasks with ID, title, status, and priority.

### Step 5: Get next task

```
next
```

Returns the highest-priority task that is not blocked. Considers: priority, resolved dependencies, current sprint.

### Step 6: Get context for implementation

```
context { nodeId: "<ID>" }
```

Generates a compact payload with 70-85% fewer tokens. Includes: task details, dependencies, acceptance criteria, relevant knowledge.

### Step 7: Implement and update status

```
update_status { nodeId: "<ID>", status: "in_progress" }
```

*(implement the task...)*

```
update_status { nodeId: "<ID>", status: "done" }
```

### Step 8: Repeat

```
next → context → implement → update_status → next...
```

---

## 3. Web Dashboard

### Access

```bash
mcp-graph serve --port 3000   # or: npm run dev
```

Open `http://localhost:3000`.

### 5 Tabs

1. **Graph** — Interactive diagram (React Flow), filters, node table, detail panel
2. **PRD & Backlog** — Imported PRDs with progress tracking
3. **Code Graph** — GitNexus code dependency visualization
4. **Insights** — Bottleneck detection, velocity metrics, reports
5. **Benchmark** — Performance benchmark results

### Features

- Dark/light theme toggle
- Real-time updates via SSE (Server-Sent Events)
- Filters by type, status, sprint, priority

---

## 4. Common Workflows

### 4.1 Sprint Planning

```
plan_sprint { sprintName: "Sprint 1", capacityMinutes: 2400 }
```

Generates a report with recommended tasks, estimates, and risk assessment.

```
velocity
```

Velocity metrics: completed tasks, average time, burn rate.

### 4.2 Search and RAG

```
search { query: "authentication" }
```

Full-text search with BM25 ranking.

```
rag_context { query: "how to implement JWT", maxTokens: 2000 }
```

Semantic search with TF-IDF + token-budgeted context.

### 4.3 Decompose Large Tasks

```
decompose { nodeId: "<ID>" }
```

Detects tasks that are too large and suggests breakdown into subtasks.

### 4.4 Snapshots (Backup)

```
snapshot { action: "create", name: "before-refactor" }
snapshot { action: "list" }
snapshot { action: "restore", name: "before-refactor" }
```

### 4.5 Export Graph

```
export { format: "mermaid" }
```

Generates a Mermaid diagram (paste into GitHub, Notion, etc.).

```
export { format: "json" }
```

Full JSON export.

### 4.6 Knowledge Pipeline

```
sync_stack_docs
```

Auto-detects project stack and fetches docs via Context7.

```
reindex_knowledge
```

Rebuilds FTS5 indexes + TF-IDF embeddings.

---

## 5. Configuration

### Config file

Create `mcp-graph.config.json` in the project root:

```json
{
  "port": 3000,
  "dbPath": "workflow-graph",
  "integrations": {
    "gitnexusPort": 3737,
    "gitnexusAutoStart": true
  }
}
```

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_PORT` | `3000` | HTTP server port |
| `GITNEXUS_PORT` | `3737` | GitNexus port |
| `GITNEXUS_AUTO_START` | `true` | Auto-start GitNexus on serve |

---

## 6. Integrations (Quick Setup)

### Serena (Code Analysis)

Automatically configured via `.serena/`. Indexes code for RAG and symbol analysis.

### GitNexus (Git Intelligence)

Auto-detected on `serve` if `.git/` exists. Manual: `npx gitnexus analyze`.

### Context7 (Library Docs)

Activated automatically via `sync_stack_docs`. Fetches up-to-date docs for project libraries.

### Playwright (Browser Testing)

Requires installation: `npx playwright install`. Used by `validate_task` for visual validation.

---

## 7. FAQ / Troubleshooting

### "Dashboard won't load"

- Check if the server is running: `curl http://localhost:3000/health`
- Rebuild: `npm run build` and restart

### "import_prd doesn't generate tasks"

- Check PRD format: needs hierarchical headings (`##`, `###`)
- Each task needs a clear title after the heading

### "next returns null"

- All tasks may be completed or blocked
- Check: `list { status: "backlog" }` and `dependencies { nodeId: "<ID>" }`

### "GitNexus won't connect"

- Check: `npx gitnexus status`
- Re-index: `npx gitnexus analyze`

### "RAG returns empty results"

- Run: `reindex_knowledge` to rebuild indexes
- Check if knowledge entries exist: `search { query: "*" }`

### "MCP tools not appearing in my editor"

- **Copilot**: Ensure you're in Agent Mode (Ctrl+Shift+I or `@workspace`). Check `.vscode/mcp.json` syntax.
- **Claude Code**: Run `claude mcp list` to verify the server is registered. Check `.mcp.json` in project root.
- **Cursor**: Check `.mcp.json` in project root. Restart the editor after config changes.
- **IntelliJ**: Requires 2025.1+. Go to Settings → Tools → AI Assistant → MCP. Verify `.mcp.json` exists in project root.
- **General**: Run `npx -y @diegonogueiradev_/mcp-graph --help` to verify the package installs correctly. If it shows CLI help, the package is working — your MCP client should connect automatically via stdio.

---

## Next Steps

- Full 26-tool reference: [MCP-TOOLS-REFERENCE.md](MCP-TOOLS-REFERENCE.md)
- REST API: [REST-API-REFERENCE.md](REST-API-REFERENCE.md)
- Knowledge Pipeline: [KNOWLEDGE-PIPELINE.md](KNOWLEDGE-PIPELINE.md)
- Integrations: [INTEGRATIONS-GUIDE.md](INTEGRATIONS-GUIDE.md)
- Architecture: [ARCHITECTURE-GUIDE.md](ARCHITECTURE-GUIDE.md)
