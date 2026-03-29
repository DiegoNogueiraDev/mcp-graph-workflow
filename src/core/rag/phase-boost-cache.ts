/**
 * Phase-Boosted Search Cache — caches searchWithPhaseBoost results by (query, phase).
 *
 * TTL: 2 minutes (phase changes less frequently than queries).
 * Invalidation: knowledge:indexed event + phase change.
 * Uses lru-cache for O(1) LRU eviction.
 */
import { LRUCache } from "lru-cache";

export interface PhaseBoostCacheOptions {
  maxSize: number;
  ttlMs: number;
}

export interface PhaseBoostCacheStats {
  size: number;
  hits: number;
  misses: number;
}

function normalizeKey(query: string): string {
  return query.trim().toLowerCase();
}

function buildKey(query: string, phase: string): string {
  return `${normalizeKey(query)}::${phase}`;
}

export class PhaseBoostCache {
  private cache: LRUCache<string, unknown[]>;
  private hits: number = 0;
  private misses: number = 0;

  constructor(options: PhaseBoostCacheOptions) {
    this.cache = new LRUCache<string, unknown[]>({
      max: options.maxSize,
    });
  }

  get(query: string, phase: string): unknown[] | undefined {
    const key = buildKey(query, phase);
    const result = this.cache.get(key);

    if (result === undefined) {
      this.misses++;
      return undefined;
    }

    this.hits++;
    return result;
  }

  set(query: string, phase: string, results: unknown[]): void {
    const key = buildKey(query, phase);
    this.cache.set(key, results);
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  getStats(): PhaseBoostCacheStats {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
    };
  }
}
