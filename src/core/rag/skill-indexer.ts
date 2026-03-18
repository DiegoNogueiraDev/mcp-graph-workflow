/**
 * Skill Indexer — indexes built-in skills and filesystem skills
 * into the knowledge store for unified search.
 */

import { getBuiltInSkills, type BuiltInSkill } from "../skills/built-in-skills.js";
import { scanSkills } from "../insights/skill-recommender.js";
import { KnowledgeStore } from "../store/knowledge-store.js";
import { chunkText } from "./chunk-text.js";
import { logger } from "../utils/logger.js";

export interface SkillIndexResult {
  builtInIndexed: number;
  filesystemIndexed: number;
  skippedDuplicates: number;
}

/**
 * Index all skills (built-in + filesystem) into the knowledge store.
 * Uses sourceType: "skill" and sourceId: "skill:{name}".
 */
export async function indexSkills(
  knowledgeStore: KnowledgeStore,
  basePath: string,
): Promise<SkillIndexResult> {
  let builtInIndexed = 0;
  let filesystemIndexed = 0;
  let skippedDuplicates = 0;

  // Index built-in skills
  const builtInSkills = getBuiltInSkills();
  for (const skill of builtInSkills) {
    const content = formatSkillContent(skill);
    const countBefore = knowledgeStore.count("skill");

    knowledgeStore.insert({
      sourceType: "skill",
      sourceId: `skill:${skill.name}`,
      title: skill.name,
      content,
      chunkIndex: 0,
      metadata: {
        category: skill.category,
        phases: skill.phases,
        description: skill.description,
        source: "built-in",
      },
    });

    if (knowledgeStore.count("skill") > countBefore) {
      builtInIndexed++;
    } else {
      skippedDuplicates++;
    }
  }

  // Index filesystem skills
  try {
    const fsSkills = await scanSkills(basePath);
    for (const fsSkill of fsSkills) {
      // Skip if already indexed as built-in
      const isBuiltIn = builtInSkills.some((b) => b.name === fsSkill.name);
      if (isBuiltIn) continue;

      const content = `# ${fsSkill.name}\n\n${fsSkill.description}\n\nCategory: ${fsSkill.category}`;
      const chunks = chunkText(content);
      const countBefore = knowledgeStore.count("skill");

      for (const chunk of chunks) {
        knowledgeStore.insert({
          sourceType: "skill",
          sourceId: `skill:${fsSkill.name}`,
          title: chunks.length > 1
            ? `${fsSkill.name} [${chunk.index + 1}/${chunks.length}]`
            : fsSkill.name,
          content: chunk.content,
          chunkIndex: chunk.index,
          metadata: {
            category: fsSkill.category,
            description: fsSkill.description,
            filePath: fsSkill.filePath,
            source: "filesystem",
          },
        });
      }

      if (knowledgeStore.count("skill") > countBefore) {
        filesystemIndexed++;
      } else {
        skippedDuplicates++;
      }
    }
  } catch {
    logger.debug("skill-indexer: filesystem scan skipped (no skills directory)");
  }

  logger.info("Skills indexed", { builtInIndexed, filesystemIndexed, skippedDuplicates });
  return { builtInIndexed, filesystemIndexed, skippedDuplicates };
}

function formatSkillContent(skill: BuiltInSkill): string {
  return [
    `# ${skill.name}`,
    "",
    skill.description,
    "",
    `Category: ${skill.category}`,
    `Phases: ${skill.phases.join(", ")}`,
    "",
    "## Instructions",
    "",
    skill.instructions,
  ].join("\n");
}
