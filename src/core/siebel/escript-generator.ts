/**
 * eScript Generator — generates Siebel eScript code for event handlers
 * using patterns learned from the repository.
 *
 * Follows real-world Siebel patterns:
 * - try/catch/finally structure
 * - TheApplication().RaiseErrorText for error handling
 * - Memory cleanup (null assignments) in finally block
 * - Standard event handler signatures
 */

import type { SiebelObject, SiebelObjectType } from "../../schemas/siebel.schema.js";
import { logger } from "../utils/logger.js";

// --- Types ---

export interface EScriptGenerationRequest {
  readonly parentObjectName: string;
  readonly parentObjectType: "applet" | "business_component" | "business_service";
  readonly eventName: string;
  readonly behaviorDescription: string;
  readonly referenceScripts: readonly SiebelObject[];
  readonly knownBcNames?: readonly string[];
  readonly knownFieldNames?: readonly string[];
}

export interface ReferencedEntity {
  readonly name: string;
  readonly type: "bc" | "field" | "service";
}

export interface EScriptGenerationResult {
  readonly script: string;
  readonly eventName: string;
  readonly functionName: string;
  readonly sifXmlBlock: string;
  readonly referencedEntities: readonly ReferencedEntity[];
}

// --- Event handler mappings ---

interface EventHandlerDef {
  functionPrefix: string;
  params: string;
  defaultReturn: string;
  objectVar: string;
  objectAccessor: string;
}

const APPLET_EVENTS: Record<string, EventHandlerDef> = {
  PreInvokeMethod: {
    functionPrefix: "WebApplet",
    params: "MethodName",
    defaultReturn: "return (ContinueOperation);",
    objectVar: "oBC",
    objectAccessor: "this.BusComp()",
  },
  SetFieldValue: {
    functionPrefix: "WebApplet",
    params: "FieldName, FieldValue",
    defaultReturn: "return (ContinueOperation);",
    objectVar: "oBC",
    objectAccessor: "this.BusComp()",
  },
  PreQuery: {
    functionPrefix: "WebApplet",
    params: "",
    defaultReturn: "return (ContinueOperation);",
    objectVar: "oBC",
    objectAccessor: "this.BusComp()",
  },
  WriteRecord: {
    functionPrefix: "WebApplet",
    params: "",
    defaultReturn: "return (ContinueOperation);",
    objectVar: "oBC",
    objectAccessor: "this.BusComp()",
  },
};

const BC_EVENTS: Record<string, EventHandlerDef> = {
  PreSetFieldValue: {
    functionPrefix: "BusComp",
    params: "FieldName, FieldValue",
    defaultReturn: "return (ContinueOperation);",
    objectVar: "oBC",
    objectAccessor: "this",
  },
  PreInvokeMethod: {
    functionPrefix: "BusComp",
    params: "MethodName",
    defaultReturn: "return (ContinueOperation);",
    objectVar: "oBC",
    objectAccessor: "this",
  },
  SetFieldValue: {
    functionPrefix: "BusComp",
    params: "FieldName, FieldValue",
    defaultReturn: "return (ContinueOperation);",
    objectVar: "oBC",
    objectAccessor: "this",
  },
  PreQuery: {
    functionPrefix: "BusComp",
    params: "",
    defaultReturn: "return (ContinueOperation);",
    objectVar: "oBC",
    objectAccessor: "this",
  },
  WriteRecord: {
    functionPrefix: "BusComp",
    params: "",
    defaultReturn: "return (ContinueOperation);",
    objectVar: "oBC",
    objectAccessor: "this",
  },
};

const BS_EVENTS: Record<string, EventHandlerDef> = {
  PreInvokeMethod: {
    functionPrefix: "Service",
    params: "MethodName, Inputs, Outputs",
    defaultReturn: "return (ContinueOperation);",
    objectVar: "oBS",
    objectAccessor: "this",
  },
};

function getEventDef(parentType: string, eventName: string): EventHandlerDef {
  if (parentType === "business_component") {
    return BC_EVENTS[eventName] ?? BC_EVENTS["PreInvokeMethod"];
  }
  if (parentType === "business_service") {
    return BS_EVENTS[eventName] ?? BS_EVENTS["PreInvokeMethod"];
  }
  return APPLET_EVENTS[eventName] ?? APPLET_EVENTS["PreInvokeMethod"];
}

