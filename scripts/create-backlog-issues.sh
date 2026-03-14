#!/usr/bin/env bash
# =============================================================================
# create-backlog-issues.sh — Create GitHub Issues for mcp-graph-workflow backlog
#
# Usage:
#   ./scripts/create-backlog-issues.sh              # Create all labels + issues
#   ./scripts/create-backlog-issues.sh --labels-only # Create labels only
#   ./scripts/create-backlog-issues.sh --dry-run     # Print commands without executing
#
# Prerequisites:
#   - gh CLI installed and authenticated (https://cli.github.com)
#   - Run from the repository root
# =============================================================================
set -euo pipefail

DRY_RUN=false
LABELS_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --labels-only) LABELS_ONLY=true ;;
    --help|-h)
      echo "Usage: $0 [--dry-run] [--labels-only]"
      exit 0
      ;;
  esac
done

run() {
  if [ "$DRY_RUN" = true ]; then
    echo "[DRY-RUN] $*"
  else
    "$@"
  fi
}

# Check gh is available
if ! command -v gh &> /dev/null && [ "$DRY_RUN" = false ]; then
  echo "Error: gh CLI not found. Install it from https://cli.github.com"
  exit 1
fi

echo "=== Creating labels ==="

create_label() {
  local name="$1" color="$2" desc="$3"
  echo "  Label: $name"
  run gh label create "$name" --color "$color" --description "$desc" --force
}

# Priority labels
create_label "priority/P0" "b60205" "Critical — increases adoption immediately"
create_label "priority/P1" "d93f0b" "High — product UX and ecosystem"
create_label "priority/P2" "fbca04" "Medium — distribution and enterprise"

# Sprint labels
create_label "sprint/1" "0e8a16" "Sprint 1 — Activation & Trust foundations"
create_label "sprint/2" "006b75" "Sprint 2 — Exports, quality, dashboard ops"
create_label "sprint/3" "1d76db" "Sprint 3 — PRD evolution, context, simulation"
create_label "sprint/4" "5319e7" "Sprint 4 — Binaries, git, timeline, policy"

# Epic labels
create_label "epic/onboarding" "c5def5" "Epic: Onboarding & Activation"
create_label "epic/planning-intelligence" "d4c5f9" "Epic: Planning Intelligence"
create_label "epic/dashboard-ux" "bfdadc" "Epic: Dashboard UX"
create_label "epic/sync-execution" "f9d0c4" "Epic: Sync & Execution"
create_label "epic/prd-evolution" "fef2c0" "Epic: Continuous PRD Evolution"

# Type labels
create_label "type/feature" "a2eeef" "New feature"
create_label "type/enhancement" "7057ff" "Enhancement to existing feature"
create_label "type/infrastructure" "e4e669" "Infrastructure / tooling"

if [ "$LABELS_ONLY" = true ]; then
  echo "=== Labels created. Exiting (--labels-only) ==="
  exit 0
fi

echo ""
echo "=== Creating issues ==="

# -----------------------------------------------------------------------------
# Epic 1 — Onboarding & Activation
# -----------------------------------------------------------------------------

echo "--- Epic 1: Onboarding & Activation ---"

# Issue 1: doctor
run gh issue create \
  --title "feat: add doctor command for environment diagnostics" \
  --label "priority/P0,sprint/1,epic/onboarding,type/feature" \
  --body "$(cat <<'ISSUE_EOF'
## Context

The project depends on Node.js ≥18, SQLite persistence, dashboard build assets, Playwright availability, MCP config (`.mcp.json`), and optional integrations (Serena, GitNexus, Context7). A broken setup kills adoption early. Today there is no single command to validate readiness.

## Current State

- `stats` command shows graph statistics but does not verify environment health
- `init` command creates project structure but does not validate prerequisites
- No verification of integration availability

## Proposal

Add a new CLI command:

```bash
mcp-graph doctor
mcp-graph doctor --json
mcp-graph doctor --fix
```

## Acceptance Criteria

- [ ] Command `mcp-graph doctor` validates: Node.js version, write permissions, SQLite database, dashboard build, Playwright availability, `.mcp.json`, integration status
- [ ] Human-readable output with ✓/✗ per check
- [ ] `--json` flag for structured output
- [ ] Suggests automatic corrections for common problems
- [ ] Exits 0 when all critical checks pass, non-zero otherwise
- [ ] Output separates ok, warning, and error levels
- [ ] Unit tests for each checker
- [ ] Documented in README and Getting Started

## Technical Notes

