/**
 * Siebel Object Context Builder — builds token-efficient context combining
 * definition, scripts, user props, dependencies, and similar objects.
 */

import type { SiebelObject, SiebelDependency, SiebelObjectType } from "../../schemas/siebel.schema.js";

/**
 * Build complete context for a Siebel object in compressed markdown format.
 */
export function buildSiebelObjectContext(
  objectName: string,
  objectType: SiebelObjectType,
  objects: SiebelObject[],
  dependencies: SiebelDependency[],
): string {
  const obj = objects.find((o) => o.name === objectName && o.type === objectType && !o.parentName);
  if (!obj) {
    return `Object "${objectName}" (${objectType}) not found.`;
  }

  const parts: string[] = [];

  // Header
  parts.push(`# ${objectType}: ${obj.name}`);
  if (obj.project) parts.push(`Project: ${obj.project}`);

  // Properties (compact)
  if (obj.properties.length > 0) {
    parts.push(`\n## Props`);
    for (const p of obj.properties) {
      parts.push(`${p.name}=${p.value}`);
    }
  }

  // Children by type (grouped)
  const childGroups = new Map<string, SiebelObject[]>();
  for (const child of obj.children) {
    const group = childGroups.get(child.type) ?? [];
    group.push(child);
    childGroups.set(child.type, group);
  }

  for (const [type, children] of childGroups) {
    if (type === "escript") {
      parts.push(`\n## Scripts (${children.length})`);
      for (const script of children) {
        const method = script.properties.find((p) => p.name === "METHOD")?.value ?? script.name;
        const sourceCode = script.properties.find((p) => p.name === "SOURCE_CODE")?.value;
        parts.push(`### ${method}`);
        if (sourceCode) {
          parts.push("```js");
          parts.push(sourceCode);
          parts.push("```");
        }
      }
    } else if (type === "user_property") {
      parts.push(`\n## User Props (${children.length})`);
      for (const up of children) {
        const val = up.properties.find((p) => p.name === "VALUE")?.value ?? "";
        parts.push(`${up.name}=${val}`);
      }
    } else {
      parts.push(`\n## ${type} (${children.length})`);
      for (const child of children) {
        const props = child.properties.map((p) => `${p.name}=${p.value}`).join(", ");
        parts.push(`- ${child.name}${props ? ` (${props})` : ""}`);
      }
    }
  }

  // Dependencies (bidirectional)
  const outbound = dependencies.filter((d) => d.from.name === obj.name && d.from.type === obj.type);
  const inbound = dependencies.filter((d) => d.to.name === obj.name && d.to.type === obj.type);

  if (outbound.length > 0 || inbound.length > 0) {
    parts.push(`\n## Deps`);
    for (const d of outbound) {
      parts.push(`→ ${d.relationType} ${d.to.type}:${d.to.name}`);
    }
    for (const d of inbound) {
      parts.push(`← ${d.from.type}:${d.from.name} ${d.relationType}`);
    }
  }

  return parts.join("\n");
}