// --- SIF XML tag mapping ---

function getSifScriptTag(parentType: string): string {
  switch (parentType) {
    case "business_component":
      return "BUSCOMP_SERVER_SCRIPT";
    case "business_service":
      return "BUSINESS_SERVICE_SERVER_SCRIPT";
    default:
      return "APPLET_SERVER_SCRIPT";
  }
}

// --- Reference analysis ---

function extractReferencedEntities(
  description: string,
  knownBcNames?: readonly string[],
  knownFieldNames?: readonly string[],
): ReferencedEntity[] {
  const entities: ReferencedEntity[] = [];
  const lower = description.toLowerCase();

  if (knownBcNames) {
    for (const bc of knownBcNames) {
      if (lower.includes(bc.toLowerCase())) {
        entities.push({ name: bc, type: "bc" });
      }
    }
  }

  if (knownFieldNames) {
    for (const field of knownFieldNames) {
      if (lower.includes(field.toLowerCase())) {
        entities.push({ name: field, type: "field" });
      }
    }
  }

  return entities;
}

// --- Main function ---

export function generateEScript(request: EScriptGenerationRequest): EScriptGenerationResult {
  const {
    parentObjectName,
    parentObjectType,
    eventName,
    behaviorDescription,
    knownBcNames,
    knownFieldNames,
  } = request;

  logger.info("escript-generator", {
    parent: parentObjectName,
    event: eventName,
    description: behaviorDescription.slice(0, 80),
  });

  const eventDef = getEventDef(parentObjectType, eventName);
  const functionName = `${eventDef.functionPrefix}_${eventName}`;
  const paramStr = eventDef.params ? `(${eventDef.params})` : "()";

  // Build the script body
  const todoComment = `// TODO: ${behaviorDescription}`;
  const lines: string[] = [];

  lines.push(`function ${functionName}${paramStr}`);
  lines.push("{");
  lines.push(`  var ${eventDef.objectVar} = ${eventDef.objectAccessor};`);
  lines.push("  try");
  lines.push("  {");
  lines.push(`    ${todoComment}`);

  // Add event-specific boilerplate
  if (eventName === "PreInvokeMethod") {
    lines.push(`    if (${eventDef.params.split(",")[0].trim()} === "")`);
    lines.push("    {");
    lines.push("      // Handle method");
    lines.push("      return (CancelOperation);");
    lines.push("    }");
  } else if (eventName === "SetFieldValue" || eventName === "PreSetFieldValue") {
    lines.push(`    switch (${eventDef.params.split(",")[0].trim()})`);
    lines.push("    {");
    lines.push('      case "":');
    lines.push("        // Handle field change");
    lines.push("        break;");
    lines.push("    }");
  }

  lines.push("  }");
  lines.push("  catch (e)");
  lines.push("  {");
  lines.push("    TheApplication().RaiseErrorText(e.toString());");
  lines.push("  }");
  lines.push("  finally");
  lines.push("  {");
  lines.push(`    ${eventDef.objectVar} = null;`);
  lines.push("  }");
  lines.push(`  ${eventDef.defaultReturn}`);
  lines.push("}");

  const script = lines.join("\n");

  // Build SIF XML block
  const xmlTag = getSifScriptTag(parentObjectType);
  const sifXmlBlock = [
    `<${xmlTag}>`,
    `  <SCRIPT LANGUAGE="JS" EVENT="${eventName}">`,
    `    <![CDATA[${script}]]>`,
    `  </SCRIPT>`,
    `</${xmlTag}>`,
  ].join("\n");

  // Referenced entities
  const referencedEntities = extractReferencedEntities(
    behaviorDescription,
    knownBcNames,
    knownFieldNames,
  );

  logger.debug("escript-generator:complete", {
    functionName,
    scriptLength: String(script.length),
    referencedEntities: String(referencedEntities.length),
  });

  return {
    script,
    eventName,
    functionName,
    sifXmlBlock,
    referencedEntities,
  };
}
