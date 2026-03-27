/**
 * SIF Parser — parses Siebel Import Files (.sif) into typed Siebel objects.
 *
 * SIF files are XML-based archives following the hierarchy:
 * Repository → Project → Object Types (Applet, BC, BO, etc.) → Child Elements
 */

import { XMLParser } from "fast-xml-parser";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { logger } from "../utils/logger.js";
import { FileNotFoundError, ValidationError } from "../utils/errors.js";
import type {
  SiebelObject,
  SiebelObjectType,
  SiebelProperty,
  SiebelDependency,
  SiebelSifParseResult,
  SiebelSifMetadata,
} from "../../schemas/siebel.schema.js";

/**
 * Mapping from SIF XML tag names to Siebel object types.
 */
const TAG_TO_TYPE: Record<string, SiebelObjectType> = {
  APPLET: "applet",
  BUSINESS_COMPONENT: "business_component",
  BUSINESS_OBJECT: "business_object",
  VIEW: "view",
  SCREEN: "screen",
  WORKFLOW: "workflow",
  INTEGRATION_OBJECT: "integration_object",
  BUSINESS_SERVICE: "business_service",
  WEB_TEMPLATE: "web_template",
  PICK_LIST: "pick_list",
  TABLE: "table",
  APPLICATION: "application",
};

/**
 * Child element tag names and their mapped types.
 */
const CHILD_TAG_TO_TYPE: Record<string, SiebelObjectType> = {
  FIELD: "field",
  COLUMN: "column",
  CONTROL: "control",
  LIST_COLUMN: "list_column",
  LINK: "link",
  APPLET_WEB_TEMPLATE: "web_template",
  VIEW_WEB_TEMPLATE: "web_template",
  VIEW_APPLET: "applet",
  SCREEN_VIEW: "view",
  APPLET_METHOD_MENU_ITEM: "menu_item",
  BUSINESS_OBJECT_COMPONENT: "business_component",
  BUSINESS_SERVICE_METHOD: "business_service",
  WORKFLOW_STEP: "workflow",
  INTEGRATION_COMPONENT: "business_component",
  APPLET_USER_PROP: "user_property",
  BUSINESS_COMPONENT_USER_PROP: "user_property",
  APPLICATION_USER_PROP: "user_property",
  APPLET_WEB_TEMPLATE_ITEM: "web_template_item",
  VIEW_WEB_TEMPLATE_ITEM: "web_template_item",
  SCREEN_MENU: "screen",
};

/**
 * Script element tag names that contain eScript source code.
 */
const SCRIPT_TAGS = new Set([
  "APPLET_SERVER_SCRIPT",
  "BUSCOMP_SERVER_SCRIPT",
  "APPLICATION_SERVER_SCRIPT",
  "APPLET_BROWSER_SCRIPT",
  "BUSCOMP_BROWSER_SCRIPT",
]);

/** Reserved XML attribute names that are not properties. */
const RESERVED_ATTRS = new Set(["NAME", "INACTIVE"]);

/**
 * Parse SIF XML content string into typed Siebel objects.
 */
export function parseSifContent(content: string, fileName: string): SiebelSifParseResult {
  if (!content || content.trim().length === 0) {
    throw new ValidationError("SIF content is empty", [{ field: "content", message: "empty" }]);
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    allowBooleanAttributes: true,
    parseAttributeValue: false,
    textNodeName: "#text",
    trimValues: false,
    isArray: () => {
      // Force array for repeating elements
      return true;
    },
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(content) as Record<string, unknown>;
  } catch (err) {
    throw new ValidationError("Invalid SIF XML", [
      { field: "xml", message: err instanceof Error ? err.message : String(err) },
    ]);
  }

  // Navigate to REPOSITORY root
  const repositories = getArray(parsed, "REPOSITORY");
  if (repositories.length === 0) {
    throw new ValidationError("SIF file missing REPOSITORY root element", [
      { field: "structure", message: "no REPOSITORY found" },
    ]);
  }

  const repo = repositories[0] as Record<string, unknown>;
  const repositoryName = getAttr(repo, "NAME") ?? "Unknown";

  // Navigate to PROJECT(s)
  const projects = getArray(repo, "PROJECT");
  const projectName = projects.length > 0 ? getAttr(projects[0] as Record<string, unknown>, "NAME") : undefined;

  const objects: SiebelObject[] = [];

  for (const proj of projects) {
    const projObj = proj as Record<string, unknown>;
    const projName = getAttr(projObj, "NAME") ?? "Unknown";
    extractObjectsFromProject(projObj, projName, objects);
  }

  const dependencies = inferDependencies(objects);

  const objectTypes = [...new Set(objects.map((o) => o.type))];

  const metadata: SiebelSifMetadata = {
    fileName,
    repositoryName,
    projectName,
    objectCount: objects.length,
    objectTypes,
    extractedAt: new Date().toISOString(),
  };

  logger.info("SIF parsed", {
    fileName,
    objectCount: String(objects.length),
    dependencyCount: String(dependencies.length),
    objectTypes: objectTypes.join(","),
  });

  return { metadata, objects, dependencies };
}

