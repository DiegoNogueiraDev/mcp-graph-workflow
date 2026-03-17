import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { registerInit } from "./init.js";
import { registerImportPrd } from "./import-prd.js";
import { registerList } from "./list.js";
import { registerShow } from "./show.js";
import { registerNext } from "./next.js";
import { registerUpdateStatus } from "./update-status.js";
import { registerMetrics } from "./metrics.js";
import { registerContext } from "./context.js";
import { registerUpdateNode } from "./update-node.js";
import { registerDeleteNode } from "./delete-node.js";
import { registerSearch } from "./search.js";
import { registerRagContext } from "./rag-context.js";
import { registerAnalyze } from "./analyze.js";
import { registerEdge } from "./edge.js";
import { registerSnapshot } from "./snapshot.js";
import { registerAddNode } from "./add-node.js";
import { registerExport } from "./export.js";
import { registerMoveNode } from "./move-node.js";
import { registerCloneNode } from "./clone-node.js";
import { registerReindexKnowledge } from "./reindex-knowledge.js";
import { registerSyncStackDocs } from "./sync-stack-docs.js";
import { registerValidateTask } from "./validate-task.js";
import { registerValidateAc } from "./validate-ac.js";
import { registerPlanSprint } from "./plan-sprint.js";
import { registerSetPhase } from "./set-phase.js";
import { wrapToolsWithLifecycle } from "../lifecycle-wrapper.js";

export function registerAllTools(server: McpServer, store: SqliteStore): void {
  registerInit(server, store);
  registerImportPrd(server, store);
  registerList(server, store);
  registerShow(server, store);
  registerNext(server, store);
  registerUpdateStatus(server, store);
  registerMetrics(server, store);
  registerContext(server, store);
  registerUpdateNode(server, store);
  registerDeleteNode(server, store);
  registerSearch(server, store);
  registerRagContext(server, store);
  registerAnalyze(server, store);
  registerEdge(server, store);
  registerSnapshot(server, store);
  registerAddNode(server, store);
  registerExport(server, store);
  registerMoveNode(server, store);
  registerCloneNode(server, store);
  registerReindexKnowledge(server, store);
  registerSyncStackDocs(server, store);
  registerValidateTask(server, store);
  registerValidateAc(server, store);
  registerPlanSprint(server, store);
  registerSetPhase(server, store);

  // Wrap all registered tool responses with lifecycle context
  wrapToolsWithLifecycle(server, store);
}
