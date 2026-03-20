# Getting Started — mcp-graph

Step-by-step guide for new users. For API reference, see [MCP-TOOLS-REFERENCE.md](MCP-TOOLS-REFERENCE.md).

---

## What is mcp-graph?

**mcp-graph** is a local-first CLI tool that converts PRD (Product Requirements Document) text files into persistent execution graphs stored in SQLite. It provides 30 MCP tools, a knowledge pipeline with RAG, and a web dashboard — enabling structured, token-efficient agentic workflows for AI-assisted development.

No cloud, no Docker, no external infra. Everything runs locally on your machine.

---

## Prerequisites

Before installing, make sure you have:

- **Node.js >= 18** — check with `node -v`
- **npm** (comes with Node.js) — check with `npm -v`
- **An editor with MCP support** — VS Code (Copilot), Claude Code, Cursor, IntelliJ 2025.1+, Windsurf, or Zed
- **Optional:** Playwright (`npx playwright install`) for browser validation features

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
      "args": ["-y", "@mcp-graph-workflow/mcp-graph"]
    }
  }
}
```

Then open **Copilot Chat** in Agent Mode (`@workspace` or Ctrl+Shift+I) — the 30 MCP tools will be available automatically.

#### Claude Code / Cursor / IntelliJ (JetBrains)

Add to `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "mcp-graph": {
      "command": "npx",
      "args": ["-y", "@mcp-graph-workflow/mcp-graph"]
    }
  }
}
```

> **IntelliJ/JetBrains**: Go to Settings → Tools → AI Assistant → Model Context Protocol (MCP) and add the server. Uses the same `.mcp.json` format. Requires IntelliJ 2025.1+.

#### Windsurf / Zed / Other MCP Clients

Any MCP client that supports stdio transport can connect using:

```
npx -y @mcp-graph-workflow/mcp-graph
```

Refer to your client's documentation for the exact config format.

### From Source (development)

```bash
git clone https://github.com/DiegoNogueiraDev/mcp-graph-workflow.git
cd mcp-graph-workflow
npm install
npm run build
npm run dev              # HTTP server + dashboard
npm run dev:stdio        # MCP Stdio server (no dashboard)
```

---

## 2. Your First Project (Tutorial)

### Step 1: Initialize

```
init { projectName: "my-project" }
```

Creates a SQLite database in `workflow-graph/` and generates AI configuration files (CLAUDE.md markers, copilot-instructions).

**Expected output:**
```
✅ Project "my-project" initialized
   Database: workflow-graph/graph.db
   AI config: CLAUDE.md markers generated
   Copilot: copilot-instructions.md updated
```

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

**Expected output:**
```
✅ PRD imported successfully
   Nodes created: 8 (1 epic, 2 features, 5 tasks)
   Edges created: 12 (parent_of, depends_on)
   Knowledge indexed: 8 entries
```

### Step 4: See what was generated

```
stats
```

Shows: total nodes, edges, nodes by type/status, compression ratio.

**Expected output:**
```
📊 Graph Statistics
   Nodes: 8 | Edges: 12
   By type: epic=1, task=5, requirement=2
   By status: backlog=8
   Knowledge entries: 8
```

```
list { type: "task" }
```

Lists all tasks with ID, title, status, and priority.

**Expected output:**
```
ID          Title                    Status   Priority
TASK-a1b2   Login endpoint           backlog  3
TASK-c3d4   Registration endpoint    backlog  3
...
```

### Step 5: Get next task

```
next
```

Returns the highest-priority task that is not blocked. Considers: priority, resolved dependencies, current sprint.

**Expected output:**
```
📋 Next recommended task:
   TASK-a1b2: "Login endpoint"
   Priority: 3 | Size: M | Coverage: 0.7
   TDD hints: "should return 200 with valid JWT token"
```

### Step 6: Get context for implementation

```
context { nodeId: "<ID>" }
```

Generates a compact payload with 70-85% fewer tokens. Includes: task details, dependencies, acceptance criteria, relevant knowledge.

**Expected output:**
```
📦 Context for TASK-a1b2 (compressed: 73% reduction)
   Task: Login endpoint
   AC: returns 200 with valid token
   Dependencies: none (ready to start)
   Knowledge: 2 relevant entries
   Tokens: 342 (original: 1,267)
