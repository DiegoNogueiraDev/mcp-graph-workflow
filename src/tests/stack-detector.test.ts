import { describe, it, expect, afterEach } from "vitest";
import { writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { detectStack } from "../core/docs/stack-detector.js";

describe("StackDetector", () => {
  const testDir = path.join(tmpdir(), `stack-detector-test-${Date.now()}`);

  afterEach(async () => {
    try { await rm(testDir, { recursive: true }); } catch { /* noop */ }
  });

  it("should detect Node.js stack from package.json", async () => {
    await mkdir(testDir, { recursive: true });
    await writeFile(
      path.join(testDir, "package.json"),
      JSON.stringify({
        dependencies: {
          express: "^5.0.0",
          zod: "^4.0.0",
        },
        devDependencies: {
          vitest: "^4.0.0",
        },
      }),
    );

    const stack = await detectStack(testDir);

    expect(stack).not.toBeNull();
    expect(stack!.runtime).toBe("node");
    expect(stack!.sourceFile).toBe("package.json");
    expect(stack!.libraries.length).toBe(3);
    expect(stack!.libraries.find((l) => l.name === "express")).toBeDefined();
  });

  it("should detect Python stack from requirements.txt", async () => {
    await mkdir(testDir, { recursive: true });
    await writeFile(
      path.join(testDir, "requirements.txt"),
      "flask==2.0.0\nrequests>=2.28.0\n# comment\nsqlalchemy\n",
    );

    const stack = await detectStack(testDir);

    expect(stack).not.toBeNull();
    expect(stack!.runtime).toBe("python");
    expect(stack!.sourceFile).toBe("requirements.txt");
    expect(stack!.libraries.length).toBe(3);
  });

  it("should detect Go stack from go.mod", async () => {
    await mkdir(testDir, { recursive: true });
    await writeFile(
      path.join(testDir, "go.mod"),
      `module example.com/myapp

go 1.21

require (
\tgithub.com/gin-gonic/gin v1.9.0
\tgithub.com/go-sql-driver/mysql v1.7.0
)
`,
    );

    const stack = await detectStack(testDir);

    expect(stack).not.toBeNull();
    expect(stack!.runtime).toBe("go");
    expect(stack!.libraries.length).toBe(2);
  });

  it("should return null when no manifest found", async () => {
    await mkdir(testDir, { recursive: true });

    const stack = await detectStack(testDir);
    expect(stack).toBeNull();
  });

  it("should prefer package.json over other manifests", async () => {
    await mkdir(testDir, { recursive: true });
    await writeFile(
      path.join(testDir, "package.json"),
      JSON.stringify({ dependencies: { react: "^18.0.0" } }),
    );
    await writeFile(path.join(testDir, "requirements.txt"), "flask==2.0.0\n");

    const stack = await detectStack(testDir);
    expect(stack!.runtime).toBe("node");
  });

  it("should strip version prefixes", async () => {
    await mkdir(testDir, { recursive: true });
    await writeFile(
      path.join(testDir, "package.json"),
      JSON.stringify({ dependencies: { express: "^5.2.1", zod: "~4.3.0" } }),
    );

    const stack = await detectStack(testDir);
    const express = stack!.libraries.find((l) => l.name === "express");
    expect(express!.version).toBe("5.2.1");
  });
});
