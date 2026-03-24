import { describe, it, expect, beforeEach } from "vitest";
import { isTypeScriptAvailable, resetTypeScriptLoader } from "../core/code/ts-analyzer.js";

describe("isTypeScriptAvailable", () => {
  beforeEach(() => {
    resetTypeScriptLoader();
  });

  it("should return true when typescript is available", async () => {
    const available = await isTypeScriptAvailable();

    expect(available).toBe(true);
  });

  it("should return consistent result on subsequent calls", async () => {
    const first = await isTypeScriptAvailable();
    const second = await isTypeScriptAvailable();

    expect(first).toBe(second);
  });
});