- Create `src/core/diagnostics/` with per-subsystem checkers
- CLI command in `src/cli/commands/doctor.ts` (thin orchestration)
- Follow existing `stats.ts` pattern for output formatting
ISSUE_EOF
)"

# Issue 2: bootstrap
run gh issue create \
  --title "feat: add bootstrap command for guided project setup" \
  --label "priority/P0,sprint/1,epic/onboarding,type/feature" \
  --body "$(cat <<'ISSUE_EOF'
## Context

The current command set is powerful, but first-time users must understand multiple steps: init → import PRD → index knowledge → inspect graph → start dashboard. This increases time-to-value.

## Current State

- `init` command creates project, `.mcp.json`, `.vscode/mcp.json`, installs MCP deps, generates `CLAUDE.md`
- No guided flow that chains commands together
- No stack detection + import + sprint suggestion in one step

## Proposal

```bash
mcp-graph bootstrap
mcp-graph bootstrap --prd PRD.md --non-interactive
```

Flow: init → validate env → detect stack → import PRD → build indexes → suggest first sprint → optionally launch dashboard.

## Acceptance Criteria

- [ ] Interactive mode: wizard with prompts for project name, PRD path, stack, dashboard auto-start
- [ ] Non-interactive mode: `--prd` and `--non-interactive` flags
- [ ] Final output shows "next recommended commands"
- [ ] Works with minimal text PRD (graceful degradation)
- [ ] Failure messages are recoverable and clear
- [ ] Documented in README
- [ ] Reuses existing core services (no shelling out to CLI internally)

## Technical Notes

- Orchestrate through `src/core/` functions
- Support default values for smooth demo path ("demo in 2 minutes")
ISSUE_EOF
)"

# Issue 3: quickstart import
run gh issue create \
  --title "feat: add quickstart import mode for lightweight PRDs" \
  --label "priority/P0,sprint/2,epic/onboarding,type/feature" \
  --body "$(cat <<'ISSUE_EOF'
## Context

Users evaluating the project often have small, messy, or lightweight PRDs. They need fast value without learning the full graph model first.

## Current State

- Import supports `.md`, `.txt`, `.pdf`, `.html`
- Parser pipeline: `readFileContent()` → `extractEntities()` → `convertToGraph()` → `bulkInsert()`
- Confidence scoring exists in `classify.ts` (0.3–0.9 range)
- No "aggressive inference" mode for minimal documents

## Proposal

```bash
mcp-graph import ./prd.md --quickstart
```

## Acceptance Criteria

- [ ] `--quickstart` flag on import command
- [ ] Aggressive epic/task hierarchy inference from structure
- [ ] Sensible default priorities assigned
- [ ] Minimal acceptance criteria generated when missing
- [ ] Simple dependency heuristics applied
- [ ] Low-confidence items marked with `needsReview: true`
- [ ] Does not overwrite explicit fields already present in PRD
- [ ] Works for `.md` and `.txt` inputs

## Technical Notes

- Extend `src/core/importer/prd-to-graph.ts` with quickstart strategy
- Leverage existing confidence scores from `classify.ts`
- Use `metadata.inferred = true` for all heuristic fields
ISSUE_EOF
)"

# -----------------------------------------------------------------------------
# Epic 2 — Planning Intelligence
# -----------------------------------------------------------------------------

echo "--- Epic 2: Planning Intelligence ---"

# Issue 4: explainable next
run gh issue create \
  --title "feat: add decision trace to next task recommendation" \
  --label "priority/P0,sprint/1,epic/planning-intelligence,type/enhancement" \
  --body "$(cat <<'ISSUE_EOF'
## Context

The `next` feature is central to product trust. Users need to understand **why** a task was chosen and **why others were not**.

## Current State

- `next-task.ts` returns `NextTaskResult` with `node` + `reason` string
- `enhanced-next.ts` adds `knowledgeCoverage` and `velocityContext`
- Algorithm: filter eligible → check dependencies → topological rank → multi-factor sort
- Logging includes reasoning at each step, but not exposed to API/MCP consumers
- **Gap**: no structured `decision_trace`, no rejected candidates, no top-N alternatives

## Proposal

Extend next responses with structured explainability:

```json
{
  "taskId": "task-123",
  "decisionTrace": {
    "selectedBecause": ["highest eligible priority", "all dependencies resolved"],
    "rejectedCandidates": [{"taskId": "task-124", "reason": "blocked by task-099"}],
    "alternatives": ["task-130", "task-140"]
  }
}
```

## Acceptance Criteria

