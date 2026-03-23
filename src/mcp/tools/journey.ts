import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { JourneyStore } from "../../core/journey/journey-store.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { indexJourneyMaps } from "../../core/rag/journey-indexer.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

function getJourneyStore(store: SqliteStore): JourneyStore {
  const project = store.getProject();
  if (!project) return mcpError("Graph not initialized") as never;
  return new JourneyStore(store.getDb(), project.id);
}

export function registerJourney(server: McpServer, store: SqliteStore): void {
  server.tool(
    "journey",
    "Manage and query website journey maps — screen flows, form fields, CTAs, A/B variants. Use 'list' to see maps, 'get' for full details, 'search' to find screens by content, 'index' to sync journey data into the knowledge store for RAG queries.",
    {
      action: z
        .enum(["list", "get", "search", "index"])
        .describe("Action: list maps, get map details, search screens, index into knowledge store"),
      mapId: z
        .string()
        .optional()
        .describe("Journey map ID (required for 'get')"),
      query: z
        .string()
        .optional()
        .describe("Search query for screens (required for 'search')"),
    },
    async ({ action, mapId, query }) => {
      logger.debug("tool:journey", { action, mapId, query });

      const journeyStore = getJourneyStore(store);

      switch (action) {
        case "list": {
          const maps = journeyStore.listMaps();
          logger.info("tool:journey:list", { count: maps.length });
          return mcpText({
            action: "list",
            total: maps.length,
            maps: maps.map((m) => ({
              id: m.id,
              name: m.name,
              url: m.url,
              description: m.description,
              createdAt: m.createdAt,
            })),
          });
        }

        case "get": {
          if (!mapId) return mcpError("mapId is required for 'get' action");
          const map = journeyStore.getMap(mapId);
          if (!map) return mcpError(`Journey map not found: ${mapId}`);

          // Build a compact representation optimized for AI context
          const screenMap = new Map(map.screens.map((s) => [s.id, s]));
          const compactScreens = map.screens.map((s) => {
            const outEdges = map.edges
              .filter((e) => e.from === s.id)
              .map((e) => ({
                to: screenMap.get(e.to)?.title ?? e.to,
                label: e.label,
                type: e.type,
              }));

            return {
              id: s.id,
              title: s.title,
              type: s.screenType,
              url: s.url,
              description: s.description,
              fields: s.fields?.map((f) => ({
                name: f.name,
                type: f.type,
                required: f.required,
                label: f.label,
              })),
              ctas: s.ctas,
              navigatesTo: outEdges.length > 0 ? outEdges : undefined,
            };
          });

          const compactVariants = map.variants.map((v) => ({
            name: v.name,
            description: v.description,
            path: v.path.map((id) => screenMap.get(id)?.title ?? id),
          }));

          logger.info("tool:journey:get", { mapId, screens: map.screens.length });
          return mcpText({
            action: "get",
            id: map.id,
            name: map.name,
            url: map.url,
            description: map.description,
            screens: compactScreens,
            variants: compactVariants.length > 0 ? compactVariants : undefined,
            summary: {
              totalScreens: map.screens.length,
              totalEdges: map.edges.length,
              totalVariants: map.variants.length,
              screenTypes: [...new Set(map.screens.map((s) => s.screenType))],
              totalFormFields: map.screens.reduce((sum, s) => sum + (s.fields?.length ?? 0), 0),
              totalCTAs: map.screens.reduce((sum, s) => sum + (s.ctas?.length ?? 0), 0),
            },
          });
        }

        case "search": {
          if (!query) return mcpError("query is required for 'search' action");

          const maps = journeyStore.listMaps();
          const results: Array<{
            mapName: string;
            screenId: string;
            title: string;
            type: string;
            url?: string;
            matchContext: string;
          }> = [];

          const queryLower = query.toLowerCase();

          for (const mapSummary of maps) {
            const map = journeyStore.getMap(mapSummary.id);
            if (!map) continue;

            for (const screen of map.screens) {
              const searchable = [
                screen.title,
                screen.description ?? "",
                screen.screenType,
                screen.url ?? "",
                ...(screen.ctas ?? []),
                ...(screen.fields?.map((f) => `${f.label ?? f.name} ${f.type}`) ?? []),
              ].join(" ").toLowerCase();

              if (searchable.includes(queryLower)) {
                results.push({
                  mapName: map.name,
                  screenId: screen.id,
                  title: screen.title,
                  type: screen.screenType,
                  url: screen.url,
                  matchContext: screen.description?.slice(0, 200) ?? screen.title,
                });
              }
            }
          }

          logger.info("tool:journey:search", { query, results: results.length });
          return mcpText({
            action: "search",
            query,
            total: results.length,
            results,
          });
        }

        case "index": {
          const knowledgeStore = new KnowledgeStore(store.getDb());
          const result = indexJourneyMaps(knowledgeStore, journeyStore);
          logger.info("tool:journey:index", { mapsIndexed: result.mapsIndexed, documentsIndexed: result.documentsIndexed });
          return mcpText({
            action: "index",
            mapsIndexed: result.mapsIndexed,
            documentsIndexed: result.documentsIndexed,
            message: `Indexed ${result.mapsIndexed} journey map(s) into knowledge store (${result.documentsIndexed} documents). Journey data is now searchable via RAG queries.`,
          });
        }
      }
    },
  );
}
