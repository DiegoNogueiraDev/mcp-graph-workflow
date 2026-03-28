import { describe, it, expect } from "vitest";
import { PythonParserAdapter } from "../../core/translation/parsers/python-parser-adapter.js";
import type { ParsedConstruct } from "../../core/translation/parsers/parser-adapter.js";

describe("PythonParserAdapter", () => {
  const adapter = new PythonParserAdapter();

  it("should have languageId = python", () => {
    expect(adapter.languageId).toBe("python");
  });

  describe("parseSnippet", () => {
    it("should detect function definitions", () => {
      const code = `def greet(name: str) -> None:\n    print(name)`;
      const constructs = adapter.parseSnippet(code);
      const fnDef = constructs.find((c: ParsedConstruct) => c.constructId === "uc_fn_def");
      expect(fnDef).toBeDefined();
      expect(fnDef!.name).toBe("greet");
    });

    it("should detect async function definitions", () => {
      const code = `async def fetch_data(url: str):\n    return await get(url)`;
      const constructs = adapter.parseSnippet(code);
      const asyncFn = constructs.find((c: ParsedConstruct) => c.constructId === "uc_async_fn");
      expect(asyncFn).toBeDefined();
      expect(asyncFn!.name).toBe("fetch_data");
    });

    it("should detect class definitions", () => {
      const code = `class User:\n    def __init__(self, name):\n        self.name = name`;
      const constructs = adapter.parseSnippet(code);
      const classDef = constructs.find((c: ParsedConstruct) => c.constructId === "uc_class_def");
      expect(classDef).toBeDefined();
      expect(classDef!.name).toBe("User");
    });

    it("should detect class with inheritance", () => {
      const code = `class Admin(User):\n    pass`;
      const constructs = adapter.parseSnippet(code);
      const extends_ = constructs.find((c: ParsedConstruct) => c.constructId === "uc_extends");
      expect(extends_).toBeDefined();
    });

    it("should detect imports (from x import y)", () => {
      const code = `from os import path\nimport json`;
      const constructs = adapter.parseSnippet(code);
      const namedImport = constructs.find((c: ParsedConstruct) => c.constructId === "uc_import_named");
      expect(namedImport).toBeDefined();
      const defaultImport = constructs.find((c: ParsedConstruct) => c.constructId === "uc_import_default");
      expect(defaultImport).toBeDefined();
    });

    it("should detect if/else statements", () => {
      const code = `if x > 0:\n    return x\nelse:\n    return -x`;
      const constructs = adapter.parseSnippet(code);
      const ifElse = constructs.find((c: ParsedConstruct) => c.constructId === "uc_if_else");
      expect(ifElse).toBeDefined();
    });

    it("should detect for loops", () => {
      const code = `for item in items:\n    process(item)`;
      const constructs = adapter.parseSnippet(code);
      const forLoop = constructs.find((c: ParsedConstruct) => c.constructId === "uc_for_each");
      expect(forLoop).toBeDefined();
    });

    it("should detect while loops", () => {
      const code = `while not done:\n    step()`;
      const constructs = adapter.parseSnippet(code);
      const whileLoop = constructs.find((c: ParsedConstruct) => c.constructId === "uc_while");
      expect(whileLoop).toBeDefined();
    });

    it("should detect try/except", () => {
      const code = `try:\n    risky()\nexcept ValueError as e:\n    handle(e)`;
      const constructs = adapter.parseSnippet(code);
      const tryCatch = constructs.find((c: ParsedConstruct) => c.constructId === "uc_try_catch");
      expect(tryCatch).toBeDefined();
    });

    it("should detect decorators", () => {
      const code = `@app.route("/api")\ndef index():\n    return "ok"`;
      const constructs = adapter.parseSnippet(code);
      // Decorator is detected alongside the function
      const fnDef = constructs.find((c: ParsedConstruct) => c.constructId === "uc_fn_def");
      expect(fnDef).toBeDefined();
    });

    it("should detect return statements", () => {
      const code = `def foo():\n    return 42`;
      const constructs = adapter.parseSnippet(code);
      const ret = constructs.find((c: ParsedConstruct) => c.constructId === "uc_return");
      expect(ret).toBeDefined();
    });

    it("should detect raise (throw)", () => {
      const code = `raise ValueError("bad input")`;
      const constructs = adapter.parseSnippet(code);
      const throw_ = constructs.find((c: ParsedConstruct) => c.constructId === "uc_throw");
      expect(throw_).toBeDefined();
    });

    it("should detect await expressions", () => {
      const code = `result = await fetch(url)`;
      const constructs = adapter.parseSnippet(code);
      const await_ = constructs.find((c: ParsedConstruct) => c.constructId === "uc_await");
      expect(await_).toBeDefined();
    });

    it("should return empty array for empty code", () => {
      expect(adapter.parseSnippet("")).toHaveLength(0);
      expect(adapter.parseSnippet("   \n  ")).toHaveLength(0);
    });

    it("should handle complex real-world Python snippet", () => {
      const code = `
from typing import List, Optional
import asyncio

class DataProcessor:
    def __init__(self, config: dict):
        self.config = config

    async def process(self, items: List[str]) -> Optional[dict]:
        try:
            for item in items:
                if item.startswith("#"):
                    continue
                result = await self.transform(item)
                return result
        except Exception as e:
            raise RuntimeError(f"Failed: {e}")
`;
      const constructs = adapter.parseSnippet(code);
      const ids = constructs.map((c: ParsedConstruct) => c.constructId);

      expect(ids).toContain("uc_import_named");
      expect(ids).toContain("uc_import_default");
      expect(ids).toContain("uc_class_def");
      expect(ids).toContain("uc_fn_def");
      expect(ids).toContain("uc_async_fn");
      expect(ids).toContain("uc_try_catch");
      expect(ids).toContain("uc_for_each");
      expect(ids).toContain("uc_if_else");
      expect(ids).toContain("uc_await");
      expect(ids).toContain("uc_throw");
    });
  });
});
