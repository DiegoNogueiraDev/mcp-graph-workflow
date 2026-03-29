/**
 * TaskContextCache — caches buildTaskContext results per nodeId.
 *
 * Avoids redundant context computation for the same node.
 * Invalidation: per-node, per-node+dependents, or all.
 * Uses lru-cache for O(1) LRU eviction.
 */
import { LRUCache } from "lru-cache";
import type { TaskContext } from "./compact-context.js";

export interface TaskContextCacheOptions {
  maxSize: number;
  ttlMs: number;
}

export interface TaskContextCacheStats {
  size: number;
  hits: number;
  misses: number;
}

export class TaskContextCache {
  private cache: LRUCache<string, TaskContext>;
  private hits: number = 0;
  private misses: number = 0;

  constructor(options: TaskContextCacheOptions) {
    this.cache = new LRUCache<string, TaskContext>({
      max: options.maxSize,
    });
  }

  get(nodeId: string): TaskContext | undefined {
    const result = this.cache.get(nodeId);

    if (result === undefined) {
      this.misses++;
      return undefined;
    }

    this.hits++;
    return result;
  }

  set(nodeId: string, context: TaskContext): void {
    this.cache.set(nodeId, context);
  }

  /**
   * Invalidate cache for a specific node.
   */
  invalidateNode(nodeId: string): void {
    this.cache.delete(nodeId);
  }

  /**
   * Invalidate cache for a node and its direct dependents.
   * Call on update_status to ensure dependents get fresh context.
   */
  invalidateNodeAndDependents(nodeId: string, dependentIds: string[]): void {
    this.cache.delete(nodeId);
    for (const depId of dependentIds) {
      this.cache.delete(depId);
    }
  }

  /**
   * Invalidate all cached entries.
   */
  invalidateAll(): void {
    this.cache.clear();
  }

  getStats(): TaskContextCacheStats {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
    };
  }
}
