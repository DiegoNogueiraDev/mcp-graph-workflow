import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseSifContent } from "../../core/siebel/sif-parser.js";

const FIXTURE_PATH = join(import.meta.dirname, "../fixtures/sample-application.sif");
const SIF_CONTENT = readFileSync(FIXTURE_PATH, "utf-8");

describe("sif-parser Application Objects", () => {
  it("should parse APPLICATION as top-level object with type application", () => {
    const result = parseSifContent(SIF_CONTENT, "sample-application.sif");
    const app = result.objects.find((o) => o.type === "application");
    expect(app).toBeDefined();
    expect(app!.name).toBe("Sales Application");
  });

  it("should extract SCREEN_MENU as screen children", () => {
    const result = parseSifContent(SIF_CONTENT, "sample-application.sif");
    const app = result.objects.find((o) => o.type === "application");
    expect(app).toBeDefined();

    const screens = app!.children.filter((c) => c.type === "screen");
    expect(screens.length).toBe(3);
    expect(screens[0].name).toBe("Accounts Screen");
    expect(screens[1].name).toBe("Contacts Screen");
    expect(screens[2].name).toBe("Orders Screen");
  });

  it("should extract APPLICATION_USER_PROP as user_property children", () => {
    const result = parseSifContent(SIF_CONTENT, "sample-application.sif");
    const app = result.objects.find((o) => o.type === "application");

    const userProps = app!.children.filter((c) => c.type === "user_property");
    expect(userProps.length).toBe(1);
    expect(userProps[0].name).toBe("DefaultScreen");

    const valueProp = userProps[0].properties.find((p) => p.name === "VALUE");
    expect(valueProp!.value).toBe("Accounts Screen");
  });

  it("should infer application→screen dependencies via SCREEN_MENU", () => {
    const result = parseSifContent(SIF_CONTENT, "sample-application.sif");
    const appDeps = result.dependencies.filter(
      (d) => d.from.type === "application" && d.to.type === "screen"
    );
    expect(appDeps.length).toBeGreaterThanOrEqual(2);

    const accountsDep = appDeps.find((d) => d.to.name === "Accounts Screen");
    expect(accountsDep).toBeDefined();
    expect(accountsDep!.relationType).toBe("contains");
  });

  it("should include application in metadata objectTypes", () => {
    const result = parseSifContent(SIF_CONTENT, "sample-application.sif");
    expect(result.metadata.objectTypes).toContain("application");
  });
});
