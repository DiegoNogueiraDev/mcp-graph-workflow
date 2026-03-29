import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { analyzeFile } from "../core/code/ts-analyzer.js";

const FIXTURE_DIR = path.join(import.meta.dirname, "__fixtures__", "ts-analyzer");

beforeAll(() => {
  mkdirSync(FIXTURE_DIR, { recursive: true });

  // Fixture: simple function
  writeFileSync(
    path.join(FIXTURE_DIR, "simple.ts"),
    `
export function greet(name: string): string {
  return \`Hello, \${name}\`;
}

function privateHelper(): void {
  // not exported
}

export const PI = 3.14;
`.trim(),
  );

  // Fixture: class with methods
  writeFileSync(
    path.join(FIXTURE_DIR, "user-service.ts"),
    `
export class UserService {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async getUser(id: string): Promise<User> {
    return this.db.find(id);
  }

  async deleteUser(id: string): Promise<void> {
    await this.db.delete(id);
  }
}

interface Database {
  find(id: string): Promise<User>;
  delete(id: string): Promise<void>;
}

interface User {
  id: string;
  name: string;
}
`.trim(),
  );

  // Fixture: imports and calls
  writeFileSync(
    path.join(FIXTURE_DIR, "caller.ts"),
    `
import { greet } from "./simple.js";
import { UserService } from "./user-service.js";

export function main(): void {
  const msg = greet("world");
  console.log(msg);
}

export function createService(db: unknown): UserService {
  return new UserService(db as any);
}
`.trim(),
  );

  // Fixture: barrel file with named re-exports
  writeFileSync(
    path.join(FIXTURE_DIR, "barrel-named.ts"),
    `
export { greet } from "./simple.js";
export { UserService } from "./user-service.js";
`.trim(),
  );

  // Fixture: barrel file with star re-export
  writeFileSync(
    path.join(FIXTURE_DIR, "barrel-star.ts"),
    `
export * from "./simple.js";
export * from "./shapes.js";
`.trim(),
  );

  // Fixture: barrel file with local re-exports
  writeFileSync(
    path.join(FIXTURE_DIR, "barrel-local.ts"),
    `
const internalFoo = 42;
const internalBar = "hello";
export { internalFoo, internalBar };
`.trim(),
  );

  // Fixture: arrow functions (exported and non-exported)
  writeFileSync(
    path.join(FIXTURE_DIR, "arrow-fns.ts"),
    `
import { greet } from "./simple.js";

const internalHandler = (req: Request) => {
  greet("internal");
  return new Response("ok");
};

export const publicHandler = async (req: Request) => {
  return new Response("public");
};

const plainValue = 42;
const plainString = "hello";
`.trim(),
  );

  // Fixture: barrel file with mixed re-exports
  writeFileSync(
    path.join(FIXTURE_DIR, "barrel-mixed.ts"),
    `
export { greet as hello } from "./simple.js";
export * from "./shapes.js";
export { UserService } from "./user-service.js";
`.trim(),
  );

  // Fixture: inheritance
  writeFileSync(
    path.join(FIXTURE_DIR, "shapes.ts"),
    `
export interface Drawable {
  draw(): void;
}

export class Shape {
  x: number = 0;
  y: number = 0;
}

export class Circle extends Shape implements Drawable {
  radius: number = 1;

  draw(): void {
    // draw circle
  }
}

export enum Color {
  Red = "red",
  Blue = "blue",
  Green = "green",
}

export type Point = { x: number; y: number };
`.trim(),
  );
});

afterAll(() => {
  rmSync(FIXTURE_DIR, { recursive: true, force: true });
});

