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
import { registerSearch } from "./search.js";
import { registerRagContext } from "./rag-context.js";
import { registerAnalyze } from "./analyze.js";
import { registerEdge } from "./edge.js";
import { registerSnapshot } from "./snapshot.js";
import { registerExport } from "./export.js";
import { registerMoveNode } from "./move-node.js";
import { registerCloneNode } from "./clone-node.js";
import { registerReindexKnowledge } from "./reindex-knowledge.js";
import { registerSyncStackDocs } from "./sync-stack-docs.js";
import { registerPlanSprint } from "./plan-sprint.js";
import { registerSetPhase } from "./set-phase.js";
import { registerMemory } from "./memory.js";
import { registerManageSkill } from "./manage-skill.js";
// Siebel CRM integration tools
import { registerSiebelImportSif } from "./siebel-import-sif.js";
import { registerSiebelAnalyze } from "./siebel-analyze.js";
import { registerSiebelComposer } from "./siebel-composer.js";
import { registerSiebelEnv } from "./siebel-env.js";
import { registerSiebelValidate } from "./siebel-validate.js";
import { registerSiebelSearch } from "./siebel-search.js";
import { registerSiebelGenerateSif } from "./siebel-generate-sif.js";
import { registerSiebelImportDocs } from "./siebel-import-docs.js";
// Consolidated tools
import { registerNode } from "./node.js";
import { registerValidate } from "./validate.js";
// Deprecated tools (backward compat — will be removed in v7.0)
import { registerAddNode } from "./add-node.js";
import { registerUpdateNode } from "./update-node.js";
import { registerDeleteNode } from "./delete-node.js";
import { registerValidateTask } from "./validate-task.js";
import { registerValidateAc } from "./validate-ac.js";
import { registerListSkills } from "./list-skills.js";
import { wrapToolsWithLifecycle } from "../lifecycle-wrapper.js";

export function registerAllTools(server: McpServer, store: SqliteStore): void {
  // Core tools
  registerInit(server, store);
  registerImportPrd(server, store);
  registerList(server, store);
  registerShow(server, store);
  registerNext(server, store);
  registerUpdateStatus(server, store);
  registerMetrics(server, store);
  registerContext(server, store);
  registerSearch(server, store);
  registerRagContext(server, store);
  registerAnalyze(server, store);
  registerEdge(server, store);
  registerSnapshot(server, store);
  registerExport(server, store);
  registerMoveNode(server, store);
  registerCloneNode(server, store);
  registerReindexKnowledge(server, store);
  registerSyncStackDocs(server, store);
  registerPlanSprint(server, store);
  registerSetPhase(server, store);
  registerMemory(server, store);
  registerManageSkill(server, store);

  // Siebel CRM integration tools
  registerSiebelImportSif(server, store);
  registerSiebelAnalyze(server, store);
  registerSiebelComposer(server, store);
  registerSiebelEnv(server, store);
  registerSiebelValidate(server, store);
  registerSiebelSearch(server, store);
  registerSiebelGenerateSif(server, store);
  registerSiebelImportDocs(server, store);

  // Consolidated tools
  registerNode(server, store);
  registerValidate(server, store);

  // Deprecated tools (backward compat — will be removed in v7.0)
  registerAddNode(server, store);
  registerUpdateNode(server, store);
  registerDeleteNode(server, store);
  registerValidateTask(server, store);
  registerValidateAc(server, store);
  registerListSkills(server);

  // Wrap all registered tool responses with lifecycle context
  wrapToolsWithLifecycle(server, store);
}
