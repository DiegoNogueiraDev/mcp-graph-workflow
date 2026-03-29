/**
 * Construct parser tests for Java, Go, C#, and Rust adapters.
 * Verifies each parser returns >0 constructs for non-trivial code,
 * detects key construct types, and returns empty for empty input.
 */
import { describe, it, expect } from "vitest";
import { JavaParserAdapter } from "../core/translation/parsers/java-parser-adapter.js";
import { GoParserAdapter } from "../core/translation/parsers/go-parser-adapter.js";
import { CSharpParserAdapter } from "../core/translation/parsers/csharp-parser-adapter.js";
import { RustParserAdapter } from "../core/translation/parsers/rust-parser-adapter.js";

// ── Java ─────────────────────────────────────────────

const JAVA_SAMPLE = `
import java.util.List;
import java.util.Optional;

public class OrderService extends BaseService implements Serializable {
  private final List<String> items;

  public Optional<String> findItem(String id) {
    if (id == null) {
      throw new IllegalArgumentException("id required");
    }
    for (String item : items) {
      if (item.equals(id)) {
        return Optional.of(item);
      }
    }
    try {
      return fetchRemote(id);
    } catch (Exception e) {
      return Optional.empty();
    }
  }

  public enum Status {
    ACTIVE, INACTIVE
  }

  public void process() {
    while (hasNext()) {
      next();
    }
    return;
  }
}
`;

// ── Go ───────────────────────────────────────────────

const GO_SAMPLE = `
import "fmt"

type OrderService struct {
  Items []string
}

type Repository interface {
  FindById(id string) (string, error)
}

func (s *OrderService) FindItem(id string) (string, error) {
  if id == "" {
    return "", fmt.Errorf("id required")
  }
  for _, item := range s.Items {
    if item == id {
      return item, nil
    }
  }
  return "", nil
}

func main() {
  switch os.Args[1] {
  case "run":
    fmt.Println("running")
  }
  return
}

const (
  StatusActive = iota
  StatusInactive
)
`;

// ── C# ───────────────────────────────────────────────

const CSHARP_SAMPLE = `
using System;
using System.Collections.Generic;

public class OrderService : BaseService {
  private readonly List<string> _items;

  public string FindItem(string id) {
    if (id == null) {
      throw new ArgumentException("id required");
    }
    foreach (var item in _items) {
      if (item == id) {
        return item;
      }
    }
    try {
      return FetchRemote(id);
    } catch (Exception e) {
      return null;
    }
  }

  public interface IRepository {
    string FindById(string id);
  }

  public enum Status {
    Active,
    Inactive
  }

  public void Process() {
    for (int i = 0; i < 10; i++) {
      Console.WriteLine(i);
    }
    while (HasNext()) {
      Next();
    }
    switch (mode) {
      case "run": break;
    }
    return;
  }
}
`;

// ── Rust ─────────────────────────────────────────────

const RUST_SAMPLE = `
use std::collections::HashMap;

struct OrderService {
  items: Vec<String>,
}

trait Repository {
  fn find_by_id(&self, id: &str) -> Option<String>;
}

enum Status {
  Active,
  Inactive,
}

impl OrderService {
  fn find_item(&self, id: &str) -> Option<&String> {
    if id.is_empty() {
      return None;
    }
    for item in &self.items {
      if item == id {
        return Some(item);
      }
    }
    match self.mode {
      Mode::Fast => self.fast_search(id),
      _ => None,
    }
  }

  fn process(&self) {
    while self.has_next() {
      self.next();
    }
    loop {
      break;
    }
    return;
  }
}
`;

describe("JavaParserAdapter — construct detection", () => {
  const parser = new JavaParserAdapter();

  it("should return >0 constructs for non-trivial code", () => {
    const result = parser.parseSnippet(JAVA_SAMPLE);
    expect(result.length).toBeGreaterThan(0);
  });

  it("should detect uc_fn_def, uc_class_def, uc_if_else", () => {
    const result = parser.parseSnippet(JAVA_SAMPLE);
    expect(result.some((c) => c.constructId === "uc_fn_def")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_class_def")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_if_else")).toBe(true);
  });

  it("should detect uc_extends for class with extends/implements", () => {
    const result = parser.parseSnippet(JAVA_SAMPLE);
    expect(result.some((c) => c.constructId === "uc_extends")).toBe(true);
  });

  it("should detect uc_type_enum", () => {
    const result = parser.parseSnippet(JAVA_SAMPLE);
    expect(result.some((c) => c.constructId === "uc_type_enum")).toBe(true);
  });

  it("should detect try_catch, throw, for_each, while, return, import", () => {
    const result = parser.parseSnippet(JAVA_SAMPLE);
    expect(result.some((c) => c.constructId === "uc_try_catch")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_throw")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_for_each")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_while")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_return")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_import_named")).toBe(true);
  });

  it("should return empty array for empty code", () => {
    expect(parser.parseSnippet("")).toEqual([]);
    expect(parser.parseSnippet("   ")).toEqual([]);
  });
});

