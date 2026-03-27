/**
 * eScript Cross-Reference — extracts references to Siebel objects from eScript source code.
 * Detects: GetBusObject, GetBusComp, GetService, GetFieldValue, SetFieldValue,
 * GetProfileAttr, SetProfileAttr, LookupValue.
 */

export type ScriptRefType = "business_object" | "business_component" | "business_service" | "field" | "profile_attr" | "lov";

export interface ScriptReference {
  type: ScriptRefType;
  name: string;
  sourceObject: string;
  sourceMethod: string;
}

interface PatternDef {
  regex: RegExp;
  type: ScriptRefType;
  nameGroup: number;
}

const PATTERNS: PatternDef[] = [
  { regex: /GetBusObject\s*\(\s*"([^"]+)"\s*\)/g, type: "business_object", nameGroup: 1 },
  { regex: /GetBusComp\s*\(\s*"([^"]+)"\s*\)/g, type: "business_component", nameGroup: 1 },
  { regex: /GetService\s*\(\s*"([^"]+)"\s*\)/g, type: "business_service", nameGroup: 1 },
  { regex: /GetFieldValue\s*\(\s*"([^"]+)"\s*\)/g, type: "field", nameGroup: 1 },
  { regex: /SetFieldValue\s*\(\s*"([^"]+)"\s*/g, type: "field", nameGroup: 1 },
  { regex: /GetProfileAttr\s*\(\s*"([^"]+)"\s*\)/g, type: "profile_attr", nameGroup: 1 },
  { regex: /SetProfileAttr\s*\(\s*"([^"]+)"\s*/g, type: "profile_attr", nameGroup: 1 },
  { regex: /LookupValue\s*\(\s*"([^"]+)"\s*,/g, type: "lov", nameGroup: 1 },
  // Also match InvokeMethod("LookupValue", "TYPE", ...) pattern
  { regex: /InvokeMethod\s*\(\s*"LookupValue"\s*,\s*"([^"]+)"\s*/g, type: "lov", nameGroup: 1 },
];

/**
 * Extract references to Siebel objects from eScript source code.
 * Returns deduplicated list of references with source metadata.
 */
export function extractScriptReferences(
  sourceCode: string,
  sourceObject: string,
  sourceMethod: string,
): ScriptReference[] {
  if (!sourceCode || sourceCode.trim().length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const refs: ScriptReference[] = [];

  for (const pattern of PATTERNS) {
    // Reset regex state
    pattern.regex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.regex.exec(sourceCode)) !== null) {
      const name = match[pattern.nameGroup];
      if (!name) continue;

      const key = `${pattern.type}:${name}`;
      if (seen.has(key)) continue;
      seen.add(key);

      refs.push({
        type: pattern.type,
        name,
        sourceObject,
        sourceMethod,
      });
    }
  }

  return refs;
}
