import { describe, it, expect } from "vitest";
import { checkEnvironmentHealth } from "../../core/siebel/health-check.js";
import type { SiebelEnvironment } from "../../schemas/siebel.schema.js";

const ENV: SiebelEnvironment = {
  name: "dev",
  url: "http://localhost:9999",
  version: "15.0",
  type: "dev",
};

describe("health-check", () => {
  it("should return offline for unreachable host", async () => {
    const result = await checkEnvironmentHealth(ENV, { timeoutMs: 1000 });
    expect(result.status).toBe("offline");
    expect(result.environmentName).toBe("dev");
  });

  it("should include response time when available", async () => {
    const result = await checkEnvironmentHealth(ENV, { timeoutMs: 1000 });
    expect(result.responseTimeMs).toBeDefined();
    expect(typeof result.responseTimeMs).toBe("number");
  });

  it("should include error message on failure", async () => {
    const result = await checkEnvironmentHealth(ENV, { timeoutMs: 1000 });
    expect(result.error).toBeDefined();
  });

  it("should respect custom timeout", async () => {
    const start = Date.now();
    await checkEnvironmentHealth(ENV, { timeoutMs: 500 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(3000);
  });

  it("should use default timeout of 10s", async () => {
    // Just verify the function signature accepts no options
    const result = await checkEnvironmentHealth(ENV);
    expect(result.status).toBe("offline");
  });
});
