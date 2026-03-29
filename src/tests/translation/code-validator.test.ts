/**
 * TDD tests for Syntax/Type validators.
 * Task 4.3: Automatic validation of target code.
 */
import { describe, it, expect } from "vitest";
import {
  validateTypescript,
  validatePython,
  type ValidationResult,
} from "../../core/translation/validators/code-validator.js";

describe("TypeScript Validator", () => {
  it("should pass valid TypeScript code", () => {
    const code = `function add(a: number, b: number): number {
  return a + b;
}`;
    const result = validateTypescript(code);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should detect syntax errors in TypeScript", () => {
    const code = `function add(a: number, b: number {
  return a + b;
}`;
    const result = validateTypescript(code);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].line).toBeDefined();
    expect(result.errors[0].message).toBeDefined();
  });

  it("should validate async/await TypeScript", () => {
    const code = `async function fetchData(): Promise<string> {
  const result = await fetch("http://example.com");
  return result.text();
}`;
    const result = validateTypescript(code);

    expect(result.valid).toBe(true);
  });

  it("should validate class TypeScript", () => {
    const code = `class UserService {
  private name: string;
  constructor(name: string) {
    this.name = name;
  }
  getName(): string {
    return this.name;
  }
}`;
    const result = validateTypescript(code);

    expect(result.valid).toBe(true);
  });

  it("should detect missing closing brace", () => {
    const code = `function broken() {
  if (true) {
    return 1;
`;
    const result = validateTypescript(code);

    expect(result.valid).toBe(false);
  });
});

describe("Python Validator", () => {
  it("should pass valid Python code", () => {
    const code = `def add(a, b):
    return a + b`;
    const result = validatePython(code);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should detect indentation errors", () => {
    const code = `def add(a, b):
return a + b`;
    const result = validatePython(code);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("should detect unmatched parentheses", () => {
    const code = `def broken(a, b:
    return a + b`;
    const result = validatePython(code);

    expect(result.valid).toBe(false);
  });

  it("should validate async Python code", () => {
    const code = `async def fetch_data():
    result = await get_data()
    return result`;
    const result = validatePython(code);

    expect(result.valid).toBe(true);
  });

  it("should validate class Python code", () => {
    const code = `class UserService:
    def __init__(self, name):
        self.name = name

    def get_name(self):
        return self.name`;
    const result = validatePython(code);

    expect(result.valid).toBe(true);
  });

  it("should detect invalid colon placement", () => {
    const code = `def broken()
    return 1`;
    const result = validatePython(code);

    expect(result.valid).toBe(false);
  });
});

describe("ValidationResult format", () => {
  it("should include language in result", () => {
    const tsResult = validateTypescript("const x = 1;");
    expect(tsResult.language).toBe("typescript");

    const pyResult = validatePython("x = 1");
    expect(pyResult.language).toBe("python");
  });

  it("should include error line numbers when available", () => {
    const result = validateTypescript("function bad( {");
    if (!result.valid && result.errors.length > 0) {
      expect(typeof result.errors[0].line).toBe("number");
    }
  });
});
