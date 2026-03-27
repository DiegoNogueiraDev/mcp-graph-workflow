import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { batchImportSifs } from "../../core/siebel/sif-batch-importer.js";

const APPLET_SIF = `<?xml version="1.0" encoding="UTF-8"?>
<REPOSITORY NAME="Siebel Repository">
  <PROJECT NAME="Project A">
    <APPLET NAME="Test Applet 1" BUS_COMP="Account" CLASS="CSSFrameList">
      <CONTROL NAME="Name" FIELD="Name" HTML_TYPE="Text" />
    </APPLET>
  </PROJECT>
</REPOSITORY>`;

const BC_SIF = `<?xml version="1.0" encoding="UTF-8"?>
<REPOSITORY NAME="Siebel Repository">
  <PROJECT NAME="Project B">
    <BUSINESS_COMPONENT NAME="Account" TABLE="S_ORG_EXT" CLASS="CSSBCBase">
      <FIELD NAME="Name" COLUMN="NAME" TYPE="DTYPE_TEXT" />
    </BUSINESS_COMPONENT>
  </PROJECT>
</REPOSITORY>`;

const INVALID_SIF = `this is not valid XML at all`;

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "sif-batch-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("batchImportSifs", () => {
  it("should import multiple SIF files from a directory", async () => {
    writeFileSync(join(tempDir, "applet.sif"), APPLET_SIF);
    writeFileSync(join(tempDir, "bc.sif"), BC_SIF);

    const result = await batchImportSifs(tempDir);

    expect(result.totalFiles).toBe(2);
    expect(result.successCount).toBe(2);
    expect(result.errorCount).toBe(0);
    expect(result.results.length).toBe(2);
  });

  it("should aggregate object counts across files", async () => {
    writeFileSync(join(tempDir, "applet.sif"), APPLET_SIF);
    writeFileSync(join(tempDir, "bc.sif"), BC_SIF);

    const result = await batchImportSifs(tempDir);

    expect(result.totalObjects).toBe(2); // 1 applet + 1 BC
  });

  it("should skip non-SIF files", async () => {
    writeFileSync(join(tempDir, "applet.sif"), APPLET_SIF);
    writeFileSync(join(tempDir, "readme.txt"), "not a sif");
    writeFileSync(join(tempDir, "data.json"), "{}");

    const result = await batchImportSifs(tempDir);

    expect(result.totalFiles).toBe(1);
    expect(result.successCount).toBe(1);
  });

  it("should report per-file errors without failing entire batch", async () => {
    writeFileSync(join(tempDir, "good.sif"), APPLET_SIF);
    writeFileSync(join(tempDir, "bad.sif"), INVALID_SIF);

    const result = await batchImportSifs(tempDir);

    expect(result.totalFiles).toBe(2);
    expect(result.successCount).toBe(1);
    expect(result.errorCount).toBe(1);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].file).toBe("bad.sif");
    expect(result.errors[0].error).toBeDefined();
  });

  it("should handle empty directory", async () => {
    const result = await batchImportSifs(tempDir);

    expect(result.totalFiles).toBe(0);
    expect(result.successCount).toBe(0);
    expect(result.errorCount).toBe(0);
  });

  it("should respect concurrency limit", async () => {
    // Create 10 SIF files
    for (let i = 0; i < 10; i++) {
      writeFileSync(join(tempDir, `applet_${i}.sif`), APPLET_SIF.replace("Test Applet 1", `Test Applet ${i}`));
    }

    const result = await batchImportSifs(tempDir, { concurrency: 3 });

    expect(result.totalFiles).toBe(10);
    expect(result.successCount).toBe(10);
  });

  it("should report object types distribution", async () => {
    writeFileSync(join(tempDir, "applet.sif"), APPLET_SIF);
    writeFileSync(join(tempDir, "bc.sif"), BC_SIF);

    const result = await batchImportSifs(tempDir);

    expect(result.objectsByType).toBeDefined();
    expect(result.objectsByType["applet"]).toBe(1);
    expect(result.objectsByType["business_component"]).toBe(1);
  });

  it("should not recurse into subdirectories by default", async () => {
    writeFileSync(join(tempDir, "root.sif"), APPLET_SIF);
    const subDir = join(tempDir, "subdir");
    mkdirSync(subDir);
    writeFileSync(join(subDir, "nested.sif"), BC_SIF);

    const result = await batchImportSifs(tempDir);

    expect(result.totalFiles).toBe(1);
  });
});
