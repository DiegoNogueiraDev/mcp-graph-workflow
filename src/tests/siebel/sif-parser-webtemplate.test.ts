import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseSifContent } from "../../core/siebel/sif-parser.js";

const FIXTURE_PATH = join(import.meta.dirname, "../fixtures/sample-webtemplate.sif");
const SIF_CONTENT = readFileSync(FIXTURE_PATH, "utf-8");

describe("sif-parser Web Template extraction", () => {
  it("should extract APPLET_WEB_TEMPLATE as web_template children with WEB_TEMPLATE property", () => {
    const result = parseSifContent(SIF_CONTENT, "sample-webtemplate.sif");
    const applet = result.objects.find((o) => o.name === "Account Form Applet");
    expect(applet).toBeDefined();

    const templates = applet!.children.filter((c) => c.type === "web_template");
    expect(templates.length).toBe(2);
    expect(templates[0].name).toBe("Base");

    const wtProp = templates[0].properties.find((p) => p.name === "WEB_TEMPLATE");
    expect(wtProp).toBeDefined();
    expect(wtProp!.value).toBe("Form Applet Base");
  });

  it("should extract APPLET_WEB_TEMPLATE_ITEM as web_template_item children", () => {
    const result = parseSifContent(SIF_CONTENT, "sample-webtemplate.sif");
    const applet = result.objects.find((o) => o.name === "Account Form Applet");
    expect(applet).toBeDefined();

    const items = applet!.children.filter((c) => c.type === "web_template_item");
    expect(items.length).toBe(2);
    expect(items[0].name).toBe("Name");
    expect(items[1].name).toBe("Status");

    const rowProp = items[0].properties.find((p) => p.name === "ROW");
    expect(rowProp).toBeDefined();
    expect(rowProp!.value).toBe("1");
  });

  it("should infer applet→web_template dependency", () => {
    const result = parseSifContent(SIF_CONTENT, "sample-webtemplate.sif");
    const wtDeps = result.dependencies.filter(
      (d) => d.from.type === "applet" && d.to.type === "web_template" && d.relationType === "references"
    );
    expect(wtDeps.length).toBeGreaterThanOrEqual(1);

    const dep = wtDeps.find((d) => d.from.name === "Account Form Applet" && d.to.name === "Form Applet Base");
    expect(dep).toBeDefined();
  });

  it("should infer view→web_template dependency", () => {
    const result = parseSifContent(SIF_CONTENT, "sample-webtemplate.sif");
    const vtDeps = result.dependencies.filter(
      (d) => d.from.type === "view" && d.to.type === "web_template" && d.relationType === "references"
    );
    expect(vtDeps.length).toBeGreaterThanOrEqual(1);

    const dep = vtDeps.find((d) => d.from.name === "Account Detail View" && d.to.name === "View Detail Base");
    expect(dep).toBeDefined();
  });
});
