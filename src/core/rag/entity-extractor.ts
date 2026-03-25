/**
 * Entity Extractor — heuristic-based extraction of entities and relations
 * from text content. No LLM dependency, uses regex patterns and
 * domain-specific dictionaries.
 *
 * Extends the basic extractEntities from enrichment-pipeline.ts with
 * richer type classification and relation detection.
 */

import { logger } from "../utils/logger.js";
import type { EntityType, EntityRelationType } from "../../schemas/entity.schema.js";

// ── Extracted types ──────────────────────────────────────

export interface ExtractedEntity {
  name: string;
  type: EntityType;
}

export interface ExtractedRelation {
  fromName: string;
  toName: string;
  relationType: EntityRelationType;
  weight: number;
}

// ── Technology dictionary ────────────────────────────────

const TECHNOLOGY_TERMS = new Set([
  "TypeScript", "JavaScript", "Python", "Rust", "Go", "Java", "C#", "Ruby",
  "SQLite", "PostgreSQL", "MySQL", "MongoDB", "Redis", "DynamoDB",
  "React", "Vue", "Angular", "Svelte", "Next.js", "Nuxt",
  "Node.js", "Deno", "Bun",
  "Express", "Fastify", "Koa", "Hono",
  "Docker", "Kubernetes", "Terraform", "AWS", "Azure", "GCP",
  "GraphQL", "REST", "gRPC", "WebSocket",
  "Vitest", "Jest", "Mocha", "Playwright", "Cypress",
  "Webpack", "Vite", "Rollup", "esbuild", "Turbopack",
  "Git", "GitHub", "GitLab",
  "Tailwind", "CSS", "HTML", "Sass", "SCSS",
  "Zod", "Prisma", "Drizzle", "Knex",
  "FTS5", "BM25", "TF-IDF",
  "ESLint", "Prettier", "Biome",
  "Commander.js", "MCP",
]);

// Case-insensitive lookup map
const TECH_LOWER_MAP = new Map<string, string>();
for (const term of TECHNOLOGY_TERMS) {
  TECH_LOWER_MAP.set(term.toLowerCase(), term);
}

// ── Entity extraction patterns ───────────────────────────

/** PascalCase: at least two words joined (e.g., GraphNode, SqliteStore) */
// eslint-disable-next-line security/detect-unsafe-regex -- bounded pattern, safe for identifiers
const PASCAL_CASE_RE = /\b([A-Z][a-z]+(?:[A-Z][a-z0-9]*)+)\b/g;