- [ ] Response includes structured `decisionTrace` with: `selectedBecause`, `rejectedCandidates`, `alternatives` (top 5)
- [ ] Blocked tasks include exact blocking dependency IDs
- [ ] Available via MCP tool, REST API, and CLI
- [ ] CLI supports `next --verbose` for detailed trace
- [ ] Result is deterministic for the same graph state
- [ ] Tests verify reasoning output, not just selected task

## Technical Notes

- Extend `NextTaskResult` and `EnhancedNextResult` types
- Refactor internal ranking to collect trace as it runs
- Add `verbose` parameter to MCP `next` tool and REST endpoint
ISSUE_EOF
)"

# Issue 5: confidence scoring exposure
run gh issue create \
  --title "feat: expose confidence scoring with review queue" \
  --label "priority/P0,sprint/1,epic/planning-intelligence,type/enhancement" \
  --body "$(cat <<'ISSUE_EOF'
## Context

Confidence scoring already exists internally (0.3–0.9 per entity in `classify.ts`) but is not fully surfaced to users.

## Current State

- `ClassifiedBlock.confidence` and `ClassifiedItem.confidence` exist
- `GraphNode.sourceRef.confidence` persists the score
- `GraphNode.metadata.inferred` is true when confidence < 0.7
- **Gap**: no dashboard review queue, no `--strict` mode, no API filter

## Acceptance Criteria

- [ ] `mcp-graph import --strict` rejects items below configurable confidence threshold
- [ ] REST API filter: `GET /api/nodes?maxConfidence=0.7` returns items needing review
- [ ] MCP `list` tool supports `confidenceBelow` filter
- [ ] Dashboard "Review Queue" panel shows low-confidence items with classification reason
- [ ] Each item shows: confidence score, classification reason, source segment
- [ ] User can approve/override classification from review queue
- [ ] Documentation explains confidence semantics and score ranges

## Technical Notes

- Extend `classify.ts` to include `classificationReason` string per item
- Add `confidence` filter to `sqlite-store.ts` query methods
- Dashboard component for review queue
ISSUE_EOF
)"

# Issue 6: duplicate detection
run gh issue create \
  --title "feat: detect duplicate tasks and conflicting requirements during import" \
  --label "priority/P1,sprint/2,epic/planning-intelligence,type/feature" \
  --body "$(cat <<'ISSUE_EOF'
## Context

Real PRDs often contain repeated requirements, similar user stories, or conflicting acceptance criteria. This degrades graph quality and planning reliability.

## Current State

- `store.hasImport()` checks file-level duplicates, not content-level
- FTS5 search with BM25 ranking exists
- TF-IDF vectorization and cosine similarity available in RAG pipeline
- **Gap**: no duplicate detection within or across imports, no conflict analysis

## Acceptance Criteria

- [ ] During import, flag near-duplicate tasks with similarity score
- [ ] Detect conflicting acceptance criteria across related tasks
- [ ] Suggest merge candidates (no auto-merge by default)
- [ ] Warn on contradictory dependencies or circular references
- [ ] Warnings appear in CLI output, API response, and dashboard
- [ ] Configurable similarity threshold

## Technical Notes

- Leverage existing TF-IDF/cosine similarity for comparison
- Use FTS5 BM25 for fast candidate retrieval before detailed comparison
- Create `src/core/quality/duplicate-detector.ts` and `conflict-analyzer.ts`
ISSUE_EOF
)"

# Issue 7: sprint simulation
run gh issue create \
  --title "feat: add sprint simulation and what-if planning" \
  --label "priority/P1,sprint/3,epic/planning-intelligence,type/feature" \
  --body "$(cat <<'ISSUE_EOF'
## Context

Current planning estimates velocity and sprint capacity, but users need scenario analysis before committing a sprint plan.

## Current State

- `planning-report.ts` simulates execution order (iterative `findNextTask` loop)
- `velocity.ts` tracks tasks/sprint, XP points, completion hours
- **Gap**: no what-if scenarios, no parameter modification, no side-by-side comparison

## Proposal

Simulate questions like:
- What if capacity drops by 20%?
- What if we remove a blocker?
- What if these tasks move to next sprint?
- What if a critical dependency is delayed?

## Acceptance Criteria

- [ ] MCP tool and API endpoint accept scenario parameters: capacity change (%), removed blockers, moved tasks, delayed dependencies
- [ ] Output includes: projected completed tasks, carry-over, risk delta vs baseline
- [ ] Simulation is pure (does not mutate graph state)
- [ ] Results are reproducible for identical inputs
- [ ] Dashboard can visualize baseline vs scenario comparison
- [ ] Supports at least 3 scenario types

