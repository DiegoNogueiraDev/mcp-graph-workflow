import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseSifContent } from "../../core/siebel/sif-parser.js";

const FIXTURE_PATH = join(import.meta.dirname, "../fixtures/sample-userprop.sif");
const SIF_CONTENT = readFileSync(FIXTURE_PATH, "utf-8");

describe("sif-parser User Property extraction", () => {
  it("should extract APPLET_USER_PROP as user_property children", () => {
    const result = parseSifContent(SIF_CONTENT, "sample-userprop.sif");
    const applet = result.objects.find((o) => o.name === "Account List Applet");
    expect(applet).toBeDefined();

    const userProps = applet!.children.filter((c) => c.type === "user_property");
    expect(userProps.length).toBe(3);
    expect(userProps[0].name).toBe("CanInvokeMethod: DeleteRecord");
    expect(userProps[1].name).toBe("CanInvokeMethod: NewRecord");
    expect(userProps[2].name).toBe("Named Search: SavedSearches");
  });

  it("should extract BUSINESS_COMPONENT_USER_PROP from BCs", () => {
    const result = parseSifContent(SIF_CONTENT, "sample-userprop.sif");
    const bc = result.objects.find((o) => o.name === "Account" && o.type === "business_component");
    expect(bc).toBeDefined();

    const userProps = bc!.children.filter((c) => c.type === "user_property");
    expect(userProps.length).toBe(4);
    expect(userProps[0].name).toBe("DataCleansing");
    expect(userProps[1].name).toBe("DeDuplication");
  });

  it("should include VALUE as a structured property", () => {
    const result = parseSifContent(SIF_CONTENT, "sample-userprop.sif");
    const applet = result.objects.find((o) => o.name === "Account List Applet");
    const deleteProp = applet!.children.find(
      (c) => c.type === "user_property" && c.name === "CanInvokeMethod: DeleteRecord"
    );
    expect(deleteProp).toBeDefined();

    const valueProp = deleteProp!.properties.find((p) => p.name === "VALUE");
    expect(valueProp).toBeDefined();
    expect(valueProp!.value).toBe("N");
  });

  it("should preserve parent name on user property children", () => {
    const result = parseSifContent(SIF_CONTENT, "sample-userprop.sif");
    const bc = result.objects.find((o) => o.name === "Account" && o.type === "business_component");
    const userProp = bc!.children.find((c) => c.type === "user_property");
    expect(userProp!.parentName).toBe("Account");
  });

  it("should not break existing child extraction", () => {
    const result = parseSifContent(SIF_CONTENT, "sample-userprop.sif");
    const applet = result.objects.find((o) => o.name === "Account List Applet");
    const controls = applet!.children.filter((c) => c.type === "control");
    expect(controls.length).toBe(1);
    expect(controls[0].name).toBe("Name");
  });

  it("should extract complex VALUE strings", () => {
    const result = parseSifContent(SIF_CONTENT, "sample-userprop.sif");
    const bc = result.objects.find((o) => o.name === "Account" && o.type === "business_component");
    const onFieldUpdate = bc!.children.find(
      (c) => c.type === "user_property" && c.name === "On Field Update Set 1"
    );
    expect(onFieldUpdate).toBeDefined();

    const valueProp = onFieldUpdate!.properties.find((p) => p.name === "VALUE");
    expect(valueProp!.value).toBe("Name,Account Status");
  });
});
