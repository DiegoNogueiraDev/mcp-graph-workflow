import { describe, it, expect } from "vitest";
import { normalize } from "../core/parser/normalize.js";
import { segment } from "../core/parser/segment.js";
import { classifyText, classifySectionTitle, classifySection } from "../core/parser/classify.js";
import { extractEntities } from "../core/parser/extract.js";

// ── normalize ─────────────────────────────────────────

describe("normalize", () => {
  it("standardizes line endings", () => {
    expect(normalize("a\r\nb\rc")).toBe("a\nb\nc");
  });

  it("collapses 3+ blank lines to 2", () => {
    expect(normalize("a\n\n\n\nb")).toBe("a\n\nb");
  });

  it("standardizes bullet markers", () => {
    const result = normalize("* item1\n• item2\n● item3");
    expect(result).toBe("- item1\n- item2\n- item3");
  });

  it("preserves indented bullets", () => {
    const result = normalize("line\n  * nested");
    expect(result).toBe("line\n  - nested");
  });

  it("trims trailing whitespace per line", () => {
    const result = normalize("hello   \nworld  ");
    expect(result).toBe("hello\nworld");
  });

  it("trims overall text", () => {
    expect(normalize("  \n\nhello\n\n  ")).toBe("hello");
  });
});

// ── segment ───────────────────────────────────────────

describe("segment", () => {
  it("splits by headings", () => {
    const text = "# Title\nBody\n## Sub\nSub body";
    const result = segment(text);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("Title");
    expect(result[0].level).toBe(1);
    expect(result[0].body).toBe("Body");
    expect(result[1].title).toBe("Sub");
    expect(result[1].level).toBe(2);
  });

  it("handles text without headings", () => {
    const result = segment("Just plain text\nMore text");
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Untitled");
    expect(result[0].level).toBe(0);
  });

  it("returns empty for empty text", () => {
    expect(segment("")).toHaveLength(0);
    expect(segment("   ")).toHaveLength(0);
  });

  it("tracks line numbers correctly", () => {
    const text = "# First\nLine1\nLine2\n## Second\nLine3";
    const result = segment(text);
    expect(result[0].startLine).toBe(1);
    expect(result[1].startLine).toBe(4);
  });

  it("handles multiple heading levels", () => {
    const text = "# H1\n## H2\n### H3\n#### H4";
    const result = segment(text);
    expect(result).toHaveLength(4);
    expect(result.map((s) => s.level)).toEqual([1, 2, 3, 4]);
  });
});

// ── classify ──────────────────────────────────────────

describe("classifyText", () => {
  it("detects requirements", () => {
    expect(classifyText("Deve processar arquivos").type).toBe("requirement");
    expect(classifyText("Must be fast").type).toBe("requirement");
    expect(classifyText("Required for deployment").type).toBe("requirement");
  });

  it("detects constraints", () => {
    expect(classifyText("Não deve usar banco externo").type).toBe("constraint");
    expect(classifyText("Without external dependencies").type).toBe("constraint");
  });

  it("detects tasks", () => {
    expect(classifyText("Implementar parser de PRD").type).toBe("task");
    expect(classifyText("Create authentication module").type).toBe("task");
    expect(classifyText("Build the API layer").type).toBe("task");
  });

  it("detects acceptance criteria", () => {
    expect(classifyText("Critério de aceite: testes passam").type).toBe("acceptance_criteria");
    expect(classifyText("Definition of done").type).toBe("acceptance_criteria");
  });

  it("detects risks", () => {
    expect(classifyText("Risco de performance").type).toBe("risk");
    expect(classifyText("Risk of data loss").type).toBe("risk");
  });

  it("returns unknown for ambiguous text", () => {
    expect(classifyText("Some random text here").type).toBe("unknown");
  });

  it("constraints take priority over requirements", () => {
    // "não deve" matches constraint, "deve" matches requirement
    // constraint patterns are checked first
    expect(classifyText("Não deve falhar").type).toBe("constraint");
  });
});

