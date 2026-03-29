/**
 * Knowledge Synthesizer — generates derived knowledge by analyzing patterns
 * across existing knowledge documents.
 *
 * This is the "self-learning" layer: the system creates new knowledge from
 * patterns found in AI decisions, sprint reports, and validation results.
 */

import type Database from "better-sqlite3";
import { KnowledgeStore } from "../store/knowledge-store.js";
import { logger } from "../utils/logger.js";

const MIN_DOCS_FOR_SYNTHESIS = 3;

export interface SynthesisResult {
  synthesized: number;
  strategies: Record<string, number>;
}

/**
 * Run all synthesis strategies and store derived knowledge.
 */
export function runSynthesisCycle(db: Database.Database): SynthesisResult {
  const store = new KnowledgeStore(db);
  let synthesized = 0;
  const strategies: Record<string, number> = {};

  // Strategy 1: Error/Decision pattern detection from ai_decision docs
  const decisionCount = synthesizeDecisionPatterns(db, store);
  strategies.decisionPatterns = decisionCount;
  synthesized += decisionCount;

  // Strategy 2: Sprint trend analysis from sprint_plan docs
  const sprintCount = synthesizeSprintTrends(db, store);
  strategies.sprintTrends = sprintCount;
  synthesized += sprintCount;

  logger.info("Synthesis cycle complete", { synthesized, strategies });
  return { synthesized, strategies };
}

/**
 * Strategy 1: Detect patterns in AI decisions by grouping by shared tags.
 * When multiple decisions share a tag, synthesize a "pattern" document.
 */
function synthesizeDecisionPatterns(db: Database.Database, store: KnowledgeStore): number {
  const decisions = db
    .prepare("SELECT id, title, content, metadata FROM knowledge_documents WHERE source_type = 'ai_decision' LIMIT 1000")
    .all() as Array<{ id: string; title: string; content: string; metadata: string | null }>;

  if (decisions.length < MIN_DOCS_FOR_SYNTHESIS) return 0;

  // Group by tags
  const byTag = new Map<string, Array<{ title: string; content: string }>>();
  for (const dec of decisions) {
    const meta = dec.metadata ? JSON.parse(dec.metadata) : {};
    const tags = (meta.tags ?? []) as string[];
    for (const tag of tags) {
      const group = byTag.get(tag) ?? [];
      group.push({ title: dec.title, content: dec.content });
      byTag.set(tag, group);
    }
  }

  let synthesized = 0;

  for (const [tag, group] of byTag) {
    if (group.length < MIN_DOCS_FOR_SYNTHESIS) continue;

    const summaryLines = group.map((d) => `- ${d.title}: ${d.content.slice(0, 200)}`);
    const content = `# Pattern Synthesis: "${tag}"\n\nFound ${group.length} decisions related to "${tag}":\n\n${summaryLines.join("\n")}\n\n## Insight\nMultiple decisions share the "${tag}" theme. Consider creating a shared strategy or guideline for this topic.`;

    const sourceId = `synthesis:pattern:${tag}`;

    store.insert({
      sourceType: "synthesis",
      sourceId,
      title: `Pattern: ${tag} (${group.length} decisions)`,
      content,
      metadata: {
        strategy: "decision_patterns",
        tag,
        decisionCount: group.length,
        phase: "REVIEW",
        indexedAt: new Date().toISOString(),
      },
    });
    synthesized++;
  }

  return synthesized;
}

/**
 * Strategy 2: Analyze sprint plan trends across multiple sprints.
 */
function synthesizeSprintTrends(db: Database.Database, store: KnowledgeStore): number {
  const sprints = db
    .prepare("SELECT content, metadata FROM knowledge_documents WHERE source_type = 'sprint_plan' ORDER BY created_at LIMIT 1000")
    .all() as Array<{ content: string; metadata: string | null }>;

  if (sprints.length < MIN_DOCS_FOR_SYNTHESIS) return 0;

  const velocities: number[] = [];
  for (const sprint of sprints) {
    const meta = sprint.metadata ? JSON.parse(sprint.metadata) : {};
    if (typeof meta.velocity === "number") {
      velocities.push(meta.velocity);
    }
  }

  if (velocities.length < 2) return 0;

  const avgVelocity = velocities.reduce((a, b) => a + b, 0) / velocities.length;
  const trend = velocities.length >= 2
    ? velocities[velocities.length - 1] - velocities[0]
    : 0;
  const trendDirection = trend > 0 ? "improving" : trend < 0 ? "declining" : "stable";

  const content = `# Sprint Velocity Trend Analysis\n\nAnalyzed ${velocities.length} sprints.\n\n- Average velocity: ${avgVelocity.toFixed(1)}\n- Trend: ${trendDirection} (${trend > 0 ? "+" : ""}${trend.toFixed(1)})\n- Latest velocity: ${velocities[velocities.length - 1]}\n\n## Recommendation\n${trendDirection === "improving" ? "Velocity is improving. Consider slightly increasing sprint capacity." : trendDirection === "declining" ? "Velocity is declining. Investigate blockers and reduce WIP." : "Velocity is stable. Current capacity planning is well-calibrated."}`;

  const sourceId = `synthesis:sprint_trend:${new Date().toISOString()}`;

  store.insert({
    sourceType: "synthesis",
    sourceId,
    title: `Sprint Trend: ${trendDirection} (avg ${avgVelocity.toFixed(1)})`,
    content,
    metadata: {
      strategy: "sprint_trends",
      sprintCount: sprints.length,
      avgVelocity,
      trend: trendDirection,
      phase: "PLAN",
      indexedAt: new Date().toISOString(),
    },
  });

  return 1;
}
