import { describe, it, expect } from "vitest";
import { PhpParserAdapter } from "../../core/translation/parsers/php-parser-adapter.js";
import { SwiftParserAdapter } from "../../core/translation/parsers/swift-parser-adapter.js";
import { KotlinParserAdapter } from "../../core/translation/parsers/kotlin-parser-adapter.js";
import { ScalaParserAdapter } from "../../core/translation/parsers/scala-parser-adapter.js";
import { ElixirParserAdapter } from "../../core/translation/parsers/elixir-parser-adapter.js";
import { DartParserAdapter } from "../../core/translation/parsers/dart-parser-adapter.js";
import { HaskellParserAdapter } from "../../core/translation/parsers/haskell-parser-adapter.js";
import { CppParserAdapter } from "../../core/translation/parsers/cpp-parser-adapter.js";
import { LuaParserAdapter } from "../../core/translation/parsers/lua-parser-adapter.js";

const PHP_CODE = `<?php
namespace App\\Controllers;

use App\\Models\\User;

class UserController {
  public function index() {
    try {
      if ($user) {
        foreach ($users as $u) {
          return $u;
        }
      }
    } catch (Exception $e) {
      throw new RuntimeException("error");
    }
  }
}`;

const SWIFT_CODE = `import Foundation

protocol Drawable {
  func draw()
}

class Shape: Drawable {
  func draw() {
    guard let x = optional else { return }
    if x > 0 {
      for item in items {
        return item
      }
    }
    switch value {
    case .a: break
    }
  }
}

enum Color { case red, green, blue }
struct Point { var x: Int; var y: Int }`;

const KOTLIN_CODE = `import kotlin.math.sqrt

interface Printable { fun print() }

data class Point(val x: Int, val y: Int)

enum class Color { RED, GREEN, BLUE }

class Calculator : Printable {
  suspend fun compute(n: Int): Int {
    try {
      if (n > 0) {
        for (i in 1..n) {
          when (i) {
            1 -> return 1
          }
        }
      }
      while (n > 0) {}
    } catch (e: Exception) {
      throw RuntimeException("error")
    }
    return 0
  }

  override fun print() {}
}`;

const SCALA_CODE = `import scala.collection.mutable

trait Printable { def print(): Unit }

case class Point(x: Int, y: Int)

sealed trait Color

object Main {
  def compute(n: Int): Int = {
    try {
      if (n > 0) {
        for (i <- 1 to n) {
          n match {
            case 1 => return 1
          }
        }
      }
      while (false) {}
    } catch {
      case e: Exception => throw new RuntimeException("error")
    }
    return 0
  }
}`;

const ELIXIR_CODE = `defmodule MyApp.Worker do
  import Logger
  alias MyApp.Repo
  use GenServer

  def start_link(opts) do
    if opts[:debug] do
      IO.puts("debug mode")
    end

    unless opts[:silent] do
      IO.puts("starting")
    end

    case opts[:mode] do
      :fast -> :ok
      :slow -> :wait
    end

    cond do
      true -> :ok
    end

    try do
      for item <- opts[:items] do
        process(item)
      end
    rescue
      e -> raise "error: #{inspect(e)}"
    end
  end

  defp private_helper(x), do: x
end`;

const DART_CODE = `import 'package:flutter/material.dart';

abstract class Shape {
  void draw();
}

mixin Colorable {
  String get color;
}

class Circle extends Shape with Colorable {
  String get color => 'red';

  Future<void> asyncMethod() async {
    try {
      if (true) {
        for (var i = 0; i < 10; i++) {
          switch (i) {
            case 0: break;
          }
          while (false) {}
          return;
        }
      }
    } catch (e) {
      throw Exception('error');
    }
  }
}

enum Color { red, green, blue }`;

const HASKELL_CODE = `module MyModule where

import Data.List

class Printable a where
  printIt :: a -> String

data Color = Red | Green | Blue

newtype Wrapper a = Wrapper a

type Name = String

factorial :: Int -> Int
factorial n =
  case n of
    0 -> 1
    _ -> n * factorial (n - 1)

isPositive :: Int -> Bool
isPositive n = if n > 0 then True else False`;