```

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

> Para o guia completo do dashboard, veja **[DASHBOARD-GUIDE.md](DASHBOARD-GUIDE.md)**.

### 7 Tabs

1. **Graph** — Interactive diagram (React Flow), filters, node table, detail panel
2. **PRD & Backlog** — Imported PRDs with progress tracking
3. **Code Graph** — Code dependency visualization (native Code Intelligence)
4. **Memories** — Project knowledge and memories (native memory system)
5. **Insights** — Bottleneck detection, velocity metrics, reports
6. **Benchmark** — Context compression performance metrics
7. **Logs** — Real-time server logs with filtering

### Quick Dashboard Tour

| Tab | What you'll see |
|-----|----------------|
| **Graph** | Drag-and-zoom execution graph with status colors, click any node to see details and dependencies |
| **PRD & Backlog** | Hierarchical epic → task tree with progress bars and the next recommended task |
| **Code Graph** | Interactive symbol map of your codebase — functions, classes, and their relationships |
| **Memories** | File-tree explorer for project knowledge (architecture decisions, patterns, notes) |
| **Insights** | Health score, bottleneck detection, velocity trend charts, and actionable recommendations |
| **Benchmark** | Token compression metrics showing how much context budget mcp-graph saves per task |
| **Logs** | Live SSE-streamed server logs with level filtering (info/warn/error/debug) |

### Key Features

- **Open Folder** — Switch between project databases without restarting the server
- **Import PRD** — Upload .md, .txt, .pdf, .html files to generate the execution graph
- **Capture** — Extract web page content via Playwright
- **Multi-project** — Switch projects within the same DB or swap entire DBs
- **Real-time updates** via SSE (Server-Sent Events)
- **Filters** by type, status, sprint, priority
- **Dark/light theme** toggle

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
  "integrations": {}
}
```

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_PORT` | `3000` | HTTP server port |

---

## 6. Integrations (Quick Setup)

### Memories (Project Knowledge)

Native memory system for persistent project knowledge. Use `write_memory`, `read_memory`, `list_memories`, `delete_memory` MCP tools. Memories are stored in `workflow-graph/memories/` and auto-indexed into the knowledge store.

### Code Intelligence (Code Analysis)

Built-in code analysis via `src/core/code/`. No external process needed — code indexing and symbol analysis are native to mcp-graph.

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

### "RAG returns empty results"

- Run: `reindex_knowledge` to rebuild indexes
- Check if knowledge entries exist: `search { query: "*" }`

### "MCP tools not appearing in my editor"

- **Copilot**: Ensure you're in Agent Mode (Ctrl+Shift+I or `@workspace`). Check `.vscode/mcp.json` syntax.
- **Claude Code**: Run `claude mcp list` to verify the server is registered. Check `.mcp.json` in project root.
- **Cursor**: Check `.mcp.json` in project root. Restart the editor after config changes.
- **IntelliJ**: Requires 2025.1+. Go to Settings → Tools → AI Assistant → MCP. Verify `.mcp.json` exists in project root.
- **General**: Run `npx -y @mcp-graph-workflow/mcp-graph --help` to verify the package installs correctly. If it shows CLI help, the package is working — your MCP client should connect automatically via stdio.

---

## 8. Cheat Sheet

The 10 most-used commands at a glance:

| Command | What it does |
|---------|-------------|
| `init { projectName: "X" }` | Initialize a new project graph |
| `import_prd { filePath: "prd.md" }` | Import PRD → auto-generate nodes + edges |
| `next` | Get the next recommended task (priority + deps) |
| `context { nodeId: "ID" }` | Get compressed context for a task (70-85% fewer tokens) |
| `update_status { nodeId: "ID", status: "done" }` | Mark a task as completed |
| `search { query: "keyword" }` | Full-text search across the graph (BM25) |
| `plan_sprint { sprintName: "S1", capacityMinutes: 2400 }` | Generate sprint planning report |
| `write_memory { name: "note", content: "..." }` | Save project knowledge (auto-indexed) |
| `export { format: "mermaid" }` | Export graph as Mermaid diagram |
| `stats` | Show graph statistics (nodes, edges, status) |

---

## Next Steps

- **[User Guide](USER-GUIDE.md)** — Day-to-day workflows: sprint planning, knowledge pipeline, Code Graph, multi-project, and more
- **[Advanced Guide](ADVANCED-GUIDE.md)** — Lifecycle methodology, 25 analyze modes, RAG tuning, architecture, and extensibility
- Full 30-tool reference: [MCP-TOOLS-REFERENCE.md](MCP-TOOLS-REFERENCE.md)
- REST API: [REST-API-REFERENCE.md](REST-API-REFERENCE.md)
- Knowledge Pipeline: [KNOWLEDGE-PIPELINE.md](KNOWLEDGE-PIPELINE.md)
- Integrations: [INTEGRATIONS-GUIDE.md](INTEGRATIONS-GUIDE.md)
- Architecture: [ARCHITECTURE-GUIDE.md](ARCHITECTURE-GUIDE.md)
- Dashboard: [DASHBOARD-GUIDE.md](DASHBOARD-GUIDE.md)