/** camelCase: starts lowercase, has at least one uppercase (e.g., findNextTask) */
const CAMEL_CASE_RE = /\b([a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*)\b/g;

/** File paths: src/... or similar path patterns */
const FILE_PATH_RE = /\b((?:src|lib|dist|test|tests)\/[\w\-./]+\.(?:ts|js|tsx|jsx|json|md|sql))\b/g;

/** Scoped npm packages: @scope/name */
const SCOPED_PACKAGE_RE = /(@[\w-]+\/[\w-]+)/g;

/** Non-scoped packages after "import" or known patterns */
// eslint-disable-next-line security/detect-unsafe-regex -- bounded pattern for import statements
const PACKAGE_IMPORT_RE = /(?:from\s+["'])([a-z][\w-]*(?:\/[\w-]+)?)(?:["'])/g;

/** API endpoints: GET/POST/PUT/DELETE/PATCH /path */
const API_ENDPOINT_RE = /\b((?:GET|POST|PUT|DELETE|PATCH)\s+\/[\w/\-:{}]+)/g;

/** UPPER_SNAKE_CASE: config constants (at least 2 segments) */
// eslint-disable-next-line security/detect-unsafe-regex -- bounded quantifiers, safe for identifiers
const UPPER_SNAKE_RE = /\b([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\b/g;

/** Markdown headings: ## Title */
const HEADING_RE = /^#{1,3}\s+(.+)$/gm;

/** Backtick-quoted concepts: `something here` (2+ chars) */
const BACKTICK_RE = /`([^`]{2,50})`/g;

// ── Relation extraction patterns ─────────────────────────

interface RelationPattern {
  pattern: RegExp;
  relationType: EntityRelationType;
  weight: number;
}

const RELATION_PATTERNS: RelationPattern[] = [
  { pattern: /\buses\b|\butiliza\b|\busing\b/i, relationType: "uses", weight: 0.8 },
  { pattern: /\bimplements\b|\bimplementa\b|\bimplementing\b/i, relationType: "implements", weight: 0.9 },
  { pattern: /\bdepends\s+on\b|\bdepende\s+de\b/i, relationType: "depends_on", weight: 0.9 },
  { pattern: /\bextends\b|\bestende\b|\bextending\b/i, relationType: "extends", weight: 0.9 },
  { pattern: /\bcalls\b|\bchama\b|\bcalling\b/i, relationType: "calls", weight: 0.7 },
  { pattern: /\bis\s+part\s+of\b|\bfaz\s+parte\s+de\b|\bbelongs\s+to\b/i, relationType: "part_of", weight: 0.8 },
];

/** Import statement: import { X } from "Y" */
const IMPORT_RE = /import\s+\{([^}]+)\}\s+from\s+["']([^"']+)["']/g;

// ── Main extraction functions ────────────────────────────

/**
 * Extract entities from text using heuristic patterns.
 * Returns deduplicated list of entities with type classification.
 */
export function extractEntitiesFromText(text: string): ExtractedEntity[] {
  const seen = new Map<string, ExtractedEntity>();

  function add(name: string, type: EntityType): void {
    const key = `${name}::${type}`;
    if (!seen.has(key)) {
      seen.set(key, { name, type });
    }
  }

  // 1. Technology terms (check before PascalCase to get correct type)
  // Strip trailing punctuation (.!?:) from each word before matching
  const words = text.split(/[\s,;()[\]{}"'`]+/);
  for (const rawWord of words) {
    const word = rawWord.replace(/[.!?:]+$/, "");
    const tech = TECH_LOWER_MAP.get(word.toLowerCase());
    if (tech) {
      add(tech, "technology");
    }
  }

  // 2. PascalCase → class (skip if already a technology)
  PASCAL_CASE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PASCAL_CASE_RE.exec(text)) !== null) {
    const name = match[1];
    if (!TECH_LOWER_MAP.has(name.toLowerCase())) {
      add(name, "class");
    }
  }

  // 3. camelCase → function
  CAMEL_CASE_RE.lastIndex = 0;
  while ((match = CAMEL_CASE_RE.exec(text)) !== null) {
    add(match[1], "function");
  }

  // 4. File paths
  FILE_PATH_RE.lastIndex = 0;
  while ((match = FILE_PATH_RE.exec(text)) !== null) {
    add(match[1], "file");
  }

  // 5. Scoped packages
  SCOPED_PACKAGE_RE.lastIndex = 0;
  while ((match = SCOPED_PACKAGE_RE.exec(text)) !== null) {
    add(match[1], "package");
  }

  // 6. Package imports (non-scoped, from import statements)
  PACKAGE_IMPORT_RE.lastIndex = 0;
  while ((match = PACKAGE_IMPORT_RE.exec(text)) !== null) {
    const pkg = match[1];
    // Skip relative imports
    if (!pkg.startsWith(".") && !pkg.startsWith("/")) {
      add(pkg, "package");
    }
  }

  // 7. API endpoints
  API_ENDPOINT_RE.lastIndex = 0;
  while ((match = API_ENDPOINT_RE.exec(text)) !== null) {
    add(match[1], "api_endpoint");
  }

  // 8. UPPER_SNAKE_CASE config constants
  UPPER_SNAKE_RE.lastIndex = 0;
  while ((match = UPPER_SNAKE_RE.exec(text)) !== null) {
    const name = match[1];
    // Skip common false positives
    if (name.length >= 4 && !["TODO", "NOTE", "FIXME", "HACK"].includes(name)) {
      add(name, "config");
    }
  }

  // 9. Markdown headings → domain terms
  HEADING_RE.lastIndex = 0;
  while ((match = HEADING_RE.exec(text)) !== null) {
    const heading = match[1].trim();
    if (heading.length >= 3 && heading.length <= 80) {
      add(heading, "domain_term");
    }
  }

  // 10. Backtick-quoted concepts
  BACKTICK_RE.lastIndex = 0;
  while ((match = BACKTICK_RE.exec(text)) !== null) {
    const concept = match[1].trim();
    // Skip if it looks like code (has dots, slashes, parens)
    if (concept.length >= 3 && !/[./()[\]{}]/.test(concept)) {
      add(concept, "concept");
    }
  }

  logger.debug("entity-extractor:entities", { count: seen.size });
  return Array.from(seen.values());
}

