/**
 * TDD tests for multi-language parser adapters.
 * Task 4.6a-d: Java, Go, C#, Ruby, Rust parser adapters.
 */
import { describe, it, expect } from "vitest";
import { JavaParserAdapter } from "../../core/translation/parsers/java-parser-adapter.js";
import { GoParserAdapter } from "../../core/translation/parsers/go-parser-adapter.js";
import { CSharpParserAdapter } from "../../core/translation/parsers/csharp-parser-adapter.js";
import { RubyParserAdapter } from "../../core/translation/parsers/ruby-parser-adapter.js";
import { RustParserAdapter } from "../../core/translation/parsers/rust-parser-adapter.js";

describe("JavaParserAdapter", () => {
  const parser = new JavaParserAdapter();

  it("should have languageId 'java'", () => {
    expect(parser.languageId).toBe("java");
  });

  it("should detect class declaration", () => {
    const result = parser.parseSnippet("public class UserService {");
    expect(result.some((c) => c.constructId === "uc_class_def" && c.name === "UserService")).toBe(true);
  });

  it("should detect method declaration", () => {
    const result = parser.parseSnippet("  public String getName() {");
    expect(result.some((c) => c.constructId === "uc_fn_def" && c.name === "getName")).toBe(true);
  });

  it("should detect import", () => {
    const result = parser.parseSnippet("import java.util.List;");
    expect(result.some((c) => c.constructId === "uc_import_named")).toBe(true);
  });

  it("should detect try/catch", () => {
    const result = parser.parseSnippet("  try {");
    expect(result.some((c) => c.constructId === "uc_try_catch")).toBe(true);
  });

  it("should detect if/for/while", () => {
    const code = "if (x > 0) {\nfor (int i = 0; i < n; i++) {\nwhile (true) {";
    const result = parser.parseSnippet(code);
    expect(result.some((c) => c.constructId === "uc_if_else")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_for_each")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_while")).toBe(true);
  });

  it("should detect enum", () => {
    const result = parser.parseSnippet("public enum Color {");
    expect(result.some((c) => c.constructId === "uc_type_enum" && c.name === "Color")).toBe(true);
  });

  it("should detect extends/implements", () => {
    const result = parser.parseSnippet("public class Dog extends Animal implements Runnable {");
    expect(result.some((c) => c.constructId === "uc_class_def" && c.name === "Dog")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_extends")).toBe(true);
  });

  it("should return empty array for empty code", () => {
    expect(parser.parseSnippet("")).toEqual([]);
  });

  it("should detect >0 constructs for non-trivial code", () => {
    const code = [
      "import java.util.List;",
      "public class UserService {",
      "  public String getName() {",
      "    if (name != null) {",
      "      return name;",
      "    }",
      "  }",
      "}",
    ].join("\n");
    const result = parser.parseSnippet(code);
    expect(result.length).toBeGreaterThan(0);
    expect(result.some((c) => c.constructId === "uc_fn_def")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_class_def")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_if_else")).toBe(true);
  });
});

