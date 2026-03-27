/**
 * eScript Pattern Detection — detects patterns and anti-patterns in Siebel eScript code.
 */

export interface ScriptPattern {
  name: string;
  isAntiPattern: boolean;
  description: string;
  line?: number;
}

export interface PatternDetectionResult {
  sourceObject: string;
  sourceMethod: string;
  patterns: ScriptPattern[];
  qualityScore: number;
}

interface PatternCheck {
  name: string;
  isAntiPattern: boolean;
  description: string;
  detect: (code: string) => boolean;
  scoreImpact: number;
}

const CHECKS: PatternCheck[] = [
  {
    name: "proper_error_handling",
    isAntiPattern: false,
    description: "Uses TheApplication().RaiseErrorText() for error reporting",
    detect: (code) => /RaiseErrorText\s*\(/.test(code),
    scoreImpact: 15,
  },
  {
    name: "finally_cleanup",
    isAntiPattern: false,
    description: "Uses finally block for memory cleanup (null assignments)",
    detect: (code) => /finally\s*\{[\s\S]*?=\s*null/.test(code),
    scoreImpact: 15,
  },
  {
    name: "empty_catch",
    isAntiPattern: true,
    description: "Empty catch block swallows errors silently",
    detect: (code) => /catch\s*\([^)]*\)\s*\{\s*\}/.test(code),
    scoreImpact: -25,
  },
  {
    name: "hardcoded_value",
    isAntiPattern: true,
    description: "Hardcoded URL, IP, or server name in script",
    detect: (code) => /https?:\/\/[^\s"']+/.test(code) || /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(code),
    scoreImpact: -20,
  },
  {
    name: "missing_try_catch",
    isAntiPattern: true,
    description: "Function body has no try/catch error handling",
    detect: (code) => {
      if (code.trim().length === 0) return false;
      const hasFunction = /function\s+\w+/.test(code);
      const hasTry = /try\s*\{/.test(code);
      return hasFunction && !hasTry;
    },
    scoreImpact: -20,
  },
];

/**
 * Detect patterns and anti-patterns in eScript source code.
 */
export function detectEscriptPatterns(
  sourceCode: string,
  sourceObject: string,
  sourceMethod: string,
): PatternDetectionResult {
  if (!sourceCode || sourceCode.trim().length === 0) {
    return { sourceObject, sourceMethod, patterns: [], qualityScore: 0 };
  }

  const patterns: ScriptPattern[] = [];
  let score = 50; // baseline

  for (const check of CHECKS) {
    if (check.detect(sourceCode)) {
      patterns.push({
        name: check.name,
        isAntiPattern: check.isAntiPattern,
        description: check.description,
      });
      score += check.scoreImpact;
    }
  }

  const qualityScore = Math.max(0, Math.min(100, score));

  return { sourceObject, sourceMethod, patterns, qualityScore };
}
