---
description: Core module rules
globs: src/core/**/*.ts
---

# Core Rules

- **Pure functions preferred** — minimize side effects, make dependencies explicit
- **Typed errors** — use custom error classes from `utils/errors.ts`
- **No framework coupling** — core must not import from `cli/`, `mcp/`, or external frameworks
- **Dependency direction** — core modules may depend on `schemas/` and `utils/`, never on `cli/` or `mcp/`
- **Explicit interfaces** — all cross-module contracts defined via TypeScript interfaces
- **Transaction safety** — all multi-write operations must be wrapped in SQLite transactions
