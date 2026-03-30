/**
 * TDD Red: Tests for multi-language SymbolKind and RelationType extensions.
 * Validates that new enum values are accepted by Zod schemas
 * while existing values remain valid (backward compatibility).
 */

import { describe, it, expect } from "vitest";
import { SymbolKindSchema, RelationTypeSchema } from "../core/code/code-types.js";

describe("SymbolKindSchema — multi-language extensions", () => {
  // ── Existing values (backward compatibility) ──────────

  const existingKinds = [
    "function",
    "class",
    "method",
    "interface",
    "type_alias",
    "enum",
    "variable",
  ] as const;

  for (const kind of existingKinds) {
    it(`should accept existing kind: ${kind}`, () => {
      const result = SymbolKindSchema.safeParse(kind);
      expect(result.success).toBe(true);
    });
  }

  // ── New multi-language values ─────────────────────────

  const newKinds = [
    "struct",      // Go, Rust, C/C++, C#, Swift
    "trait",       // Rust, PHP
    "module",      // Python, Ruby, Rust (mod), Lua
    "package",     // Java, Kotlin, Go
    "annotation",  // Java, Kotlin (@interface)
    "macro",       // Rust, C/C++ (#define)
    "constant",    // Go (const), Ruby, Python (ALL_CAPS)
    "property",    // C#, Swift, Kotlin, PHP (class fields)
  ] as const;

  for (const kind of newKinds) {
    it(`should accept new kind: ${kind}`, () => {
      const result = SymbolKindSchema.safeParse(kind);
      expect(result.success).toBe(true);
    });
  }

  // ── Invalid values ────────────────────────────────────

  it("should reject invalid kind", () => {
    const result = SymbolKindSchema.safeParse("not_a_real_kind");
    expect(result.success).toBe(false);
  });

  it("should reject empty string", () => {
    const result = SymbolKindSchema.safeParse("");
    expect(result.success).toBe(false);
  });

  // ── Total count ───────────────────────────────────────

  it("should have exactly 15 kinds (7 existing + 8 new)", () => {
    expect(SymbolKindSchema.options).toHaveLength(15);
  });
});

describe("RelationTypeSchema — multi-language extensions", () => {
  // ── Existing values (backward compatibility) ──────────

  const existingTypes = [
    "calls",
    "imports",
    "extends",
    "implements",
    "belongs_to",
    "exports",
  ] as const;

  for (const type of existingTypes) {
    it(`should accept existing type: ${type}`, () => {
      const result = RelationTypeSchema.safeParse(type);
      expect(result.success).toBe(true);
    });
  }

  // ── New multi-language values ─────────────────────────

  const newTypes = [
    "uses",       // composition relations (field type refs, param types)
    "overrides",  // Java/Kotlin @Override, Ruby overridden methods
    "decorates",  // Python decorators, Java annotations applied to symbols
  ] as const;

  for (const type of newTypes) {
    it(`should accept new type: ${type}`, () => {
      const result = RelationTypeSchema.safeParse(type);
      expect(result.success).toBe(true);
    });
  }

  // ── Invalid values ────────────────────────────────────

  it("should reject invalid type", () => {
    const result = RelationTypeSchema.safeParse("not_a_real_type");
    expect(result.success).toBe(false);
  });

  // ── Total count ───────────────────────────────────────

  it("should have exactly 9 types (6 existing + 3 new)", () => {
    expect(RelationTypeSchema.options).toHaveLength(9);
  });
});
