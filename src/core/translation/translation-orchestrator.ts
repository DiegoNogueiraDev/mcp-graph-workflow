/**
 * Translation Orchestrator — wires all translation components together.
 *
 * Flow: analyzeSource → prepareTranslation → (AI generates code) → finalizeTranslation
 */

import { createHash } from "node:crypto";
import { ConstructRegistry } from "./ucr/construct-registry.js";
import { TranslationStore } from "./translation-store.js";
import type { CodeStore } from "../code/code-store.js";
import { analyzeFromIndex } from "./pre-indexed-analyzer.js";
import type { TranslationAnalysis, TranslationJob, TranslationScope } from "./translation-types.js";
import type { TranslationScore, AmbiguityReport } from "./ucr/construct-types.js";
import { detectLanguageFromCode } from "./language-detect.js";
import { TsParserAdapter } from "./parsers/ts-parser-adapter.js";
import { PythonParserAdapter } from "./parsers/python-parser-adapter.js";
import { JavaParserAdapter } from "./parsers/java-parser-adapter.js";
import { GoParserAdapter } from "./parsers/go-parser-adapter.js";
import { CSharpParserAdapter } from "./parsers/csharp-parser-adapter.js";
import { RustParserAdapter } from "./parsers/rust-parser-adapter.js";
import { RubyParserAdapter } from "./parsers/ruby-parser-adapter.js";
import { PhpParserAdapter } from "./parsers/php-parser-adapter.js";
import { SwiftParserAdapter } from "./parsers/swift-parser-adapter.js";
import { KotlinParserAdapter } from "./parsers/kotlin-parser-adapter.js";
import { ScalaParserAdapter } from "./parsers/scala-parser-adapter.js";
import { ElixirParserAdapter } from "./parsers/elixir-parser-adapter.js";
import { DartParserAdapter } from "./parsers/dart-parser-adapter.js";
import { HaskellParserAdapter } from "./parsers/haskell-parser-adapter.js";
import { CppParserAdapter } from "./parsers/cpp-parser-adapter.js";
import { LuaParserAdapter } from "./parsers/lua-parser-adapter.js";
import type { ParserAdapter, ParsedConstruct } from "./parsers/parser-adapter.js";
import { scoreConstructs } from "./confidence/equivalence-scorer.js";
import { detectAmbiguities } from "./confidence/ambiguity-detector.js";
import { buildTranslationPrompt } from "./prompt-builder.js";
import type { PromptContext } from "./prompt-builder.js";
import { TranslationError } from "../utils/errors.js";

/**
 * Mapping of equivalent constructs across languages.
 * When source construct X translates to target construct Y,
 * both are valid equivalents and should not be flagged as risk.
 */
const EQUIVALENT_CONSTRUCTS: ReadonlyMap<string, string> = new Map([
  ["uc_for_each", "uc_for_loop"],
  ["uc_for_loop", "uc_for_each"],
  ["uc_fn_def", "uc_arrow_fn"],
  ["uc_arrow_fn", "uc_fn_def"],
]);

// ── Analysis Cache (LRU, SHA-256 keyed) ────────────

const ANALYSIS_CACHE_TTL_MS = 3_600_000; // 60 minutes
const ANALYSIS_CACHE_MAX_ENTRIES = 100;

interface AnalysisCacheEntry {
  result: TranslationAnalysis & { cacheHit: boolean };
  timestamp: number;
}

const analysisCache = new Map<string, AnalysisCacheEntry>();

function computeCacheKey(code: string, targetLanguage?: string): string {
  return createHash("sha256")
    .update(code + "|" + (targetLanguage ?? ""))
    .digest("hex");
}

function evictOldestIfNeeded(): void {
  if (analysisCache.size <= ANALYSIS_CACHE_MAX_ENTRIES) return;
  let oldestKey: string | undefined;
  let oldestTs = Infinity;
  for (const [key, entry] of analysisCache) {
    if (entry.timestamp < oldestTs) {
      oldestTs = entry.timestamp;
      oldestKey = key;
    }
  }
  if (oldestKey) analysisCache.delete(oldestKey);
}

interface AnalyzeHints {
  languageHint?: string;
  targetLanguage?: string;
}

interface PrepareInput {
  projectId: string;
  sourceCode: string;
  sourceLanguage?: string;
  targetLanguage: string;
  scope: TranslationScope;
}

interface PrepareResult {
  jobId: string;
  prompt: string;
  analysis: TranslationAnalysis;
}

interface EvidencePack {
  diff: string;
  translatedConstructs: Array<{ source: string; target: string; method: string }>;
  risks: Array<{ construct: string; severity: string; message: string }>;
  confidenceScore: number;
  humanReviewPoints: string[];
}

interface FinalizeResult {
  job: { id: string; status: string; targetCode?: string; confidenceScore?: number };
  evidence: EvidencePack;
}

