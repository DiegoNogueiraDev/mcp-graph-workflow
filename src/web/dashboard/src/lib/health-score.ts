/**
 * Pure function: compute a 0-100 health score from project data.
 *
 * Weights:
 *  - completion rate (40%)
 *  - blocker-free ratio (25%)
 *  - AC coverage (20%)
 *  - size health — no oversized tasks (15%)
 */

export interface HealthScoreInput {
  completionRate: number;
  totalNodes: number;
  blockedCount: number;
  missingACCount: number;
  oversizedCount: number;
}

export function computeHealthScore(input: HealthScoreInput): number {
  const { completionRate, totalNodes, blockedCount, missingACCount, oversizedCount } = input;

  if (totalNodes === 0) return 100;

  const completion = completionRate;
  const blockerFree = ((totalNodes - blockedCount) / totalNodes) * 100;
  const acCoverage = ((totalNodes - missingACCount) / totalNodes) * 100;
  const sizeHealth = ((totalNodes - oversizedCount) / totalNodes) * 100;

  const raw =
    completion * 0.4 +
    blockerFree * 0.25 +
    acCoverage * 0.2 +
    sizeHealth * 0.15;

  return Math.round(Math.max(0, Math.min(100, raw)));
}
