import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import type { GraphDocument } from "../graph/graph-types.js";
import { logger } from "../utils/logger.js";

export interface SkillInfo {
  name: string;
  description: string;
  category: string;
  filePath: string;
}

export interface SkillRecommendation {
  skill: string;
  reason: string;
  phase: string;
}

/**
 * Scan skills directory for SKILL.md files and extract frontmatter.
 */
export async function scanSkills(basePath: string): Promise<SkillInfo[]> {
  const skillsDirs = [
    path.join(basePath, "copilot-ecosystem", "skills", "agents"),
    path.join(basePath, ".claude", "skills"),
  ];

  const skills: SkillInfo[] = [];

  for (const dir of skillsDirs) {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const skillMdPath = path.join(dir, entry.name, "SKILL.md");
        try {
          const content = await readFile(skillMdPath, "utf-8");
          const info = parseSkillFrontmatter(content, entry.name, skillMdPath);
          if (info) skills.push(info);
        } catch {
          // No SKILL.md in this directory
        }
      }
    } catch {
      // Directory doesn't exist
    }
  }

  logger.info("Skills scanned", { count: skills.length });
  return skills;
}

function parseSkillFrontmatter(content: string, dirName: string, filePath: string): SkillInfo | null {
  // Parse YAML frontmatter between --- delimiters
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    return {
      name: dirName,
      description: extractFirstLine(content),
      category: "general",
      filePath,
    };
  }

  const frontmatter = match[1];
  const name = extractField(frontmatter, "name") ?? dirName;
  const description = extractField(frontmatter, "description") ?? extractFirstLine(content);
  const category = extractField(frontmatter, "category") ?? "general";

  return { name, description, category, filePath };
}

function extractField(yaml: string, field: string): string | null {
  const match = yaml.match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
  return match ? match[1].trim().replace(/^["']|["']$/g, "") : null;
}

function extractFirstLine(content: string): string {
  const lines = content.split("\n").filter((l) => l.trim() && !l.startsWith("---") && !l.startsWith("#"));
  return lines[0]?.trim().substring(0, 120) ?? "";
}

/**
 * Generate skill recommendations based on current graph state.
 */
export function recommendSkills(
  doc: GraphDocument,
  availableSkills: SkillInfo[],
): SkillRecommendation[] {
  const recommendations: SkillRecommendation[] = [];
  // Bug #098: guard null/undefined availableSkills
  if (!availableSkills || availableSkills.length === 0) return recommendations;
  const skillNames = new Set(availableSkills.map((s) => s.name));

  const tasksByStatus = new Map<string, number>();
  for (const node of doc.nodes) {
    if (node.type === "task" || node.type === "subtask") {
      const count = tasksByStatus.get(node.status) ?? 0;
      tasksByStatus.set(node.status, count + 1);
    }
  }

  const inProgressCount = tasksByStatus.get("in_progress") ?? 0;
  const backlogCount = tasksByStatus.get("backlog") ?? 0;
  const blockedCount = tasksByStatus.get("blocked") ?? 0;

  // Tasks without tests
  const tasksWithoutTests = doc.nodes.filter(
    (n) =>
      (n.type === "task" || n.type === "subtask") &&
      n.status === "in_progress" &&
      !n.tags?.includes("tested"),
  );
  if (tasksWithoutTests.length > 0 && skillNames.has("polyglot-test-generator")) {
    recommendations.push({
      skill: "polyglot-test-generator",
      reason: `${tasksWithoutTests.length} tasks in progress without test coverage`,
      phase: "IMPLEMENT",
    });
  }

  // Review pending
  const readyForReview = doc.nodes.filter(
    (n) => n.type === "task" && n.status === "in_progress" && n.tags?.includes("review-pending"),
  );
  if (readyForReview.length > 0 && skillNames.has("code-reviewer")) {
    recommendations.push({
      skill: "code-reviewer",
      reason: `${readyForReview.length} tasks pending review`,
      phase: "REVIEW",
    });
  }

  // High blocked count
  if (blockedCount > 3) {
    recommendations.push({
      skill: "dev-flow-orchestrator",
      reason: `${blockedCount} blocked tasks — consider re-planning dependencies`,
      phase: "ANALYZE",
    });
  }

  // Large backlog
  if (backlogCount > 20 && inProgressCount === 0) {
    recommendations.push({
      skill: "dev-flow-orchestrator",
      reason: `${backlogCount} tasks in backlog with none in progress — start sprint planning`,
      phase: "PLAN",
    });
  }

  // Missing acceptance criteria
  const missingAC = doc.nodes.filter(
    (n) =>
      (n.type === "task" || n.type === "epic") &&
      n.status !== "done" &&
      (!n.acceptanceCriteria || n.acceptanceCriteria.length === 0),
  );
  if (missingAC.length > 5) {
    recommendations.push({
      skill: "create-prd-chat-mode",
      reason: `${missingAC.length} tasks/epics without acceptance criteria`,
      phase: "DESIGN",
    });
  }

  logger.info("Skill recommendations generated", { count: recommendations.length });
  return recommendations;
}