## Technical Notes

- Create `src/core/planner/sprint-simulator.ts`
- Reuse `findNextTask` with cloned/modified graph state
- Compare against baseline from `planning-report.ts`
ISSUE_EOF
)"

# -----------------------------------------------------------------------------
# Epic 3 — Dashboard UX
# -----------------------------------------------------------------------------

echo "--- Epic 3: Dashboard UX ---"

# Issue 8: inline editing
run gh issue create \
  --title "feat: enable inline node editing and relationship management in dashboard" \
  --label "priority/P1,sprint/2,epic/dashboard-ux,type/feature" \
  --body "$(cat <<'ISSUE_EOF'
## Context

The dashboard visualizes graph and backlog state but users need operational editing capabilities.

## Current State

- React Flow with Dagre auto-layout, direction toggle
- Node selection + read-only detail panel
- Edge creation dialog exists (pendingConnection state)
- REST API supports full CRUD
- **Gap**: no inline edits, no status dropdowns, no edge deletion from UI, no undo/redo

## Acceptance Criteria

- [ ] Inline node title and description editing (double-click or edit button)
- [ ] Status and priority dropdowns in detail panel
- [ ] Add/remove dependencies from UI
- [ ] Create new nodes from canvas or backlog view
- [ ] Delete nodes with confirmation
- [ ] Edits persist immediately via REST API
- [ ] Optimistic UI updates with rollback on error
- [ ] Keyboard-friendly editing flow
- [ ] Undo/redo for last 20 operations

## Technical Notes

- Extend existing `workflow-graph.tsx` components
- Use existing REST API endpoints (no new backend needed for basic CRUD)
- Undo/redo: maintain operation stack in React state
ISSUE_EOF
)"

# Issue 9: health score
run gh issue create \
  --title "feat: add backlog health score with actionable warnings" \
  --label "priority/P1,sprint/2,epic/dashboard-ux,type/feature" \
  --body "$(cat <<'ISSUE_EOF'
## Context

Users need a fast way to assess whether a graph is execution-ready or structurally weak.

## Current State

- `bottleneck-detector.ts` identifies bottlenecks
- `metrics-calculator.ts` computes graph metrics
- Insights tab exists in dashboard
- **Gap**: no single composite health score, no actionable drill-down

## Acceptance Criteria

- [ ] Composite health score (0–100) based on weighted factors
- [ ] Factors: tasks without AC, oversized tasks, blocked critical paths, circular deps, priority inconsistency, low-confidence imports, stale knowledge
- [ ] Warning list links directly to affected nodes
- [ ] Score recalculates after graph mutations (SSE-driven)
- [ ] Clear explanation of each penalty factor and weight
- [ ] Health score visible in dashboard Insights tab and stats API
- [ ] Score changes tracked over time (health trend)

## Technical Notes

- Create `src/core/insights/health-score.ts`
- Leverage existing `bottleneck-detector.ts` and `metrics-calculator.ts`
- Add REST endpoint: `GET /api/insights/health`
ISSUE_EOF
)"

# Issue 10: timeline
run gh issue create \
  --title "feat: add project timeline with status transitions and audit trail" \
  --label "priority/P1,sprint/4,epic/dashboard-ux,type/feature" \
  --body "$(cat <<'ISSUE_EOF'
## Context

Project history enables auditing, debugging, and progress narrative. Infrastructure exists but is not surfaced.

## Current State

- `GraphEventBus` emits events for all operations
- Snapshots stored in SQLite
- SSE streaming exists for real-time updates
- **Gap**: no event persistence, no timeline UI, no snapshot diff

## Acceptance Criteria

- [ ] Status transitions logged per node (timestamp, from, to, actor)
- [ ] Timeline view in dashboard showing events chronologically
- [ ] Snapshot comparison: diff two snapshots
- [ ] Filter by node, type, sprint, time range
- [ ] Sprint-level progress summary
- [ ] Export timeline as JSON or Markdown

## Technical Notes

- Add `events` table to SQLite schema (migration v3)
- Subscribe `GraphEventBus` to persist events
- Create `src/core/events/event-store.ts`
- Dashboard: Timeline tab or section in Insights
ISSUE_EOF
)"

# Issue 11: focus mode
run gh issue create \
  --title "feat: add focus execution mode for single-task delivery" \
  --label "priority/P1,sprint/3,epic/dashboard-ux,type/feature" \
  --body "$(cat <<'ISSUE_EOF'