/**
 * Parse SIF from a file path.
 */
export async function parseSifFile(filePath: string): Promise<SiebelSifParseResult> {
  let content: string;
  try {
    content = await readFile(filePath, "utf-8");
  } catch {
    throw new FileNotFoundError(filePath);
  }

  return parseSifContent(content, basename(filePath));
}

/**
 * Extract top-level objects from a PROJECT element.
 */
function extractObjectsFromProject(
  projObj: Record<string, unknown>,
  projectName: string,
  objects: SiebelObject[],
): void {
  for (const [tag, siebelType] of Object.entries(TAG_TO_TYPE)) {
    const elements = getArray(projObj, tag);
    for (const elem of elements) {
      const obj = elementToSiebelObject(elem as Record<string, unknown>, siebelType, projectName);
      if (obj) {
        objects.push(obj);
      }
    }
  }
}

/**
 * Convert a single XML element into a SiebelObject.
 */
function elementToSiebelObject(
  elem: Record<string, unknown>,
  type: SiebelObjectType,
  projectName: string,
): SiebelObject | null {
  const name = getAttr(elem, "NAME");
  if (!name) return null;

  const properties = extractProperties(elem);
  const children = extractChildren(elem, name);
  const inactive = getAttr(elem, "INACTIVE") === "Y";

  return {
    name,
    type,
    project: projectName,
    properties,
    children,
    inactive: inactive || undefined,
  };
}

/**
 * Extract properties from element attributes.
 */
function extractProperties(elem: Record<string, unknown>): SiebelProperty[] {
  const props: SiebelProperty[] = [];

  for (const [key, value] of Object.entries(elem)) {
    if (key.startsWith("@_") && !RESERVED_ATTRS.has(key.slice(2))) {
      props.push({ name: key.slice(2), value: String(value) });
    }
  }

  return props;
}

/**
 * Extract child elements from a parent element.
 */
function extractChildren(elem: Record<string, unknown>, parentName: string): SiebelObject[] {
  const children: SiebelObject[] = [];

  for (const [tag, childType] of Object.entries(CHILD_TAG_TO_TYPE)) {
    const elements = getArray(elem, tag);
    for (const child of elements) {
      const childObj = child as Record<string, unknown>;
      const name = getAttr(childObj, "NAME");
      if (!name) continue;

      children.push({
        name,
        type: childType,
        properties: extractProperties(childObj),
        children: [],
        parentName,
      });
    }
  }

  // Extract eScript blocks (server/browser scripts)
  for (const scriptTag of SCRIPT_TAGS) {
    const elements = getArray(elem, scriptTag);
    for (const child of elements) {
      const childObj = child as Record<string, unknown>;
      const name = getAttr(childObj, "NAME");
      if (!name) continue;

      const properties = extractProperties(childObj);

      // Extract source code from text content (#text key from fast-xml-parser)
      const sourceCode = extractTextContent(childObj);
      properties.push({ name: "SOURCE_CODE", value: sourceCode });

      const lineCount = sourceCode ? sourceCode.split("\n").length : 0;
      properties.push({ name: "LINE_COUNT", value: String(lineCount) });

      children.push({
        name,
        type: "escript" as SiebelObjectType,
        properties,
        children: [],
        parentName,
      });
    }
  }

  return children;
}

/**
 * Extract text content from an XML element (script source code).
 * fast-xml-parser stores text content in the #text key.
 */
function extractTextContent(elem: Record<string, unknown>): string {
  const text = elem["#text"];
  if (text == null) return "";
  if (Array.isArray(text)) return text.map(String).join("");
  return String(text);
}

/**
 * Infer dependencies between Siebel objects based on known patterns.
 */