describe("GoParserAdapter — construct detection", () => {
  const parser = new GoParserAdapter();

  it("should return >0 constructs for non-trivial code", () => {
    const result = parser.parseSnippet(GO_SAMPLE);
    expect(result.length).toBeGreaterThan(0);
  });

  it("should detect uc_fn_def, uc_class_def, uc_if_else", () => {
    const result = parser.parseSnippet(GO_SAMPLE);
    expect(result.some((c) => c.constructId === "uc_fn_def")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_class_def")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_if_else")).toBe(true);
  });

  it("should detect uc_interface", () => {
    const result = parser.parseSnippet(GO_SAMPLE);
    expect(result.some((c) => c.constructId === "uc_interface")).toBe(true);
  });

  it("should detect uc_type_enum for const iota pattern", () => {
    const result = parser.parseSnippet(GO_SAMPLE);
    expect(result.some((c) => c.constructId === "uc_type_enum")).toBe(true);
  });

  it("should detect for_each, switch, return, import", () => {
    const result = parser.parseSnippet(GO_SAMPLE);
    expect(result.some((c) => c.constructId === "uc_for_each")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_switch")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_return")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_import_named")).toBe(true);
  });

  it("should return empty array for empty code", () => {
    expect(parser.parseSnippet("")).toEqual([]);
    expect(parser.parseSnippet("   ")).toEqual([]);
  });
});

describe("CSharpParserAdapter — construct detection", () => {
  const parser = new CSharpParserAdapter();

  it("should return >0 constructs for non-trivial code", () => {
    const result = parser.parseSnippet(CSHARP_SAMPLE);
    expect(result.length).toBeGreaterThan(0);
  });

  it("should detect uc_fn_def, uc_class_def, uc_if_else", () => {
    const result = parser.parseSnippet(CSHARP_SAMPLE);
    expect(result.some((c) => c.constructId === "uc_fn_def")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_class_def")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_if_else")).toBe(true);
  });

  it("should detect uc_extends for class with inheritance", () => {
    const result = parser.parseSnippet(CSHARP_SAMPLE);
    expect(result.some((c) => c.constructId === "uc_extends")).toBe(true);
  });

  it("should detect uc_interface and uc_type_enum", () => {
    const result = parser.parseSnippet(CSHARP_SAMPLE);
    expect(result.some((c) => c.constructId === "uc_interface")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_type_enum")).toBe(true);
  });

  it("should detect try_catch, throw, for_each, while, switch, return, import", () => {
    const result = parser.parseSnippet(CSHARP_SAMPLE);
    expect(result.some((c) => c.constructId === "uc_try_catch")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_throw")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_for_each")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_while")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_switch")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_return")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_import_named")).toBe(true);
  });

  it("should return empty array for empty code", () => {
    expect(parser.parseSnippet("")).toEqual([]);
    expect(parser.parseSnippet("   ")).toEqual([]);
  });
});

describe("RustParserAdapter — construct detection", () => {
  const parser = new RustParserAdapter();

  it("should return >0 constructs for non-trivial code", () => {
    const result = parser.parseSnippet(RUST_SAMPLE);
    expect(result.length).toBeGreaterThan(0);
  });

  it("should detect uc_fn_def, uc_class_def, uc_if_else", () => {
    const result = parser.parseSnippet(RUST_SAMPLE);
    expect(result.some((c) => c.constructId === "uc_fn_def")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_class_def")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_if_else")).toBe(true);
  });

  it("should detect uc_interface (trait) and uc_type_enum", () => {
    const result = parser.parseSnippet(RUST_SAMPLE);
    expect(result.some((c) => c.constructId === "uc_interface")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_type_enum")).toBe(true);
  });

  it("should detect uc_switch (match)", () => {
    const result = parser.parseSnippet(RUST_SAMPLE);
    expect(result.some((c) => c.constructId === "uc_switch")).toBe(true);
  });

  it("should detect for_each, while (loop+while), return, import", () => {
    const result = parser.parseSnippet(RUST_SAMPLE);
    expect(result.some((c) => c.constructId === "uc_for_each")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_while")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_return")).toBe(true);
    expect(result.some((c) => c.constructId === "uc_import_named")).toBe(true);
  });

  it("should return empty array for empty code", () => {
    expect(parser.parseSnippet("")).toEqual([]);
    expect(parser.parseSnippet("   ")).toEqual([]);
  });
});