## Context

The product promise is pair programming with operational memory. Users need a distraction-free mode centered on the current task.

## Current State

- `next` recommends next task
- Tiered context: summary (~20 tokens), standard (~150), deep (~500+)
- Context assembler with token budgeting
- **Gap**: no dedicated focused UI, no execution checklist, no in-context validation

## Acceptance Criteria

- [ ] Dedicated view: current task, compact context, AC, deps/blockers, checklist, validation
- [ ] Works with `next` recommendation (auto-loads recommended task)
- [ ] Context tier toggle (summary/standard/deep)
- [ ] Reflects real-time status changes via SSE
- [ ] Switch between focus mode and graph mode
- [ ] Mark AC items as done from focus view
- [ ] "Complete task" action with validation gate

## Technical Notes

- Dashboard component: `src/web/dashboard/src/components/focus/`
- Reuse `tiered-context.ts` and `context-assembler.ts`
- Use existing `validate-task` MCP tool for completion validation
ISSUE_EOF
)"

# -----------------------------------------------------------------------------
# Epic 4 — Sync & Execution
# -----------------------------------------------------------------------------

echo "--- Epic 4: Sync & Execution ---"

# Issue 12: multi-format export
run gh issue create \
  --title "feat: add Markdown, CSV, and GitHub Issues export formats" \
  --label "priority/P1,sprint/2,epic/sync-execution,type/feature" \
  --body "$(cat <<'ISSUE_EOF'
## Context

Currently only JSON and Mermaid exports are supported. Teams need formats that plug into real workflows.

## Current State

- `export` MCP tool supports `action: "json" | "mermaid"`
- Mermaid: flowchart or mindmap with filters
- **Gap**: no Markdown, CSV, GitHub Issues payload, sprint report HTML

## Acceptance Criteria

- [ ] Export supports: `"markdown"`, `"csv"`, `"github-issues"`, `"sprint-report"`
- [ ] Markdown: structured backlog with epics → tasks → subtasks, status badges, AC checklists
- [ ] CSV: flat table (id, title, type, status, priority, sprint, dependencies, tags)
- [ ] GitHub Issues: JSON array of `{title, body, labels, milestone}` ready for `gh issue create`
- [ ] Sprint report: HTML summary with progress, velocity, blockers, risks
- [ ] All formats support same status/type filters as existing exports
- [ ] REST endpoints for each format
- [ ] Stable JSON schema for GitHub Issues format (documented)

## Technical Notes

- Create `src/core/graph/export/` directory with per-format exporters
- Extend `export` MCP tool action enum
- Reuse existing filter logic from `mermaid-export.ts`
ISSUE_EOF
)"

# Issue 13: GitHub sync
run gh issue create \
  --title "feat: add bidirectional GitHub Issues sync mapping" \
  --label "priority/P1,sprint/3,epic/sync-execution,type/feature" \
  --body "$(cat <<'ISSUE_EOF'
## Context

Many teams track work in GitHub Issues. Without a bridge, the graph stays isolated from daily execution.

## Acceptance Criteria

- [ ] Graph nodes can export to GitHub-compatible issue payloads
- [ ] Import can attach existing issue metadata (URL, number, state) to nodes
- [ ] Bidirectional mapping: node type → label, priority → label, status ↔ issue state
- [ ] Backlinks between issue URL and node ID stored in metadata
- [ ] Sync is explicit and reviewable, not destructive by default
- [ ] Conflict resolution strategy when local and remote diverge
- [ ] Documentation explains mapping conventions

## Technical Notes

- Create `src/core/integrations/github-sync.ts`
- Keep deps minimal (raw fetch or `@octokit/rest`)
- Store mapping in `metadata.github` on nodes
- CLI: `mcp-graph sync github --repo owner/repo`
ISSUE_EOF
)"

# Issue 14: git local integration
run gh issue create \
  --title "feat: link local git activity to workflow nodes" \
  --label "priority/P1,sprint/4,epic/sync-execution,type/feature" \
  --body "$(cat <<'ISSUE_EOF'
## Context

Planning becomes more valuable when it reflects actual implementation activity.

## Current State

- GitNexus integration exists for code graph analysis
- `isGitRepo()` detection available
- **Gap**: no branch naming, no commit association, no PR linking

## Acceptance Criteria