const PARSERS = new Map<string, ParserAdapter>([
  ["typescript", new TsParserAdapter()],
  ["python", new PythonParserAdapter()],
  ["java", new JavaParserAdapter()],
  ["go", new GoParserAdapter()],
  ["csharp", new CSharpParserAdapter()],
  ["rust", new RustParserAdapter()],
  ["ruby", new RubyParserAdapter()],
  ["php", new PhpParserAdapter()],
  ["swift", new SwiftParserAdapter()],
  ["kotlin", new KotlinParserAdapter()],
  ["scala", new ScalaParserAdapter()],
  ["elixir", new ElixirParserAdapter()],
  ["dart", new DartParserAdapter()],
  ["haskell", new HaskellParserAdapter()],
  ["cpp", new CppParserAdapter()],
  ["lua", new LuaParserAdapter()],
]);

export class TranslationOrchestrator {
  constructor(
    private readonly registry: ConstructRegistry,
    private readonly store: TranslationStore,
    private readonly codeStore?: CodeStore,
  ) {}

  /**
   * Analyze source code — detect language, identify constructs, compute complexity.
   * Results are cached with SHA-256 content hash (TTL 60min, max 100 entries).
   * When filePath + projectId are provided and Code Intelligence has indexed the file,
   * uses pre-indexed analysis (instant, zero parsing cost).
   */
  analyzeSource(code: string, hints?: AnalyzeHints, filePath?: string, projectId?: string): TranslationAnalysis & { cacheHit: boolean } {
    // Try pre-indexed analysis (Layer 5) when file context is available
    if (filePath && projectId && this.codeStore) {
      const preIndexed = analyzeFromIndex(this.codeStore, projectId, filePath);
      if (preIndexed) {
        const result = { ...preIndexed.analysis, cacheHit: false };
        return result;
      }
    }

    // Check cache
    const cacheKey = computeCacheKey(code, hints?.targetLanguage);
    const cached = analysisCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < ANALYSIS_CACHE_TTL_MS) {
      return { ...cached.result, cacheHit: true };
    }

    // Detect language
    const detection = detectLanguageFromCode(code);
    const lang = hints?.languageHint ?? detection.languageId;
    const confidence = hints?.languageHint ? 1.0 : detection.confidence;

    // Parse constructs
    const parser = PARSERS.get(lang);
    const parsed = parser ? parser.parseSnippet(code) : [];

    // Score if target language provided
    let scores: TranslationScore[] = [];
    let ambiguities: AmbiguityReport[] = [];
    const targetLang = hints?.targetLanguage;

    if (targetLang && parsed.length > 0) {
      const constructIds = [...new Set(parsed.map((p) => p.constructId))];
      scores = scoreConstructs(this.registry, constructIds, lang, targetLang);
      ambiguities = detectAmbiguities(scores, this.registry, lang, targetLang);
    }

    // Compute complexity (normalized 0-1 based on construct variety and count)
    const uniqueConstructs = new Set(parsed.map((p) => p.constructId)).size;
    const complexityScore = Math.min(uniqueConstructs / 15, 1);

    // Build construct info
    const constructMap = new Map<string, { count: number; confidence: number }>();
    for (const p of parsed) {
      const existing = constructMap.get(p.constructId);
      const matchScore = scores.find((s) => s.constructId === p.constructId);
      if (existing) {
        existing.count++;
      } else {
        constructMap.set(p.constructId, {
          count: 1,
          confidence: matchScore?.finalConfidence ?? 0,
        });
      }
    }

    const constructs = [...constructMap.entries()].map(([id, info]) => ({
      canonicalName: id,
      count: info.count,
      confidence: info.confidence,
    }));

    // Translatability = avg confidence of scored constructs
    const estimatedTranslatability = scores.length > 0
      ? scores.reduce((sum, s) => sum + s.finalConfidence, 0) / scores.length
      : 0;

    const result: TranslationAnalysis & { cacheHit: boolean } = {
      detectedLanguage: lang,
      detectedConfidence: confidence,
      constructs,
      complexityScore,
      estimatedTranslatability,
      ambiguousConstructs: ambiguities.map((a) => a.constructId),
      totalConstructs: parsed.length,
      cacheHit: false,
    };

    // Store in cache
    analysisCache.set(cacheKey, { result, timestamp: Date.now() });
    evictOldestIfNeeded();

