/**
 * Siebel Object ERD Generator — extracts tables, columns, and relationships
 * from BCs/Links and generates Mermaid ER diagrams.
 */

import type { SiebelObject } from "../../schemas/siebel.schema.js";
import { logger } from "../utils/logger.js";

// --- Public types ---

export interface ErdColumn {
  readonly name: string;
  readonly fieldName: string;
}

export interface ErdTable {
  readonly name: string;
  readonly bcName: string;
  readonly columns: readonly ErdColumn[];
}

export interface ErdRelationship {
  readonly fromTable: string;
  readonly toTable: string;
  readonly fromField: string;
  readonly toField: string;
  readonly label: string;
}

export interface ErdResult {
  readonly tables: readonly ErdTable[];
  readonly relationships: readonly ErdRelationship[];
  readonly mermaid: string;
}

// --- Implementation ---

export function generateSiebelErd(
  objects: readonly SiebelObject[],
  projectFilter?: string,
): ErdResult {
  logger.debug("object-erd: generating", { objectCount: objects.length, project: projectFilter });

  let bcs = objects.filter((o) => o.type === "business_component");
  if (projectFilter) {
    bcs = bcs.filter((bc) => bc.project === projectFilter);
  }

  // Build BC → table name map
  const bcToTable = new Map<string, string>();
  for (const bc of bcs) {
    const table = bc.properties.find((p) => p.name === "TABLE")?.value;
    if (table) {
      bcToTable.set(bc.name, table);
    }
  }

  // Extract tables with columns
  const tables: ErdTable[] = [];
  for (const bc of bcs) {
    const tableName = bcToTable.get(bc.name);
    if (!tableName) continue;

    const columns: ErdColumn[] = bc.children
      .filter((c) => c.type === "field")
      .map((f) => ({
        name: f.properties.find((p) => p.name === "COLUMN")?.value ?? f.name,
        fieldName: f.name,
      }));

    tables.push({ name: tableName, bcName: bc.name, columns });
  }

  // Extract relationships from LINK elements
  const relationships: ErdRelationship[] = [];
  for (const bc of bcs) {
    const fromTable = bcToTable.get(bc.name);
    if (!fromTable) continue;

    const links = bc.children.filter((c) => c.type === "link");
    for (const link of links) {
      const childBcName = link.properties.find((p) => p.name === "CHILD_BC")?.value;
      if (!childBcName) continue;

      const toTable = bcToTable.get(childBcName);
      if (!toTable) continue;

      const sourceField = link.properties.find((p) => p.name === "SOURCE_FIELD")?.value ?? "Id";
      const destField = link.properties.find((p) => p.name === "DEST_FIELD")?.value ?? "Parent Id";

      relationships.push({
        fromTable,
        toTable,
        fromField: sourceField,
        toField: destField,
        label: link.name,
      });
    }
  }

  // Generate Mermaid
  const mermaid = generateMermaid(tables, relationships);

  logger.info("object-erd: complete", { tables: tables.length, relationships: relationships.length });

  return { tables, relationships, mermaid };
}

function generateMermaid(tables: readonly ErdTable[], relationships: readonly ErdRelationship[]): string {
  const lines: string[] = ["erDiagram"];

  for (const table of tables) {
    lines.push(`  ${sanitize(table.name)} {`);
    for (const col of table.columns.slice(0, 20)) { // Limit to avoid huge diagrams
      lines.push(`    string ${sanitize(col.name)}`);
    }
    lines.push("  }");
  }

  for (const rel of relationships) {
    lines.push(`  ${sanitize(rel.fromTable)} ||--o{ ${sanitize(rel.toTable)} : "${rel.label}"`);
  }

  return lines.join("\n");
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}
