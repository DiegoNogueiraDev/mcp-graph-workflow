/**
 * Web Worker for SIF XML parsing — runs off main thread to avoid UI freezes.
 *
 * Message protocol:
 *   IN:  { type: "parse", content: string, fileName: string }
 *   OUT: { type: "progress", status: string, progress: number }
 *   OUT: { type: "result", data: SifParseResult }
 *   OUT: { type: "error", message: string }
 */

import { XMLParser } from "fast-xml-parser";

// ── Types (mirrored from core, kept minimal for worker bundle) ──

interface SiebelProperty {
  name: string;
  value: string;
}

interface SiebelObject {
  name: string;
  type: string;
  project?: string;
  properties: SiebelProperty[];
  children: SiebelObject[];
  inactive?: boolean;
  parentName?: string;
}

interface SiebelDependency {
  from: { name: string; type: string };
  to: { name: string; type: string };
  relationType: string;
  inferred: boolean;
}

interface SifParseResult {
  metadata: {
    fileName: string;
    repositoryName: string;
    projectName?: string;
    objectCount: number;
    objectTypes: string[];
    extractedAt: string;
  };
  objects: SiebelObject[];
  dependencies: SiebelDependency[];
}

// ── Tag mappings (same as sif-parser.ts) ──

const TAG_TO_TYPE: Record<string, string> = {
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
};

const CHILD_TAG_TO_TYPE: Record<string, string> = {
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
};

const RESERVED_ATTRS = new Set(["NAME", "INACTIVE"]);

// ── Helpers ──

function getArray(obj: Record<string, unknown>, key: string): unknown[] {
  const val = obj[key];
  if (Array.isArray(val)) return val;
  if (val != null) return [val];
  return [];
}

function getAttr(obj: Record<string, unknown>, name: string): string | undefined {
  const val = obj[`@_${name}`];
  return val != null ? String(val) : undefined;
}

function extractProperties(elem: Record<string, unknown>): SiebelProperty[] {
  const props: SiebelProperty[] = [];
  for (const [key, value] of Object.entries(elem)) {
    if (key.startsWith("@_") && !RESERVED_ATTRS.has(key.slice(2))) {
      props.push({ name: key.slice(2), value: String(value) });
    }
  }
  return props;
}

