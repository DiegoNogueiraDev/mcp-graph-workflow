/**
 * Scaffold Generator — generates complete Siebel object sets from natural language descriptions.
 *
 * Given a description like "list applet for orders with fields order number, date, status",
 * generates BC + Applet + View (+ optional Screen) with correct properties, naming conventions,
 * and SIF XML.
 *
 * Uses template-learner.ts to learn from real repository objects and apply realistic patterns.
 */

import type { SiebelObject, SiebelObjectType } from "../../schemas/siebel.schema.js";
import { learnTemplates, type LearnedTemplate } from "./template-learner.js";
import { buildSifXml, type SifTemplateObject, type SifTemplateChild } from "./sif-templates.js";
import { logger } from "../utils/logger.js";

// --- Types ---

export interface ScaffoldRequest {
  readonly description: string;
  readonly prefix: string;
  readonly projectName: string;
  readonly referenceObjects: readonly SiebelObject[];
  readonly includeScriptBoilerplate?: boolean;
}

export interface ScaffoldResult {
  readonly objects: readonly SiebelObject[];
  readonly sifXml: string;
  readonly validationScore: number;
  readonly scriptBoilerplate?: readonly string[];
}

// --- Description parsing ---

interface ParsedIntent {
  appletStyle: "list" | "form";
  entityName: string;
  fields: string[];
  includeView: boolean;
  includeScreen: boolean;
}

function parseDescription(description: string): ParsedIntent {
  const lower = description.toLowerCase();

  // Determine applet style
  const appletStyle: "list" | "form" = lower.includes("form") ? "form" : "list";

  // Extract entity name (word after "for" or first noun-like word)
  const forMatch = lower.match(/(?:for|of)\s+(\w+)/);
  const entityName = forMatch ? capitalize(forMatch[1]) : "Entity";

  // Extract field names (after "fields:", "with fields", "campos", or comma-separated terms)
  const fields: string[] = [];
  const fieldMatch = lower.match(/(?:fields?|campos?|with)\s*:?\s*(.+)/);
  if (fieldMatch) {
    const fieldStr = fieldMatch[1];
    const parts = fieldStr.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
      // Clean up common noise words
      const cleaned = part.replace(/^(and|e|com)\s+/i, "").trim();
      if (cleaned && cleaned.length > 1) {
        fields.push(capitalize(cleaned));
      }
    }
  }

  return {
    appletStyle,
    entityName,
    fields,
    includeView: true,
    includeScreen: false, // only on explicit request
  };
}

