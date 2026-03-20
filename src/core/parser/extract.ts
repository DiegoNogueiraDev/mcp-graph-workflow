/**
 * Stage 4: Entity extraction.
 * Combine normalize → segment → classify to produce structured extraction results.
 */

import { normalize } from "./normalize.js";
import { segment } from "./segment.js";
import { classifySection, classifyText } from "./classify.js";
import type { ClassifiedBlock, ClassifiedItem, BlockType } from "./classify.js";
import { logger } from "../utils/logger.js";

export interface ExtractionResult {
  blocks: ClassifiedBlock[];
  summary: {
    totalSections: number;
    epics: number;
    tasks: number;
    subtasks: number;
    requirements: number;
    constraints: number;
    acceptanceCriteria: number;
    risks: number;
    unknown: number;
  };
}

function countByType(blocks: ClassifiedBlock[], items: ClassifiedItem[], type: BlockType): number {
  const blockCount = blocks.filter((b) => b.type === type).length;
  const itemCount = items.filter((i) => i.type === type).length;
  return blockCount + itemCount;
}

export function extractEntities(rawText: string): ExtractionResult {
  logger.info(`Extracting entities from ${rawText.length} chars`);
  const normalized = normalize(rawText);
  const sections = segment(normalized);
  logger.info(`Segmented into ${sections.length} sections`);

  const blocks: ClassifiedBlock[] = sections.map((sec) =>
    classifySection(sec.title, sec.body, sec.level, sec.startLine, sec.endLine),
  );

  // Detect items following bold AC labels (e.g., **Critérios de aceite:**)
  const acLabelPattern = /\*\*(?:crit[eé]rios?\s+de\s+aceite|acceptance\s+criteria|definition\s+of\s+done)\s*:?\s*\*\*/i;
  for (const block of blocks) {
    if (block.type === "task" || block.type === "epic") {
      const bodyLines = block.description.split("\n");
      let inAcSection = false;
      for (const line of bodyLines) {
        if (acLabelPattern.test(line)) {
          inAcSection = true;
          continue;
        }
        // Exit AC section on next bold label or heading
        if (inAcSection && /^\*\*[^*]+\*\*/.test(line) && !acLabelPattern.test(line)) {
          inAcSection = false;
        }
        if (inAcSection) {
          const bulletMatch = line.match(/^\s*[-*]\s+(?:\[[ x]\]\s)?(.+)$/i);
          if (bulletMatch) {
            const bulletText = bulletMatch[1].trim();
            const matchingItem = block.items.find((item) => {
              const normalized = item.text.replace(/^\[[ x]\]\s*/i, "").trim();
              return normalized === bulletText || item.text === bulletText;
            });
            if (matchingItem) {
              matchingItem.type = "acceptance_criteria";
              matchingItem.confidence = 0.85;
            }
          }
        }
      }
    }
  }

  // Promote items inside task-sections to subtask if they're generic or tasks
  for (const block of blocks) {
    if (block.type === "task" || block.type === "epic") {
      for (const item of block.items) {
        if (item.type === "acceptance_criteria" || item.type === "constraint") {
          continue; // Already classified with higher confidence — don't demote
        }
        if (item.type === "unknown" || item.type === "task") {
          // Items inside a task/epic section are subtasks
          if (block.type === "task") {
            item.type = "subtask";
            item.confidence = Math.max(item.confidence, 0.6);
          }
        }
      }
    }
  }

  // Also classify numbered items inside sections that look like task lists
  // (e.g., "Entregas" sections with numbered action items)
  for (const block of blocks) {
    if (block.type === "unknown") {
      for (const item of block.items) {
        if (item.type === "unknown") {
          const reclassified = classifyText(item.text);
          if (reclassified.type !== "unknown") {
            item.type = reclassified.type;
            item.confidence = reclassified.confidence;
          }
        }
      }
    }
  }

  const allItems = blocks.flatMap((b) => b.items);

  logger.info(`Extraction complete: ${blocks.length} blocks, ${allItems.length} items`);

  return {
    blocks,
    summary: {
      totalSections: blocks.length,
      epics: countByType(blocks, allItems, "epic"),
      tasks: countByType(blocks, allItems, "task"),
      subtasks: countByType(blocks, allItems, "subtask"),
      requirements: countByType(blocks, allItems, "requirement"),
      constraints: countByType(blocks, allItems, "constraint"),
      acceptanceCriteria: countByType(blocks, allItems, "acceptance_criteria"),
      risks: countByType(blocks, allItems, "risk"),
      unknown: countByType(blocks, allItems, "unknown"),
    },
  };
}
