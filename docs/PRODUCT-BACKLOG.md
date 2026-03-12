# Product Backlog — mcp-graph-workflow

> **Strategic direction**: Move the project from "technically impressive tool" to "inevitable tool in the developer workflow". Three fronts: **adoption**, **reliability**, **differentiation**.

> **Last updated**: 2026-03-12

---

## Table of Contents

- [Labels](#labels)
- [Milestones](#milestones)
- [Epic 1 — Onboarding & Activation](#epic-1--onboarding--activation)
- [Epic 2 — Planning Intelligence](#epic-2--planning-intelligence)
- [Epic 3 — Dashboard UX](#epic-3--dashboard-ux)
- [Epic 4 — Sync & Execution](#epic-4--sync--execution)
- [Epic 5 — Continuous PRD Evolution](#epic-5--continuous-prd-evolution)
- [P2 — Distribution & Growth](#p2--distribution--growth)
- [P2 — Governance & Enterprise-Readiness](#p2--governance--enterprise-readiness)

---

## Labels

| Label | Color | Description |
|-------|-------|-------------|
| `priority/P0` | `#b60205` | Critical — increases adoption immediately |
| `priority/P1` | `#d93f0b` | High — product UX and ecosystem |
| `priority/P2` | `#fbca04` | Medium — distribution and enterprise |
| `sprint/1` | `#0e8a16` | Sprint 1 — Activation & Trust foundations |
| `sprint/2` | `#006b75` | Sprint 2 — Exports, quality, dashboard ops |
| `sprint/3` | `#1d76db` | Sprint 3 — PRD evolution, context, simulation |
| `sprint/4` | `#5319e7` | Sprint 4 — Binaries, git, timeline, policy |
| `epic/onboarding` | `#c5def5` | Epic: Onboarding & Activation |
| `epic/planning-intelligence` | `#d4c5f9` | Epic: Planning Intelligence |
| `epic/dashboard-ux` | `#bfdadc` | Epic: Dashboard UX |
| `epic/sync-execution` | `#f9d0c4` | Epic: Sync & Execution |
| `epic/prd-evolution` | `#fef2c0` | Epic: Continuous PRD Evolution |
| `type/feature` | `#a2eeef` | New feature |
| `type/enhancement` | `#7057ff` | Enhancement to existing feature |
| `type/infrastructure` | `#e4e669` | Infrastructure / tooling |

---

## Milestones

### Milestone 1 — Activation (Sprint 1)
- Issue 1: `doctor` environment diagnostics
- Issue 2: `bootstrap` guided setup
- Issue 4: Explainable `next` with decision trace
- Issue 5: Confidence scoring in import pipeline

### Milestone 2 — Trust (Sprint 2)
- Issue 3: Quickstart import mode
- Issue 6: Duplicate/conflict detection
- Issue 9: Backlog health score
- Issue 11: Export formats (Markdown, CSV, GitHub Issues)

### Milestone 3 — Execution (Sprint 3)
- Issue 13: Incremental PRD re-import
- Issue 7: Sprint simulation engine
- Issue 18: Context per persona/agent
- Issue 19: Knowledge freshness/staleness

### Milestone 4 — Integration (Sprint 4)
- Issue 20: Standalone binaries
- Issue 14: Git local integration
- Issue 10: Timeline + audit trail
- Issue 24: Policy engine

---

## Epic 1 — Onboarding & Activation

### Issue 1 — Add `mcp-graph doctor` environment diagnostics

| Field | Value |
|-------|-------|
| **Title** | `feat: add doctor command for environment diagnostics` |
| **Labels** | `priority/P0`, `sprint/1`, `epic/onboarding`, `type/feature` |
| **Sprint** | 1 |

#### Context

The project depends on Node.js ≥18, SQLite persistence, dashboard build assets, Playwright availability, MCP config (`.mcp.json`), and optional integrations (Serena, GitNexus, Context7). A broken setup kills adoption early. Today there is no single command to validate readiness.

#### Current state

- `stats` command (`src/cli/commands/stats.ts`) shows graph statistics but does not verify environment health
- `init` command creates project structure but does not validate prerequisites
- No verification of integration availability

#### Acceptance Criteria

- [ ] Command `mcp-graph doctor` validates: Node.js version, write permissions, SQLite database, dashboard build, Playwright availability, `.mcp.json`, integration status
- [ ] Human-readable output with `✓`/`✗` per check
- [ ] `--json` flag for structured output
- [ ] Suggests automatic corrections for common problems
- [ ] Exits 0 when all critical checks pass, non-zero otherwise
- [ ] Output separates `ok`, `warning`, and `error` levels
- [ ] Unit tests for each checker
- [ ] Documented in README and Getting Started

#### Technical Notes

- Create `src/core/diagnostics/` with per-subsystem checkers: `node-check.ts`, `fs-check.ts`, `sqlite-check.ts`, `dashboard-check.ts`, `playwright-check.ts`, `mcp-config-check.ts`, `integration-check.ts`
- CLI command in `src/cli/commands/doctor.ts` (thin orchestration, per `cli.md` rules)
- Follow existing `stats.ts` pattern for output formatting

#### Test Plan

- Unit tests for each checker (success + failure paths)
- CLI integration test for aggregate report
- Snapshot tests for JSON output shape
- Simulate missing files/tools using temp dirs

---

### Issue 2 — Add guided `bootstrap` command for first-run setup

| Field | Value |
|-------|-------|
| **Title** | `feat: add bootstrap command for guided project setup` |
| **Labels** | `priority/P0`, `sprint/1`, `epic/onboarding`, `type/feature` |
| **Sprint** | 1 |

#### Context

The current command set is powerful, but first-time users must understand multiple steps: init → import PRD → index knowledge → inspect graph → start dashboard. This increases time-to-value.

#### Current state

- `init` command (`src/cli/commands/init.ts`, `src/mcp/init-project.ts`) creates project, `.mcp.json`, `.vscode/mcp.json`, installs MCP deps, generates `CLAUDE.md`
- No guided flow that chains commands together
- No stack detection + import + sprint suggestion in one step

#### Acceptance Criteria

- [ ] Interactive mode: wizard with prompts for project name, PRD path, stack, dashboard auto-start
- [ ] Non-interactive mode: `mcp-graph bootstrap --prd PRD.md --non-interactive`
- [ ] Sequence: init → validate env → detect stack → import PRD → build indexes → suggest first sprint → optionally launch dashboard
- [ ] Final output shows "next recommended commands"
- [ ] Works with minimal text PRD (graceful degradation)
- [ ] Failure messages are recoverable and clear
- [ ] Documented in README

#### Technical Notes

- Reuse existing core services (do not shell out to CLI commands internally)
- Orchestrate through `src/core/` functions
- Support default values for smooth demo path ("demo in 2 minutes")

#### Test Plan

- Integration test for happy path
- Tests for missing PRD, invalid project dir, failed import
- Snapshot tests for bootstrap summary output

---

### Issue 3 — Add quickstart import mode for small PRDs

| Field | Value |
|-------|-------|
| **Title** | `feat: add quickstart import mode for lightweight PRDs` |
| **Labels** | `priority/P0`, `sprint/2`, `epic/onboarding`, `type/feature` |
| **Sprint** | 2 |

#### Context

Users evaluating the project often have small, messy, or lightweight PRDs. They need fast value without learning the full graph model first.

#### Current state

- Import command (`src/cli/commands/import-cmd.ts`) supports `.md`, `.txt`, `.pdf`, `.html`
- Parser pipeline: `readFileContent()` → `extractEntities()` → `convertToGraph()` → `bulkInsert()`
- Confidence scoring exists in `src/core/parser/classify.ts` (0.3–0.9 range)
- No "aggressive inference" mode for minimal documents

#### Acceptance Criteria

- [ ] `mcp-graph import ./prd.md --quickstart` flag
- [ ] Aggressive epic/task hierarchy inference from structure
- [ ] Sensible default priorities assigned
- [ ] Minimal acceptance criteria generated when missing
- [ ] Simple dependency heuristics applied
- [ ] Low-confidence items marked with `needsReview: true`
- [ ] Does not overwrite explicit fields already present in PRD
- [ ] Works for `.md` and `.txt` inputs

#### Technical Notes

- Extend `src/core/importer/prd-to-graph.ts` with quickstart strategy
- Leverage existing confidence scores from `classify.ts`
- Use `metadata.inferred = true` for all heuristic fields

#### Test Plan

- Parser tests using compact PRD fixtures (< 20 lines)
- Comparison tests between standard and quickstart modes
- Regression tests for over-fragmentation and bad dependency inference

---

## Epic 2 — Planning Intelligence

### Issue 4 — Add decision trace and explainability to `next`

| Field | Value |
|-------|-------|
| **Title** | `feat: add decision trace to next task recommendation` |
| **Labels** | `priority/P0`, `sprint/1`, `epic/planning-intelligence`, `type/enhancement` |
| **Sprint** | 1 |

#### Context

The `next` feature is central to product trust. Users need to understand **why** a task was chosen and **why others were not**.

#### Current state

- `next-task.ts` returns `NextTaskResult` with `node` + `reason` string (e.g., "desbloqueada, alta prioridade, baixa complexidade")
- `enhanced-next.ts` adds `knowledgeCoverage` (0–1) and `velocityContext`
- Algorithm: filter eligible → check dependencies → topological rank → multi-factor sort
- Logging includes reasoning at each step, but not exposed to API/MCP consumers
- **Gap**: no structured `decision_trace`, no rejected candidates, no top-N alternatives

#### Acceptance Criteria

- [ ] Response includes structured `decisionTrace` object with: `selectedBecause` (array of reasons), `rejectedCandidates` (taskId + reason), `alternatives` (top 5 candidates)
- [ ] Blocked tasks include exact blocking dependency IDs
- [ ] Available via MCP tool, REST API, and CLI
- [ ] CLI supports `next --verbose` for detailed trace
- [ ] Result is deterministic for the same graph state
- [ ] Tests verify reasoning output, not just selected task

#### Technical Notes

- Extend `NextTaskResult` and `EnhancedNextResult` types in `src/core/planner/`
- Refactor internal ranking to collect trace as it runs (already logs, just needs to accumulate)
- Add `verbose` parameter to MCP `next` tool and REST endpoint
- Dashboard: add "Why this task?" tooltip/panel

#### Test Plan

- Unit tests for ranking/exclusion reasons
- Integration tests with mixed eligibility graphs (some blocked, some ready)
- Regression tests for stable ordering
- Verify trace matches actual selection logic

---

### Issue 5 — Expose confidence scoring in import pipeline and dashboard

| Field | Value |
|-------|-------|
| **Title** | `feat: expose confidence scoring with review queue` |
| **Labels** | `priority/P0`, `sprint/1`, `epic/planning-intelligence`, `type/enhancement` |
| **Sprint** | 1 |

#### Context

Confidence scoring already exists internally but is not fully surfaced to users.

#### Current state

- `classify.ts` assigns confidence 0.3–0.9 per `ClassifiedBlock` and `ClassifiedItem`
- `GraphNode.sourceRef.confidence` persists the score
- `GraphNode.metadata.inferred` is true when confidence < 0.7
- `GraphEdge.metadata.confidence` scores inferred edges
- **Gap**: no dashboard UI for reviewing low-confidence items, no `--strict` import mode, no dedicated API filter

#### Acceptance Criteria

- [ ] `mcp-graph import --strict` rejects items below configurable confidence threshold
- [ ] REST API filter: `GET /api/nodes?maxConfidence=0.7` returns items needing review
- [ ] MCP `list` tool supports `confidenceBelow` filter
- [ ] Dashboard "Review Queue" panel shows low-confidence items with classification reason
- [ ] Each item shows: confidence score, classification reason, source segment
- [ ] User can approve/override classification from review queue
- [ ] Documentation explains confidence semantics and score ranges

#### Technical Notes

- Extend `src/core/parser/classify.ts` to include `classificationReason` string per item
- Add `confidence` filter to `src/core/store/sqlite-store.ts` query methods
- Dashboard component in `src/web/dashboard/src/components/`
- API route in `src/api/routes/`

#### Test Plan

- Unit tests for score calculation edge cases
- Parser fixture coverage across `.md`, `.txt`, `.pdf`, `.html`
- Dashboard filter/render tests
- `--strict` mode rejection tests

---

### Issue 6 — Detect duplicate tasks and conflicting requirements

| Field | Value |
|-------|-------|
| **Title** | `feat: detect duplicate tasks and conflicting requirements during import` |
| **Labels** | `priority/P1`, `sprint/2`, `epic/planning-intelligence`, `type/feature` |
| **Sprint** | 2 |

#### Context

Real PRDs often contain repeated requirements, similar user stories, or conflicting acceptance criteria. This degrades graph quality and planning reliability.

#### Current state

- `store.hasImport(sourceFileName)` checks if file was imported, but not content-level duplicates
- FTS5 search exists (`src/core/search/fts-search.ts`) with BM25 ranking
- TF-IDF vectorization in `src/core/search/tfidf.ts`
- RAG pipeline has cosine similarity (`src/core/rag/rag-pipeline.ts`)
- **Gap**: no duplicate detection within or across imports, no conflict analysis

#### Acceptance Criteria

- [ ] During import, flag near-duplicate tasks with similarity score
- [ ] Detect conflicting acceptance criteria across related tasks
- [ ] Suggest merge candidates (do not auto-merge by default)
- [ ] Warn on contradictory dependencies or circular references
- [ ] Warnings appear in CLI output, API response, and dashboard
- [ ] Configurable similarity threshold

#### Technical Notes

- Leverage existing TF-IDF/cosine similarity for title/description comparison
- Use FTS5 BM25 for fast candidate retrieval before detailed comparison
- Create `src/core/quality/duplicate-detector.ts` and `conflict-analyzer.ts`
- Integrate into import pipeline as post-processing step

#### Test Plan

- Semantic duplicate fixture cases (same intent, different wording)
- Contradictory AC fixture cases
- No false positive regressions for similar but distinct tasks
- Performance tests with large graphs (500+ nodes)

---

### Issue 7 — Add sprint simulation engine

| Field | Value |
|-------|-------|
| **Title** | `feat: add sprint simulation and what-if planning` |
| **Labels** | `priority/P1`, `sprint/3`, `epic/planning-intelligence`, `type/feature` |
| **Sprint** | 3 |

#### Context

Current planning can estimate velocity and sprint capacity, but users also need scenario analysis before committing a sprint plan.

#### Current state

- `planning-report.ts` already simulates execution order (iterative `findNextTask` loop)
- `velocity.ts` tracks tasks/sprint, XP points, completion hours
- `decompose.ts` breaks tasks into subtasks
- `dependency-chain.ts` resolves dependency ordering
- **Gap**: no what-if scenarios, no parameter modification, no side-by-side comparison

#### Acceptance Criteria

- [ ] MCP tool and API endpoint accept scenario parameters: capacity change (%), removed blockers, moved tasks, delayed dependencies
- [ ] Output includes: projected completed tasks, carry-over, risk delta vs baseline
- [ ] Simulation is pure (does not mutate graph state)
- [ ] Results are reproducible for identical inputs
- [ ] Dashboard can visualize baseline vs scenario comparison
- [ ] Supports at least 3 scenario types: capacity change, blocker removal, task deferral

#### Technical Notes

- Create `src/core/planner/sprint-simulator.ts`
- Reuse `findNextTask` with cloned/modified graph state
- Compare against baseline from `planning-report.ts`

#### Test Plan

- Deterministic simulation fixtures
- Edge cases: fully blocked graphs, overloaded sprints, empty graphs
- Compare baseline vs modified scenario outputs
- Performance: simulate 10 scenarios in < 2 seconds

---

## Epic 3 — Dashboard UX

### Issue 8 — Enable inline graph editing in dashboard

| Field | Value |
|-------|-------|
| **Title** | `feat: enable inline node editing and relationship management in dashboard` |
| **Labels** | `priority/P1`, `sprint/2`, `epic/dashboard-ux`, `type/feature` |
| **Sprint** | 2 |

#### Context

The dashboard visualizes graph and backlog state, but users need operational editing capabilities to avoid switching between CLI/API and dashboard.

#### Current state

- React Flow with Dagre auto-layout, direction toggle (TB/LR)
- Node selection + read-only detail panel (ID, type, status, priority, description, relationships)
- Edge creation dialog exists (pendingConnection state)
- `useNodesState` enables drag
- REST API supports full CRUD (`POST /api/nodes`, `PUT /api/nodes/:id`, etc.)
- **Gap**: no inline title/description edits, no status/priority dropdowns, no edge deletion from UI, no undo/redo

#### Acceptance Criteria

- [ ] Inline node title and description editing (double-click or edit button)
- [ ] Status and priority dropdowns in detail panel
- [ ] Add/remove dependencies from UI
- [ ] Create new nodes from canvas or backlog view
- [ ] Delete nodes with confirmation
- [ ] Edits persist immediately via REST API
- [ ] Optimistic UI updates with rollback on error
- [ ] Keyboard-friendly editing flow
- [ ] Undo/redo for last 20 operations

#### Technical Notes

- Extend existing `workflow-graph.tsx` components
- Use existing REST API endpoints (no new backend work needed for basic CRUD)
- Undo/redo: maintain operation stack in React state or zustand store
- Consider `react-hotkeys-hook` for keyboard shortcuts

#### Test Plan

- Component tests for edit forms
- API integration tests for persistence
- E2E Playwright tests for edit workflows
- Undo/redo state management tests

---

### Issue 9 — Add backlog health score and warnings panel

| Field | Value |
|-------|-------|
| **Title** | `feat: add backlog health score with actionable warnings` |
| **Labels** | `priority/P1`, `sprint/2`, `epic/dashboard-ux`, `type/feature` |
| **Sprint** | 2 |

#### Context

Users need a fast way to assess whether a graph is execution-ready or structurally weak.

#### Current state

- `bottleneck-detector.ts` identifies bottlenecks
- `metrics-calculator.ts` computes graph metrics
- `skill-recommender.ts` suggests improvements
- Insights tab exists in dashboard
- **Gap**: no single composite health score, no actionable drill-down

#### Acceptance Criteria

- [ ] Composite health score (0–100) based on weighted factors
- [ ] Factors: tasks without AC, oversized tasks (XL), blocked critical paths, circular dependencies, priority inconsistency, low-confidence imports, stale knowledge coverage
- [ ] Warning list links directly to affected nodes
- [ ] Score recalculates after graph mutations (SSE-driven updates)
- [ ] Clear explanation of each penalty factor and weight
- [ ] Health score visible in dashboard Insights tab and stats API
- [ ] Score changes tracked over time (health trend)

#### Technical Notes

- Create `src/core/insights/health-score.ts`
- Leverage existing `bottleneck-detector.ts` and `metrics-calculator.ts`
- Add REST endpoint: `GET /api/insights/health`
- Dashboard component in Insights tab

#### Test Plan

- Unit tests for metric weighting with various graph shapes
- Integration tests with mixed graph states (healthy, unhealthy, mixed)
- UI tests for drill-down interaction
- Regression tests for score stability

---

### Issue 10 — Add project timeline and audit trail

| Field | Value |
|-------|-------|
| **Title** | `feat: add project timeline with status transitions and audit trail` |
| **Labels** | `priority/P1`, `sprint/4`, `epic/dashboard-ux`, `type/feature` |
| **Sprint** | 4 |

#### Context

Project history enables auditing, debugging, and progress narrative. The infrastructure exists but is not surfaced.

#### Current state

- `GraphEventBus` emits events for all operations (`src/core/events/`)
- Snapshots stored in SQLite (`createSnapshot`, `listSnapshots`, `restoreSnapshot`)
- SSE streaming exists for real-time updates
- `import_history` table tracks imports
- **Gap**: no event persistence, no timeline UI, no diff between snapshots

#### Acceptance Criteria

- [ ] Status transitions logged per node (timestamp, from, to, actor)
- [ ] Timeline view in dashboard showing events chronologically
- [ ] Snapshot comparison: diff two snapshots to see what changed
- [ ] Filter by node, type, sprint, time range
- [ ] Sprint-level progress summary
- [ ] Export timeline as JSON or Markdown

#### Technical Notes

- Add `events` table to SQLite schema (migration v3)
- Subscribe `GraphEventBus` to persist events
- Create `src/core/events/event-store.ts`
- Dashboard: new Timeline tab or section in Insights
- Snapshot diff: compare two `GraphDocument` JSON objects

#### Test Plan

- Event persistence tests
- Timeline query tests (filters, pagination)
- Snapshot diff correctness tests
- Dashboard rendering tests

---

### Issue 11 — Add focus execution mode

| Field | Value |
|-------|-------|
| **Title** | `feat: add focus execution mode for single-task delivery` |
| **Labels** | `priority/P1`, `sprint/3`, `epic/dashboard-ux`, `type/feature` |
| **Sprint** | 3 |

#### Context

The product promise is not just planning, but execution guidance. Users need a distraction-free mode centered on the current task — the "pair programming with operational memory" experience.

#### Current state

- `next` recommends the next task
- Tiered context (`tiered-context.ts`): summary (~20 tokens), standard (~150 tokens), deep (~500+ tokens)
- Context assembler builds multi-source context with token budgeting
- RAG pipeline provides relevant knowledge
- **Gap**: no dedicated focused UI, no execution checklist, no in-context validation

#### Acceptance Criteria

- [ ] Dedicated view showing: current task, compact context, acceptance criteria, dependencies/blockers, execution checklist, validation entry point
- [ ] Works with `next` recommendation (auto-loads recommended task)
- [ ] Context tier toggle (summary/standard/deep)
- [ ] Reflects real-time status changes via SSE
- [ ] Switch between focus mode and graph mode
- [ ] Mark AC items as done from focus view
- [ ] "Complete task" action with validation gate

#### Technical Notes

- Dashboard component: `src/web/dashboard/src/components/focus/`
- Reuse `tiered-context.ts` and `context-assembler.ts` for context rendering
- Use existing `validate-task` MCP tool for completion validation

#### Test Plan

- Component tests for task display and switching
- E2E: from `next` → focus mode → mark AC → complete task
- Context tier toggle tests
- SSE update handling tests

---

## Epic 4 — Sync & Execution

### Issue 12 — Add multi-format export (Markdown, CSV, GitHub Issues)

| Field | Value |
|-------|-------|
| **Title** | `feat: add Markdown, CSV, and GitHub Issues export formats` |
| **Labels** | `priority/P1`, `sprint/2`, `epic/sync-execution`, `type/feature` |
| **Sprint** | 2 |

#### Context

Currently only JSON and Mermaid exports are supported. Teams need formats that plug into real workflows.

#### Current state

- `export` MCP tool supports `action: "json" | "mermaid"`
- Mermaid: flowchart or mindmap, with status/type filters, direction toggle
- `src/core/graph/mermaid-export.ts` generates Mermaid syntax
- REST: `GET /api/graph/` (JSON), `GET /api/graph/mermaid`
- **Gap**: no Markdown backlog, no CSV, no GitHub Issues payload, no sprint report HTML

#### Acceptance Criteria

- [ ] `export` MCP tool supports: `"markdown"`, `"csv"`, `"github-issues"`, `"sprint-report"`
- [ ] Markdown: structured backlog with epics → tasks → subtasks, status badges, AC checklists
- [ ] CSV: flat table with columns: id, title, type, status, priority, sprint, dependencies, tags
- [ ] GitHub Issues: JSON array of `{title, body, labels, milestone}` ready for `gh issue create`
- [ ] Sprint report: HTML summary with progress, velocity, blockers, risks
- [ ] All formats support the same status/type filters as existing exports
- [ ] REST endpoints for each format
- [ ] Stable JSON schema for GitHub Issues format (documented)

#### Technical Notes

- Create `src/core/graph/export/` directory with per-format exporters
- Extend `export` MCP tool action enum
- Add REST routes in `src/api/routes/`
- Reuse existing filter logic from `mermaid-export.ts`

#### Test Plan

- Snapshot tests for each format output
- Round-trip tests: export → import (where applicable)
- Filter tests across formats
- Large graph performance tests

---

### Issue 13 — Export/import GitHub Issues sync mapping

| Field | Value |
|-------|-------|
| **Title** | `feat: add bidirectional GitHub Issues sync mapping` |
| **Labels** | `priority/P1`, `sprint/3`, `epic/sync-execution`, `type/feature` |
| **Sprint** | 3 |

#### Context

Many teams already track work in GitHub Issues. Without an easy bridge, the graph risks staying isolated from daily execution.

#### Acceptance Criteria

- [ ] Graph nodes can export to GitHub-compatible issue payloads
- [ ] Import can attach existing issue metadata (URL, number, state) to nodes
- [ ] Bidirectional mapping: node type → label, priority → label, status ↔ issue state
- [ ] Backlinks between issue URL and node ID stored in `metadata`
- [ ] Sync is explicit and reviewable, not destructive by default
- [ ] Conflict resolution strategy when local and remote diverge
- [ ] Documentation explains mapping conventions

#### Technical Notes

- Create `src/core/integrations/github-sync.ts`
- Use `@octokit/rest` or raw fetch (keep deps minimal)
- Store mapping in `metadata.github` on nodes
- CLI command: `mcp-graph sync github --repo owner/repo`

#### Test Plan

- Serialization tests for issue payloads
- Round-trip mapping tests (export → import → compare)
- Conflict handling tests for divergent status
- Mock GitHub API for integration tests

---

### Issue 14 — Link local git branches and commits to tasks

| Field | Value |
|-------|-------|
| **Title** | `feat: link local git activity to workflow nodes` |
| **Labels** | `priority/P1`, `sprint/4`, `epic/sync-execution`, `type/feature` |
| **Sprint** | 4 |

#### Context

Planning becomes much more valuable when it reflects actual implementation activity. Linking git activity to task nodes closes the loop between planning and execution.

#### Current state

- GitNexus integration exists for code graph analysis
- `isGitRepo()` detection available
- **Gap**: no branch name suggestion, no commit association, no PR linking, no auto-status-update

#### Acceptance Criteria

- [ ] Suggest branch names from task IDs (e.g., `feat/task-abc123-add-auth`)
- [ ] Associate commits to nodes (by convention: commit message contains task ID)
- [ ] Detect active branches per task
- [ ] Surface branch/commit metadata in dashboard node detail
- [ ] `mcp-graph git link <task-id> <branch>` CLI command
- [ ] Mark task as "in_progress" when branch is created (optional)
- [ ] Feature remains optional and local-first (no remote API required)

#### Technical Notes

- Create `src/core/integrations/git-local.ts`
- Use `child_process.execFile('git', ...)` for git commands
- Store branch/commit links in `metadata.git` on nodes
- Dashboard: show git info in node detail panel

#### Test Plan

- Temp git repo integration tests
- Branch detection and naming tests
- Commit association heuristic tests
- No-git-repo graceful degradation tests

---

### Issue 15 — Add integration tier levels (core / core+docs / full mesh)

| Field | Value |
|-------|-------|
| **Title** | `feat: add integration tier levels for reduced cognitive complexity` |
| **Labels** | `priority/P1`, `sprint/4`, `epic/sync-execution`, `type/enhancement` |
| **Sprint** | 4 |

#### Context

The integration mesh (Serena, GitNexus, Context7, Playwright) is powerful but can overwhelm new users.

#### Current state

- `IntegrationOrchestrator` manages all 4 integrations
- `mcp-servers-config.ts` configures all MCP servers
- `mcp-deps-installer.ts` installs all deps at once
- **Gap**: no way to select a subset, no tier concept

#### Acceptance Criteria

- [ ] Three tiers: `core` (graph only), `core+docs` (+ Context7 + knowledge), `full` (all integrations)
- [ ] Selectable during `init` or `bootstrap`
- [ ] `.mcp.json` only includes servers for selected tier
- [ ] Tier can be upgraded later without re-init
- [ ] Documentation explains what each tier includes and when to upgrade

#### Technical Notes

- Modify `src/mcp/init-project.ts` to accept tier parameter
- Conditional server inclusion in `.mcp.json` generation
- Add `tier` field to project config in SQLite

#### Test Plan

- Init tests for each tier level
- Upgrade path tests (core → full)
- Verify only selected servers appear in config

---

## Epic 5 — Continuous PRD Evolution

### Issue 16 — Add incremental PRD re-import with change detection

| Field | Value |
|-------|-------|
| **Title** | `feat: add incremental PRD re-import with diff awareness` |
| **Labels** | `priority/P0`, `sprint/3`, `epic/prd-evolution`, `type/feature` |
| **Sprint** | 3 |

#### Context

PRDs evolve. Full re-import risks breaking IDs, losing manual refinements, and creating duplicated graph state. This is one of the highest-leverage features because it turns the tool from a one-shot importer into a living workflow engine.

#### Current state

- `store.hasImport(sourceFileName)` detects previous imports
- `force=true` deletes all old nodes and re-imports from scratch
- `import_history` table tracks source file, counts, timestamp
- `sourceRef` on nodes links back to source file
- **Gap**: no diff between PRD versions, no selective update, no preservation of manual edits

#### Acceptance Criteria

- [ ] Diff new PRD against previously imported structure
- [ ] Update only impacted nodes (added, removed, changed)
- [ ] Preserve user-edited metadata (status, priority, manual AC) unless explicitly overridden
- [ ] Mark added/removed/changed items visibly in output
- [ ] Unchanged nodes keep stable identity (same IDs)
- [ ] Show "what changed" summary before applying destructive changes
- [ ] `--dry-run` flag to preview changes without applying
- [ ] Works with snapshots/history (snapshot before re-import)
- [ ] Dashboard can display "what changed" panel

#### Technical Notes

- Create `src/core/importer/incremental-import.ts`
- Content fingerprint per node (hash of title + description) for change detection
- Store fingerprints in `metadata.contentHash`
- Diff algorithm: match by fingerprint → detect adds/removes/changes
- Preserve manual overrides by checking if field was modified after import

#### Test Plan

- Import v1 → import v2 fixture tests
- Identity preservation tests (IDs stable for unchanged nodes)
- Conflict cases when user edits collide with PRD changes
- Snapshot restore compatibility tests
- Dry-run accuracy tests

---

### Issue 17 — Add PRD template detection and specialized parsing

| Field | Value |
|-------|-------|
| **Title** | `feat: add PRD template detection with specialized parsing strategies` |
| **Labels** | `priority/P1`, `sprint/3`, `epic/prd-evolution`, `type/feature` |
| **Sprint** | 3 |

#### Context

Not all PRDs share the same structure. Generic heuristics miss signal when the document follows known formats.

#### Current state

- Parser pipeline: `read-file.ts` → `segment.ts` → `classify.ts` → `extract.ts` → `normalize.ts`
- Bilingual keyword patterns (PT + EN)
- Single generic parsing strategy
- **Gap**: no template detection, no format-specific parsers

#### Acceptance Criteria

- [ ] Detect common templates: Lean PRD, RFC/spec, user stories, roadmap/milestone, technical spec
- [ ] Apply format-specific extraction rules per detected template
- [ ] Fall back safely to generic parser when no template matches
- [ ] Template detection confidence score
- [ ] Specialized parsers improve extraction quality on supported formats
- [ ] Documentation describes supported templates and how to add new ones

#### Technical Notes

- Create `src/core/parser/templates/` with per-template parsers
- Template detector in `src/core/parser/template-detector.ts`
- Strategy pattern: detector selects parser, falls back to generic

#### Test Plan

- Fixture suite per template format
- Fallback regression tests
- Quality comparison: template-specific vs generic parser on same input
- False positive template detection tests

---

### Issue 18 — Add context per persona/agent

| Field | Value |
|-------|-------|
| **Title** | `feat: add persona-specific context assembly` |
| **Labels** | `priority/P1`, `sprint/3`, `epic/prd-evolution`, `type/enhancement` |
| **Sprint** | 3 |

#### Context

Different roles need different context views. A developer needs code references; a reviewer needs acceptance criteria; a PM needs progress and risks.

#### Current state

- Tiered context: summary (~20 tokens), standard (~150 tokens), deep (~500+ tokens)
- Context assembler: 60% graph, 30% knowledge, 10% headers
- RAG pipeline for knowledge retrieval
- Token budgeting per section
- **Gap**: context is query/node-centric, not role-centric

#### Acceptance Criteria

- [ ] Persona presets: `dev`, `reviewer`, `qa`, `product`, `ai-agent`
- [ ] Each persona has different: token budget, section weights, included fields, formatting
- [ ] `ai-agent` persona optimized for Claude/Copilot/Cursor prompt format
- [ ] `dev` persona emphasizes: code context, dependencies, technical notes
- [ ] `reviewer` persona emphasizes: AC, test coverage, risk
- [ ] `qa` persona emphasizes: AC, edge cases, validation steps
- [ ] `product` persona emphasizes: progress, blockers, sprint metrics
- [ ] Selectable via MCP tool, API, and CLI parameter
- [ ] Backward compatible: default persona = current behavior

#### Technical Notes

- Create `src/core/context/personas/` with preset configs
- Extend `context-assembler.ts` to accept persona parameter
- Persona configs define: weights, included sections, token budgets, formatting rules

#### Test Plan

- Unit tests for each persona configuration
- Token budget compliance tests
- Output comparison tests across personas for same node
- Backward compatibility test (no persona = current behavior)

---

### Issue 19 — Add knowledge freshness and staleness tracking

| Field | Value |
|-------|-------|
| **Title** | `feat: add knowledge freshness scoring and stale content detection` |
| **Labels** | `priority/P1`, `sprint/3`, `epic/prd-evolution`, `type/feature` |
| **Sprint** | 3 |

#### Context

Good context is not just small — it's current. Using outdated documentation leads to wrong decisions.

#### Current state

- `KnowledgeStore` tracks `sourceType` (upload, serena, code_context, docs, web_capture)
- Embeddings stored in `embedding_store.ts`
- RAG pipeline retrieves by similarity
- **Gap**: no last-update timestamps, no freshness score, no staleness alerts, no selective invalidation

#### Acceptance Criteria

- [ ] Each knowledge document has `lastUpdated` and `freshnessScore` (0–1, decays over time)
- [ ] Configurable decay curve (e.g., linear, exponential, step)
- [ ] Stale chunks flagged when context is assembled
- [ ] Alert when context uses documents older than threshold
- [ ] Selective embedding invalidation (re-index only stale docs)
- [ ] `mcp-graph index --refresh-stale` command
- [ ] Dashboard indicator for knowledge freshness

#### Technical Notes

- Add `updated_at` column to knowledge store (migration)
- Create `src/core/rag/freshness-scorer.ts`
- Integrate into `context-assembler.ts` as freshness weight
- Modify `rag-pipeline.ts` to factor freshness into ranking

#### Test Plan

- Freshness decay calculation tests
- Stale detection threshold tests
- Selective re-indexing tests
- Context assembly with mixed fresh/stale sources

---

## P2 — Distribution & Growth

### Issue 20 — Add standalone binaries for macOS/Linux/Windows

| Field | Value |
|-------|-------|
| **Title** | `feat: add standalone binaries for cross-platform distribution` |
| **Labels** | `priority/P2`, `sprint/4`, `epic/sync-execution`, `type/infrastructure` |
| **Sprint** | 4 |

#### Context

The package is npm-first and requires Node.js ≥18. Standalone binaries would greatly increase adoption in enterprises and among less patient developers.

#### Acceptance Criteria

- [ ] Single binary for macOS (arm64 + x64), Linux (x64), Windows (x64)
- [ ] Binary includes Node.js runtime (no system Node required)
- [ ] Simple installer or curl-pipe-bash script
- [ ] Fully offline operation after install
- [ ] Binary size under 100MB
- [ ] CI/CD pipeline for automated binary builds
- [ ] Release automation with GitHub Releases

#### Technical Notes

- Evaluate: `pkg`, `nexe`, `bun build --compile`, or `sea` (Node.js single-executable-applications)
- SQLite native binding compatibility is the main challenge
- Test with `better-sqlite3` in bundled mode

#### Test Plan

- Build verification on each platform (CI matrix)
- Smoke test: `mcp-graph --help`, `mcp-graph init`, `mcp-graph import`
- Binary size monitoring
- Offline operation tests

---

### Issue 21 — Add public benchmark suite

| Field | Value |
|-------|-------|
| **Title** | `feat: add public benchmark suite with reproducible metrics` |
| **Labels** | `priority/P2`, `sprint/4`, `type/infrastructure` |
| **Sprint** | 4 |

#### Context

The project claims token efficiency and performance. Public, reproducible benchmarks turn claims into proof.

#### Acceptance Criteria

- [ ] Public corpus of PRD files (various sizes: small, medium, large)
- [ ] Benchmark scenarios: import speed, context compression ratio, search latency, FTS accuracy, RAG retrieval quality
- [ ] Before/after comparison for context compression
- [ ] Reproducible results via `npm run test:bench`
- [ ] Results published in docs or GitHub wiki
- [ ] CI tracks regressions (benchmark must not degrade > 10%)

#### Technical Notes

- Extend existing benchmark infrastructure (`docs/benchmarks/`)
- Use Vitest bench mode or dedicated benchmark library
- Corpus stored in `tests/fixtures/benchmarks/`

#### Test Plan

- Benchmark reproducibility tests (same input → same metrics within 5% variance)
- Regression detection tests

---

### Issue 22 — Add template gallery with starter kits

| Field | Value |
|-------|-------|
| **Title** | `feat: add template gallery with project starter kits` |
| **Labels** | `priority/P2`, `sprint/4`, `type/feature` |
| **Sprint** | 4 |

#### Context

Templates accelerate adoption and provide community content. Users need examples to understand what the tool can do.

#### Acceptance Criteria

- [ ] Starter kits for: SaaS, REST API, Mobile App, CLI Tool, AI Agent, Monorepo
- [ ] Each kit includes: example PRD, expected graph, sprint plan example, workflow config
- [ ] `mcp-graph init --template saas` uses starter kit
- [ ] Template gallery browsable in docs and dashboard
- [ ] Community contribution guide for new templates

#### Technical Notes

- Store templates in `templates/` directory
- Each template: `prd.md`, `expected-graph.json`, `README.md`
- CLI: template selection during init/bootstrap

#### Test Plan

- Template import tests (each template produces valid graph)
- Template integrity tests (all required files present)
- Init with template integration tests

---

### Issue 23 — Add skills marketplace

| Field | Value |
|-------|-------|
| **Title** | `feat: add installable skills marketplace` |
| **Labels** | `priority/P2`, `sprint/4`, `type/feature` |
| **Sprint** | 4 |

#### Context

Creating an ecosystem around the core tool increases stickiness and community contribution.

#### Acceptance Criteria

- [ ] Skill catalog: browsable list of installable skills
- [ ] Version and compatibility tracking
- [ ] Enable/disable skills per project
- [ ] Skill packs: XP workflow, QA workflow, Release workflow, Refactor workflow, Bugfix workflow
- [ ] `mcp-graph skills install <name>` CLI command
- [ ] Skills can extend: parser rules, context templates, validation gates, export formats

#### Technical Notes

- Skills as npm packages or local directories with manifest
- Skill manifest: `mcp-graph-skill.json` with name, version, hooks, extensions
- Plugin architecture in `src/core/skills/`

#### Test Plan

- Skill installation/removal tests
- Skill compatibility verification tests
- Skill pack integration tests

---

## P2 — Governance & Enterprise-Readiness

### Issue 24 — Add policy engine for workflow governance

| Field | Value |
|-------|-------|
| **Title** | `feat: add policy engine for workflow governance rules` |
| **Labels** | `priority/P2`, `sprint/4`, `type/feature` |
| **Sprint** | 4 |

#### Context

Professional use requires enforceable rules. A policy engine prevents common mistakes before they compound.

#### Acceptance Criteria

- [ ] Configurable rules: require AC before task completion, require linked test, block sprint with circular deps, prevent epic closure with open subtasks
- [ ] Policy violations shown as warnings or blockers (configurable severity)
- [ ] Policy check runs on: status transitions, sprint planning, export
- [ ] `mcp-graph policy check` CLI command
- [ ] Custom policy rules via config file
- [ ] Dashboard shows policy violations inline

#### Technical Notes

- Create `src/core/governance/policy-engine.ts`
- Policy rules as declarative config (JSON/YAML)
- Hook into status update and sprint planning flows
- Default policy set with sensible rules

#### Test Plan

- Policy rule evaluation tests
- Violation detection tests
- Custom rule loading tests
- Integration with status transitions

---

### Issue 25 — Add structured observability and audit logging

| Field | Value |
|-------|-------|
| **Title** | `feat: add structured observability with audit logging` |
| **Labels** | `priority/P2`, `sprint/4`, `type/infrastructure` |
| **Sprint** | 4 |

#### Context

As the tool handles more complex workflows, operators need structured logging, metrics, and tracing for debugging and performance optimization.

#### Acceptance Criteria

- [ ] Structured logs per operation (key=value or JSON format)
- [ ] Internal metrics: import duration, FTS latency, RAG retrieval time, context assembly time
- [ ] Tracing per command/import (correlation IDs)
- [ ] Performance report for parser, FTS, embeddings
- [ ] `mcp-graph audit` CLI command for log review
- [ ] Log levels configurable via env var or config

#### Technical Notes

- Extend existing logger (`src/core/utils/logger.ts`) with structured fields
- Add timing instrumentation to hot paths
- Store audit log in SQLite (separate table)
- Correlation ID passed through operation context

#### Test Plan

- Structured log format tests
- Timing accuracy tests
- Correlation ID propagation tests
- Log level filtering tests

---

### Issue 26 — Add SQLite hardening and recovery

| Field | Value |
|-------|-------|
| **Title** | `feat: add SQLite backup, integrity checks, and recovery mode` |
| **Labels** | `priority/P2`, `sprint/4`, `type/infrastructure` |
| **Sprint** | 4 |

#### Context

SQLite is the persistence backbone. Data loss or corruption would be catastrophic for user trust.

#### Current state

- SQLite store in `workflow-graph/graph.db`
- Transaction safety for multi-write operations
- Manual snapshots via `createSnapshot()`
- Migration system (v1 → v2)
- **Gap**: no auto-backup, no integrity verification, no repair mode, no lock diagnostics

#### Acceptance Criteria

- [ ] Automatic rotational backup (configurable: every N operations or every N minutes)
- [ ] `mcp-graph db check` integrity verification (SQLite `PRAGMA integrity_check`)
- [ ] `mcp-graph db repair` mode for recoverable corruption
- [ ] Import/export snapshots as standalone files
- [ ] Lock diagnostics: detect and report stale locks
- [ ] Backup location configurable
- [ ] Max backup count with automatic rotation

#### Technical Notes

- Create `src/core/store/backup-manager.ts`
- Use SQLite `PRAGMA integrity_check` and `VACUUM`
- Backup via `sqlite3.backup()` API or file copy
- Lock detection via `PRAGMA busy_timeout` and file system checks

#### Test Plan

- Backup creation and rotation tests
- Integrity check tests (with intentionally corrupted DB)
- Recovery tests from backup
- Lock diagnostic tests
- Concurrent access tests

---

## Sprint Summary

| Sprint | Issues | Theme |
|--------|--------|-------|
| **Sprint 1** | #1 doctor, #2 bootstrap, #4 explainable next, #5 confidence scoring | Activation & Trust |
| **Sprint 2** | #3 quickstart, #6 duplicates, #8 inline editing, #9 health score, #12 exports | Quality & Operations |
| **Sprint 3** | #7 simulation, #11 focus mode, #13 GitHub sync, #16 incremental import, #17 templates, #18 personas, #19 freshness | Evolution & Execution |
| **Sprint 4** | #10 timeline, #14 git local, #15 tiers, #20 binaries, #21 benchmarks, #22 gallery, #23 marketplace, #24 policy, #25 observability, #26 SQLite hardening | Integration & Enterprise |

## Top 5 Priority Order

1. **bootstrap** (#2) — demo in 2 minutes
2. **doctor** (#1) — reduce onboarding friction
3. **explainable next** (#4) — build trust in the engine
4. **incremental PRD re-import** (#16) — living workflow, not one-shot
5. **GitHub Issues sync** (#13) — bridge to existing team workflows

These maximize: activation, confidence, retention, and real-world usage simultaneously.
