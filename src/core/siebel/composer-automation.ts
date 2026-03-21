/**
 * Siebel Composer Automation — automates Siebel Composer web UI via Playwright.
 *
 * Siebel Composer is a web-based development tool (IP 2015+) that allows
 * configuring repository objects without compiling SRF. Changes are published
 * directly to the server database.
 *
 * This module delegates browser operations to the Playwright MCP integration
 * and provides Siebel-specific navigation and interaction patterns.
 */

import { logger } from "../utils/logger.js";
import { ValidationError } from "../utils/errors.js";
import type { SiebelEnvironment, SiebelComposerResult } from "../../schemas/siebel.schema.js";

/**
 * Options for Composer automation actions.
 */
export interface ComposerActionOptions {
  /** Siebel environment config */
  env: SiebelEnvironment;
  /** Action to perform */
  action: "navigate" | "import_sif" | "edit" | "publish" | "capture";
  /** SIF file path for import action */
  sifPath?: string;
  /** Object name to navigate to or edit */
  objectName?: string;
  /** Property to modify */
  property?: string;
  /** New value for the property */
  value?: string;
  /** CSS selector for waiting/capturing */
  selector?: string;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Build Playwright navigation instructions for Siebel Composer.
 *
 * Returns structured instructions that can be used with the Playwright MCP
 * tools (browser_navigate, browser_click, browser_type, etc.).
 *
 * Note: Actual Playwright page interactions are performed by the MCP Playwright
 * server — this module provides the URL and selector patterns.
 */
export function buildComposerInstructions(options: ComposerActionOptions): ComposerInstructions {
  const { env, action, objectName, property, value, sifPath, selector, timeout } = options;

  const composerUrl = env.composerUrl ?? `${env.url}/composer`;

  logger.info("Building Composer instructions", { action, composerUrl, objectName });

  switch (action) {
    case "navigate":
      return {
        steps: [
          { type: "navigate", url: composerUrl },
          ...(objectName
            ? [
                { type: "wait" as const, selector: selector ?? ".siebel-composer-loaded", timeout: timeout ?? 10000 },
                { type: "click" as const, selector: `[data-object-name="${objectName}"]`, description: `Navigate to ${objectName}` },
              ]
            : [{ type: "wait" as const, selector: selector ?? ".siebel-composer-loaded", timeout: timeout ?? 10000 }]),
        ],
        description: objectName
          ? `Navigate to Siebel Composer and open ${objectName}`
          : "Navigate to Siebel Composer",
      };

    case "import_sif":
      if (!sifPath) {
        throw new ValidationError("sifPath is required for import_sif action", []);
      }
      return {
        steps: [
          { type: "navigate", url: composerUrl },
          { type: "wait", selector: ".siebel-composer-loaded", timeout: timeout ?? 10000 },
          { type: "click", selector: "[data-action='import']", description: "Click Import button" },
          { type: "upload", selector: "input[type='file']", filePath: sifPath, description: "Upload SIF file" },
          { type: "click", selector: "[data-action='confirm-import']", description: "Confirm import" },
          { type: "wait", selector: ".import-success", timeout: timeout ?? 30000 },
        ],
        description: `Import SIF file: ${sifPath}`,
      };

    case "edit":
      if (!objectName || !property || value === undefined) {
        throw new ValidationError("objectName, property, and value are required for edit action", []);
      }
      return {
        steps: [
          { type: "navigate", url: composerUrl },
          { type: "wait", selector: ".siebel-composer-loaded", timeout: timeout ?? 10000 },
          { type: "click", selector: `[data-object-name="${objectName}"]`, description: `Open ${objectName}` },
          { type: "wait", selector: `[data-property="${property}"]`, timeout: timeout ?? 5000 },
          { type: "click", selector: `[data-property="${property}"]`, description: `Select ${property}` },
          { type: "type", selector: `[data-property="${property}"] input`, text: value, description: `Set ${property} = ${value}` },
          { type: "click", selector: "[data-action='save']", description: "Save changes" },
        ],
        description: `Edit ${objectName}.${property} = ${value}`,
      };

    case "publish":
      return {
        steps: [
          { type: "navigate", url: composerUrl },
          { type: "wait", selector: ".siebel-composer-loaded", timeout: timeout ?? 10000 },
          { type: "click", selector: "[data-action='publish']", description: "Click Publish" },
          { type: "click", selector: "[data-action='confirm-publish']", description: "Confirm publish" },
          { type: "wait", selector: ".publish-success", timeout: timeout ?? 30000 },
        ],
        description: "Publish Composer workspace changes",
      };

    case "capture":
      return {
        steps: [
          { type: "navigate", url: composerUrl },
          { type: "wait", selector: selector ?? ".siebel-composer-loaded", timeout: timeout ?? 10000 },
          { type: "screenshot", description: "Capture Composer state" },
        ],
        description: "Capture current Composer state",
      };

    default:
      throw new ValidationError(`Unknown Composer action: ${action}`, []);
  }
}

/**
 * Create a Composer result from action execution.
 */
export function createComposerResult(
  action: string,
  success: boolean,
  message?: string,
  capturedContent?: string,
  screenshotPath?: string,
): SiebelComposerResult {
  return {
    action: action as SiebelComposerResult["action"],
    success,
    message,
    capturedContent,
    screenshotPath,
    timestamp: new Date().toISOString(),
  };
}

/** Structured Playwright instructions for Composer automation. */
export interface ComposerInstructions {
  steps: ComposerStep[];
  description: string;
}

export type ComposerStep =
  | { type: "navigate"; url: string }
  | { type: "wait"; selector: string; timeout?: number }
  | { type: "click"; selector: string; description: string }
  | { type: "type"; selector: string; text: string; description: string }
  | { type: "upload"; selector: string; filePath: string; description: string }
  | { type: "screenshot"; description: string };
