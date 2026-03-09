---
description: Test conventions
globs: src/tests/**/*.test.ts
---

# Test Rules

- **Vitest** — `import { describe, it, expect } from 'vitest'`
- **Arrange-Act-Assert** — every test follows this structure
- **TDD first** — write failing test before implementation
- **Minimal fixtures** — factory functions that create ONE minimal valid object, override only relevant fields
- **In-memory SQLite** — use `:memory:` for store tests, no file I/O
- **Isolation** — each test creates its own store/state, no shared mutable state
- **No unnecessary mocks** — prefer real lightweight instances; mock only external boundaries
- **Descriptive names** — `it('should return next unblocked task sorted by priority')`
- **Test files** — colocated in `src/tests/`, named `*.test.ts`