const CPP_CODE = `#include <iostream>
#include <vector>

using namespace std;

namespace MyApp {

template<typename T>
class Container {
  T value;
public:
  T getValue() {
    try {
      if (value > 0) {
        for (int i = 0; i < 10; i++) {
          while (false) {}
          switch (i) {
            case 0: break;
          }
          return value;
        }
      }
    } catch (const exception& e) {
      throw runtime_error("error");
    }
    return value;
  }
};

enum Color { Red, Green, Blue };

struct Point {
  int x;
  int y;
};
}`;

const LUA_CODE = `local json = require("json")
require("utils")

local function helper(x)
  return x * 2
end

function MyModule.process(data)
  if data then
    for i, v in ipairs(data) do
      while v > 0 do
        v = v - 1
      end
      return v
    end
  end

  local ok, err = pcall(function()
    error("something went wrong")
  end)

  repeat
    break
  until true
end`;

// ── Helper ──

function hasConstruct(constructs: Array<{ constructId: string }>, id: string): boolean {
  return constructs.some((c) => c.constructId === id);
}

// ── Tests ──

describe("Wave 2: Parser adapters for 9 additional languages", () => {
  describe("PhpParserAdapter", () => {
    const parser = new PhpParserAdapter();

    it("should have languageId = php", () => {
      expect(parser.languageId).toBe("php");
    });

    it("should return empty array for empty code", () => {
      expect(parser.parseSnippet("")).toEqual([]);
      expect(parser.parseSnippet("   ")).toEqual([]);
    });

    it("should detect >= 5 construct types", () => {
      const result = parser.parseSnippet(PHP_CODE);
      const types = new Set(result.map((c) => c.constructId));
      expect(types.size).toBeGreaterThanOrEqual(5);
    });

    it("should detect uc_class_def, uc_fn_def, uc_if_else, uc_for_each, uc_try_catch", () => {
      const result = parser.parseSnippet(PHP_CODE);
      expect(hasConstruct(result, "uc_class_def")).toBe(true);
      expect(hasConstruct(result, "uc_fn_def")).toBe(true);
      expect(hasConstruct(result, "uc_if_else")).toBe(true);
      expect(hasConstruct(result, "uc_for_each")).toBe(true);
      expect(hasConstruct(result, "uc_try_catch")).toBe(true);
    });

    it("should extract class name", () => {
      const result = parser.parseSnippet(PHP_CODE);
      const cls = result.find((c) => c.constructId === "uc_class_def");
      expect(cls?.name).toBe("UserController");
    });
  });

  describe("SwiftParserAdapter", () => {
    const parser = new SwiftParserAdapter();

    it("should have languageId = swift", () => {
      expect(parser.languageId).toBe("swift");
    });

    it("should return empty array for empty code", () => {
      expect(parser.parseSnippet("")).toEqual([]);
    });

    it("should detect >= 5 construct types", () => {
      const result = parser.parseSnippet(SWIFT_CODE);
      const types = new Set(result.map((c) => c.constructId));
      expect(types.size).toBeGreaterThanOrEqual(5);
    });

    it("should detect uc_class_def, uc_fn_def, uc_interface, uc_if_else, uc_for_each", () => {
      const result = parser.parseSnippet(SWIFT_CODE);
      expect(hasConstruct(result, "uc_class_def")).toBe(true);
      expect(hasConstruct(result, "uc_fn_def")).toBe(true);
      expect(hasConstruct(result, "uc_interface")).toBe(true);
      expect(hasConstruct(result, "uc_if_else")).toBe(true);
      expect(hasConstruct(result, "uc_for_each")).toBe(true);
    });
  });

  describe("KotlinParserAdapter", () => {
    const parser = new KotlinParserAdapter();

    it("should have languageId = kotlin", () => {
      expect(parser.languageId).toBe("kotlin");
    });

    it("should return empty array for empty code", () => {
      expect(parser.parseSnippet("")).toEqual([]);
    });

    it("should detect >= 5 construct types", () => {
      const result = parser.parseSnippet(KOTLIN_CODE);
      const types = new Set(result.map((c) => c.constructId));
      expect(types.size).toBeGreaterThanOrEqual(5);
    });

    it("should detect uc_class_def, uc_fn_def, uc_interface, uc_if_else, uc_for_each", () => {
      const result = parser.parseSnippet(KOTLIN_CODE);
      expect(hasConstruct(result, "uc_class_def")).toBe(true);
      expect(hasConstruct(result, "uc_fn_def")).toBe(true);
      expect(hasConstruct(result, "uc_interface")).toBe(true);
      expect(hasConstruct(result, "uc_if_else")).toBe(true);
      expect(hasConstruct(result, "uc_for_each")).toBe(true);
    });

    it("should detect uc_async_fn for suspend fun", () => {
      const result = parser.parseSnippet(KOTLIN_CODE);
      expect(hasConstruct(result, "uc_async_fn")).toBe(true);
    });
  });

  describe("ScalaParserAdapter", () => {
    const parser = new ScalaParserAdapter();

    it("should have languageId = scala", () => {
      expect(parser.languageId).toBe("scala");
    });

    it("should return empty array for empty code", () => {
      expect(parser.parseSnippet("")).toEqual([]);
    });

    it("should detect >= 5 construct types", () => {
      const result = parser.parseSnippet(SCALA_CODE);
      const types = new Set(result.map((c) => c.constructId));
      expect(types.size).toBeGreaterThanOrEqual(5);
    });

    it("should detect uc_class_def, uc_fn_def, uc_interface, uc_if_else, uc_switch", () => {
      const result = parser.parseSnippet(SCALA_CODE);
      expect(hasConstruct(result, "uc_class_def")).toBe(true);
      expect(hasConstruct(result, "uc_fn_def")).toBe(true);
      expect(hasConstruct(result, "uc_interface")).toBe(true);
      expect(hasConstruct(result, "uc_if_else")).toBe(true);
      expect(hasConstruct(result, "uc_switch")).toBe(true);
    });
  });

  describe("ElixirParserAdapter", () => {
    const parser = new ElixirParserAdapter();

    it("should have languageId = elixir", () => {
      expect(parser.languageId).toBe("elixir");
    });

    it("should return empty array for empty code", () => {
      expect(parser.parseSnippet("")).toEqual([]);
    });

    it("should detect >= 5 construct types", () => {
      const result = parser.parseSnippet(ELIXIR_CODE);
      const types = new Set(result.map((c) => c.constructId));
      expect(types.size).toBeGreaterThanOrEqual(5);
    });

    it("should detect uc_class_def, uc_fn_def, uc_if_else, uc_switch, uc_for_each", () => {
      const result = parser.parseSnippet(ELIXIR_CODE);
      expect(hasConstruct(result, "uc_class_def")).toBe(true);
      expect(hasConstruct(result, "uc_fn_def")).toBe(true);
      expect(hasConstruct(result, "uc_if_else")).toBe(true);
      expect(hasConstruct(result, "uc_switch")).toBe(true);
      expect(hasConstruct(result, "uc_for_each")).toBe(true);
    });
  });

  describe("DartParserAdapter", () => {
    const parser = new DartParserAdapter();

    it("should have languageId = dart", () => {
      expect(parser.languageId).toBe("dart");
    });

    it("should return empty array for empty code", () => {
      expect(parser.parseSnippet("")).toEqual([]);
    });

    it("should detect >= 5 construct types", () => {
      const result = parser.parseSnippet(DART_CODE);
      const types = new Set(result.map((c) => c.constructId));
      expect(types.size).toBeGreaterThanOrEqual(5);
    });

    it("should detect uc_class_def, uc_fn_def, uc_if_else, uc_for_loop, uc_try_catch", () => {
      const result = parser.parseSnippet(DART_CODE);
      expect(hasConstruct(result, "uc_class_def")).toBe(true);
      expect(hasConstruct(result, "uc_fn_def")).toBe(true);
      expect(hasConstruct(result, "uc_if_else")).toBe(true);
      expect(hasConstruct(result, "uc_for_loop")).toBe(true);
      expect(hasConstruct(result, "uc_try_catch")).toBe(true);
    });
  });

  describe("HaskellParserAdapter", () => {
    const parser = new HaskellParserAdapter();

    it("should have languageId = haskell", () => {
      expect(parser.languageId).toBe("haskell");
    });

    it("should return empty array for empty code", () => {
      expect(parser.parseSnippet("")).toEqual([]);
    });

    it("should detect >= 5 construct types", () => {
      const result = parser.parseSnippet(HASKELL_CODE);
      const types = new Set(result.map((c) => c.constructId));
      expect(types.size).toBeGreaterThanOrEqual(5);
    });

    it("should detect uc_class_def, uc_fn_def, uc_interface, uc_type_enum, uc_switch", () => {
      const result = parser.parseSnippet(HASKELL_CODE);
      expect(hasConstruct(result, "uc_class_def")).toBe(true);
      expect(hasConstruct(result, "uc_fn_def")).toBe(true);
      expect(hasConstruct(result, "uc_interface")).toBe(true);
      expect(hasConstruct(result, "uc_type_enum")).toBe(true);
      expect(hasConstruct(result, "uc_switch")).toBe(true);
    });
  });

  describe("CppParserAdapter", () => {
    const parser = new CppParserAdapter();

    it("should have languageId = cpp", () => {
      expect(parser.languageId).toBe("cpp");
    });

    it("should return empty array for empty code", () => {
      expect(parser.parseSnippet("")).toEqual([]);
    });

    it("should detect >= 5 construct types", () => {
      const result = parser.parseSnippet(CPP_CODE);
      const types = new Set(result.map((c) => c.constructId));
      expect(types.size).toBeGreaterThanOrEqual(5);
    });

    it("should detect uc_class_def, uc_fn_def, uc_if_else, uc_for_loop, uc_try_catch", () => {
      const result = parser.parseSnippet(CPP_CODE);
      expect(hasConstruct(result, "uc_class_def")).toBe(true);
      expect(hasConstruct(result, "uc_fn_def")).toBe(true);
      expect(hasConstruct(result, "uc_if_else")).toBe(true);
      expect(hasConstruct(result, "uc_for_loop")).toBe(true);
      expect(hasConstruct(result, "uc_try_catch")).toBe(true);
    });

    it("should detect uc_import_named for #include", () => {
      const result = parser.parseSnippet(CPP_CODE);
      expect(hasConstruct(result, "uc_import_named")).toBe(true);
    });
  });

  describe("LuaParserAdapter", () => {
    const parser = new LuaParserAdapter();

    it("should have languageId = lua", () => {
      expect(parser.languageId).toBe("lua");
    });

    it("should return empty array for empty code", () => {
      expect(parser.parseSnippet("")).toEqual([]);
    });

    it("should detect >= 5 construct types", () => {
      const result = parser.parseSnippet(LUA_CODE);
      const types = new Set(result.map((c) => c.constructId));
      expect(types.size).toBeGreaterThanOrEqual(5);
    });

    it("should detect uc_fn_def, uc_if_else, uc_for_each, uc_while, uc_return", () => {
      const result = parser.parseSnippet(LUA_CODE);
      expect(hasConstruct(result, "uc_fn_def")).toBe(true);
      expect(hasConstruct(result, "uc_if_else")).toBe(true);
      expect(hasConstruct(result, "uc_for_each")).toBe(true);
      expect(hasConstruct(result, "uc_while")).toBe(true);
      expect(hasConstruct(result, "uc_return")).toBe(true);
    });

    it("should detect uc_try_catch for pcall", () => {
      const result = parser.parseSnippet(LUA_CODE);
      expect(hasConstruct(result, "uc_try_catch")).toBe(true);
    });
  });
});
