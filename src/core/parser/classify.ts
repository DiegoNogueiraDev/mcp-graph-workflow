/**
 * Stage 3: Heuristic classification.
 * Classify sections and bullet items into semantic types.
 */

import type { NodeType } from "../graph/graph-types.js";

export type BlockType = NodeType | "unknown";

export interface ClassifiedBlock {
  type: BlockType;
  title: string;
  description: string;
  items: ClassifiedItem[];
  startLine: number;
  endLine: number;
  confidence: number;
}

export interface ClassifiedItem {
  type: BlockType;
  text: string;
  line: number;
  confidence: number;
}

// --- Heuristic keyword patterns (Portuguese + English) ---

const REQUIREMENT_PATTERNS = [
  /\bdeve\b/i, /\bprecisa\b/i, /\bnecessário\b/i, /\bmust\b/i,
  /\bshould\b/i, /\brequired\b/i, /\brequisito/i, /\brequirement/i,
];

const CONSTRAINT_PATTERNS = [
  /\bnão deve\b/i, /\bsem\b/i, /\brestrição/i, /\bnão depender/i,
  /\bnão exigir/i, /\bconstraint/i, /\bwithout\b/i, /\bnot allowed/i,
  /\bfora do escopo/i,
];

const TASK_PATTERNS = [
  /\bimplementar\b/i, /\bcriar\b/i, /\badicionar\b/i, /\bdefinir\b/i,
  /\bconstruir\b/i, /\bconfigurar\b/i, /\binstalar\b/i, /\bdesenvolver\b/i,
  /\bimplement\b/i, /\bcreate\b/i, /\bbuild\b/i, /\bset up\b/i,
  /\bdesign\b/i,
];

const ACCEPTANCE_PATTERNS = [
  /\baceite\b/i, /\bcritério/i, /\bdone\b/i, /\bacceptance/i,
  /\bcriterion/i, /\bcriteria/i, /\bdefinition of done/i,
];

const RISK_PATTERNS = [
  /\brisco\b/i, /\brisk\b/i, /\bmitigação/i, /\bmitigation/i,
];

const EPIC_TITLE_PATTERNS = [
  /\bepic\b/i, /\bvisão\b/i, /\bvision\b/i, /\bobjetivo principal/i,
  /\bproduto\b/i, /\bprojeto\b/i,
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

export function classifyText(text: string): { type: BlockType; confidence: number } {
  // Order matters: more specific checks first
  if (matchesAny(text, CONSTRAINT_PATTERNS)) return { type: "constraint", confidence: 0.8 };
  if (matchesAny(text, ACCEPTANCE_PATTERNS)) return { type: "acceptance_criteria", confidence: 0.8 };
  if (matchesAny(text, RISK_PATTERNS)) return { type: "risk", confidence: 0.7 };
  if (matchesAny(text, TASK_PATTERNS)) return { type: "task", confidence: 0.7 };
  if (matchesAny(text, REQUIREMENT_PATTERNS)) return { type: "requirement", confidence: 0.7 };
  return { type: "unknown", confidence: 0.3 };
}

export function classifySectionTitle(title: string, level: number): { type: BlockType; confidence: number } {
  const lower = title.toLowerCase();

  if (matchesAny(lower, ACCEPTANCE_PATTERNS)) return { type: "acceptance_criteria", confidence: 0.9 };
  if (matchesAny(lower, RISK_PATTERNS)) return { type: "risk", confidence: 0.85 };
  if (matchesAny(lower, CONSTRAINT_PATTERNS)) return { type: "constraint", confidence: 0.85 };
  if (/\brequisito/i.test(lower) || /\brequirement/i.test(lower)) return { type: "requirement", confidence: 0.9 };

  if (level === 1 || matchesAny(lower, EPIC_TITLE_PATTERNS)) return { type: "epic", confidence: 0.8 };
  if (/\btask\b/i.test(lower) || /\bentrega/i.test(lower)) return { type: "task", confidence: 0.85 };

  return { type: "unknown", confidence: 0.3 };
}

function parseBulletItems(body: string, startLine: number): ClassifiedItem[] {
  const items: ClassifiedItem[] = [];
  const lines = body.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const bulletMatch = line.match(/^\s*[-]\s+(.+)$/);
    if (!bulletMatch) continue;

    const text = bulletMatch[1].trim();
    const { type, confidence } = classifyText(text);

    items.push({
      type,
      text,
      line: startLine + i,
      confidence,
    });
  }

  return items;
}

function parseNumberedItems(body: string, startLine: number): ClassifiedItem[] {
  const items: ClassifiedItem[] = [];
  const lines = body.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const numMatch = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (!numMatch) continue;

    const text = numMatch[1].trim();
    const { type, confidence } = classifyText(text);

    items.push({
      type,
      text,
      line: startLine + i,
      confidence,
    });
  }

  return items;
}

export function classifySection(
  title: string,
  body: string,
  level: number,
  startLine: number,
  endLine: number,
): ClassifiedBlock {
  const { type: sectionType, confidence: sectionConf } = classifySectionTitle(title, level);

  const bulletItems = parseBulletItems(body, startLine);
  const numberedItems = parseNumberedItems(body, startLine);
  const items = [...bulletItems, ...numberedItems];

  // If the section is a generic "unknown" but its items are mostly tasks, promote it
  let finalType = sectionType;
  let finalConf = sectionConf;

  if (sectionType === "unknown" && items.length > 0) {
    const taskCount = items.filter((it) => it.type === "task").length;
    if (taskCount > items.length / 2) {
      finalType = "task";
      finalConf = 0.6;
    }
  }

  return {
    type: finalType,
    title,
    description: body,
    items,
    startLine,
    endLine,
    confidence: finalConf,
  };
}