function inferDependencies(objects: SiebelObject[]): SiebelDependency[] {
  const deps: SiebelDependency[] = [];
  const objectIndex = new Map<string, SiebelObject>();

  for (const obj of objects) {
    objectIndex.set(`${obj.type}:${obj.name}`, obj);
  }

  for (const obj of objects) {
    // Applet → BC (via BUS_COMP attribute)
    if (obj.type === "applet") {
      const busComp = findProperty(obj, "BUS_COMP");
      if (busComp && objectIndex.has(`business_component:${busComp}`)) {
        deps.push({
          from: { name: obj.name, type: "applet" },
          to: { name: busComp, type: "business_component" },
          relationType: "references",
          inferred: true,
        });
      }
    }

    // Applet/View → Web Template (via WEB_TEMPLATE attribute in children)
    if (obj.type === "applet" || obj.type === "view") {
      for (const child of obj.children) {
        if (child.type === "web_template") {
          const wtName = findProperty(child, "WEB_TEMPLATE");
          if (wtName && objectIndex.has(`web_template:${wtName}`)) {
            deps.push({
              from: { name: obj.name, type: obj.type },
              to: { name: wtName, type: "web_template" },
              relationType: "references",
              inferred: true,
            });
          }
        }
      }
    }

    // View → BO (via BUS_OBJECT attribute)
    if (obj.type === "view") {
      const busObject = findProperty(obj, "BUS_OBJECT");
      if (busObject && objectIndex.has(`business_object:${busObject}`)) {
        deps.push({
          from: { name: obj.name, type: "view" },
          to: { name: busObject, type: "business_object" },
          relationType: "references",
          inferred: true,
        });
      }

      // View → Applet (via VIEW_APPLET children)
      for (const child of obj.children) {
        if (child.type === "applet") {
          const appletName = findProperty(child, "APPLET") ?? child.name;
          if (objectIndex.has(`applet:${appletName}`)) {
            deps.push({
              from: { name: obj.name, type: "view" },
              to: { name: appletName, type: "applet" },
              relationType: "contains",
              inferred: true,
            });
          }
        }
      }
    }

    // Screen → View (via SCREEN_VIEW children)
    if (obj.type === "screen") {
      for (const child of obj.children) {
        if (child.type === "view") {
          const viewName = findProperty(child, "VIEW") ?? child.name;
          if (objectIndex.has(`view:${viewName}`)) {
            deps.push({
              from: { name: obj.name, type: "screen" },
              to: { name: viewName, type: "view" },
              relationType: "contains",
              inferred: true,
            });
          }
        }
      }
    }

    // BO → BC (via BUSINESS_OBJECT_COMPONENT children)
    if (obj.type === "business_object") {
      for (const child of obj.children) {
        if (child.type === "business_component") {
          const bcName = findProperty(child, "BUS_COMP") ?? child.name;
          if (objectIndex.has(`business_component:${bcName}`)) {
            deps.push({
              from: { name: obj.name, type: "business_object" },
              to: { name: bcName, type: "business_component" },
              relationType: "contains",
              inferred: true,
            });
          }
        }
      }
    }

    // Workflow → BO (via BUS_OBJECT attribute)
    if (obj.type === "workflow") {
      const busObject = findProperty(obj, "BUS_OBJECT");
      if (busObject && objectIndex.has(`business_object:${busObject}`)) {
        deps.push({
          from: { name: obj.name, type: "workflow" },
          to: { name: busObject, type: "business_object" },
          relationType: "references",
          inferred: true,
        });
      }

      // Workflow → BS (via workflow steps)
      for (const child of obj.children) {
        const busService = findProperty(child, "BUS_SERVICE");
        if (busService && objectIndex.has(`business_service:${busService}`)) {
          deps.push({
            from: { name: obj.name, type: "workflow" },
            to: { name: busService, type: "business_service" },
            relationType: "uses",
            inferred: true,
          });
        }
      }
    }

    // Integration Object → BC (via BUS_COMP attribute or INTEGRATION_COMPONENT children)
    if (obj.type === "integration_object") {
      const busComp = findProperty(obj, "BUS_COMP");
      if (busComp && objectIndex.has(`business_component:${busComp}`)) {
        deps.push({
          from: { name: obj.name, type: "integration_object" },
          to: { name: busComp, type: "business_component" },
          relationType: "references",
          inferred: true,
        });
      }
    }

    // Application → Screen (via SCREEN_MENU children)
    if (obj.type === "application") {
      for (const child of obj.children) {
        if (child.type === "screen") {
          const screenName = findProperty(child, "SCREEN") ?? child.name;
          if (objectIndex.has(`screen:${screenName}`)) {
            deps.push({
              from: { name: obj.name, type: "application" },
              to: { name: screenName, type: "screen" },
              relationType: "contains",
              inferred: true,
            });
          }
        }
      }
    }

    // BC → Table (via TABLE attribute)
    if (obj.type === "business_component") {
      const table = findProperty(obj, "TABLE");
      if (table) {
        deps.push({
          from: { name: obj.name, type: "business_component" },
          to: { name: table, type: "table" },
          relationType: "based_on",
          inferred: true,
        });
      }

      // BC → BC (via LINK children's CHILD_BC)
      for (const child of obj.children) {
        if (child.type === "link") {
          const childBc = findProperty(child, "CHILD_BC");
          if (childBc && objectIndex.has(`business_component:${childBc}`)) {
            deps.push({
              from: { name: obj.name, type: "business_component" },
              to: { name: childBc, type: "business_component" },
              relationType: "linked_to",
              inferred: true,
            });
          }
        }
      }
    }
  }

  return deps;
}

/** Find a property value by name. */
function findProperty(obj: SiebelObject, propName: string): string | undefined {
  return obj.properties.find((p) => p.name === propName)?.value;
}

/** Safely get an array of elements from parsed XML. */
function getArray(obj: Record<string, unknown>, key: string): unknown[] {
  const val = obj[key];
  if (Array.isArray(val)) return val;
  if (val != null) return [val];
  return [];
}

/** Get an XML attribute value. */
function getAttr(obj: Record<string, unknown>, name: string): string | undefined {
  const val = obj[`@_${name}`];
  return val != null ? String(val) : undefined;
}
