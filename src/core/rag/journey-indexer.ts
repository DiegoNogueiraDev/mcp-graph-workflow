/**
 * Journey Indexer — indexes journey maps (screens, edges, variants) into the knowledge store.
 * Makes journey data discoverable via RAG queries so the AI can use it as context.
 */

import { KnowledgeStore } from "../store/knowledge-store.js";
import { JourneyStore, type JourneyMapFull, type JourneyScreen, type JourneyEdge } from "../journey/journey-store.js";
import { chunkText } from "./chunk-text.js";
import { logger } from "../utils/logger.js";

export interface JourneyIndexResult {
  mapsIndexed: number;
  documentsIndexed: number;
}

/**
 * Format a single screen into a rich text representation for the knowledge store.
 * Includes all contextual data: fields, CTAs, URL, type, connections.
 */
function formatScreenContent(
  screen: JourneyScreen,
  edges: JourneyEdge[],
  allScreens: Map<string, JourneyScreen>,
): string {
  const lines: string[] = [];

  lines.push(`# ${screen.title}`);
  lines.push(`Type: ${screen.screenType}`);
  if (screen.url) lines.push(`URL: ${screen.url}`);
  if (screen.description) lines.push(`\n${screen.description}`);

  // Form fields
  if (screen.fields && screen.fields.length > 0) {
    lines.push(`\n## Form Fields (${screen.fields.length})`);
    for (const field of screen.fields) {
      const req = field.required ? " *required*" : "";
      const opts = field.options ? ` [${field.options.join(", ")}]` : "";
      lines.push(`- ${field.label ?? field.name} (${field.type})${req}${opts}`);
    }
  }

  // CTAs
  if (screen.ctas && screen.ctas.length > 0) {
    lines.push(`\n## CTAs`);
    for (const cta of screen.ctas) {
      lines.push(`- ${cta}`);
    }
  }

  // Outgoing navigations
  const outEdges = edges.filter((e) => e.from === screen.id);
  if (outEdges.length > 0) {
    lines.push(`\n## Navigates To`);
    for (const edge of outEdges) {
      const target = allScreens.get(edge.to);
      const targetName = target ? target.title : edge.to;
      lines.push(`- ${edge.label ?? edge.type} -> ${targetName}`);
    }
  }

  // Incoming navigations
  const inEdges = edges.filter((e) => e.to === screen.id);
  if (inEdges.length > 0) {
    lines.push(`\n## Reached From`);
    for (const edge of inEdges) {
      const source = allScreens.get(edge.from);
      const sourceName = source ? source.title : edge.from;
      lines.push(`- ${sourceName} via ${edge.label ?? edge.type}`);
    }
  }

  // Metadata
  if (screen.metadata && Object.keys(screen.metadata).length > 0) {
    lines.push(`\n## Metadata`);
    for (const [key, value] of Object.entries(screen.metadata)) {
      lines.push(`- ${key}: ${JSON.stringify(value)}`);
    }
  }

  return lines.join("\n");
}

/**
 * Format the full journey map overview (summary of all screens and flows).
 */
function formatMapOverview(map: JourneyMapFull): string {
  const lines: string[] = [];

  lines.push(`# Journey Map: ${map.name}`);
  if (map.url) lines.push(`Site: ${map.url}`);
  if (map.description) lines.push(`\n${map.description}`);

  lines.push(`\n## Screens (${map.screens.length})`);
  for (const screen of map.screens) {
    const fieldCount = screen.fields?.length ?? 0;
    const ctaCount = screen.ctas?.length ?? 0;
    lines.push(`- ${screen.title} [${screen.screenType}]${fieldCount > 0 ? ` ${fieldCount} fields` : ""}${ctaCount > 0 ? ` ${ctaCount} CTAs` : ""}`);
  }

  lines.push(`\n## User Flows (${map.edges.length} connections)`);
  const screenMap = new Map(map.screens.map((s) => [s.id, s]));
  for (const edge of map.edges) {
    const from = screenMap.get(edge.from);
    const to = screenMap.get(edge.to);
    lines.push(`- ${from?.title ?? edge.from} -> ${to?.title ?? edge.to}: ${edge.label ?? edge.type}`);
  }

  if (map.variants.length > 0) {
    lines.push(`\n## A/B Variants (${map.variants.length})`);
    for (const variant of map.variants) {
      const pathNames = variant.path.map((id) => screenMap.get(id)?.title ?? id);
      lines.push(`- ${variant.name}: ${pathNames.join(" -> ")}`);
      if (variant.description) lines.push(`  ${variant.description}`);
    }
  }

  return lines.join("\n");
}