describe("GoParserAdapter", () => {
  const parser = new GoParserAdapter();

  it("should have languageId 'go'", () => {
    expect(parser.languageId).toBe("go");
  });

  it("should detect func declaration", () => {
    const result = parser.parseSnippet("func main() {");
    expect(result.some((c) => c.constructId === "uc_fn_def" && c.name === "main")).toBe(true);
  });

  it("should detect struct (class equivalent)", () => {
    const result = parser.parseSnippet("type UserService struct {");
    expect(result.some((c) => c.constructId === "uc_class_def" && c.name === "UserService")).toBe(true);
  });

  it("should detect interface", () => {
    const result = parser.parseSnippet("type Reader interface {");
    expect(result.some((c) => c.constructId === "uc_interface" && c.name === "Reader")).toBe(true);
  });

  it("should detect import", () => {
    const result = parser.parseSnippet('import "fmt"');
    expect(result.some((c) => c.constructId === "uc_import_named")).toBe(true);
  });

  it("should detect if/for", () => {
    const code = "if err != nil {\nfor i := 0; i < n; i++ {";
    const result = parser.parseSnippet(code);
    expect(result.some((c) => c.constructId === "uc_if_else")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_for_each")).toBe(true);
  });

  it("should detect goroutine (async)", () => {
    const result = parser.parseSnippet("go func() {");
    expect(result.some((c) => c.constructId === "uc_async_fn")).toBe(true);
  });

  it("should detect const enum pattern", () => {
    const result = parser.parseSnippet("const (");
    expect(result.some((c) => c.constructId === "uc_type_enum")).toBe(true);
  });

  it("should detect switch", () => {
    const result = parser.parseSnippet("switch value {");
    expect(result.some((c) => c.constructId === "uc_switch")).toBe(true);
  });

  it("should return empty array for empty code", () => {
    expect(parser.parseSnippet("")).toEqual([]);
  });

  it("should detect >0 constructs for non-trivial code", () => {
    const code = [
      'import "fmt"',
      "type UserService struct {",
      "  Name string",
      "}",
      "func (s *UserService) GetName() string {",
      "  if s.Name != \"\" {",
      "    return s.Name",
      "  }",
      '  return "unknown"',
      "}",
    ].join("\n");
    const result = parser.parseSnippet(code);
    expect(result.length).toBeGreaterThan(0);
    expect(result.some((c) => c.constructId === "uc_fn_def")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_class_def")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_if_else")).toBe(true);
  });
});

