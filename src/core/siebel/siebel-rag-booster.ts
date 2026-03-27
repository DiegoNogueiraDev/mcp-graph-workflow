/**
 * Siebel RAG Booster — adjusts ranking based on lifecycle phase.
 */

export interface ScoredDoc {
  id: string;
  sourceType: string;
  title: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface BoostedDoc extends ScoredDoc {
  boostedScore: number;
  boostReason?: string;
}

type BoostConfig = Record<string, { factor: number; reason: string }>;

const PHASE_BOOSTS: Record<string, BoostConfig> = {
  DESIGN: {
    siebel_pattern: { factor: 1.5, reason: "patterns relevant for design decisions" },
    siebel_sif: { factor: 1.2, reason: "object definitions for architecture" },
  },
  IMPLEMENT: {
    siebel_escript: { factor: 1.5, reason: "code examples for implementation" },
    siebel_sif: { factor: 1.3, reason: "field definitions for implementation" },
  },
  VALIDATE: {
    siebel_contract: { factor: 1.5, reason: "contracts for validation" },
    siebel_wsdl: { factor: 1.3, reason: "WSDL specs for test generation" },
  },
  REVIEW: {
    siebel_pattern: { factor: 1.3, reason: "patterns for compliance check" },
    siebel_escript: { factor: 1.2, reason: "scripts for quality review" },
  },
};

/**
 * Boost Siebel search results based on lifecycle phase.
 */
export function boostSiebelResults(docs: ScoredDoc[], phase: string): BoostedDoc[] {
  const boosts = PHASE_BOOSTS[phase] ?? {};

  const boosted: BoostedDoc[] = docs.map((doc) => {
    const boost = boosts[doc.sourceType];
    if (boost) {
      return {
        ...doc,
        boostedScore: doc.score * boost.factor,
        boostReason: boost.reason,
      };
    }
    return { ...doc, boostedScore: doc.score };
  });

  boosted.sort((a, b) => b.boostedScore - a.boostedScore);
  return boosted;
}
