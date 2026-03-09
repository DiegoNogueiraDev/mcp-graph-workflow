---
description: TypeScript conventions for all source files
globs: src/**/*.ts
---

# TypeScript Rules

- **Strict mode** — `strict: true` in tsconfig, no `any` types
- **ESM only** — always use `.js` extension in relative imports (`import { foo } from './bar.js'`)
- **Zod v4** — `import { z } from 'zod/v4'` (never `'zod'`)
- **Explicit return types** on all public/exported functions
- **Kebab-case files** — `graph-store.ts`, not `graphStore.ts`
- **PascalCase types** — `GraphNode`, `NodeStatus`
- **camelCase functions** — `findNextTask()`, `buildTaskContext()`
- **Infer from Zod** — use `z.infer<typeof Schema>` instead of duplicating types
- **Typed errors** — use error classes from `src/core/utils/errors.ts`, never throw raw strings
- **Logger** — use `src/core/utils/logger.ts`, never `console.log`
- **No default exports** — use named exports only
