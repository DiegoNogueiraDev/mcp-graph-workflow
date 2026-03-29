import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { analyzePrdQuality } from "../../core/analyzer/prd-quality.js";
import { analyzeScope } from "../../core/analyzer/scope-analyzer.js";
import { checkDefinitionOfReady } from "../../core/analyzer/definition-of-ready.js";
import { assessRisks } from "../../core/analyzer/risk-assessment.js";
import {
  findTransitiveBlockers,
  detectCycles,
  findCriticalPath,
} from "../../core/planner/dependency-chain.js";
import { detectLargeTasks } from "../../core/planner/decompose.js";
import { validateAdrs } from "../../core/designer/adr-validator.js";
import { buildTraceabilityMatrix } from "../../core/designer/traceability-matrix.js";
import { analyzeCoupling } from "../../core/designer/coupling-analyzer.js";
import { checkInterfaces } from "../../core/designer/interface-checker.js";
import { assessTechRisks } from "../../core/designer/tech-risk-assessor.js";
import { checkDesignReadiness } from "../../core/designer/definition-of-ready.js";
import { checkValidationReadiness } from "../../core/validator/definition-of-ready.js";
import { checkDoneIntegrity } from "../../core/validator/done-integrity-checker.js";
import { checkStatusFlow } from "../../core/validator/status-flow-checker.js";
import { checkReviewReadiness } from "../../core/reviewer/review-readiness.js";
import { checkHandoffReadiness } from "../../core/handoff/delivery-checklist.js";
import { checkDocCompleteness } from "../../core/handoff/doc-completeness.js";
import { checkDeployReadiness } from "../../core/deployer/deploy-readiness.js";
import { checkListeningReadiness } from "../../core/listener/feedback-readiness.js";
import { analyzeBacklogHealth } from "../../core/listener/backlog-health.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { detectCurrentPhase } from "../../core/planner/lifecycle-phase.js";
import { checkDefinitionOfDone } from "../../core/implementer/definition-of-done.js";
import { checkTddAdherence } from "../../core/implementer/tdd-checker.js";
import { calculateSprintProgress } from "../../core/implementer/sprint-progress.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

const ANALYZE_MODES = z.enum([
  "prd_quality",
  "scope",
  "ready",
  "risk",
  "blockers",
  "cycles",
  "critical_path",
  "decompose",
  "adr",
  "traceability",
  "coupling",
  "interfaces",
  "tech_risk",
  "design_ready",
  "implement_done",
  "tdd_check",
  "progress",
  "validate_ready",
  "done_integrity",
  "status_flow",
  "review_ready",
  "handoff_ready",
  "doc_completeness",
  "deploy_ready",
  "release_check",
  "listening_ready",
  "backlog_health",
]);