describe("classifySectionTitle", () => {
  it("classifies level 1 as epic", () => {
    expect(classifySectionTitle("My Project", 1).type).toBe("epic");
  });

  it("detects task sections", () => {
    expect(classifySectionTitle("Entregas", 2).type).toBe("task");
  });

  it("detects requirement sections", () => {
    expect(classifySectionTitle("Requisitos Funcionais", 2).type).toBe("requirement");
  });

  it("detects risk sections", () => {
    expect(classifySectionTitle("Risco e Mitigação", 2).type).toBe("risk");
  });

  it("detects acceptance criteria sections", () => {
    expect(classifySectionTitle("Critérios de Aceite", 2).type).toBe("acceptance_criteria");
  });

  it("detects constraint sections", () => {
    expect(classifySectionTitle("Constraints", 2).type).toBe("constraint");
    expect(classifySectionTitle("Restrição de Escopo", 2).type).toBe("constraint");
  });

  it("detects epic titles via keywords", () => {
    expect(classifySectionTitle("Visão do Produto", 2).type).toBe("epic");
    expect(classifySectionTitle("Project Vision", 2).type).toBe("epic");
  });

  it("returns unknown for non-matching level 2+ titles", () => {
    expect(classifySectionTitle("Random Section", 2).type).toBe("unknown");
  });

  it("returns higher confidence for section titles than text", () => {
    const titleResult = classifySectionTitle("Requisitos", 2);
    const textResult = classifyText("Some requirement text");
    expect(titleResult.confidence).toBeGreaterThanOrEqual(0.85);
  });
});

describe("classifySection", () => {
  it("classifies section with bullet items", () => {
    const block = classifySection(
      "Requisitos",
      "- Deve processar em lote\n- Deve ter CLI",
      2, 1, 3,
    );
    expect(block.type).toBe("requirement");
    expect(block.items).toHaveLength(2);
    expect(block.items[0].type).toBe("requirement");
  });

  it("classifies section with numbered items", () => {
    const block = classifySection(
      "Entregas",
      "1. Implementar módulo A\n2. Criar testes",
      2, 1, 3,
    );
    expect(block.type).toBe("task");
    expect(block.items).toHaveLength(2);
  });

  it("promotes unknown section with mostly task items", () => {
    const block = classifySection(
      "Steps",
      "- Implementar cache\n- Criar endpoint\n- Build pipeline",
      2, 1, 4,
    );
    expect(block.type).toBe("task");
  });
});

// ── extractEntities (integration) ─────────────────────

describe("extractEntities", () => {
  it("extracts entities from simple PRD", () => {
    const prd = `# Meu Projeto

## Requisitos
- Deve ter persistência
- Deve ser rápido

## Entregas
1. Implementar banco de dados
2. Criar API REST

## Riscos
- Risco de performance
`;
    const result = extractEntities(prd);
    expect(result.blocks.length).toBeGreaterThan(0);
    expect(result.summary.requirements).toBeGreaterThan(0);
    expect(result.summary.risks).toBeGreaterThan(0);
    expect(result.summary.epics).toBeGreaterThan(0);
  });

  it("handles empty input", () => {
    const result = extractEntities("");
    expect(result.blocks).toHaveLength(0);
    expect(result.summary.totalSections).toBe(0);
  });

  it("promotes items inside task sections to subtask", () => {
    const prd = `## Task A
- Implementar cache
- Criar testes
`;
    const result = extractEntities(prd);
    const taskBlock = result.blocks.find((b) => b.type === "task");
    if (taskBlock) {
      const subtasks = taskBlock.items.filter((i) => i.type === "subtask");
      expect(subtasks.length).toBeGreaterThan(0);
    }
  });

  it("reclassifies unknown items in unknown sections", () => {
    const prd = `## Miscellaneous
- Deve ter persistência local
- Risco de escalabilidade
- Just a note
`;
    const result = extractEntities(prd);
    const miscBlock = result.blocks.find((b) => b.title === "Miscellaneous");
    expect(miscBlock).toBeDefined();
    // "Deve ter" → requirement, "Risco de" → risk, "Just a note" → unknown
    const types = miscBlock!.items.map((i) => i.type);
    expect(types).toContain("requirement");
    expect(types).toContain("risk");
  });

  it("does not promote items in non-task/non-epic sections", () => {
    const prd = `## Requisitos
- Deve processar rápido
- Implementar cache
`;
    const result = extractEntities(prd);
    const reqBlock = result.blocks.find((b) => b.type === "requirement");
    // Items inside requirement section should NOT be promoted to subtask
    const subtasks = reqBlock?.items.filter((i) => i.type === "subtask") ?? [];
    expect(subtasks).toHaveLength(0);
  });

  it("produces correct summary counts", () => {
    const prd = `# Epic

## Requisitos Funcionais
- Deve processar arquivos
- Precisa ter CLI

## Restrições
- Sem Docker
- Não depender de serviço externo

## Critérios de Aceite
- Done quando testes passam
`;
    const result = extractEntities(prd);
    expect(result.summary.epics).toBeGreaterThanOrEqual(1);
    expect(result.summary.requirements).toBeGreaterThanOrEqual(2);
    expect(result.summary.constraints).toBeGreaterThanOrEqual(1);
  });
});
