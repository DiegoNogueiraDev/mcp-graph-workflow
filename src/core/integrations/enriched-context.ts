/**
 * Enriched Context Builder — combines Serena memories with GitNexus data
 * for a unified symbol context. All data sourced locally.
 */

import { readAllSerenaMemories, type SerenaMemory } from "./serena-reader.js";
import { isGitNexusRunning } from "./gitnexus-launcher.js";
import { logger } from "../utils/logger.js";

export interface EnrichedContext {
  symbol: string;
  serena: {
    available: boolean;
    relevantMemories: Array<{ name: string; excerpt: string }>;
  };
  gitnexus: {
    available: boolean;
    data?: unknown;
  };
  combined: string;
}

/**
 * Filter memories that mention the given symbol (case-insensitive).
 */
function filterRelevantMemories(
  memories: SerenaMemory[],
  symbol: string,
): Array<{ name: string; excerpt: string }> {
  const lower = symbol.toLowerCase();

  return memories
    .filter((m) => m.content.toLowerCase().includes(lower))
    .map((m) => {
      // Extract relevant excerpt — lines containing the symbol
      const lines = m.content.split("\n");
      const relevant = lines.filter((l) => l.toLowerCase().includes(lower));
      const excerpt = relevant.slice(0, 5).join("\n") || m.content.slice(0, 200);

      return { name: m.name, excerpt };
    });
}

/**
 * Try to fetch GitNexus context for a symbol.
 */
async function fetchGitNexusContext(
  symbol: string,
  port: number,
): Promise<{ available: boolean; data?: unknown }> {
  const running = await isGitNexusRunning(port);
  if (!running) {
    return { available: false };
  }

  try {
    const res = await fetch(`http://localhost:${port}/api/context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol }),
    });

    if (!res.ok) {
      return { available: true, data: null };
    }

    const data = await res.json();
    return { available: true, data };
  } catch {
    return { available: false };
  }
}

/**
 * Build enriched context for a symbol by combining Serena + GitNexus data.
 */
export async function buildEnrichedContext(
  symbol: string,
  basePath: string,
  gitnexusPort: number = 3737,
): Promise<EnrichedContext> {
  logger.info("Building enriched context", { symbol, basePath });

  // Fetch data from both sources in parallel
  const [memories, gitnexus] = await Promise.all([
    readAllSerenaMemories(basePath),
    fetchGitNexusContext(symbol, gitnexusPort),
  ]);

  const serenaAvailable = memories.length > 0;
  const relevantMemories = filterRelevantMemories(memories, symbol);

  // Build combined summary
  const parts: string[] = [`Symbol: ${symbol}`];

  if (relevantMemories.length > 0) {
    parts.push(`\nSerena Memories (${relevantMemories.length} relevant):`);
    for (const mem of relevantMemories) {
      parts.push(`  [${mem.name}] ${mem.excerpt.split("\n")[0]}`);
    }
  }

  if (gitnexus.available && gitnexus.data) {
    parts.push("\nGitNexus Context: Available (see gitnexus.data)");
  } else if (!gitnexus.available) {
    parts.push("\nGitNexus: Not available");
  }

  const combined = parts.join("\n");

  logger.info("Enriched context built", {
    symbol,
    serenaMemories: relevantMemories.length,
    gitnexusAvailable: gitnexus.available,
  });

  return {
    symbol,
    serena: {
      available: serenaAvailable,
      relevantMemories,
    },
    gitnexus,
    combined,
  };
}
