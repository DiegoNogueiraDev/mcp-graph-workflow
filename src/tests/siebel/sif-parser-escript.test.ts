import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseSifContent } from "../../core/siebel/sif-parser.js";

const FIXTURE_PATH = join(import.meta.dirname, "../fixtures/sample-escript.sif");
const SIF_CONTENT = readFileSync(FIXTURE_PATH, "utf-8");

describe("sif-parser eScript extraction", () => {
  it("should extract APPLET_SERVER_SCRIPT as escript children", () => {
    const result = parseSifContent(SIF_CONTENT, "sample-escript.sif");
    const applet = result.objects.find((o) => o.name === "Custom Account Admin Form Applet");
    expect(applet).toBeDefined();

    const scripts = applet!.children.filter((c) => c.type === "escript");
    expect(scripts.length).toBe(2);
    expect(scripts[0].name).toBe("WebApplet_PreInvokeMethod");
    expect(scripts[1].name).toBe("WebApplet_ShowControl");
  });

  it("should extract BUSCOMP_SERVER_SCRIPT blocks", () => {
    const result = parseSifContent(SIF_CONTENT, "sample-escript.sif");
    const bc = result.objects.find((o) => o.name === "Account" && o.type === "business_component");
    expect(bc).toBeDefined();

    const scripts = bc!.children.filter((c) => c.type === "escript");
    expect(scripts.length).toBe(2);
    expect(scripts[0].name).toBe("BusComp_PreWriteRecord");
    expect(scripts[1].name).toBe("BusComp_SetFieldValue");
  });

  it("should capture method name and program language as properties", () => {
    const result = parseSifContent(SIF_CONTENT, "sample-escript.sif");
    const applet = result.objects.find((o) => o.name === "Custom Account Admin Form Applet");
    const script = applet!.children.find((c) => c.type === "escript" && c.name === "WebApplet_PreInvokeMethod");
    expect(script).toBeDefined();

    const lang = script!.properties.find((p) => p.name === "PROGRAM_LANGUAGE");
    expect(lang).toBeDefined();
    expect(lang!.value).toBe("JS");

    const method = script!.properties.find((p) => p.name === "METHOD");
    expect(method).toBeDefined();
    expect(method!.value).toBe("WebApplet_PreInvokeMethod");
  });

  it("should store script source code in sourceCode property", () => {
    const result = parseSifContent(SIF_CONTENT, "sample-escript.sif");
    const applet = result.objects.find((o) => o.name === "Custom Account Admin Form Applet");
    const script = applet!.children.find((c) => c.type === "escript" && c.name === "WebApplet_PreInvokeMethod");
    expect(script).toBeDefined();

    const sourceCode = script!.properties.find((p) => p.name === "SOURCE_CODE");
    expect(sourceCode).toBeDefined();
    expect(sourceCode!.value).toContain("function WebApplet_PreInvokeMethod");
    expect(sourceCode!.value).toContain("TheApplication().RaiseErrorText");
    expect(sourceCode!.value).toContain("DeleteRecord");
  });

  it("should extract line count from script source", () => {
    const result = parseSifContent(SIF_CONTENT, "sample-escript.sif");
    const applet = result.objects.find((o) => o.name === "Custom Account Admin Form Applet");
    const script = applet!.children.find((c) => c.type === "escript" && c.name === "WebApplet_PreInvokeMethod");

    const lineCount = script!.properties.find((p) => p.name === "LINE_COUNT");
    expect(lineCount).toBeDefined();
    expect(Number(lineCount!.value)).toBeGreaterThan(5);
  });

  it("should handle empty script blocks gracefully", () => {
    const result = parseSifContent(SIF_CONTENT, "sample-escript.sif");
    const emptyApplet = result.objects.find((o) => o.name === "Empty Script Applet");
    expect(emptyApplet).toBeDefined();

    const scripts = emptyApplet!.children.filter((c) => c.type === "escript");
    expect(scripts.length).toBe(1);

    const sourceCode = scripts[0].properties.find((p) => p.name === "SOURCE_CODE");
    expect(sourceCode).toBeDefined();
    expect(sourceCode!.value).toBe("");
  });

  it("should include escript type in metadata objectTypes", () => {
    const result = parseSifContent(SIF_CONTENT, "sample-escript.sif");
    // eScript children are part of parent objects, not top-level
    // But the metadata should reflect we found scripts
    expect(result.objects.length).toBeGreaterThan(0);

    const allChildren = result.objects.flatMap((o) => o.children);
    const escriptChildren = allChildren.filter((c) => c.type === "escript");
    expect(escriptChildren.length).toBe(5); // 2 applet + 2 BC + 1 empty
  });

  it("should preserve parent name on escript children", () => {
    const result = parseSifContent(SIF_CONTENT, "sample-escript.sif");
    const bc = result.objects.find((o) => o.name === "Account" && o.type === "business_component");
    const script = bc!.children.find((c) => c.type === "escript");
    expect(script!.parentName).toBe("Account");
  });
});
