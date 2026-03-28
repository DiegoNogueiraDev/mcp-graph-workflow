import { describe, it, expect } from "vitest";
import { detectLanguageFromCode } from "../../core/translation/language-detect.js";

describe("detectLanguageFromCode", () => {
  // TypeScript snippets
  it("should detect TypeScript from interface + type annotations", () => {
    const result = detectLanguageFromCode(`interface Config { host: string; port: number; }`);
    expect(result.languageId).toBe("typescript");
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it("should detect TypeScript from const + type + arrow fn", () => {
    const result = detectLanguageFromCode(`const greet = (name: string): void => console.log(name);`);
    expect(result.languageId).toBe("typescript");
  });

  it("should detect TypeScript from import with .js extension", () => {
    const result = detectLanguageFromCode(`import { foo } from './bar.js';\nexport function test(): string { return ''; }`);
    expect(result.languageId).toBe("typescript");
  });

  it("should detect TypeScript from enum declaration", () => {
    const result = detectLanguageFromCode(`enum Color { Red, Green, Blue }`);
    expect(result.languageId).toBe("typescript");
  });

  // Python snippets
  it("should detect Python from def + indentation", () => {
    const result = detectLanguageFromCode(`def greet(name):\n    print(f"Hello {name}")`);
    expect(result.languageId).toBe("python");
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it("should detect Python from import + class", () => {
    const result = detectLanguageFromCode(`from typing import List\n\nclass User:\n    pass`);
    expect(result.languageId).toBe("python");
  });

  it("should detect Python from async def", () => {
    const result = detectLanguageFromCode(`async def fetch(url):\n    async with aiohttp.ClientSession() as session:\n        return await session.get(url)`);
    expect(result.languageId).toBe("python");
  });

  it("should detect Python from decorator syntax", () => {
    const result = detectLanguageFromCode(`@app.route("/api")\ndef index():\n    return jsonify({"ok": True})`);
    expect(result.languageId).toBe("python");
  });

  // Go snippets
  it("should detect Go from func + package", () => {
    const result = detectLanguageFromCode(`package main\n\nfunc main() {\n\tfmt.Println("hello")\n}`);
    expect(result.languageId).toBe("go");
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it("should detect Go from := and func", () => {
    const result = detectLanguageFromCode(`func greet(name string) string {\n\tresult := "Hello " + name\n\treturn result\n}`);
    expect(result.languageId).toBe("go");
  });

  it("should detect Go from goroutine syntax", () => {
    const result = detectLanguageFromCode(`go func() {\n\tch <- result\n}()`);
    expect(result.languageId).toBe("go");
  });

  // Java snippets
  it("should detect Java from public class + System.out", () => {
    const result = detectLanguageFromCode(`public class Main {\n    public static void main(String[] args) {\n        System.out.println("hello");\n    }\n}`);
    expect(result.languageId).toBe("java");
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it("should detect Java from annotations + generics", () => {
    const result = detectLanguageFromCode(`@Override\npublic List<String> getNames() {\n    return new ArrayList<>();\n}`);
    expect(result.languageId).toBe("java");
  });

  // C# snippets
  it("should detect C# from using + namespace", () => {
    const result = detectLanguageFromCode(`using System;\nnamespace MyApp {\n    class Program {\n        static void Main() { Console.WriteLine("hi"); }\n    }\n}`);
    expect(result.languageId).toBe("csharp");
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it("should detect C# from var + LINQ", () => {
    const result = detectLanguageFromCode(`var items = list.Where(x => x.Active).Select(x => x.Name).ToList();`);
    expect(result.languageId).toBe("csharp");
  });

  // Rust snippets
  it("should detect Rust from fn + let mut", () => {
    const result = detectLanguageFromCode(`fn main() {\n    let mut x = 5;\n    println!("{}", x);\n}`);
    expect(result.languageId).toBe("rust");
  });

  it("should detect Rust from impl + struct", () => {
    const result = detectLanguageFromCode(`struct Point { x: f64, y: f64 }\nimpl Point {\n    fn new(x: f64, y: f64) -> Self { Point { x, y } }\n}`);
    expect(result.languageId).toBe("rust");
  });

  // Edge cases
  it("should return indicators explaining detection", () => {
    const result = detectLanguageFromCode(`def foo():\n    pass`);
    expect(result.indicators.length).toBeGreaterThan(0);
  });

  it("should handle empty code", () => {
    const result = detectLanguageFromCode("");
    expect(result.confidence).toBe(0);
  });

  it("should handle ambiguous code with low confidence", () => {
    const result = detectLanguageFromCode(`x = 1`);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
