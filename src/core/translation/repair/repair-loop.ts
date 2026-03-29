/**
 * Repair Loop — iterative repair of translated code using AI.
 *
 * Validates code, sends errors to a repair function (AI), and retries
 * up to maxIterations. Tracks repair history for auditing.
 */

import type { ValidationError, ValidationResult } from "../validators/code-validator.js";

// ── Types ──────────────────────────────────────────

/** Function that attempts to repair code given validation errors. */
export type RepairFunction = (code: string, errors: ValidationError[]) => Promise<string>;

/** Validator function signature. */
export type ValidatorFunction = (code: string) => ValidationResult;

export interface RepairHistoryEntry {
  iteration: number;
  errors: ValidationError[];
  codeAfterRepair: string;
}

export interface RepairResult {
  success: boolean;
  finalCode: string;
  iterations: number;
  errors: ValidationError[];
  history: RepairHistoryEntry[];
}

export interface RepairLoopOptions {
  maxIterations: number;
  repairFn: RepairFunction;
  validator: ValidatorFunction;
}

// ── Repair Loop ────────────────────────────────────

export class RepairLoop {
  private maxIterations: number;
  private repairFn: RepairFunction;
  private validator: ValidatorFunction;

  constructor(options: RepairLoopOptions) {
    this.maxIterations = options.maxIterations;
    this.repairFn = options.repairFn;
    this.validator = options.validator;
  }

  /**
   * Attempt to repair code by iteratively validating and fixing errors.
   * Returns immediately if code is already valid (0 iterations).
   */
  async repair(code: string): Promise<RepairResult> {
    const history: RepairHistoryEntry[] = [];

    // Check if already valid
    const initial = this.validator(code);
    if (initial.valid) {
      return {
        success: true,
        finalCode: code,
        iterations: 0,
        errors: [],
        history,
      };
    }

    let currentCode = code;
    let lastErrors = initial.errors;

    for (let i = 0; i < this.maxIterations; i++) {
      // Attempt repair
      const repairedCode = await this.repairFn(currentCode, lastErrors);

      history.push({
        iteration: i + 1,
        errors: lastErrors,
        codeAfterRepair: repairedCode,
      });

      // Validate repaired code
      const result = this.validator(repairedCode);
      if (result.valid) {
        return {
          success: true,
          finalCode: repairedCode,
          iterations: i + 1,
          errors: [],
          history,
        };
      }

      currentCode = repairedCode;
      lastErrors = result.errors;
    }

    // Max iterations reached without success
    return {
      success: false,
      finalCode: currentCode,
      iterations: this.maxIterations,
      errors: lastErrors,
      history,
    };
  }
}