function extractChildren(elem: Record<string, unknown>, parentName: string): SiebelObject[] {
  const children: SiebelObject[] = [];
  for (const [tag, childType] of Object.entries(CHILD_TAG_TO_TYPE)) {
    for (const child of getArray(elem, tag)) {
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
  return children;
}

function findProperty(obj: SiebelObject, propName: string): string | undefined {
  return obj.properties.find((p) => p.name === propName)?.value;
}

function inferDependencies(objects: SiebelObject[]): SiebelDependency[] {
  const deps: SiebelDependency[] = [];
  const objectIndex = new Map<string, SiebelObject>();
  for (const obj of objects) {
    objectIndex.set(`${obj.type}:${obj.name}`, obj);
  }

  for (const obj of objects) {
    if (obj.type === "applet") {
      const busComp = findProperty(obj, "BUS_COMP");
      if (busComp && objectIndex.has(`business_component:${busComp}`)) {
        deps.push({ from: { name: obj.name, type: "applet" }, to: { name: busComp, type: "business_component" }, relationType: "references", inferred: true });
      }
    }

    if (obj.type === "view") {
      const busObject = findProperty(obj, "BUS_OBJECT");
      if (busObject && objectIndex.has(`business_object:${busObject}`)) {
        deps.push({ from: { name: obj.name, type: "view" }, to: { name: busObject, type: "business_object" }, relationType: "references", inferred: true });
      }
      for (const child of obj.children) {
        if (child.type === "applet") {
          const appletName = findProperty(child, "APPLET") ?? child.name;
          if (objectIndex.has(`applet:${appletName}`)) {
            deps.push({ from: { name: obj.name, type: "view" }, to: { name: appletName, type: "applet" }, relationType: "contains", inferred: true });
          }
        }
      }
    }

    if (obj.type === "screen") {
      for (const child of obj.children) {
        if (child.type === "view") {
          const viewName = findProperty(child, "VIEW") ?? child.name;
          if (objectIndex.has(`view:${viewName}`)) {
            deps.push({ from: { name: obj.name, type: "screen" }, to: { name: viewName, type: "view" }, relationType: "contains", inferred: true });
          }
        }
      }
    }

    if (obj.type === "business_object") {
      for (const child of obj.children) {
        if (child.type === "business_component") {
          const bcName = findProperty(child, "BUS_COMP") ?? child.name;
          if (objectIndex.has(`business_component:${bcName}`)) {
            deps.push({ from: { name: obj.name, type: "business_object" }, to: { name: bcName, type: "business_component" }, relationType: "contains", inferred: true });
          }
        }
      }
    }

    if (obj.type === "workflow") {
      const busObject = findProperty(obj, "BUS_OBJECT");
      if (busObject && objectIndex.has(`business_object:${busObject}`)) {
        deps.push({ from: { name: obj.name, type: "workflow" }, to: { name: busObject, type: "business_object" }, relationType: "references", inferred: true });
      }
      for (const child of obj.children) {
        const busService = findProperty(child, "BUS_SERVICE");
        if (busService && objectIndex.has(`business_service:${busService}`)) {
          deps.push({ from: { name: obj.name, type: "workflow" }, to: { name: busService, type: "business_service" }, relationType: "uses", inferred: true });
        }
      }
    }

    if (obj.type === "integration_object") {
      const busComp = findProperty(obj, "BUS_COMP");
      if (busComp && objectIndex.has(`business_component:${busComp}`)) {
        deps.push({ from: { name: obj.name, type: "integration_object" }, to: { name: busComp, type: "business_component" }, relationType: "references", inferred: true });
      }
    }

    if (obj.type === "business_component") {
      const table = findProperty(obj, "TABLE");
      if (table) {
        deps.push({ from: { name: obj.name, type: "business_component" }, to: { name: table, type: "table" }, relationType: "based_on", inferred: true });
      }
      for (const child of obj.children) {
        if (child.type === "link") {
          const childBc = findProperty(child, "CHILD_BC");
          if (childBc && objectIndex.has(`business_component:${childBc}`)) {
            deps.push({ from: { name: obj.name, type: "business_component" }, to: { name: childBc, type: "business_component" }, relationType: "linked_to", inferred: true });
          }
        }
      }
    }
  }

  return deps;
}

// ── Worker message handler ──

self.onmessage = (event: MessageEvent) => {
  const { type, content, fileName } = event.data;

  if (type !== "parse") return;

  try {
    // Step 1: Parse XML
    self.postMessage({ type: "progress", status: "parsing", progress: 20 });

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      allowBooleanAttributes: true,
      parseAttributeValue: false,
      isArray: () => true,
    });

    const parsed = parser.parse(content) as Record<string, unknown>;

    // Step 2: Navigate to repository
    self.postMessage({ type: "progress", status: "extracting", progress: 50 });

    const repositories = getArray(parsed, "REPOSITORY");
    if (repositories.length === 0) {
      self.postMessage({ type: "error", message: "SIF file missing REPOSITORY root element" });
      return;
    }

    const repo = repositories[0] as Record<string, unknown>;
    const repositoryName = getAttr(repo, "NAME") ?? "Unknown";
    const projects = getArray(repo, "PROJECT");
    const projectName = projects.length > 0 ? getAttr(projects[0] as Record<string, unknown>, "NAME") : undefined;

    // Step 3: Extract objects
    const objects: SiebelObject[] = [];
    for (const proj of projects) {
      const projObj = proj as Record<string, unknown>;
      const projName = getAttr(projObj, "NAME") ?? "Unknown";
      for (const [tag, siebelType] of Object.entries(TAG_TO_TYPE)) {
        for (const elem of getArray(projObj, tag)) {
          const e = elem as Record<string, unknown>;
          const name = getAttr(e, "NAME");
          if (!name) continue;
          objects.push({
            name,
            type: siebelType,
            project: projName,
            properties: extractProperties(e),
            children: extractChildren(e, name),
            inactive: getAttr(e, "INACTIVE") === "Y" || undefined,
          });
        }
      }
    }

    // Step 4: Infer dependencies
    self.postMessage({ type: "progress", status: "inferring", progress: 80 });

    const dependencies = inferDependencies(objects);
    const objectTypes = [...new Set(objects.map((o) => o.type))];

    const result: SifParseResult = {
      metadata: {
        fileName,
        repositoryName,
        projectName,
        objectCount: objects.length,
        objectTypes,
        extractedAt: new Date().toISOString(),
      },
      objects,
      dependencies,
    };

    self.postMessage({ type: "progress", status: "done", progress: 100 });
    self.postMessage({ type: "result", data: result });
  } catch (err) {
    self.postMessage({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
