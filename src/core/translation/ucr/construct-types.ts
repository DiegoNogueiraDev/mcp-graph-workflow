import { z } from "zod/v4";

// --- UCR Category ---

export const UcrCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
});

export type UcrCategory = z.infer<typeof UcrCategorySchema>;

// --- UCR Construct (canonical) ---

export const UcrConstructSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  canonicalName: z.string(),
  description: z.string().optional(),
  semanticGroup: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type UcrConstruct = z.infer<typeof UcrConstructSchema>;

// --- UCR Language Mapping ---

export const UcrLanguageMappingSchema = z.object({
  id: z.string(),
  constructId: z.string(),
  languageId: z.string(),
  syntaxPattern: z.string(),
  astNodeType: z.string().optional(),
  confidence: z.number().min(0).max(1),
  isPrimary: z.boolean(),
  constraints: z.record(z.string(), z.unknown()).optional(),
});

export type UcrLanguageMapping = z.infer<typeof UcrLanguageMappingSchema>;

// --- UCR Equivalence Class ---

export const EquivalenceTypeSchema = z.enum(["exact", "syntactic", "semantic", "none"]);

export type EquivalenceType = z.infer<typeof EquivalenceTypeSchema>;

export const UcrEquivalenceClassSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  equivalenceType: EquivalenceTypeSchema,
});

export type UcrEquivalenceClass = z.infer<typeof UcrEquivalenceClassSchema>;

// --- Canonical Construct (parsed output — what the parser returns) ---

export type CanonicalConstruct = {
  constructId: string;
  canonicalName: string;
  sourceText: string;
  startLine: number;
  endLine: number;
  children: CanonicalConstruct[];
  metadata?: Record<string, unknown>;
};

export const CanonicalConstructSchema: z.ZodType<CanonicalConstruct> = z.lazy(() =>
  z.object({
    constructId: z.string(),
    canonicalName: z.string(),
    sourceText: z.string(),
    startLine: z.number().int(),
    endLine: z.number().int(),
    children: z.array(CanonicalConstructSchema),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
);

// --- Translation Path (UCR lookup result) ---

export const TranslationPathSchema = z.object({
  sourceMapping: UcrLanguageMappingSchema,
  targetMapping: UcrLanguageMappingSchema,
  confidence: z.number().min(0).max(1),
  alternatives: z.array(UcrLanguageMappingSchema),
});

export type TranslationPath = z.infer<typeof TranslationPathSchema>;

// --- Translation Score (per-construct scoring) ---

export const TranslationScoreAlternativeSchema = z.object({
  mappingId: z.string(),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
});

export const TranslationScoreSchema = z.object({
  constructId: z.string(),
  staticConfidence: z.number().min(0).max(1),
  contextualConfidence: z.number().min(0).max(1),
  finalConfidence: z.number().min(0).max(1),
  selectedMappingId: z.string(),
  alternatives: z.array(TranslationScoreAlternativeSchema),
  needsAiAssist: z.boolean(),
});

export type TranslationScore = z.infer<typeof TranslationScoreSchema>;

// --- Ambiguity Report ---

export const AmbiguityTypeSchema = z.enum(["multiple_targets", "no_target", "lossy_translation"]);

export type AmbiguityType = z.infer<typeof AmbiguityTypeSchema>;

export const AmbiguityCandidateSchema = z.object({
  mappingId: z.string(),
  confidence: z.number().min(0).max(1),
  tradeoff: z.string(),
});

export const AmbiguityReportSchema = z.object({
  constructId: z.string(),
  canonicalName: z.string(),
  ambiguityType: AmbiguityTypeSchema,
  candidates: z.array(AmbiguityCandidateSchema),
  recommendation: z.string().optional(),
});

export type AmbiguityReport = z.infer<typeof AmbiguityReportSchema>;

// --- UCR Seed Data (JSON import format) ---

export const UcrSeedDataSchema = z.object({
  categories: z.array(UcrCategorySchema),
  constructs: z.array(UcrConstructSchema),
  mappings: z.array(UcrLanguageMappingSchema),
  equivalenceClasses: z.array(UcrEquivalenceClassSchema).optional(),
});

export type UcrSeedData = z.infer<typeof UcrSeedDataSchema>;
