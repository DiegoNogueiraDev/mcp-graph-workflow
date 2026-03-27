/**
 * Runtime Dependency Builder — creates runtime_depends_on edges from eScript references.
 */

import type { SiebelObject, SiebelDependency, SiebelDependencyRelation } from "../../schemas/siebel.schema.js";
import { extractScriptReferences } from "./escript-crossref.js";
import type { ScriptRefType } from "./escript-crossref.js";

const REF_TYPE_TO_SIEBEL: Record<ScriptRefType, string> = {
  business_object: "business_object",
  business_component: "business_component",
  business_service: "business_service",
  field: "field",
  profile_attr: "field",
  lov: "field",
};

/**
 * Build runtime dependency edges by analyzing eScript source code in all objects.
 */
export function buildRuntimeDeps(objects: SiebelObject[]): SiebelDependency[] {
  const deps: SiebelDependency[] = [];
  const seen = new Set<string>();

  for (const obj of objects) {
    const scripts = obj.children.filter((c) => c.type === "escript");
    for (const script of scripts) {
      const sourceCode = script.properties.find((p) => p.name === "SOURCE_CODE")?.value ?? "";
      const methodName = script.properties.find((p) => p.name === "METHOD")?.value ?? script.name;

      if (!sourceCode) continue;

      const refs = extractScriptReferences(sourceCode, obj.name, methodName);
      for (const ref of refs) {
        // Only create deps for object-level refs (not fields/LOVs)
        const siebelType = REF_TYPE_TO_SIEBEL[ref.type];
        if (!siebelType || ref.type === "field" || ref.type === "profile_attr" || ref.type === "lov") continue;

        const key = `${obj.type}:${obj.name}→${siebelType}:${ref.name}`;
        if (seen.has(key)) continue;
        seen.add(key);

        deps.push({
          from: { name: obj.name, type: obj.type },
          to: { name: ref.name, type: siebelType as SiebelDependency["to"]["type"] },
          relationType: "runtime_depends_on" as SiebelDependencyRelation,
          inferred: true,
        });
      }
    }
  }

  return deps;
}