    return result;
  }

  /**
   * Prepare a translation job — creates the job, analyzes source, builds prompt.
   */
  prepareTranslation(input: PrepareInput): PrepareResult {
    const sourceCode = input.sourceCode ?? "";
    const analysis = this.analyzeSource(sourceCode, {
      languageHint: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
    });

    // Create job in store
    const job = this.store.createJob({
      projectId: input.projectId,
      sourceLanguage: analysis.detectedLanguage,
      targetLanguage: input.targetLanguage,
      sourceCode,
      scope: input.scope,
    });

    // Update to analyzing status
    this.store.updateJob(job.id, {
      status: "analyzing",
      analysis: analysis as unknown as Record<string, unknown>,
    });

    // Build scores + ambiguities for prompt
    // Guard: if registry has no seed data, scoreConstructs returns [] safely
    const parser = PARSERS.get(analysis.detectedLanguage);
    const parsed = parser ? parser.parseSnippet(sourceCode) : [];
    const constructIds = [...new Set(parsed.map((p) => p.constructId))].filter(Boolean);
    const scores = scoreConstructs(this.registry, constructIds, analysis.detectedLanguage, input.targetLanguage);
    const ambiguities = detectAmbiguities(scores, this.registry, analysis.detectedLanguage, input.targetLanguage);

    // Filter out scores/ambiguities with undefined construct data
    const safeScores = scores.filter((s) => s.constructId != null);
    const safeAmbiguities = ambiguities.filter((a) => a.constructId != null && a.canonicalName != null);

    const promptCtx: PromptContext = {
      sourceLanguage: analysis.detectedLanguage,
      targetLanguage: input.targetLanguage,
      sourceCode,
      scores: safeScores,
      ambiguities: safeAmbiguities,
    };

    const prompt = buildTranslationPrompt(promptCtx);

    return { jobId: job.id, prompt, analysis };
  }

  /**
   * Finalize a translation — validate output, compute confidence, generate evidence.
   */
  finalizeTranslation(jobId: string, generatedCode: string): FinalizeResult {
    const job = this.store.getJob(jobId);
    if (!job) {
      throw new TranslationError(`Job not found: ${jobId}`);
    }

    // Empty code = failure
    if (!generatedCode.trim()) {
      this.store.updateJob(jobId, {
        status: "failed",
        errorMessage: "Generated code is empty",
      });
      const failedJob = this.store.getJob(jobId) as TranslationJob;
      return {
        job: { id: failedJob.id, status: failedJob.status },
        evidence: emptyEvidence(),
      };
    }

    // Parse target code to validate construct coverage
    const targetParser = PARSERS.get(job.targetLanguage);
    const targetParsed = targetParser ? targetParser.parseSnippet(generatedCode) : [];

    // Parse source for comparison
    const sourceParser = PARSERS.get(job.sourceLanguage);
    const sourceParsed = sourceParser ? sourceParser.parseSnippet(job.sourceCode) : [];

    // Build evidence
    const evidence = buildEvidence(sourceParsed, targetParsed, job.sourceLanguage, job.targetLanguage);

    // Update job as done
    this.store.updateJob(jobId, {
      status: "done",
      targetCode: generatedCode,
      confidenceScore: evidence.confidenceScore,
      evidence: evidence as unknown as Record<string, unknown>,
    });

    const finalJob = this.store.getJob(jobId);
    if (!finalJob) throw new Error(`Job not found after finalization: ${jobId}`);
    return {
      job: {
        id: finalJob.id,
        status: finalJob.status,
        targetCode: finalJob.targetCode,
        confidenceScore: finalJob.confidenceScore,
      },
      evidence,
    };
  }
}

function buildEvidence(
  source: ParsedConstruct[],
  target: ParsedConstruct[],
  sourceLang: string,
  targetLang: string,
): EvidencePack {
  const sourceIds = new Set(source.map((p) => p.constructId));
  const targetIds = new Set(target.map((p) => p.constructId));

  const translated: EvidencePack["translatedConstructs"] = [];
  const risks: EvidencePack["risks"] = [];
  const reviewPoints: string[] = [];

  for (const id of sourceIds) {
    if (targetIds.has(id)) {
      translated.push({ source: id, target: id, method: "direct" });
    } else {
      // Check if an equivalent construct exists in target (e.g. uc_for_each ↔ uc_for_loop)
      const equivalent = EQUIVALENT_CONSTRUCTS.get(id);
      if (equivalent && targetIds.has(equivalent)) {
        translated.push({ source: id, target: equivalent, method: "equivalent" });
      } else {
        risks.push({
          construct: id,
          severity: "medium",
          message: `${id} from ${sourceLang} has no direct equivalent detected in ${targetLang} output`,
        });
        reviewPoints.push(`Review mapping of ${id}`);
      }
    }
  }

  // Coverage-based confidence
  const coverage = sourceIds.size > 0 ? translated.length / sourceIds.size : 0;
  const confidenceScore = Math.min(coverage * 0.8 + 0.2, 1);

  return {
    diff: `${sourceLang} (${source.length} constructs) → ${targetLang} (${target.length} constructs)`,
    translatedConstructs: translated,
    risks,
    confidenceScore,
    humanReviewPoints: reviewPoints,
  };
}

function emptyEvidence(): EvidencePack {
  return {
    diff: "",
    translatedConstructs: [],
    risks: [{ construct: "all", severity: "critical", message: "Translation failed — no code generated" }],
    confidenceScore: 0,
    humanReviewPoints: ["Full manual review required"],
  };
}
