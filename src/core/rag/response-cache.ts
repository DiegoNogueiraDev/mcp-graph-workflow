/**
 * ResponseCache — generic in-memory cache for any response type.
 *
 * Used to cache RAG context responses (detail, default paths)
 * that return different object shapes than RankedResult[].
 *
 * Features:
 * - TTL-based expiration
 * - True LRU eviction (by lastAccessedAt)
 * - Key normalization (case-insensitive, trimmed)
 * - Hit/miss statistics
 * - Bulk invalidation
 */

import { logger } from "../utils/logger.js";

export interface ResponseCacheOptions {
  ttlMs: number;
  maxSize: number;
}

interface CacheEntry {
  data: unknown;
  createdAt: number;
  lastAccessedAt: number;
}

export interface ResponseCacheStats {
  size: number;
  hits: number;
  misses: number;
  evictions: number;
}

function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

export class ResponseCache {
  private entries: Map<string, CacheEntry> = new Map();
  private ttlMs: number;
  private maxSize: number;
  private hits: number = 0;
  private misses: number = 0;
  private evictions: number = 0;

  constructor(options: ResponseCacheOptions) {
    this.ttlMs = options.ttlMs;
    this.maxSize = options.maxSize;
  }

  get(key: string): unknown | undefined {
    const normalized = normalizeKey(key);
    const entry = this.entries.get(normalized);

    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.entries.delete(normalized);
      this.misses++;
      return undefined;
    }

    entry.lastAccessedAt = Date.now();
    this.hits++;
    return entry.data;
  }

  set(key: string, data: unknown): void {
    const normalized = normalizeKey(key);

    if (this.entries.size >= this.maxSize && !this.entries.has(normalized)) {
      this.evictLru();
    }

    this.entries.set(normalized, {
      data,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
    });
  }

  invalidateAll(): void {
    const count = this.entries.size;
    this.entries.clear();
    logger.debug("ResponseCache invalidated", { entriesCleared: count });
  }

  getStats(): ResponseCacheStats {
    return {
      size: this.entries.size,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
    };
  }

  private evictLru(): void {
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