/**
 * Index all journey maps from the database into the knowledge store.
 * Each screen becomes a separate document, plus an overview doc per map.
 */
export function indexJourneyMaps(
  knowledgeStore: KnowledgeStore,
  journeyStore: JourneyStore,
): JourneyIndexResult {
  const maps = journeyStore.listMaps();

  if (maps.length === 0) {
    logger.info("No journey maps to index");
    return { mapsIndexed: 0, documentsIndexed: 0 };
  }

  // Clean previous journey knowledge — delete each map's documents
  for (const mapSummary of maps) {
    knowledgeStore.deleteBySource("journey", `journey:map:${mapSummary.id}`);
    const map = journeyStore.getMap(mapSummary.id);
    if (map) {
      for (const screen of map.screens) {
        knowledgeStore.deleteBySource("journey", `journey:screen:${screen.id}`);
      }
    }
  }

  let totalDocs = 0;

  for (const mapSummary of maps) {
    const map = journeyStore.getMap(mapSummary.id);
    if (!map) continue;

    const screenMap = new Map(map.screens.map((s) => [s.id, s]));

    // 1. Index the map overview
    const overviewContent = formatMapOverview(map);
    const overviewChunks = chunkText(overviewContent);
    const overviewSourceId = `journey:map:${map.id}`;

    knowledgeStore.insertChunks(
      overviewChunks.map((chunk) => ({
        sourceType: "journey" as const,
        sourceId: overviewSourceId,
        title: overviewChunks.length > 1
          ? `Journey: ${map.name} [overview ${chunk.index + 1}/${overviewChunks.length}]`
          : `Journey: ${map.name} [overview]`,
        content: chunk.content,
        chunkIndex: chunk.index,
        metadata: {
          mapId: map.id,
          mapName: map.name,
          url: map.url,
          screenCount: map.screens.length,
          edgeCount: map.edges.length,
          variantCount: map.variants.length,
          docType: "overview",
        },
      })),
    );
    totalDocs += overviewChunks.length;

    // 2. Index each screen individually
    for (const screen of map.screens) {
      const screenContent = formatScreenContent(screen, map.edges, screenMap);
      const screenChunks = chunkText(screenContent);
      const screenSourceId = `journey:screen:${screen.id}`;

      knowledgeStore.insertChunks(
        screenChunks.map((chunk) => ({
          sourceType: "journey" as const,
          sourceId: screenSourceId,
          title: screenChunks.length > 1
            ? `Journey: ${map.name} > ${screen.title} [${chunk.index + 1}/${screenChunks.length}]`
            : `Journey: ${map.name} > ${screen.title}`,
          content: chunk.content,
          chunkIndex: chunk.index,
          metadata: {
            mapId: map.id,
            mapName: map.name,
            screenId: screen.id,
            screenType: screen.screenType,
            url: screen.url,
            fieldCount: screen.fields?.length ?? 0,
            ctaCount: screen.ctas?.length ?? 0,
            docType: "screen",
          },
        })),
      );
      totalDocs += screenChunks.length;
    }

    logger.info("Journey map indexed", {
      mapId: map.id,
      name: map.name,
      screens: map.screens.length,
      documents: totalDocs,
    });
  }

  return { mapsIndexed: maps.length, documentsIndexed: totalDocs };
}