/**
 * Extract relations between known entities from text.
 * Uses pattern matching on sentences containing entity names.
 */
export function extractRelationsFromText(
  text: string,
  entities: ExtractedEntity[],
): ExtractedRelation[] {
  const relations: ExtractedRelation[] = [];
  const seen = new Set<string>();

  function addRelation(
    from: string,
    to: string,
    type: EntityRelationType,
    weight: number,
  ): void {
    const key = `${from}→${to}→${type}`;
    if (!seen.has(key) && from !== to) {
      seen.add(key);
      relations.push({ fromName: from, toName: to, relationType: type, weight });
    }
  }

  // Split text into sentences for pattern matching
  const sentences = text.split(/[.!?\n]+/).filter((s) => s.trim().length > 0);

  for (const sentence of sentences) {
    // Find which entities appear in this sentence
    const presentEntities = entities.filter(
      (e) => sentence.includes(e.name),
    );

    if (presentEntities.length < 2) continue;

    // Check relation patterns in sentence
    for (const rp of RELATION_PATTERNS) {
      if (rp.pattern.test(sentence)) {
        // Find the entity pair: first entity before pattern, second after
        for (let i = 0; i < presentEntities.length; i++) {
          for (let j = 0; j < presentEntities.length; j++) {
            if (i === j) continue;
            const fromIdx = sentence.indexOf(presentEntities[i].name);
            const toIdx = sentence.indexOf(presentEntities[j].name);
            if (fromIdx < toIdx) {
              addRelation(
                presentEntities[i].name,
                presentEntities[j].name,
                rp.relationType,
                rp.weight,
              );
            }
          }
        }
      }
    }
  }

  // Import statement relations
  IMPORT_RE.lastIndex = 0;
  let importMatch: RegExpExecArray | null;
  while ((importMatch = IMPORT_RE.exec(text)) !== null) {
    const imports = importMatch[1].split(",").map((s) => s.trim());
    const source = importMatch[2];

    for (const imp of imports) {
      const cleanName = imp.replace(/\s+as\s+\w+/, "").trim();
      const matchingEntity = entities.find((e) => e.name === cleanName);
      if (matchingEntity) {
        // Create a "uses" relation from the imported symbol to its source
        addRelation(cleanName, source, "uses", 0.7);
      }
    }
  }

  // Co-occurrence in same heading section → related_to (weak)
  const sections = text.split(/^#{1,3}\s+/m);
  for (const section of sections) {
    const sectionEntities = entities.filter(
      (e) => section.includes(e.name),
    );
    if (sectionEntities.length >= 2 && sectionEntities.length <= 6) {
      for (let i = 0; i < sectionEntities.length; i++) {
        for (let j = i + 1; j < sectionEntities.length; j++) {
          addRelation(
            sectionEntities[i].name,
            sectionEntities[j].name,
            "related_to",
            0.5,
          );
        }
      }
    }
  }

  logger.debug("entity-extractor:relations", { count: relations.length });
  return relations;
}