- [ ] Suggest branch names from task IDs (e.g., `feat/task-abc123-add-auth`)
- [ ] Associate commits to nodes (by convention in commit messages)
- [ ] Detect active branches per task
- [ ] Surface branch/commit metadata in dashboard node detail
- [ ] `mcp-graph git link <task-id> <branch>` CLI command
- [ ] Mark task as "in_progress" when branch is created (optional)
- [ ] Feature remains optional and local-first

## Technical Notes

- Create `src/core/integrations/git-local.ts`
- Use `child_process.execFile('git', ...)` for git commands
- Store links in `metadata.git` on nodes
ISSUE_EOF
)"

# Issue 15: integration tiers
run gh issue create \
  --title "feat: add integration tier levels for reduced cognitive complexity" \
  --label "priority/P1,sprint/4,epic/sync-execution,type/enhancement" \
  --body "$(cat <<'ISSUE_EOF'
## Context

The integration mesh (Serena, GitNexus, Context7, Playwright) is powerful but can overwhelm new users.

## Current State

- `IntegrationOrchestrator` manages all 4 integrations
- `.mcp.json` configures all MCP servers
- **Gap**: no way to select a subset, no tier concept

## Acceptance Criteria

- [ ] Three tiers: `core` (graph only), `core+docs` (+ Context7 + knowledge), `full` (all integrations)
- [ ] Selectable during `init` or `bootstrap`
- [ ] `.mcp.json` only includes servers for selected tier
- [ ] Tier can be upgraded later without re-init
- [ ] Documentation explains each tier

## Technical Notes

- Modify `src/mcp/init-project.ts` to accept tier parameter
- Conditional server inclusion in `.mcp.json` generation
ISSUE_EOF
)"

# -----------------------------------------------------------------------------
# Epic 5 — Continuous PRD Evolution
# -----------------------------------------------------------------------------

echo "--- Epic 5: Continuous PRD Evolution ---"

# Issue 16: incremental import
run gh issue create \
  --title "feat: add incremental PRD re-import with change detection" \
  --label "priority/P0,sprint/3,epic/prd-evolution,type/feature" \
  --body "$(cat <<'ISSUE_EOF'
## Context

PRDs evolve. Full re-import risks breaking IDs, losing manual refinements, and creating duplicated graph state. This is one of the highest-leverage features — it turns the tool from a one-shot importer into a living workflow engine.

## Current State

- `store.hasImport()` detects previous imports
- `force=true` deletes all old nodes and re-imports from scratch (destructive)
- `import_history` table tracks source file, counts, timestamp
- `sourceRef` on nodes links back to source file
- **Gap**: no diff, no selective update, no preservation of manual edits

## Acceptance Criteria

- [ ] Diff new PRD against previously imported structure
- [ ] Update only impacted nodes (added, removed, changed)
- [ ] Preserve user-edited metadata (status, priority, manual AC) unless explicitly overridden
- [ ] Mark added/removed/changed items visibly in output
- [ ] Unchanged nodes keep stable identity (same IDs)
- [ ] `--dry-run` flag to preview changes without applying
- [ ] Auto-snapshot before re-import
- [ ] Dashboard can display "what changed" panel

## Technical Notes

- Create `src/core/importer/incremental-import.ts`
- Content fingerprint per node (hash of title + description) for change detection
- Store fingerprints in `metadata.contentHash`
- Diff algorithm: match by fingerprint → detect adds/removes/changes
ISSUE_EOF
)"

# Issue 17: template detection
run gh issue create \
  --title "feat: add PRD template detection with specialized parsing strategies" \
  --label "priority/P1,sprint/3,epic/prd-evolution,type/feature" \
  --body "$(cat <<'ISSUE_EOF'
## Context

Not all PRDs share the same structure. Generic heuristics miss signal when the document follows known formats.

## Current State

- Parser pipeline: read → segment → classify → extract → normalize
- Single generic parsing strategy
- **Gap**: no template detection, no format-specific parsers

## Acceptance Criteria

- [ ] Detect templates: Lean PRD, RFC/spec, user stories, roadmap/milestone, technical spec
- [ ] Apply format-specific extraction rules per detected template
- [ ] Safe fallback to generic parser when no template matches
- [ ] Template detection confidence score
- [ ] Documentation describes supported templates and how to add new ones

## Technical Notes

- Create `src/core/parser/templates/` with per-template parsers
- Template detector in `src/core/parser/template-detector.ts`
- Strategy pattern: detector selects parser, falls back to generic
ISSUE_EOF
)"

# Issue 18: persona context
run gh issue create \
  --title "feat: add persona-specific context assembly" \
  --label "priority/P1,sprint/3,epic/prd-evolution,type/enhancement" \
  --body "$(cat <<'ISSUE_EOF'
