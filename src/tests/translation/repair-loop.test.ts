/**
 * TDD tests for Repair Loop.
 * Task 4.4: Iterative repair loop using AI to fix translation errors.
 */
import { describe, it, expect } from "vitest";
import {
  RepairLoop,
  type RepairFunction,
} from "../../core/translation/repair/repair-loop.js";
import type { ValidationResult } from "../../core/translation/validators/code-validator.js";

describe("RepairLoop", () => {
  // Mock repair function that "fixes" code by appending a closing brace
  const mockRepairFn: RepairFunction = async (code, errors) => {
    // Simulate AI fix: if missing brace, add it
    if (errors.some((e) => e.message.includes("brace") || e.message.includes("}"))) {
      return code + "\n}";
    }
    // If indentation error, add indent
    if (errors.some((e) => e.message.includes("indent"))) {
      return code.replace(/^(def .+:)\n(\S)/m, "$1\n    $2");
    }
    return code; // no fix possible
  };

  // Mock validator that passes on second attempt
  let callCount = 0;
  const mockValidatorPassOnSecond = (_code: string): ValidationResult => {
    callCount++;
    if (callCount <= 1) {
      return {
        valid: false,
        language: "typescript",
        errors: [{ line: 3, message: "Missing closing brace" }],
      };
    }
    return { valid: true, language: "typescript", errors: [] };
  };

  it("should return immediately if code is already valid", async () => {
    const validator = (): ValidationResult => ({
      valid: true,
      language: "typescript",
      errors: [],
    });

    const loop = new RepairLoop({ maxIterations: 3, repairFn: mockRepairFn, validator });
    const result = await loop.repair("const x = 1;");

    expect(result.success).toBe(true);
    expect(result.iterations).toBe(0);
    expect(result.finalCode).toBe("const x = 1;");
  });

  it("should repair code within max iterations", async () => {
    callCount = 0;
    const loop = new RepairLoop({
      maxIterations: 3,
      repairFn: mockRepairFn,
      validator: mockValidatorPassOnSecond,
    });

    const result = await loop.repair("function broken() {");

    expect(result.success).toBe(true);
    expect(result.iterations).toBeGreaterThan(0);
    expect(result.iterations).toBeLessThanOrEqual(3);
  });

  it("should fail after max iterations if repair doesn't fix the code", async () => {
    const alwaysFails = (): ValidationResult => ({
      valid: false,
      language: "python",
      errors: [{ line: 1, message: "Unfixable error" }],
    });
    const noopRepair: RepairFunction = async (code) => code; // doesn't actually fix

    const loop = new RepairLoop({ maxIterations: 3, repairFn: noopRepair, validator: alwaysFails });
    const result = await loop.repair("broken code");

    expect(result.success).toBe(false);
    expect(result.iterations).toBe(3);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("should track repair history", async () => {
    callCount = 0;
    const loop = new RepairLoop({
      maxIterations: 3,
      repairFn: mockRepairFn,
      validator: mockValidatorPassOnSecond,
    });

    const result = await loop.repair("function broken() {");

    expect(result.history).toBeDefined();
    expect(result.history.length).toBeGreaterThan(0);
    expect(result.history[0].errors).toBeDefined();
    expect(result.history[0].codeAfterRepair).toBeDefined();
  });

  it("should respect maxIterations = 1", async () => {
    const alwaysFails = (): ValidationResult => ({
      valid: false,
      language: "typescript",
      errors: [{ line: 1, message: "Error" }],
    });
    const noopRepair: RepairFunction = async (code) => code;

    const loop = new RepairLoop({ maxIterations: 1, repairFn: noopRepair, validator: alwaysFails });
    const result = await loop.repair("bad");

    expect(result.iterations).toBe(1);
    expect(result.success).toBe(false);
  });

  it("should pass errors and constraints to repair function", async () => {
    const receivedErrors: string[] = [];
    const capturingRepair: RepairFunction = async (code, errors) => {
      receivedErrors.push(...errors.map((e) => e.message));
      return code;
    };

    const validator = (): ValidationResult => ({
      valid: false,
      language: "typescript",
      errors: [{ line: 1, message: "Specific error XYZ" }],
    });

    const loop = new RepairLoop({ maxIterations: 1, repairFn: capturingRepair, validator });
    await loop.repair("code");

    expect(receivedErrors).toContain("Specific error XYZ");
  });
});
