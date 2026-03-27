/**
 * LOV Mapper — maps List of Values dependencies from eScript references.
 */

import type { SiebelObject } from "../../schemas/siebel.schema.js";

export interface LovDependent {
  object: string;
  method: string;
  value: string;
}

export interface LovTypeInfo {
  name: string;
  values: string[];
  dependents: LovDependent[];
}

export interface LovMapResult {
  lovTypes: LovTypeInfo[];
  totalLovTypes: number;
}

const LOV_PATTERN = /InvokeMethod\s*\(\s*"LookupValue"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"/g;
const LOOKUP_VALUE_PATTERN = /LookupValue\s*\(\s*"([^"]+)"\s*,\s*"([^"]+)"/g;

/**
 * Map all LOV references from eScript source code.
 */
export function mapLovDependencies(objects: SiebelObject[]): LovMapResult {
  const lovMap = new Map<string, { values: Set<string>; dependents: LovDependent[] }>();

  for (const obj of objects) {
    const scripts = obj.children.filter((c) => c.type === "escript");
    for (const script of scripts) {
      const sourceCode = script.properties.find((p) => p.name === "SOURCE_CODE")?.value ?? "";
      const method = script.properties.find((p) => p.name === "METHOD")?.value ?? script.name;
      if (!sourceCode) continue;

      for (const pattern of [LOV_PATTERN, LOOKUP_VALUE_PATTERN]) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(sourceCode)) !== null) {
          const lovType = match[1];
          const lovValue = match[2];

          const entry = lovMap.get(lovType) ?? { values: new Set(), dependents: [] };
          entry.values.add(lovValue);

          // Avoid duplicate dependents for same object+method
          if (!entry.dependents.some((d) => d.object === obj.name && d.method === method && d.value === lovValue)) {
            entry.dependents.push({ object: obj.name, method, value: lovValue });
          }

          lovMap.set(lovType, entry);
        }
      }
    }
  }

  const lovTypes: LovTypeInfo[] = Array.from(lovMap.entries()).map(([name, data]) => ({
    name,
    values: Array.from(data.values),
    dependents: data.dependents,
  }));

  return { lovTypes, totalLovTypes: lovTypes.length };
}