## Context

Different roles need different context views. A developer needs code references; a reviewer needs AC; a PM needs progress and risks.

## Current State

- Tiered context: summary, standard, deep
- Context assembler: 60% graph, 30% knowledge, 10% headers
- **Gap**: context is query/node-centric, not role-centric

## Acceptance Criteria

- [ ] Persona presets: `dev`, `reviewer`, `qa`, `product`, `ai-agent`
- [ ] Each persona: different token budget, section weights, included fields, formatting
- [ ] `ai-agent` optimized for Claude/Copilot/Cursor prompt format
- [ ] Selectable via MCP tool, API, and CLI parameter
- [ ] Backward compatible: default = current behavior

## Technical Notes

- Create `src/core/context/personas/` with preset configs
- Extend `context-assembler.ts` to accept persona parameter
ISSUE_EOF
)"

# Issue 19: knowledge freshness
run gh issue create \
  --title "feat: add knowledge freshness scoring and stale content detection" \
  --label "priority/P1,sprint/3,epic/prd-evolution,type/feature" \
  --body "$(cat <<'ISSUE_EOF'
## Context

Good context is not just small — it's current. Using outdated documentation leads to wrong decisions.

## Current State

- `KnowledgeStore` tracks `sourceType` but not timestamps
- RAG pipeline retrieves by similarity only
- **Gap**: no freshness score, no staleness alerts, no selective invalidation

## Acceptance Criteria

- [ ] Each knowledge document has `lastUpdated` and `freshnessScore` (0–1, decays over time)
- [ ] Configurable decay curve (linear, exponential, step)
- [ ] Stale chunks flagged when context is assembled
- [ ] Alert when context uses documents older than threshold
- [ ] Selective embedding invalidation (re-index only stale docs)
- [ ] `mcp-graph index --refresh-stale` command
- [ ] Dashboard indicator for knowledge freshness

## Technical Notes

- Add `updated_at` column to knowledge store (migration)
- Create `src/core/rag/freshness-scorer.ts`
- Modify `rag-pipeline.ts` to factor freshness into ranking
ISSUE_EOF
)"

# -----------------------------------------------------------------------------
# P2 — Distribution & Growth
# -----------------------------------------------------------------------------

echo "--- P2: Distribution & Growth ---"

# Issue 20: standalone binaries
run gh issue create \
  --title "feat: add standalone binaries for cross-platform distribution" \
  --label "priority/P2,sprint/4,type/infrastructure" \
  --body "$(cat <<'ISSUE_EOF'
## Context

The package is npm-first and requires Node.js ≥18. Standalone binaries would increase adoption in enterprises.

## Acceptance Criteria

- [ ] Single binary for macOS (arm64 + x64), Linux (x64), Windows (x64)
- [ ] Includes Node.js runtime (no system Node required)
- [ ] Fully offline operation after install
- [ ] Binary size under 100MB
- [ ] CI/CD pipeline for automated binary builds
- [ ] Release automation with GitHub Releases

## Technical Notes

- Evaluate: `pkg`, `nexe`, `bun build --compile`, or Node.js SEA
- SQLite native binding compatibility is the main challenge
ISSUE_EOF
)"

# Issue 21: benchmark suite
run gh issue create \
  --title "feat: add public benchmark suite with reproducible metrics" \
  --label "priority/P2,sprint/4,type/infrastructure" \
  --body "$(cat <<'ISSUE_EOF'
## Context

Public, reproducible benchmarks turn performance claims into proof.

## Acceptance Criteria

- [ ] Public corpus of PRD files (small, medium, large)
- [ ] Benchmark scenarios: import speed, context compression ratio, search latency, FTS accuracy, RAG quality
- [ ] Before/after comparison for context compression
- [ ] Reproducible via `npm run test:bench`
- [ ] CI tracks regressions (must not degrade > 10%)
- [ ] Results published in docs

## Technical Notes

- Extend existing benchmark infrastructure (`docs/benchmarks/`)
- Corpus stored in `tests/fixtures/benchmarks/`
ISSUE_EOF
)"

# Issue 22: template gallery
run gh issue create \
  --title "feat: add template gallery with project starter kits" \
  --label "priority/P2,sprint/4,type/feature" \
  --body "$(cat <<'ISSUE_EOF'
## Context

Templates accelerate adoption and provide community content.

## Acceptance Criteria

