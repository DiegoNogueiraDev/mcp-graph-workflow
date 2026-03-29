/**
 * TF-IDF Embedding Cache — caches computed embedding vectors per query.
 *
 * Avoids recalculating TF-IDF vectors for identical queries.
 * Uses lru-cache for O(1) LRU eviction.
 */
import { LRUCache } from "lru-cache";

export interface EmbeddingCacheOptions {
  maxSize: number;
  ttlMs: number;
}

export interface EmbeddingCacheStats {
  size: number;
  hits: number;
  misses: number;
}

function normalizeKey(query: string): string {
  return query.trim().toLowerCase();
}

export class TfIdfEmbeddingCache {
  private cache: LRUCache<string, number[]>;
  private hits: number = 0;
  private misses: number = 0;

  constructor(options: EmbeddingCacheOptions) {
    this.cache = new LRUCache<string, number[]>({
      max: options.maxSize,
      ttl: options.ttlMs,
    });
  }

  get(query: string): number[] | undefined {
    const key = normalizeKey(query);
    const result = this.cache.get(key);

    if (result === undefined) {
      this.misses++;
      return undefined;
    }

    this.hits++;
    return result;
  }

  set(query: string, vector: number[]): void {
    const key = normalizeKey(query);
    this.cache.set(key, vector);
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  getStats(): EmbeddingCacheStats {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
    };
  }
}
