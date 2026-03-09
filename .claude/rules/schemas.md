---
description: Zod schema rules
globs: src/schemas/**/*.ts
---

# Schema Rules

- **Zod v4 only** — `import { z } from 'zod/v4'`
- **Single source of truth** — TypeScript types derived via `z.infer<typeof Schema>`
- **No type duplication** — never manually define types that a schema already covers
- **Validation at boundaries** — schemas validate external input (MCP tools, file I/O, CLI args)
- **Schema naming** — `NodeSchema`, `EdgeSchema`, `GraphDocumentSchema` (PascalCase + "Schema" suffix)
- **Backward compatible** — schema changes must handle both old and new persisted data formats
