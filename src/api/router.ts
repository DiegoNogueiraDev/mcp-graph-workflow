import { Router } from "express";
import type { SqliteStore } from "../core/store/sqlite-store.js";
import type { GraphEventBus } from "../core/events/event-bus.js";
import { createProjectRouter } from "./routes/project.js";
import { createNodesRouter } from "./routes/nodes.js";
import { createEdgesRouter } from "./routes/edges.js";
import { createStatsRouter } from "./routes/stats.js";
import { createSearchRouter } from "./routes/search.js";
import { createGraphRouter } from "./routes/graph.js";
import { createImportRouter } from "./routes/import.js";
import { createIntegrationsRouter } from "./routes/integrations.js";
import { createInsightsRouter } from "./routes/insights.js";
import { createSkillsRouter } from "./routes/skills.js";
import { createCaptureRouter } from "./routes/capture.js";
import { createDocsCacheRouter } from "./routes/docs-cache.js";
import { createContextRouter } from "./routes/context.js";
import { createEventsRouter } from "./routes/events.js";
import { createGitNexusRouter } from "./routes/gitnexus.js";
import { createRagRouter } from "./routes/rag.js";
import { createKnowledgeRouter } from "./routes/knowledge.js";
import { errorHandler } from "./middleware/error-handler.js";

export interface ApiRouterOptions {
  store: SqliteStore;
  basePath?: string;
  eventBus?: GraphEventBus;
}

export function createApiRouter(options: ApiRouterOptions): Router;
export function createApiRouter(store: SqliteStore): Router;
export function createApiRouter(storeOrOptions: SqliteStore | ApiRouterOptions): Router {
  const store = "store" in storeOrOptions ? storeOrOptions.store : storeOrOptions;
  const basePath = "basePath" in storeOrOptions ? (storeOrOptions.basePath ?? process.cwd()) : process.cwd();
  const eventBus = "eventBus" in storeOrOptions ? storeOrOptions.eventBus : undefined;

  const router = Router();

  router.use("/project", createProjectRouter(store));
  router.use("/nodes", createNodesRouter(store));
  router.use("/edges", createEdgesRouter(store));
  router.use("/stats", createStatsRouter(store));
  router.use("/search", createSearchRouter(store));
  router.use("/graph", createGraphRouter(store));
  router.use("/import", createImportRouter(store));
  router.use("/integrations", createIntegrationsRouter(store, basePath));
  router.use("/insights", createInsightsRouter(store, basePath));
  router.use("/skills", createSkillsRouter(basePath));
  router.use("/capture", createCaptureRouter());
  router.use("/docs", createDocsCacheRouter(store));
  router.use("/context", createContextRouter(store));
  router.use("/gitnexus", createGitNexusRouter({ basePath }));
  router.use("/rag", createRagRouter(store));
  router.use("/knowledge", createKnowledgeRouter(store));

  if (eventBus) {
    router.use("/events", createEventsRouter(eventBus));
  }

  router.use(errorHandler);

  return router;
}
