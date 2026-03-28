import { describe, it, expect } from "vitest";
import { TsParserAdapter } from "../../core/translation/parsers/ts-parser-adapter.js";
import type { ParsedConstruct } from "../../core/translation/parsers/parser-adapter.js";

describe("TsParserAdapter", () => {
  const adapter = new TsParserAdapter();

  it("should have languageId = typescript", () => {
    expect(adapter.languageId).toBe("typescript");
  });

  describe("parseSnippet", () => {
    it("should detect function declarations", () => {
      const code = `function greet(name: string): void { console.log(name); }`;
      const constructs = adapter.parseSnippet(code);

      const fnDef = constructs.find((c: ParsedConstruct) => c.constructId === "uc_fn_def");
      expect(fnDef).toBeDefined();
      expect(fnDef!.name).toBe("greet");
    });

    it("should detect arrow functions", () => {
      const code = `const add = (a: number, b: number) => a + b;`;
      const constructs = adapter.parseSnippet(code);

      const arrowFn = constructs.find((c: ParsedConstruct) => c.constructId === "uc_arrow_fn");
      expect(arrowFn).toBeDefined();
    });

    it("should detect class declarations", () => {
      const code = `class User { name: string; constructor(n: string) { this.name = n; } }`;
      const constructs = adapter.parseSnippet(code);

      const classDef = constructs.find((c: ParsedConstruct) => c.constructId === "uc_class_def");
      expect(classDef).toBeDefined();
      expect(classDef!.name).toBe("User");
    });

    it("should detect interface declarations", () => {
      const code = `interface Config { host: string; port: number; }`;
      const constructs = adapter.parseSnippet(code);

      const iface = constructs.find((c: ParsedConstruct) => c.constructId === "uc_interface");
      expect(iface).toBeDefined();
      expect(iface!.name).toBe("Config");
    });

    it("should detect imports (named and default)", () => {
      const code = `import { readFile } from 'fs';\nimport path from 'path';`;
      const constructs = adapter.parseSnippet(code);

      const namedImport = constructs.find((c: ParsedConstruct) => c.constructId === "uc_import_named");
      expect(namedImport).toBeDefined();

      const defaultImport = constructs.find((c: ParsedConstruct) => c.constructId === "uc_import_default");
      expect(defaultImport).toBeDefined();
    });

    it("should detect if/else statements", () => {
      const code = `if (x > 0) { return x; } else { return -x; }`;
      const constructs = adapter.parseSnippet(code);

      const ifElse = constructs.find((c: ParsedConstruct) => c.constructId === "uc_if_else");
      expect(ifElse).toBeDefined();
    });

    it("should detect loops (for, while, for...of)", () => {
      const code = `for (let i = 0; i < 10; i++) { }\nwhile (true) { break; }\nfor (const x of arr) { }`;
      const constructs = adapter.parseSnippet(code);

      const forLoop = constructs.find((c: ParsedConstruct) => c.constructId === "uc_for_loop");
      expect(forLoop).toBeDefined();

      const whileLoop = constructs.find((c: ParsedConstruct) => c.constructId === "uc_while");
      expect(whileLoop).toBeDefined();

      const forEach = constructs.find((c: ParsedConstruct) => c.constructId === "uc_for_each");
      expect(forEach).toBeDefined();
    });

    it("should detect try/catch", () => {
      const code = `try { doSomething(); } catch (e) { handleError(e); }`;
      const constructs = adapter.parseSnippet(code);

      const tryCatch = constructs.find((c: ParsedConstruct) => c.constructId === "uc_try_catch");
      expect(tryCatch).toBeDefined();
    });

    it("should detect async/await", () => {
      const code = `async function fetchData() { const data = await fetch('/api'); return data; }`;
      const constructs = adapter.parseSnippet(code);

      const asyncFn = constructs.find((c: ParsedConstruct) => c.constructId === "uc_async_fn");
      expect(asyncFn).toBeDefined();

      const awaitExpr = constructs.find((c: ParsedConstruct) => c.constructId === "uc_await");
      expect(awaitExpr).toBeDefined();
    });

    it("should detect enum declarations", () => {
      const code = `enum Color { Red, Green, Blue }`;
      const constructs = adapter.parseSnippet(code);

      const enumDef = constructs.find((c: ParsedConstruct) => c.constructId === "uc_type_enum");
      expect(enumDef).toBeDefined();
      expect(enumDef!.name).toBe("Color");
    });

    it("should detect type aliases", () => {
      const code = `type ID = string | number;`;
      const constructs = adapter.parseSnippet(code);

      const typeAlias = constructs.find((c: ParsedConstruct) => c.constructId === "uc_type_alias");
      expect(typeAlias).toBeDefined();
      expect(typeAlias!.name).toBe("ID");
    });

    it("should include line numbers for detected constructs", () => {
      const code = `function foo() {}\nclass Bar {}`;
      const constructs = adapter.parseSnippet(code);

      for (const c of constructs) {
        expect(c.startLine).toBeGreaterThan(0);
        expect(c.endLine).toBeGreaterThanOrEqual(c.startLine);
      }
    });

    it("should return empty array for empty code", () => {
      expect(adapter.parseSnippet("")).toHaveLength(0);
      expect(adapter.parseSnippet("   ")).toHaveLength(0);
    });

    it("should handle complex real-world snippet", () => {
      const code = `
import { z } from 'zod';

export interface Config {
  host: string;
  port: number;
}

export class Server {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  async start(): Promise<void> {
    if (this.config.port < 0) {
      throw new Error('Invalid port');
    }
    for (const plugin of this.plugins) {
      await plugin.init();
    }
  }
}
`;
      const constructs = adapter.parseSnippet(code);
      const ids = constructs.map((c: ParsedConstruct) => c.constructId);

      expect(ids).toContain("uc_import_named");
      expect(ids).toContain("uc_interface");
      expect(ids).toContain("uc_class_def");
      expect(ids).toContain("uc_if_else");
      expect(ids).toContain("uc_for_each");
      expect(ids).toContain("uc_throw");
      expect(ids).toContain("uc_await");
    });
  });
});
