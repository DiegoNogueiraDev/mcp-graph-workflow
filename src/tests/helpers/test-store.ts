/**
 * Shared test store helper to reduce boilerplate.
 */
import { SqliteStore } from "../../core/store/sqlite-store.js";

export interface TestStoreContext {
  store: SqliteStore;
  cleanup: () => void;
}

export function createTestStore(projectName: string = "Test Project"): TestStoreContext {
  const store = SqliteStore.open(":memory:");
  store.initProject(projectName);
  return {
    store,
    cleanup: () => store.close(),
  };
}