- [ ] Starter kits for: SaaS, REST API, Mobile App, CLI Tool, AI Agent, Monorepo
- [ ] Each kit: example PRD, expected graph, sprint plan example, workflow config
- [ ] `mcp-graph init --template saas` uses starter kit
- [ ] Template gallery browsable in docs and dashboard
- [ ] Community contribution guide

## Technical Notes

- Store templates in `templates/` directory
- Each template: `prd.md`, `expected-graph.json`, `README.md`
ISSUE_EOF
)"

# Issue 23: skills marketplace
run gh issue create \
  --title "feat: add installable skills marketplace" \
  --label "priority/P2,sprint/4,type/feature" \
  --body "$(cat <<'ISSUE_EOF'
## Context

An ecosystem around the core tool increases stickiness and community contribution.

## Acceptance Criteria

- [ ] Skill catalog: browsable list of installable skills
- [ ] Version and compatibility tracking
- [ ] Enable/disable skills per project
- [ ] Skill packs: XP, QA, Release, Refactor, Bugfix workflows
- [ ] `mcp-graph skills install <name>` CLI command
- [ ] Skills can extend: parser rules, context templates, validation gates, export formats

## Technical Notes

- Skills as npm packages or local directories with manifest
- Skill manifest: `mcp-graph-skill.json`
- Plugin architecture in `src/core/skills/`
ISSUE_EOF
)"

# -----------------------------------------------------------------------------
# P2 — Governance & Enterprise-Readiness
# -----------------------------------------------------------------------------

echo "--- P2: Governance & Enterprise ---"

# Issue 24: policy engine
run gh issue create \
  --title "feat: add policy engine for workflow governance rules" \
  --label "priority/P2,sprint/4,type/feature" \
  --body "$(cat <<'ISSUE_EOF'
## Context

Professional use requires enforceable rules. A policy engine prevents common mistakes before they compound.

## Acceptance Criteria

- [ ] Configurable rules: require AC before completion, require linked test, block sprint with circular deps, prevent epic closure with open subtasks
- [ ] Policy violations as warnings or blockers (configurable severity)
- [ ] Policy check on: status transitions, sprint planning, export
- [ ] `mcp-graph policy check` CLI command
- [ ] Custom policy rules via config file
- [ ] Dashboard shows violations inline

## Technical Notes

- Create `src/core/governance/policy-engine.ts`
- Policy rules as declarative config (JSON/YAML)
- Default policy set with sensible rules
ISSUE_EOF
)"

# Issue 25: observability
run gh issue create \
  --title "feat: add structured observability with audit logging" \
  --label "priority/P2,sprint/4,type/infrastructure" \
  --body "$(cat <<'ISSUE_EOF'
## Context

Structured logging, metrics, and tracing are needed for debugging and performance optimization.

## Acceptance Criteria

- [ ] Structured logs per operation (key=value or JSON)
- [ ] Internal metrics: import duration, FTS latency, RAG retrieval time, context assembly time
- [ ] Tracing per command/import (correlation IDs)
- [ ] Performance report for parser, FTS, embeddings
- [ ] `mcp-graph audit` CLI command
- [ ] Log levels configurable via env var or config

## Technical Notes

- Extend existing logger with structured fields
- Add timing instrumentation to hot paths
- Store audit log in SQLite (separate table)
ISSUE_EOF
)"

# Issue 26: SQLite hardening
run gh issue create \
  --title "feat: add SQLite backup, integrity checks, and recovery mode" \
  --label "priority/P2,sprint/4,type/infrastructure" \
  --body "$(cat <<'ISSUE_EOF'
## Context

SQLite is the persistence backbone. Data loss or corruption would be catastrophic for user trust.

## Current State

- SQLite store in `workflow-graph/graph.db`
- Transaction safety for multi-write operations
- Manual snapshots via `createSnapshot()`
- **Gap**: no auto-backup, no integrity verification, no repair mode

## Acceptance Criteria

- [ ] Automatic rotational backup (configurable interval)
- [ ] `mcp-graph db check` integrity verification
- [ ] `mcp-graph db repair` for recoverable corruption
- [ ] Import/export snapshots as standalone files
- [ ] Lock diagnostics: detect and report stale locks
- [ ] Max backup count with automatic rotation

## Technical Notes

- Create `src/core/store/backup-manager.ts`
- Use SQLite `PRAGMA integrity_check` and `VACUUM`
- Lock detection via `PRAGMA busy_timeout`
ISSUE_EOF
)"

echo ""
echo "=== Done! ==="
echo "Created labels and 26 issues."
echo "Run 'gh issue list --limit 30' to verify."