function capitalize(s: string): string {
  return s.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// --- Template matching ---

function findBestTemplate(
  templates: readonly LearnedTemplate[],
  objectType: SiebelObjectType,
  subType?: string,
): LearnedTemplate | undefined {
  // Exact match first
  if (subType) {
    const exact = templates.find((t) => t.objectType === objectType && t.subType === subType);
    if (exact) return exact;
  }
  // Fallback to any template of this type
  return templates.find((t) => t.objectType === objectType);
}

function getPropertyValue(template: LearnedTemplate | undefined, propName: string): string | undefined {
  if (!template) return undefined;
  const prop = template.commonProperties.find((p) => p.name === propName);
  return prop?.commonValues[0];
}

// --- Script boilerplate ---

const APPLET_SCRIPT_BOILERPLATE = `function WebApplet_PreInvokeMethod (MethodName)
{
  try
  {
    // TODO: implement
    if (MethodName === "")
    {
      return (CancelOperation);
    }
  }
  catch (e)
  {
    TheApplication().RaiseErrorText(e.toString());
  }
  finally
  {
    // Memory cleanup
  }
  return (ContinueOperation);
}`;

const BC_SCRIPT_BOILERPLATE = `function BusComp_PreSetFieldValue (FieldName, FieldValue)
{
  try
  {
    // TODO: implement field-level validation
  }
  catch (e)
  {
    TheApplication().RaiseErrorText(e.toString());
  }
  finally
  {
    // Memory cleanup
  }
  return (ContinueOperation);
}`;

// --- Main function ---

export function scaffoldSiebelObjects(request: ScaffoldRequest): ScaffoldResult {
  const { description, prefix, projectName, referenceObjects, includeScriptBoilerplate } = request;

  logger.info("scaffold-generator", {
    description: description.slice(0, 100),
    prefix,
    projectName,
  });

  // 1. Parse the natural language description
  const intent = parseDescription(description);

  // 2. Learn templates from reference objects
  const templates = learnTemplates([...referenceObjects]);

  // 3. Build the scaffold objects
  const objects: SiebelObject[] = [];
  const sifObjects: SifTemplateObject[] = [];

  const bcName = `${prefix}${intent.entityName}`;
  const appletName = `${prefix}${intent.entityName} ${intent.appletStyle === "list" ? "List" : "Form"} Applet`;
  const viewName = `${prefix}${intent.entityName} View`;
  const tableName = `S_${intent.entityName.toUpperCase().replace(/\s+/g, "_")}`;

  // -- Business Component --
  const bcTemplate = findBestTemplate(templates, "business_component");
  const bcClassValue = getPropertyValue(bcTemplate, "CLASS") ?? "CSSBCBase";

  const bcFields: SiebelObject[] = intent.fields.map((f) =>
    makeSiebelObj({
      name: f,
      type: "field",
      parentName: bcName,
      properties: [
        { name: "COLUMN", value: f.toUpperCase().replace(/\s+/g, "_") },
        { name: "TYPE", value: "DTYPE_TEXT" },
      ],
    }),
  );

  const bcObj = makeSiebelObj({
    name: bcName,
    type: "business_component",
    project: projectName,
    properties: [
      { name: "TABLE", value: tableName },
      { name: "CLASS", value: bcClassValue },
    ],
    children: bcFields,
  });
  objects.push(bcObj);

  const bcSifChildren: SifTemplateChild[] = intent.fields.map((f) => ({
    tag: "FIELD",
    attributes: {
      NAME: f,
      COLUMN: f.toUpperCase().replace(/\s+/g, "_"),
      TYPE: "DTYPE_TEXT",
    },
  }));
  sifObjects.push({
    type: "business_component",
    name: bcName,
    projectName,
    attributes: { TABLE: tableName, CLASS: bcClassValue },
    children: bcSifChildren,
  });

  // -- Applet --
  const appletClass = intent.appletStyle === "list" ? "CSSFrameList" : "CSSFrameBase";
  const appletTemplate = findBestTemplate(templates, "applet", appletClass);
  const appletChildTag = intent.appletStyle === "list" ? "LIST_COLUMN" : "CONTROL";
  const appletChildType: SiebelObjectType = intent.appletStyle === "list" ? "list_column" : "control";

  const appletChildren: SiebelObject[] = intent.fields.map((f) =>
    makeSiebelObj({
      name: f,
      type: appletChildType,
      parentName: appletName,
      properties: [{ name: "FIELD", value: f }],
    }),
  );

  const appletObj = makeSiebelObj({
    name: appletName,
    type: "applet",
    project: projectName,
    properties: [
      { name: "BUS_COMP", value: bcName },
      { name: "CLASS", value: appletClass },
    ],
    children: appletChildren,
  });
  objects.push(appletObj);

  const appletSifChildren: SifTemplateChild[] = intent.fields.map((f) => ({
    tag: appletChildTag,
    attributes: { NAME: f, FIELD: f },
  }));
  sifObjects.push({
    type: "applet",
    name: appletName,
    projectName,
    attributes: { BUS_COMP: bcName, CLASS: appletClass },
    children: appletSifChildren,
  });

  // -- View --
  if (intent.includeView) {
    const viewObj = makeSiebelObj({
      name: viewName,
      type: "view",
      project: projectName,
      properties: [
        { name: "BUS_OBJECT", value: bcName },
      ],
      children: [],
    });
    objects.push(viewObj);

    sifObjects.push({
      type: "view",
      name: viewName,
      projectName,
      attributes: { BUS_OBJECT: bcName },
      children: [{ tag: "VIEW_APPLET", attributes: { NAME: appletName, APPLET: appletName } }],
    });
  }

  // 4. Generate SIF XML
  const sifXml = buildSifXml(sifObjects);

  // 5. Calculate validation score
  const validationScore = calculateScaffoldScore(objects, templates);

  // 6. Generate script boilerplate if requested
  let scriptBoilerplate: string[] | undefined;
  if (includeScriptBoilerplate) {
    scriptBoilerplate = [
      `// --- ${appletName} ---`,
      APPLET_SCRIPT_BOILERPLATE,
      `// --- ${bcName} ---`,
      BC_SCRIPT_BOILERPLATE,
    ];
  }

  logger.info("scaffold-generator:complete", {
    objectCount: String(objects.length),
    validationScore: String(validationScore),
    fields: String(intent.fields.length),
  });

  return {
    objects,
    sifXml,
    validationScore,
    scriptBoilerplate,
  };
}

// --- Helpers ---

function makeSiebelObj(
  overrides: Partial<SiebelObject> & { name: string; type: SiebelObjectType },
): SiebelObject {
  return {
    properties: [],
    children: [],
    ...overrides,
  };
}

function calculateScaffoldScore(
  objects: readonly SiebelObject[],
  templates: readonly LearnedTemplate[],
): number {
  if (objects.length === 0) return 0;

  let totalScore = 0;
  let scored = 0;

  for (const obj of objects) {
    if (obj.parentName) continue; // skip children

    const template = findBestTemplate(templates, obj.type);
    if (template) {
      totalScore += template.computeAdherence(obj);
      scored++;
    } else {
      // No template available — check basic properties exist
      totalScore += basicPropertyScore(obj);
      scored++;
    }
  }

  return scored > 0 ? Math.round(totalScore / scored) : 85;
}

function basicPropertyScore(obj: SiebelObject): number {
  let score = 60; // baseline for having the object at all

  if (obj.type === "business_component" && obj.properties.some((p) => p.name === "TABLE")) score += 20;
  if (obj.type === "applet" && obj.properties.some((p) => p.name === "BUS_COMP")) score += 20;
  if (obj.type === "view" && obj.properties.some((p) => p.name === "BUS_OBJECT")) score += 20;
  if (obj.properties.some((p) => p.name === "CLASS")) score += 10;
  if (obj.name && obj.name.length > 0) score += 10;

  return Math.min(100, score);
}