export function registerAnalyze(server: McpServer, store: SqliteStore): void {
  server.tool(
    "analyze",
    "Analyze the project graph. Modes: prd_quality, scope, ready, risk, blockers, cycles, critical_path, decompose, adr, traceability, coupling, interfaces, tech_risk, design_ready (DESIGN→PLAN gate), implement_done, tdd_check, progress, validate_ready (IMPLEMENT→VALIDATE gate), done_integrity, status_flow, review_ready (VALIDATE→REVIEW gate), handoff_ready (REVIEW→HANDOFF gate), doc_completeness, deploy_ready (HANDOFF→DEPLOY gate), release_check, listening_ready (DEPLOY→LISTENING gate), backlog_health.",
    {
      mode: ANALYZE_MODES.describe("Analysis mode"),
      nodeId: z.string().optional().describe("Node ID (required for 'blockers'/'implement_done', optional for 'decompose'/'tdd_check'. For 'progress' mode, used as sprint name filter)"),
    },
    async ({ mode, nodeId }) => {
      logger.debug("tool:analyze", { mode, nodeId });
      const doc = store.toGraphDocument();

      switch (mode) {
        case "prd_quality": {
          const report = analyzePrdQuality(doc);
          logger.info("tool:analyze:prd_quality:ok", { score: report.score, grade: report.grade });
          return mcpText({ ok: true, mode, ...report });
        }

        case "scope": {
          const analysis = analyzeScope(doc);
          logger.info("tool:analyze:scope:ok", { orphans: analysis.orphans.length });
          return mcpText({ ok: true, mode, ...analysis });
        }

        case "ready": {
          const readiness = checkDefinitionOfReady(doc);
          logger.info("tool:analyze:ready:ok", { ready: readiness.readyForNextPhase });
          return mcpText({ ok: true, mode, ...readiness });
        }

        case "risk": {
          const matrix = assessRisks(doc);
          logger.info("tool:analyze:risk:ok", { total: matrix.summary.total });
          return mcpText({ ok: true, mode, ...matrix });
        }

        case "blockers": {
          if (!nodeId) {
            return mcpError("nodeId is required for 'blockers' mode");
          }
          // Bug #025: validate node exists
          if (!doc.nodes.find((n) => n.id === nodeId)) {
            return mcpError(`Node not found: ${nodeId}`);
          }
          const blockers = findTransitiveBlockers(doc, nodeId);
          logger.info("tool:analyze:blockers:ok", { nodeId, blockerCount: blockers.length });
          return mcpText({ ok: true, mode, nodeId, blockers });
        }

        case "cycles": {
          const cycles = detectCycles(doc);
          logger.info("tool:analyze:cycles:ok", { cycleCount: cycles.length });
          return mcpText({ ok: true, mode, cycles });
        }

        case "critical_path": {
          const path = findCriticalPath(doc);
          logger.info("tool:analyze:critical_path:ok", { pathLength: path.length });
          return mcpText({ ok: true, mode, criticalPath: path });
        }

        case "decompose": {
          let results = detectLargeTasks(doc);
          if (nodeId) {
            results = results.filter((r) => r.node.id === nodeId);
          }
          logger.info("tool:analyze:decompose:ok", { count: results.length });
          return mcpText({ ok: true, mode, results });
        }

        case "adr": {
          const phase = detectCurrentPhase(doc);
          const adrReport = validateAdrs(doc);
          logger.info("tool:analyze:adr:ok", { grade: adrReport.overallGrade });
          const response: Record<string, unknown> = { ok: true, mode, ...adrReport };
          if (phase !== "DESIGN") response._info = `Modo adr é específico da fase DESIGN (fase atual: ${phase})`;
          return mcpText(response);
        }

        case "traceability": {
          const phase = detectCurrentPhase(doc);
          const traceReport = buildTraceabilityMatrix(doc);
          logger.info("tool:analyze:traceability:ok", { coverageRate: traceReport.coverageRate });
          const response: Record<string, unknown> = { ok: true, mode, ...traceReport };
          if (phase !== "DESIGN") response._info = `Modo traceability é específico da fase DESIGN (fase atual: ${phase})`;
          return mcpText(response);
        }

        case "coupling": {
          const phase = detectCurrentPhase(doc);
          const couplingReport = analyzeCoupling(doc);
          logger.info("tool:analyze:coupling:ok", { highCoupling: couplingReport.highCouplingNodes.length });
          const response: Record<string, unknown> = { ok: true, mode, ...couplingReport };
          if (phase !== "DESIGN") response._info = `Modo coupling é específico da fase DESIGN (fase atual: ${phase})`;
          return mcpText(response);
        }

        case "interfaces": {
          const phase = detectCurrentPhase(doc);
          const ifReport = checkInterfaces(doc);
          logger.info("tool:analyze:interfaces:ok", { overallScore: ifReport.overallScore });
          const response: Record<string, unknown> = { ok: true, mode, ...ifReport };
          if (phase !== "DESIGN") response._info = `Modo interfaces é específico da fase DESIGN (fase atual: ${phase})`;
          return mcpText(response);
        }

        case "tech_risk": {
          const phase = detectCurrentPhase(doc);
          const techRiskReport = assessTechRisks(doc);
          logger.info("tool:analyze:tech_risk:ok", { riskScore: techRiskReport.riskScore });
          const response: Record<string, unknown> = { ok: true, mode, ...techRiskReport };
          if (phase !== "DESIGN") response._info = `Modo tech_risk é específico da fase DESIGN (fase atual: ${phase})`;
          return mcpText(response);
        }

        case "design_ready": {
          const phase = detectCurrentPhase(doc);
          const readinessReport = checkDesignReadiness(doc);
          logger.info("tool:analyze:design_ready:ok", { ready: readinessReport.ready, grade: readinessReport.grade });
          const response: Record<string, unknown> = { ok: true, mode, ...readinessReport };
          if (phase !== "DESIGN") response._info = `Modo design_ready é específico da fase DESIGN (fase atual: ${phase})`;
          return mcpText(response);
        }

        case "implement_done": {
          if (!nodeId) {
            return mcpError("nodeId is required for 'implement_done' mode");
          }
          // Bug #026: validate node exists
          if (!doc.nodes.find((n) => n.id === nodeId)) {
            return mcpError(`Node not found: ${nodeId}`);
          }
          const phase = detectCurrentPhase(doc);
          const dodReport = checkDefinitionOfDone(doc, nodeId);
          logger.info("tool:analyze:implement_done:ok", { nodeId, ready: dodReport.ready, grade: dodReport.grade });
          const dodResponse: Record<string, unknown> = { ok: true, mode, ...dodReport };
          if (phase !== "IMPLEMENT") dodResponse._info = `Modo implement_done é específico da fase IMPLEMENT (fase atual: ${phase})`;
          return mcpText(dodResponse);
        }

        case "tdd_check": {
          const phase = detectCurrentPhase(doc);
          const tddReport = checkTddAdherence(doc, nodeId);
          logger.info("tool:analyze:tdd_check:ok", { tasks: tddReport.tasks.length, overallTestability: tddReport.overallTestability });
          const tddResponse: Record<string, unknown> = { ok: true, mode, ...tddReport };
          if (phase !== "IMPLEMENT") tddResponse._info = `Modo tdd_check é específico da fase IMPLEMENT (fase atual: ${phase})`;
          return mcpText(tddResponse);
        }

        case "progress": {
          const phase = detectCurrentPhase(doc);
          const progressReport = calculateSprintProgress(doc, nodeId);
          logger.info("tool:analyze:progress:ok", { done: progressReport.burndown.done, total: progressReport.burndown.total });
          const progressResponse: Record<string, unknown> = { ok: true, mode, ...progressReport };
          if (phase !== "IMPLEMENT") progressResponse._info = `Modo progress é específico da fase IMPLEMENT (fase atual: ${phase})`;
          return mcpText(progressResponse);
        }

        case "validate_ready": {
          const phase = detectCurrentPhase(doc);
          const valReport = checkValidationReadiness(doc);
          logger.info("tool:analyze:validate_ready:ok", { ready: valReport.ready, grade: valReport.grade });
          const valResponse: Record<string, unknown> = { ok: true, mode, ...valReport };
          if (phase !== "VALIDATE" && phase !== "IMPLEMENT") valResponse._info = `Modo validate_ready é específico das fases IMPLEMENT/VALIDATE (fase atual: ${phase})`;
          return mcpText(valResponse);
        }

        case "done_integrity": {
          const doneReport = checkDoneIntegrity(doc);
          logger.info("tool:analyze:done_integrity:ok", { passed: doneReport.passed, issues: doneReport.issues.length });
          return mcpText({ ok: true, mode, ...doneReport });
        }

        case "status_flow": {
          const flowReport = checkStatusFlow(doc);
          logger.info("tool:analyze:status_flow:ok", { complianceRate: flowReport.complianceRate });
          return mcpText({ ok: true, mode, ...flowReport });
        }

        case "review_ready": {
          const phase = detectCurrentPhase(doc);
          const revReport = checkReviewReadiness(doc);
          logger.info("tool:analyze:review_ready:ok", { ready: revReport.ready, grade: revReport.grade });
          const revResponse: Record<string, unknown> = { ok: true, mode, ...revReport };
          if (phase !== "REVIEW" && phase !== "VALIDATE") revResponse._info = `Modo review_ready é específico das fases VALIDATE/REVIEW (fase atual: ${phase})`;
          return mcpText(revResponse);
        }

        case "handoff_ready": {
          const phase = detectCurrentPhase(doc);
          const ks = new KnowledgeStore(store.getDb());
          const knowledgeCount = ks.count();
          const hoReport = checkHandoffReadiness(doc, { knowledgeCount });
          logger.info("tool:analyze:handoff_ready:ok", { ready: hoReport.ready, grade: hoReport.grade });
          const hoResponse: Record<string, unknown> = { ok: true, mode, ...hoReport };
          if (phase !== "HANDOFF" && phase !== "REVIEW") hoResponse._info = `Modo handoff_ready é específico das fases REVIEW/HANDOFF (fase atual: ${phase})`;
          return mcpText(hoResponse);
        }

        case "doc_completeness": {
          const docReport = checkDocCompleteness(doc);
          logger.info("tool:analyze:doc_completeness:ok", { coverageRate: docReport.coverageRate });
          return mcpText({ ok: true, mode, ...docReport });
        }

        case "deploy_ready": {
          const phase = detectCurrentPhase(doc);
          const snapshots = store.listSnapshots();
          const hasSnapshots = snapshots.length > 0;
          const ksD = new KnowledgeStore(store.getDb());
          const knowledgeCountD = ksD.count();
          const deployReport = checkDeployReadiness(doc, { hasSnapshots, knowledgeCount: knowledgeCountD });
          logger.info("tool:analyze:deploy_ready:ok", { ready: deployReport.ready, grade: deployReport.grade });
          const deployResponse: Record<string, unknown> = { ok: true, mode, ...deployReport };
          if (phase !== "DEPLOY" && phase !== "HANDOFF") deployResponse._info = `Modo deploy_ready é específico das fases HANDOFF/DEPLOY (fase atual: ${phase})`;
          return mcpText(deployResponse);
        }

        case "release_check": {
          const phase = detectCurrentPhase(doc);
          const snapshots = store.listSnapshots();
          const hasSnapshots = snapshots.length > 0;
          const tasks = doc.nodes.filter((n) => n.type === "task" || n.type === "subtask");
          const doneTasks = tasks.filter((n) => n.status === "done");
          const allDone = tasks.length > 0 && tasks.every((n) => n.status === "done");
          const blockedCount = doc.nodes.filter((n) => n.status === "blocked").length;
          const inProgressCount = tasks.filter((n) => n.status === "in_progress").length;

          const releaseChecks = {
            all_tasks_done: allDone,
            no_blocked_nodes: blockedCount === 0,
            no_in_progress: inProgressCount === 0,
            snapshot_exists: hasSnapshots,
            task_summary: `${doneTasks.length}/${tasks.length} tasks done`,
          };
          const releaseReady = allDone && blockedCount === 0 && inProgressCount === 0 && hasSnapshots;
          logger.info("tool:analyze:release_check:ok", { releaseReady });
          const releaseResponse: Record<string, unknown> = { ok: true, mode, releaseReady, checks: releaseChecks };
          if (phase !== "DEPLOY") releaseResponse._info = `Modo release_check é específico da fase DEPLOY (fase atual: ${phase})`;
          return mcpText(releaseResponse);
        }

        case "listening_ready": {
          const phase = detectCurrentPhase(doc);
          const snapshots = store.listSnapshots();
          const hasSnapshots = snapshots.length > 0;
          const ksL = new KnowledgeStore(store.getDb());
          const knowledgeCountL = ksL.count();
          const lisReport = checkListeningReadiness(doc, { hasSnapshots, knowledgeCount: knowledgeCountL });
          logger.info("tool:analyze:listening_ready:ok", { ready: lisReport.ready, grade: lisReport.grade });
          const lisResponse: Record<string, unknown> = { ok: true, mode, ...lisReport };
          if (phase !== "LISTENING" && phase !== "HANDOFF") lisResponse._info = `Modo listening_ready é específico das fases HANDOFF/LISTENING (fase atual: ${phase})`;
          return mcpText(lisResponse);
        }

        case "backlog_health": {
          const healthReport = analyzeBacklogHealth(doc);
          logger.info("tool:analyze:backlog_health:ok", { clean: healthReport.cleanForNewCycle, stale: healthReport.staleTasks.length });
          return mcpText({ ok: true, mode, ...healthReport });
        }

        default: {
          return mcpError(`Unknown analyze mode: ${mode as string}`);
        }
      }
    },
  );
}
