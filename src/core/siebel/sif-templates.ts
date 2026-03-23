/**
 * SIF Template Registry — parameterized XML templates for Siebel object types.
 *
 * Uses XMLBuilder from fast-xml-parser (already in project) to generate valid
 * SIF XML that round-trips through sif-parser.ts.
 */

import { XMLBuilder } from "fast-xml-parser";
import { logger } from "../utils/logger.js";
import type { SifTemplateType } from "../../schemas/siebel.schema.js";

/** Child element definition for a SIF template object. */
export interface SifTemplateChild {
  tag: string;
  attributes: Record<string, string>;
}

/** A single object to include in generated SIF XML. */
export interface SifTemplateObject {
  type: SifTemplateType;
  name: string;
  projectName: string;
  attributes?: Record<string, string>;
  children?: SifTemplateChild[];
}

/** Template metadata for a Siebel object type. */
export interface SifTemplate {
  type: SifTemplateType;
  xmlTag: string;
  requiredAttrs: string[];
  optionalAttrs: string[];
  childTags: string[];
}

/**
 * Mapping from generatable Siebel types to their SIF XML tag and attribute metadata.
 */
const TEMPLATES: Record<SifTemplateType, SifTemplate> = {
  applet: {
    type: "applet",
    xmlTag: "APPLET",
    requiredAttrs: ["NAME", "BUS_COMP"],
    optionalAttrs: ["CLASS", "CHANGED"],
    childTags: ["CONTROL", "LIST_COLUMN", "APPLET_WEB_TEMPLATE", "APPLET_METHOD_MENU_ITEM"],
  },
  business_component: {
    type: "business_component",
    xmlTag: "BUSINESS_COMPONENT",
    requiredAttrs: ["NAME", "TABLE"],
    optionalAttrs: ["CLASS", "CHANGED"],
    childTags: ["FIELD", "LINK"],
  },
  business_object: {
    type: "business_object",
    xmlTag: "BUSINESS_OBJECT",
    requiredAttrs: ["NAME"],
    optionalAttrs: ["CHANGED"],
    childTags: ["BUSINESS_OBJECT_COMPONENT"],
  },
  view: {
    type: "view",
    xmlTag: "VIEW",
    requiredAttrs: ["NAME", "BUS_OBJECT"],
    optionalAttrs: ["CHANGED"],
    childTags: ["VIEW_WEB_TEMPLATE", "VIEW_APPLET"],
  },
  screen: {
    type: "screen",
    xmlTag: "SCREEN",
    requiredAttrs: ["NAME"],
    optionalAttrs: ["CHANGED"],
    childTags: ["SCREEN_VIEW"],
  },
  workflow: {
    type: "workflow",
    xmlTag: "WORKFLOW",
    requiredAttrs: ["NAME"],
    optionalAttrs: ["BUS_OBJECT", "CHANGED"],
    childTags: ["WORKFLOW_STEP"],
  },
  business_service: {
    type: "business_service",
    xmlTag: "BUSINESS_SERVICE",
    requiredAttrs: ["NAME"],
    optionalAttrs: ["CLASS", "CHANGED"],
    childTags: ["BUSINESS_SERVICE_METHOD"],
  },
  integration_object: {
    type: "integration_object",
    xmlTag: "INTEGRATION_OBJECT",
    requiredAttrs: ["NAME"],
    optionalAttrs: ["BUS_COMP", "CHANGED"],
    childTags: ["INTEGRATION_COMPONENT"],
  },
};

/**
 * Type-to-XML-tag mapping (inverse of sif-parser's TAG_TO_TYPE).
 */
const TYPE_TO_TAG: Record<string, string> = Object.fromEntries(
  Object.values(TEMPLATES).map((t) => [t.type, t.xmlTag]),
);

/**
 * Return all available SIF templates.
 */
export function listTemplates(): SifTemplate[] {
  return Object.values(TEMPLATES);
}

/**
 * Return the template for a specific Siebel object type.
 * Returns undefined for non-generatable types (field, column, etc.).
 */
export function getTemplate(type: SifTemplateType): SifTemplate | undefined {
  return TEMPLATES[type];
}

/**
 * Build a complete SIF XML string from template objects.
 *
 * Groups objects by project and generates a valid REPOSITORY → PROJECT → Objects hierarchy.
 * The output is compatible with parseSifContent() for round-trip validation.
 */
export function buildSifXml(objects: SifTemplateObject[]): string {
  logger.info("Building SIF XML", { objectCount: String(objects.length) });

  // Group objects by project
  const byProject = new Map<string, SifTemplateObject[]>();
  for (const obj of objects) {
    const projName = obj.projectName || "Generated Project";
    const existing = byProject.get(projName) ?? [];
    existing.push(obj);
    byProject.set(projName, existing);
  }

  // Build XML structure
  const projectElements: Record<string, unknown>[] = [];

  for (const [projName, projObjects] of byProject) {
    const projectElement: Record<string, unknown> = {
      "@_NAME": projName,
      "@_UPDATED": new Date().toISOString().split("T")[0],
    };

    // Group objects by XML tag
    for (const obj of projObjects) {
      const tag = TYPE_TO_TAG[obj.type];
      if (!tag) {
        logger.debug("Skipping object with unknown type", { type: obj.type, name: obj.name });
        continue;
      }

      const element: Record<string, unknown> = {
        "@_NAME": obj.name,
      };

      // Add attributes
      if (obj.attributes) {
        for (const [key, value] of Object.entries(obj.attributes)) {
          element[`@_${key}`] = value;
        }
      }

      // Add children
      if (obj.children && obj.children.length > 0) {
        for (const child of obj.children) {
          const childElement: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(child.attributes)) {
            childElement[`@_${key}`] = value;
          }

          // Append to array of same-tag children
          if (!element[child.tag]) {
            element[child.tag] = [];
          }
          (element[child.tag] as Record<string, unknown>[]).push(childElement);
        }
      }

      // Append to project (as array to support multiple objects of same type)
      if (!projectElement[tag]) {
        projectElement[tag] = [];
      }
      (projectElement[tag] as Record<string, unknown>[]).push(element);
    }

    projectElements.push(projectElement);
  }

  // If no projects, create an empty one to ensure valid XML
  if (projectElements.length === 0) {
    projectElements.push({
      "@_NAME": "Generated Project",
      "@_UPDATED": new Date().toISOString().split("T")[0],
    });
  }

  const doc = {
    "?xml": { "@_version": "1.0", "@_encoding": "UTF-8" },
    REPOSITORY: {
      "@_NAME": "Siebel Repository",
      "@_UPDATED": new Date().toISOString().split("T")[0],
      PROJECT: projectElements,
    },
  };

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    format: true,
    indentBy: "  ",
    suppressEmptyNode: true,
    processEntities: false,
  });

  const xml = builder.build(doc) as string;

  logger.debug("SIF XML built", {
    projects: String(byProject.size),
    objects: String(objects.length),
    xmlLength: String(xml.length),
  });

  return xml;
}
