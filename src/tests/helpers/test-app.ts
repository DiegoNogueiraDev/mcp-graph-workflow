import express from "express";
import type { Express } from "express";
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { createApiRouter } from "../../api/router.js";

export interface TestContext {
  app: Express;
  store: SqliteStore;
}

export function createTestApp(): TestContext {
  const store = SqliteStore.open(":memory:");
  store.initProject("Test Project");

  const app = express();
  app.use(express.json());
  app.use("/api/v1", createApiRouter(store));

  return { app, store };
}
