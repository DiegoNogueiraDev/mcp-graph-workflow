/**
 * Language Detection from Code Snippets — heuristic keyword/pattern detection.
 * Returns languageId, confidence (0-1), and indicators explaining the detection.
 */

export { detectProjectLanguages } from "../lsp/language-detector.js";

export interface LanguageDetectionResult {
  languageId: string;
  confidence: number;
  indicators: string[];
}

interface LanguageProfile {
  id: string;
  /** Patterns that strongly indicate this language */
  strong: RegExp[];
  /** Patterns that weakly indicate this language */
  weak: RegExp[];
  /** Patterns that are unique to this language (very high weight) */
  unique: RegExp[];
}

const PROFILES: LanguageProfile[] = [
  {
    id: "typescript",
    unique: [
      /\binterface\s+\w+\s*\{/, /\btype\s+\w+\s*=/, /\benum\s+\w+\s*\{/,
      /:\s*(string|number|boolean|void)\b/, /\bas\s+(string|number|boolean)\b/,
    ],
    strong: [
      /\bconst\s+\w+\s*[:=]/, /\bimport\s*\{[^}]+\}\s*from\s*['"]/, /\bexport\s+(function|class|const|interface|type)\b/,
      /=>\s*\{/, /\bPromise</, /\bconsole\.\w+\(/,
    ],
    weak: [
      /\bfunction\s+\w+/, /\bclass\s+\w+/, /\breturn\s+/, /\bnew\s+\w+/,
    ],
  },
  {
    id: "python",
    unique: [
      /^(\s*)def\s+\w+\s*\(/m, /^(\s*)class\s+\w+.*:\s*$/m,
      /^from\s+\S+\s+import\s+/m, /^\s*elif\s+/m,
      /\bprint\s*\(/, /\bTrue\b/, /\bFalse\b/, /\bNone\b/,
      /^\s*@\w+/m, /\basync\s+def\b/,
    ],
    strong: [
      /^import\s+\w+\s*$/m, /\bself\.\w+/, /\bpass\b/,
      /:\s*$\n\s+/m, /\bf["']/, /\braise\s+\w+/,
    ],
    weak: [
      /\bif\s+.*:\s*$/m, /\bfor\s+\w+\s+in\s+/m, /\bwhile\s+/m,
    ],
  },
  {
    id: "go",
    unique: [
      /^package\s+\w+/m, /\bfunc\s+\w*\s*\(/, /\b:=\s*/,
      /\bgo\s+func\b/, /\bdefer\s+/, /\bchan\s+/,
      /\bfmt\.\w+/, /\bgoroutine/,
    ],
    strong: [
      /\bvar\s+\w+\s+\w+/, /\bstruct\s*\{/, /\binterface\s*\{/,
      /\berr\s*!=\s*nil/, /\brange\s+/,
    ],
    weak: [
      /\breturn\s+/, /\bif\s+.*\{/,
    ],
  },
  {
    id: "java",
    unique: [
      // eslint-disable-next-line security/detect-unsafe-regex -- bounded optional keyword; no overlapping quantifiers
      /\bpublic\s+(static\s+)?void\s+main\b/, /\bSystem\.out\.print/,
      // eslint-disable-next-line security/detect-unsafe-regex -- bounded optional keyword; no overlapping quantifiers
      /\bpublic\s+class\s+\w+/, /\bprivate\s+(static\s+)?\w+\s+\w+/,
      /\bnew\s+ArrayList</, /\bextends\s+\w+\s*\{/,
    ],
    strong: [
      /\b@Override\b/, /\b@Autowired\b/, /\bimport\s+java\./,
      /\bList<\w+>/, /\bString\[\]\s+\w+/, /\bthrows\s+\w+/,
    ],
    weak: [
      /\bpublic\s+\w+/, /\bprivate\s+\w+/, /\bprotected\s+\w+/,
    ],
  },
  {
    id: "csharp",
    unique: [
      /\busing\s+System\b/, /\bnamespace\s+\w+/, /\bConsole\.Write/,
      /\.Where\(/, /\.Select\(/, /\.ToList\(\)/,
      /\bvar\s+\w+\s*=\s*.*\.Where/, /\basync\s+Task</,
    ],
    strong: [
      /\busing\s+\w+\.\w+;/, /\bstring\.\w+/, /\bint\s+\w+/,
      /\bpublic\s+(override|virtual)\b/,
    ],
    weak: [
      /\bpublic\s+\w+/, /\bclass\s+\w+/,
    ],
  },
  {
    id: "rust",
    unique: [
      /\bfn\s+\w+\s*\(/, /\blet\s+mut\s+/, /\bimpl\s+\w+/,
      /\bprintln!\(/, /\b->\s*(Self|&)/, /\bstruct\s+\w+\s*\{/,
      /\bmatch\s+\w+\s*\{/, /\bOption</, /\bResult</,
    ],
    strong: [
      /\buse\s+\w+::/, /\bpub\s+(fn|struct|enum)\b/, /\b&self\b/,
      /\bunwrap\(\)/, /\b\.clone\(\)/,
    ],
    weak: [
      /\blet\s+\w+/, /\breturn\s+/,
    ],
  },
  {
    id: "ruby",
    unique: [
      /\bdef\s+\w+.*\bend\b/, /\bdo\s*\|/, /\battr_accessor\b/,
      /\brequire\b/, /puts\b/,
    ],
    strong: [
      /\bclass\s+\w+\s*</, /\bmodule\b/, /@\w+/,
    ],
    weak: [
      /\bdef\b/, /\bend\b/,
    ],
  },
  {
    id: "php",
    unique: [
      /<\?php/, /\$\w+/, /->/, /\bfunction\s+\w+\s*\(/,
      /\becho\b/,
    ],
    strong: [
      /\bnamespace\b/, /\buse\s+/, /\barray\(/,
    ],
    weak: [
      /\bclass\b/, /\breturn\b/,
    ],
  },
  {
    id: "swift",
    unique: [
      /\bfunc\s+\w+.*->/, /\blet\s+\w+\s*:/, /\bvar\s+\w+\s*:/,
      /\bguard\b/, /\bprotocol\b/,
    ],
    strong: [
      /\bstruct\b/, /\benum\b.*\bcase\b/, /\bimport\s+Foundation/,
    ],
    weak: [
      /\bif\b/, /\breturn\b/,
    ],
  },
  {
    id: "kotlin",
    unique: [
      /\bfun\s+\w+/, /\bval\s+\w+/, /\bvar\s+\w+/,
      /\bwhen\s*\(/, /\bdata\s+class\b/,
    ],
    strong: [
      /\bcompanion\s+object\b/, /\bsealed\s+class\b/,
      /\bimport\s+\w+\.\w+/,
    ],
    weak: [
      /\bclass\b/, /\bif\b/,
    ],
  },
  {
    id: "scala",
    unique: [
      /\bdef\s+\w+.*:\s*\w+\s*=/, /\bcase\s+class\b/,
      /\bcase\s+object\b/, /\bobject\s+\w+/, /\btrait\s+\w+/,
    ],
    strong: [
      /\bval\s+\w+/, /\bvar\s+\w+/, /\bimplicit\b/,
    ],
    weak: [
      /\bimport\b/, /\bif\b/,
    ],
  },
  {
    id: "elixir",
    unique: [
      /\bdefmodule\b/, /\bdef\s+\w+.*\bdo\b/, /\bdefp\b/,
      /\|>\b/, /@\w+/,
    ],
    strong: [
      /\bcase\s+\w+\s+do\b/, /\bwith\b.*<-/, /\bGenServer\b/,
    ],
    weak: [
      /\bif\b/, /\bend\b/,
    ],
  },
  {
    id: "dart",
    unique: [
      /\bvoid\s+main\b.*\{/, /\bfinal\s+\w+\s*=/, /\bFuture</,
      /\bStream</, /\brequired\s+this\./,
    ],
    strong: [
      /\bclass\s+\w+\s+extends\b/, /\bimport\s+'/, /\basync\b/,
    ],
    weak: [
      /\bif\b/, /\breturn\b/,
    ],
  },
  {
    id: "haskell",
    unique: [
      /\b::\s*/, /\bwhere\b$/, /\bmodule\s+\w+/,
      /<-/, /->/,
    ],
    strong: [
      /\bdata\b/, /\binstance\b/, /\bderiving\b/, /\bimport\s+/,
    ],
    weak: [
      /\bif\b/, /\blet\b/,
    ],
  },
  {
    id: "cpp",
    unique: [
      /#include\s*</, /\bstd::\b/, /\btemplate\s*</,
      /\bnamespace\b/, /::/,
    ],
    strong: [
      /\bcout\b/, /\bnew\b/, /\bdelete\b/, /\bvirtual\b/,
    ],
    weak: [
      /\bclass\b/, /\breturn\b/,
    ],
  },
  {
    id: "lua",
    unique: [
      /\bfunction\s+\w+.*\)\s*$/, /\blocal\s+\w+\s*=/,
      /\btable\.\w+/, /\brequire\s*\(/, /\bself\.\w+/,
    ],
    strong: [
      /\bfor\s+\w+\s*,/, /\bipairs\b/, /\bpairs\b/,
    ],
    weak: [
      /\bif\b/, /\bend\b/,
    ],
  },
];

const UNIQUE_WEIGHT = 3;
const STRONG_WEIGHT = 1.5;
const WEAK_WEIGHT = 0.5;

export function detectLanguageFromCode(code: string): LanguageDetectionResult {
  if (!code.trim()) {
    return { languageId: "unknown", confidence: 0, indicators: [] };
  }

  let bestLang = "unknown";
  let bestScore = 0;
  let bestIndicators: string[] = [];

  for (const profile of PROFILES) {
    let score = 0;
    const indicators: string[] = [];

    for (const pattern of profile.unique) {
      if (pattern.test(code)) {
        score += UNIQUE_WEIGHT;
        indicators.push(`unique: ${pattern.source.substring(0, 40)}`);
      }
    }
    for (const pattern of profile.strong) {
      if (pattern.test(code)) {
        score += STRONG_WEIGHT;
        indicators.push(`strong: ${pattern.source.substring(0, 40)}`);
      }
    }
    for (const pattern of profile.weak) {
      if (pattern.test(code)) {
        score += WEAK_WEIGHT;
        indicators.push(`weak: ${pattern.source.substring(0, 40)}`);
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestLang = profile.id;
      bestIndicators = indicators;
    }
  }

  // Normalize confidence: map score to 0-1 range
  // A score of ~6+ is high confidence, ~3 is medium, <2 is low
  const confidence = Math.min(bestScore / 8, 1);

  return { languageId: bestLang, confidence, indicators: bestIndicators };
}
