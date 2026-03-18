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
    it("should extract exported and non-exported functions", () => {
      const result = analyzeFile(path.join(FIXTURE_DIR, "simple.ts"), FIXTURE_DIR);

      const greetFn = result.symbols.find((s) => s.name === "greet");
      expect(greetFn).toBeDefined();
      expect(greetFn!.kind).toBe("function");
      expect(greetFn!.exported).toBe(true);
      expect(greetFn!.startLine).toBeGreaterThan(0);

      const helper = result.symbols.find((s) => s.name === "privateHelper");
      expect(helper).toBeDefined();
      expect(helper!.exported).toBe(false);
    });

    it("should extract exported variables", () => {
      const result = analyzeFile(path.join(FIXTURE_DIR, "simple.ts"), FIXTURE_DIR);
      const pi = result.symbols.find((s) => s.name === "PI");
      expect(pi).toBeDefined();
      expect(pi!.kind).toBe("variable");
      expect(pi!.exported).toBe(true);
    });

    it("should extract class and its methods", () => {
      const result = analyzeFile(path.join(FIXTURE_DIR, "user-service.ts"), FIXTURE_DIR);

      const cls = result.symbols.find((s) => s.name === "UserService");
      expect(cls).toBeDefined();
      expect(cls!.kind).toBe("class");
      expect(cls!.exported).toBe(true);

      const getUser = result.symbols.find((s) => s.name === "getUser");
      expect(getUser).toBeDefined();
      expect(getUser!.kind).toBe("method");
    });

    it("should create belongs_to relations for methods", () => {
      const result = analyzeFile(path.join(FIXTURE_DIR, "user-service.ts"), FIXTURE_DIR);
      const belongsTo = result.relations.filter((r) => r.type === "belongs_to");
      expect(belongsTo.length).toBeGreaterThanOrEqual(2); // getUser, deleteUser → UserService
    });

    it("should extract interfaces and type aliases", () => {
      const result = analyzeFile(path.join(FIXTURE_DIR, "shapes.ts"), FIXTURE_DIR);

      const drawable = result.symbols.find((s) => s.name === "Drawable");
      expect(drawable).toBeDefined();
      expect(drawable!.kind).toBe("interface");

      const point = result.symbols.find((s) => s.name === "Point");
      expect(point).toBeDefined();
      expect(point!.kind).toBe("type_alias");
    });

    it("should extract enums", () => {
      const result = analyzeFile(path.join(FIXTURE_DIR, "shapes.ts"), FIXTURE_DIR);

      const color = result.symbols.find((s) => s.name === "Color");
      expect(color).toBeDefined();
      expect(color!.kind).toBe("enum");
      expect(color!.exported).toBe(true);
    });
  });

  describe("analyzeFile — relation extraction", () => {
    it("should extract import relations", () => {
      const result = analyzeFile(path.join(FIXTURE_DIR, "caller.ts"), FIXTURE_DIR);
      const imports = result.relations.filter((r) => r.type === "imports");
      expect(imports.length).toBeGreaterThanOrEqual(2); // greet + UserService

      const greetImport = imports.find(
        (r) => r.fromSymbol === "main" || imports.some((i) => i.toSymbol.includes("greet")),
      );
      expect(greetImport).toBeDefined();
    });

    it("should extract call relations", () => {
      const result = analyzeFile(path.join(FIXTURE_DIR, "caller.ts"), FIXTURE_DIR);
      const calls = result.relations.filter((r) => r.type === "calls");
      expect(calls.length).toBeGreaterThanOrEqual(1); // greet("world")
    });

    it("should extract extends relations", () => {
      const result = analyzeFile(path.join(FIXTURE_DIR, "shapes.ts"), FIXTURE_DIR);
      const ext = result.relations.filter((r) => r.type === "extends");
      expect(ext.length).toBeGreaterThanOrEqual(1);

      const circleExtends = ext.find(
        (r) => r.fromSymbol === "Circle" && r.toSymbol === "Shape",
      );
      expect(circleExtends).toBeDefined();
    });

    it("should extract implements relations", () => {
      const result = analyzeFile(path.join(FIXTURE_DIR, "shapes.ts"), FIXTURE_DIR);
      const impl = result.relations.filter((r) => r.type === "implements");
      expect(impl.length).toBeGreaterThanOrEqual(1);

      const circleImpl = impl.find(
        (r) => r.fromSymbol === "Circle" && r.toSymbol === "Drawable",
      );
      expect(circleImpl).toBeDefined();
    });
  });

  describe("analyzeFile — relative paths", () => {
    it("should produce relative file paths from basePath", () => {
      const result = analyzeFile(path.join(FIXTURE_DIR, "simple.ts"), FIXTURE_DIR);
      expect(result.file).not.toContain(FIXTURE_DIR);
      expect(result.file).toMatch(/simple\.ts$/);
    });
  });
});