describe("ts-analyzer", () => {
  describe("analyzeFile — symbol extraction", () => {
    it("should extract exported and non-exported functions", async () => {
      const result = await analyzeFile(path.join(FIXTURE_DIR, "simple.ts"), FIXTURE_DIR);

      const greetFn = result.symbols.find((s) => s.name === "greet");
      expect(greetFn).toBeDefined();
      expect(greetFn!.kind).toBe("function");
      expect(greetFn!.exported).toBe(true);
      expect(greetFn!.startLine).toBeGreaterThan(0);

      const helper = result.symbols.find((s) => s.name === "privateHelper");
      expect(helper).toBeDefined();
      expect(helper!.exported).toBe(false);
    });

    it("should extract exported variables", async () => {
      const result = await analyzeFile(path.join(FIXTURE_DIR, "simple.ts"), FIXTURE_DIR);
      const pi = result.symbols.find((s) => s.name === "PI");
      expect(pi).toBeDefined();
      expect(pi!.kind).toBe("variable");
      expect(pi!.exported).toBe(true);
    });

    it("should extract class and its methods", async () => {
      const result = await analyzeFile(path.join(FIXTURE_DIR, "user-service.ts"), FIXTURE_DIR);

      const cls = result.symbols.find((s) => s.name === "UserService");
      expect(cls).toBeDefined();
      expect(cls!.kind).toBe("class");
      expect(cls!.exported).toBe(true);

      const getUser = result.symbols.find((s) => s.name === "getUser");
      expect(getUser).toBeDefined();
      expect(getUser!.kind).toBe("method");
    });

    it("should create belongs_to relations for methods", async () => {
      const result = await analyzeFile(path.join(FIXTURE_DIR, "user-service.ts"), FIXTURE_DIR);
      const belongsTo = result.relations.filter((r) => r.type === "belongs_to");
      expect(belongsTo.length).toBeGreaterThanOrEqual(2); // getUser, deleteUser → UserService
    });

    it("should extract interfaces and type aliases", async () => {
      const result = await analyzeFile(path.join(FIXTURE_DIR, "shapes.ts"), FIXTURE_DIR);

      const drawable = result.symbols.find((s) => s.name === "Drawable");
      expect(drawable).toBeDefined();
      expect(drawable!.kind).toBe("interface");

      const point = result.symbols.find((s) => s.name === "Point");
      expect(point).toBeDefined();
      expect(point!.kind).toBe("type_alias");
    });

    it("should extract enums", async () => {
      const result = await analyzeFile(path.join(FIXTURE_DIR, "shapes.ts"), FIXTURE_DIR);

      const color = result.symbols.find((s) => s.name === "Color");
      expect(color).toBeDefined();
      expect(color!.kind).toBe("enum");
      expect(color!.exported).toBe(true);
    });
  });

  describe("analyzeFile — relation extraction", () => {
    it("should extract import relations", async () => {
      const result = await analyzeFile(path.join(FIXTURE_DIR, "caller.ts"), FIXTURE_DIR);
      const imports = result.relations.filter((r) => r.type === "imports");
      expect(imports.length).toBeGreaterThanOrEqual(2); // greet + UserService

      const greetImport = imports.find(
        (r) => r.fromSymbol === "main" || imports.some((i) => i.toSymbol.includes("greet")),
      );
      expect(greetImport).toBeDefined();
    });

    it("should extract call relations", async () => {
      const result = await analyzeFile(path.join(FIXTURE_DIR, "caller.ts"), FIXTURE_DIR);
      const calls = result.relations.filter((r) => r.type === "calls");
      expect(calls.length).toBeGreaterThanOrEqual(1); // greet("world")
    });

    it("should extract extends relations", async () => {
      const result = await analyzeFile(path.join(FIXTURE_DIR, "shapes.ts"), FIXTURE_DIR);
      const ext = result.relations.filter((r) => r.type === "extends");
      expect(ext.length).toBeGreaterThanOrEqual(1);

      const circleExtends = ext.find(
        (r) => r.fromSymbol === "Circle" && r.toSymbol === "Shape",
      );
      expect(circleExtends).toBeDefined();
    });

    it("should extract implements relations", async () => {
      const result = await analyzeFile(path.join(FIXTURE_DIR, "shapes.ts"), FIXTURE_DIR);
      const impl = result.relations.filter((r) => r.type === "implements");
      expect(impl.length).toBeGreaterThanOrEqual(1);

      const circleImpl = impl.find(
        (r) => r.fromSymbol === "Circle" && r.toSymbol === "Drawable",
      );
      expect(circleImpl).toBeDefined();
    });
  });

  describe("analyzeFile — export declarations (barrel files)", () => {
    it("should extract symbols from named re-exports", async () => {
      const result = await analyzeFile(path.join(FIXTURE_DIR, "barrel-named.ts"), FIXTURE_DIR);

      expect(result.symbols.length).toBeGreaterThan(0);
      const greetReExport = result.symbols.find((s) => s.name === "greet");
      expect(greetReExport).toBeDefined();
      expect(greetReExport!.exported).toBe(true);
    });

    it("should create exports relations for named re-exports", async () => {
      const result = await analyzeFile(path.join(FIXTURE_DIR, "barrel-named.ts"), FIXTURE_DIR);

      const exports = result.relations.filter((r) => r.type === "exports");
      expect(exports.length).toBeGreaterThanOrEqual(2); // greet + UserService
      const greetExport = exports.find((r) => r.toSymbol === "greet");
      expect(greetExport).toBeDefined();
      expect(greetExport!.metadata).toBeDefined();
      expect(greetExport!.metadata?.reExportFrom).toBe("./simple.js");
    });

    it("should create exports relations for star re-exports", async () => {
      const result = await analyzeFile(path.join(FIXTURE_DIR, "barrel-star.ts"), FIXTURE_DIR);

      const exports = result.relations.filter((r) => r.type === "exports");
      expect(exports.length).toBeGreaterThanOrEqual(2); // 2 star re-exports
      const starExport = exports.find((r) => r.metadata?.reExportFrom === "./simple.js");
      expect(starExport).toBeDefined();
      expect(starExport!.toSymbol).toBe("*");
    });

    it("should create exports relations for local re-exports", async () => {
      const result = await analyzeFile(path.join(FIXTURE_DIR, "barrel-local.ts"), FIXTURE_DIR);

      const exports = result.relations.filter((r) => r.type === "exports");
      expect(exports.length).toBeGreaterThanOrEqual(2); // internalFoo + internalBar
      const fooExport = exports.find((r) => r.toSymbol === "internalFoo");
      expect(fooExport).toBeDefined();
    });

    it("should handle mixed re-exports with aliases", async () => {
      const result = await analyzeFile(path.join(FIXTURE_DIR, "barrel-mixed.ts"), FIXTURE_DIR);

      const exports = result.relations.filter((r) => r.type === "exports");
      expect(exports.length).toBeGreaterThanOrEqual(3); // hello (alias), *, UserService
      // Aliased: export { greet as hello } — the exported name is "hello", original is "greet"
      const aliasExport = exports.find((r) => r.toSymbol === "greet" || r.metadata?.originalName === "greet");
      expect(aliasExport).toBeDefined();
    });
  });

  describe("analyzeFile — arrow functions", () => {
    it("should extract non-exported arrow functions as kind function", async () => {
      const result = await analyzeFile(path.join(FIXTURE_DIR, "arrow-fns.ts"), FIXTURE_DIR);

      const handler = result.symbols.find((s) => s.name === "internalHandler");
      expect(handler).toBeDefined();
      expect(handler!.kind).toBe("function");
      expect(handler!.exported).toBe(false);
    });

    it("should extract exported arrow functions as kind function", async () => {
      const result = await analyzeFile(path.join(FIXTURE_DIR, "arrow-fns.ts"), FIXTURE_DIR);

      const handler = result.symbols.find((s) => s.name === "publicHandler");
      expect(handler).toBeDefined();
      expect(handler!.kind).toBe("function");
      expect(handler!.exported).toBe(true);
    });

    it("should NOT extract plain non-exported variables", async () => {
      const result = await analyzeFile(path.join(FIXTURE_DIR, "arrow-fns.ts"), FIXTURE_DIR);

      const plainValue = result.symbols.find((s) => s.name === "plainValue");
      expect(plainValue).toBeUndefined();
      const plainString = result.symbols.find((s) => s.name === "plainString");
      expect(plainString).toBeUndefined();
    });

    it("should capture call relations from arrow function bodies", async () => {
      const result = await analyzeFile(path.join(FIXTURE_DIR, "arrow-fns.ts"), FIXTURE_DIR);

      const calls = result.relations.filter((r) => r.type === "calls");
      const greetCall = calls.find((r) => r.fromSymbol === "internalHandler" && r.toSymbol === "greet");
      expect(greetCall).toBeDefined();
    });
  });

  describe("analyzeFile — relative paths", () => {
    it("should produce relative file paths from basePath", async () => {
      const result = await analyzeFile(path.join(FIXTURE_DIR, "simple.ts"), FIXTURE_DIR);
      expect(result.file).not.toContain(FIXTURE_DIR);
      expect(result.file).toMatch(/simple\.ts$/);
    });
  });

  describe("graceful degradation", () => {
    it("should return file path even when typescript module is loaded", async () => {
      // This test verifies the function returns properly structured results
      // The actual unavailability case is tested via the resetTypeScriptLoader export
      // which allows resetting the lazy loader state for integration testing
      const result = await analyzeFile(path.join(FIXTURE_DIR, "simple.ts"), FIXTURE_DIR);
      expect(result.file).toBe("simple.ts");
      expect(result.symbols.length).toBeGreaterThan(0);
    });
  });
});
