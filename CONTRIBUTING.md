# Contributing to mcp-graph

Thank you for your interest in contributing! This guide will help you get started.

## Getting Started

```bash
# Fork and clone the repository
git clone https://github.com/<your-username>/mcp-graph-workflow.git
cd mcp-graph-workflow

# Install dependencies
npm ci

# Install dashboard dependencies
cd src/web/dashboard && npm ci && cd ../../..

# Build
npm run build

# Run tests
npm test
```

## Development Workflow

### TDD is mandatory

All new code follows Test-Driven Development: **Red -> Green -> Refactor**.

1. Write a failing test that describes the expected behavior
2. Write the minimum code to make the test pass
3. Refactor while keeping tests green

### Branch Naming

- `feat/short-description` — new features
- `fix/short-description` — bug fixes
- `docs/short-description` — documentation changes
- `refactor/short-description` — code refactoring
- `test/short-description` — test improvements

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add velocity calculation for sprint metrics
fix: resolve transitive blocker detection loop
docs: update architecture guide with search module
test: add integration tests for PRD import pipeline
```

## Code Standards

- **Strict TypeScript** — `strict: true`, no `any` types, explicit return types on public functions
- **ESM only** — use `.js` extension in relative imports
- **Zod v4** — `import { z } from 'zod/v4'` (never `'zod'`)
- **Kebab-case files** — `graph-store.ts`, not `graphStore.ts`
- **PascalCase types** — `GraphNode`, `NodeStatus`
- **camelCase functions** — `findNextTask()`, `buildTaskContext()`
- **Typed errors** — use error classes from `src/core/utils/errors.ts`, never throw raw strings
- **Logger** — use `src/core/utils/logger.ts`, never `console.log`
- **Named exports only** — no default exports

See [CLAUDE.md](CLAUDE.md) for the full conventions reference.

## Testing

```bash
npm test               # Unit + integration tests
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
```

### Test Guidelines

- **Vitest** with arrange-act-assert structure
- Test files in `src/tests/`, named `*.test.ts`
- Use factory functions for minimal valid test objects
- Prefer in-memory SQLite (`:memory:`) over file I/O
- Mock only external boundaries you don't control
- Descriptive test names: `it('should return next unblocked task sorted by priority')`

## Submitting a PR

1. Ensure all checks pass locally:
   ```bash
   npm run build && npm run lint && npm test
   ```
2. Push your branch and open a PR against `main`
3. Fill out the [PR template](.github/PULL_REQUEST_TEMPLATE.md)
4. Wait for CI to pass and a maintainer review

## Adding Skills & Instructions

Skills live in `copilot-ecosystem/`. Each skill is a directory with a `SKILL.md` file:

1. Create a directory under the appropriate discipline in `copilot-ecosystem/skills/`
2. Add a `SKILL.md` with valid YAML frontmatter (`name`, `description`, `category`, `risk`)
3. Include `disable-model-invocation: true` in frontmatter to prevent auto-loading
4. Submit a PR with the skill

For instructions, create `.instructions.md` files in `.github/instructions/` with `applyTo` frontmatter targeting the correct file patterns.

## Code of Conduct

This project follows a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.