describe("CSharpParserAdapter", () => {
  const parser = new CSharpParserAdapter();

  it("should have languageId 'csharp'", () => {
    expect(parser.languageId).toBe("csharp");
  });

  it("should detect class declaration", () => {
    const result = parser.parseSnippet("public class UserService {");
    expect(result.some((c) => c.constructId === "uc_class_def" && c.name === "UserService")).toBe(true);
  });

  it("should detect interface", () => {
    const result = parser.parseSnippet("public interface IUserService {");
    expect(result.some((c) => c.constructId === "uc_interface" && c.name === "IUserService")).toBe(true);
  });

  it("should detect async method", () => {
    const result = parser.parseSnippet("  public async Task<string> GetName() {");
    expect(result.some((c) => c.constructId === "uc_async_fn")).toBe(true);
  });

  it("should detect using (import)", () => {
    const result = parser.parseSnippet("using System.Collections.Generic;");
    expect(result.some((c) => c.constructId === "uc_import_named")).toBe(true);
  });

  it("should detect try/catch and throw", () => {
    const code = "try {\n  throw new Exception();\n} catch {";
    const result = parser.parseSnippet(code);
    expect(result.some((c) => c.constructId === "uc_try_catch")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_throw")).toBe(true);
  });

  it("should detect enum", () => {
    const result = parser.parseSnippet("public enum Direction {");
    expect(result.some((c) => c.constructId === "uc_type_enum" && c.name === "Direction")).toBe(true);
  });

  it("should detect class with inheritance (extends)", () => {
    const result = parser.parseSnippet("public class Dog : Animal {");
    expect(result.some((c) => c.constructId === "uc_class_def" && c.name === "Dog")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_extends")).toBe(true);
  });

  it("should detect for/foreach as uc_for_each", () => {
    const code = "for (int i = 0; i < n; i++) {\nforeach (var item in list) {";
    const result = parser.parseSnippet(code);
    const forConstructs = result.filter((c) => c.constructId === "uc_for_each");
    expect(forConstructs.length).toBe(2);
  });

  it("should return empty array for empty code", () => {
    expect(parser.parseSnippet("")).toEqual([]);
  });

  it("should detect >0 constructs for non-trivial code", () => {
    const code = [
      "using System;",
      "public class UserService {",
      "  public string GetName() {",
      "    if (name != null) {",
      "      return name;",
      "    }",
      "  }",
      "}",
    ].join("\n");
    const result = parser.parseSnippet(code);
    expect(result.length).toBeGreaterThan(0);
    expect(result.some((c) => c.constructId === "uc_fn_def")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_class_def")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_if_else")).toBe(true);
  });
});

describe("RubyParserAdapter", () => {
  const parser = new RubyParserAdapter();

  it("should have languageId 'ruby'", () => {
    expect(parser.languageId).toBe("ruby");
  });

  it("should detect def (function)", () => {
    const result = parser.parseSnippet("def add(a, b)");
    expect(result.some((c) => c.constructId === "uc_fn_def" && c.name === "add")).toBe(true);
  });

  it("should detect class", () => {
    const result = parser.parseSnippet("class UserService");
    expect(result.some((c) => c.constructId === "uc_class_def" && c.name === "UserService")).toBe(true);
  });

  it("should detect require (import)", () => {
    const result = parser.parseSnippet("require 'json'");
    expect(result.some((c) => c.constructId === "uc_import_named")).toBe(true);
  });

  it("should detect begin/rescue (try/catch)", () => {
    const result = parser.parseSnippet("begin\n  something\nrescue => e");
    expect(result.some((c) => c.constructId === "uc_try_catch")).toBe(true);
  });

  it("should detect if/while/for", () => {
    const code = "if x > 0\nwhile running\nfor item in list";
    const result = parser.parseSnippet(code);
    expect(result.some((c) => c.constructId === "uc_if_else")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_while")).toBe(true);
  });
});

describe("RustParserAdapter", () => {
  const parser = new RustParserAdapter();

  it("should have languageId 'rust'", () => {
    expect(parser.languageId).toBe("rust");
  });

  it("should detect fn declaration", () => {
    const result = parser.parseSnippet("fn main() {");
    expect(result.some((c) => c.constructId === "uc_fn_def" && c.name === "main")).toBe(true);
  });

  it("should detect async fn", () => {
    const result = parser.parseSnippet("async fn fetch_data() {");
    expect(result.some((c) => c.constructId === "uc_async_fn" && c.name === "fetch_data")).toBe(true);
  });

  it("should detect struct", () => {
    const result = parser.parseSnippet("struct User {");
    expect(result.some((c) => c.constructId === "uc_class_def" && c.name === "User")).toBe(true);
  });

  it("should detect trait (interface)", () => {
    const result = parser.parseSnippet("trait Printable {");
    expect(result.some((c) => c.constructId === "uc_interface" && c.name === "Printable")).toBe(true);
  });

  it("should detect impl", () => {
    const result = parser.parseSnippet("impl User {");
    expect(result.some((c) => c.constructId === "uc_class_def")).toBe(true);
  });

  it("should detect use (import)", () => {
    const result = parser.parseSnippet("use std::collections::HashMap;");
    expect(result.some((c) => c.constructId === "uc_import_named")).toBe(true);
  });

  it("should detect match (switch)", () => {
    const result = parser.parseSnippet("match value {");
    expect(result.some((c) => c.constructId === "uc_switch")).toBe(true);
  });

  it("should detect if/loop/while/for", () => {
    const code = "if x > 0 {\nloop {\nwhile running {\nfor item in list {";
    const result = parser.parseSnippet(code);
    expect(result.some((c) => c.constructId === "uc_if_else")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_while")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_for_each")).toBe(true);
  });

  it("should detect enum as uc_type_enum", () => {
    const result = parser.parseSnippet("enum Color {");
    expect(result.some((c) => c.constructId === "uc_type_enum" && c.name === "Color")).toBe(true);
  });

  it("should return empty array for empty code", () => {
    expect(parser.parseSnippet("")).toEqual([]);
  });

  it("should detect >0 constructs for non-trivial code", () => {
    const code = [
      "use std::io;",
      "struct User {",
      "  name: String,",
      "}",
      "impl User {",
      "  fn get_name(&self) -> &str {",
      "    if !self.name.is_empty() {",
      '      return &self.name;',
      "    }",
      '    "unknown"',
      "  }",
      "}",
    ].join("\n");
    const result = parser.parseSnippet(code);
    expect(result.length).toBeGreaterThan(0);
    expect(result.some((c) => c.constructId === "uc_fn_def")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_class_def")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_if_else")).toBe(true);
  });
});
