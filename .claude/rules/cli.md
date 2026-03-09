---
description: CLI command rules
globs: src/cli/**/*.ts
---

# CLI Rules

- **Thin orchestration only** — CLI commands must NOT contain business logic
- Commands call core functions and format output, nothing else
- All business logic belongs in `src/core/`
- Use Commander.js v14 patterns for command registration
- Error handling: catch core errors and display user-friendly messages
- No direct database access from CLI layer
