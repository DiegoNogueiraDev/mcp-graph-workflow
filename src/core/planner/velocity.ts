/**
 * Velocity tracking: measures sprint completion metrics.
 *
 * Computes:
 * - Tasks completed per sprint
 * - Average XP size completed
 * - Estimated completion time (based on created→done timestamps)
 */

import type { GraphDocument, GraphNode } from "../graph/graph-types.js";
import { logger } from "../utils/logger.js";

const XP_SIZE_POINTS: Record<string, number> = {
  XS: 1, S: 2, M: 3, L: 5, XL: 8,
};

export interface SprintVelocity {
  sprint: string;
  tasksCompleted: number;
  totalPoints: number;
  avgPointsPerTask: number;
  avgCompletionHours: number | null;
  tasks: VelocityTask[];
}

export interface VelocityTask {
  id: string;
  title: string;
  xpSize: string;
  points: number;
  completionHours: number | null;
}

export interface VelocitySummary {
  sprints: SprintVelocity[];
  overall: {
    totalTasksCompleted: number;
    totalPoints: number;
    avgPointsPerSprint: number;
    avgCompletionHours: number | null;
  };
}

/**
 * Calculate velocity metrics for all sprints in the graph.
 */
export function calculateVelocity(doc: GraphDocument): VelocitySummary {
  // Group done tasks by sprint
  const doneTasks = doc.nodes.filter(
    (n) => n.status === "done" && (n.type === "task" || n.type === "subtask"),
  );

  const bySprint = new Map<string, GraphNode[]>();

  for (const node of doneTasks) {
    const sprint = node.sprint ?? "(no sprint)";
    const group = bySprint.get(sprint) ?? [];
    group.push(node);
    bySprint.set(sprint, group);
  }

  const sprints: SprintVelocity[] = [];

  for (const [sprint, tasks] of bySprint) {
    const velocityTasks: VelocityTask[] = tasks.map((t) => {
      const points = XP_SIZE_POINTS[t.xpSize ?? "M"] ?? 3;
      const completionHours = computeCompletionHours(t);
      return {
        id: t.id,
        title: t.title,
        xpSize: t.xpSize ?? "M",
        points,
        completionHours,
      };
    });

    const totalPoints = velocityTasks.reduce((sum, t) => sum + t.points, 0);
    const hoursValues = velocityTasks
      .map((t) => t.completionHours)
      .filter((h): h is number => h !== null);

    sprints.push({
      sprint,
      tasksCompleted: tasks.length,
      totalPoints,
      avgPointsPerTask: tasks.length > 0 ? Math.round((totalPoints / tasks.length) * 10) / 10 : 0,
      avgCompletionHours: hoursValues.length > 0
        ? Math.round((hoursValues.reduce((a, b) => a + b, 0) / hoursValues.length) * 10) / 10
        : null,
      tasks: velocityTasks,
    });
  }

  // Sort sprints by name
  sprints.sort((a, b) => a.sprint.localeCompare(b.sprint));

  const totalTasksCompleted = doneTasks.length;
  const totalPoints = sprints.reduce((sum, s) => sum + s.totalPoints, 0);
  const sprintCount = sprints.filter((s) => s.sprint !== "(no sprint)").length || 1;

  const allHours = sprints
    .flatMap((s) => s.tasks)
    .map((t) => t.completionHours)
    .filter((h): h is number => h !== null);

  logger.info(`Velocity: ${totalTasksCompleted} tasks done, ${totalPoints} points across ${sprints.length} sprints`);

  return {
    sprints,
    overall: {
      totalTasksCompleted,
      totalPoints,
      avgPointsPerSprint: Math.round((totalPoints / sprintCount) * 10) / 10,
      avgCompletionHours: allHours.length > 0
        ? Math.round((allHours.reduce((a, b) => a + b, 0) / allHours.length) * 10) / 10
        : null,
    },
  };
}

/**
 * Estimate completion time in hours from createdAt to updatedAt.
 * Returns null if timestamps are invalid or equal.
 */
function computeCompletionHours(node: GraphNode): number | null {
  try {
    const created = new Date(node.createdAt).getTime();
    const updated = new Date(node.updatedAt).getTime();
    if (isNaN(created) || isNaN(updated) || updated <= created) return null;
    return Math.round(((updated - created) / (1000 * 60 * 60)) * 10) / 10;
  } catch {
    return null;
  }
}
