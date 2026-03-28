/**
 * Query Cache — in-memory cache for RAG search results.
 *
 * Features:
 * - TTL-based expiration
 * - LRU eviction when maxSize exceeded
 * - Query normalization (case-insensitive, trimmed)
 * - Hit/miss statistics
 * - Bulk invalidation (e.g., when knowledge store changes)
 */

import type { RankedResult } from "./multi-strategy-retrieval.js";
import { logger } from "../utils/logger.js";

export interface CacheOptions {
  ttlMs: number;
  maxSize: number;
}

interface CacheEntry {
  results: RankedResult[];
  createdAt: number;
  lastAccessedAt: number;
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

/**
 * In-memory query cache with TTL and LRU eviction.
 */
export class QueryCache {
  private entries: Map<string, CacheEntry> = new Map();
  private ttlMs: number;
  private maxSize: number;
  private hits: number = 0;
  private misses: number = 0;
  private evictions: number = 0;

  constructor(options: CacheOptions) {
    this.ttlMs = options.ttlMs;
    this.maxSize = options.maxSize;
  }

  /**
   * Retrieve cached results for a query, or undefined if miss/expired.
   */
  get(query: string): RankedResult[] | undefined {
    const key = normalizeKey(query);
    const entry = this.entries.get(key);

    if (!entry) {
      this.misses++;
      return undefined;
    }

    // Check TTL
    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.entries.delete(key);
      this.misses++;
      return undefined;
    }

    entry.lastAccessedAt = Date.now();
    this.hits++;
    return entry.results;
  }

  /**
   * Store results for a query.
   */
  set(query: string, results: RankedResult[]): void {
    const key = normalizeKey(query);

    // Evict if at capacity
    if (this.entries.size >= this.maxSize && !this.entries.has(key)) {
      this.evictOldest();
    }

    this.entries.set(key, {
      results,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
    });
  }

  /**
   * Invalidate all cached entries.
   */
  invalidateAll(): void {
    const count = this.entries.size;
    this.entries.clear();
    logger.debug("Query cache invalidated", { entriesCleared: count });
  }

  /**
   * Get cache statistics.
   */
  getStats(): CacheStats {
    return {
      size: this.entries.size,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
    };
  }

  /**
   * Evict the oldest (by creation time) entry.
   */
  private evictOldest(): void {
    let oldestKey: string | undefined;
    let oldestTime = Infinity;

    for (const [key, entry] of this.entries) {
      if (entry.lastAccessedAt < oldestTime) {
        oldestTime = entry.lastAccessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.entries.delete(oldestKey);
      this.evictions++;
    }
  }
}
