/**
 * Query Cache — in-memory cache for RAG search results.
 *
 * Features:
 * - TTL-based expiration
 * - True LRU eviction via lru-cache (O(1) eviction by last access)
 * - Query normalization (case-insensitive, trimmed)
 * - Hit/miss statistics
 * - Bulk invalidation (e.g., when knowledge store changes)
 */

import { LRUCache } from "lru-cache";
import type { RankedResult } from "./multi-strategy-retrieval.js";
import { logger } from "../utils/logger.js";

export interface CacheOptions {
  ttlMs: number;
  maxSize: number;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  evictions: number;
}

/**
 * Normalize query for consistent cache keys.
 */
function normalizeKey(query: string): string {
  return query.trim().toLowerCase();
}

interface TimestampedResults {
  results: RankedResult[];
  createdAt: number;
}

/**
 * In-memory query cache with TTL and true LRU eviction via lru-cache.
 *
 * TTL is checked via Date.now() at access time (compatible with fake timers
 * in tests). LRU eviction is handled by lru-cache (O(1) by last access).
 */
export class QueryCache {
  private cache: LRUCache<string, TimestampedResults>;
  private ttlMs: number;
  private hits: number = 0;
  private misses: number = 0;
  private evictions: number = 0;

  constructor(options: CacheOptions) {
    this.ttlMs = options.ttlMs;
    this.cache = new LRUCache<string, TimestampedResults>({
      max: options.maxSize,
      dispose: () => {
        this.evictions++;
      },
      noDisposeOnSet: true,
    });
  }

  /**
   * Retrieve cached results for a query, or undefined if miss/expired.
   */
  get(query: string): RankedResult[] | undefined {
    const key = normalizeKey(query);
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return undefined;
    }

    // Check TTL via Date.now() for fake-timer compatibility
    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    this.hits++;
    return entry.results;
  }

  /**
   * Store results for a query.
   */
  set(query: string, results: RankedResult[]): void {
    const key = normalizeKey(query);
    this.cache.set(key, { results, createdAt: Date.now() });
  }

  /**
   * Invalidate all cached entries.
   */
  invalidateAll(): void {
    const count = this.cache.size;
    this.cache.clear();
    logger.debug("Query cache invalidated", { entriesCleared: count });
  }

  /**
   * Get cache statistics.
   */
  getStats(): CacheStats {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
    };
  }
}
