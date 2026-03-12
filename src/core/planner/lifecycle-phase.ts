import type { GraphDocument } from "../graph/graph-types.js";

export type LifecyclePhase =
  | "ANALYZE"
  | "DESIGN"
  | "PLAN"
  | "IMPLEMENT"
  | "VALIDATE"
  | "REVIEW"
  | "HANDOFF"
  | "LISTENING";

export interface PhaseGuidance {
  reminder: string;
  suggestedTools: string[];
  principles: string[];
}

const DESIGN_ONLY_TYPES = new Set(["requirement", "epic", "decision", "constraint", "milestone", "risk", "acceptance_criteria"]);
const TASK_TYPES = new Set(["task", "subtask"]);
const FEEDBACK_TYPES = new Set(["requirement", "risk", "constraint"]);

export interface PhaseDetectionOptions {
  hasSnapshots?: boolean;
  phaseOverride?: LifecyclePhase | null;
}

/**
 * Detect the current lifecycle phase from the graph state.
 *
 * Priority order:
 * 1. Manual override (if provided)
 * 2. No nodes → ANALYZE
 * 3. Only design-type nodes → DESIGN
 * 4. Any task in_progress → IMPLEMENT
 * 5. All tasks done + new feedback nodes → LISTENING
 * 6. All tasks done + snapshots exist → HANDOFF
 * 7. All tasks done → REVIEW
 * 8. No sprints assigned → PLAN
 * 9. ≥50% tasks done (threshold for partial completion) → VALIDATE
 * 10. All tasks backlog/ready → PLAN
 * 11. Fallback → IMPLEMENT
 */
export function detectCurrentPhase(doc: GraphDocument, options?: PhaseDetectionOptions): LifecyclePhase {
  if (options?.phaseOverride) {
    return options.phaseOverride;
  }

  const { nodes } = doc;

  if (nodes.length === 0) {
    return "ANALYZE";
  }

  const tasks = nodes.filter((n) => TASK_TYPES.has(n.type));
  const hasOnlyDesignNodes = nodes.every((n) => DESIGN_ONLY_TYPES.has(n.type));

  // Check in_progress BEFORE design-only check to handle mixed graphs correctly
  const inProgress = tasks.filter((n) => n.status === "in_progress");
  if (inProgress.length > 0) {
    return "IMPLEMENT";
  }

  if (hasOnlyDesignNodes || tasks.length === 0) {
    return "DESIGN";
  }

  const doneTasks = tasks.filter((n) => n.status === "done");

  if (doneTasks.length === tasks.length && tasks.length > 0) {
    // All tasks done — check for LISTENING, HANDOFF, or REVIEW
    if (hasNewFeedbackNodes(nodes, doneTasks)) {
      return "LISTENING";
    }
    if (options?.hasSnapshots) {
      return "HANDOFF";
    }
    return "REVIEW";
  }

  const hasSprints = tasks.some((n) => n.sprint != null);

  if (!hasSprints) {
    return "PLAN";
  }

  // ≥50% done but not all → partial completion phase for validation
  if (doneTasks.length > 0 && doneTasks.length >= tasks.length * 0.5) {
    return "VALIDATE";
  }

  // Tasks with sprint but not started yet → still PLAN
  const notStarted = tasks.every((n) => n.status === "backlog" || n.status === "ready");
  if (notStarted) {
    return "PLAN";
  }

  return "IMPLEMENT";
}

/**
 * Check if new feedback/requirement nodes were added after all tasks were completed.
 * This signals the project has entered a feedback loop (LISTENING phase).
 */
function hasNewFeedbackNodes(
  nodes: GraphDocument["nodes"],
  doneTasks: GraphDocument["nodes"],
): boolean {
  const lastDoneTime = doneTasks.reduce((max, n) => {
    const t = n.updatedAt ?? n.createdAt;
    return t > max ? t : max;
  }, "");

  if (!lastDoneTime) return false;

  return nodes.some(
    (n) => FEEDBACK_TYPES.has(n.type) && n.createdAt > lastDoneTime,
  );
}

const GUIDANCE: Record<LifecyclePhase, PhaseGuidance> = {
  ANALYZE: {
    reminder: "Fase ANALYZE: Crie o PRD a partir da ideia. Defina requisitos, restrições e critérios de aceitação antes de qualquer código.",
    suggestedTools: ["import_prd", "add_node", "search"],
    principles: ["Definir antes de construir", "PRD como contrato", "Requisitos claros e mensuráveis"],
  },
  DESIGN: {
    reminder: "Fase DESIGN: Defina a arquitetura e tome decisões técnicas. Use análise de impacto antes de definir a estrutura.",
    suggestedTools: ["add_node", "edge", "decompose", "export"],
    principles: ["Skeleton & Organs", "Decisões arquiteturais documentadas", "Anti-one-shot"],
  },
  PLAN: {
    reminder: "Fase PLAN: Planeje o sprint, decomponha tasks grandes e sincronize documentação das libs.",
    suggestedTools: ["plan_sprint", "decompose", "sync_stack_docs", "edge", "dependencies"],
    principles: ["Decomposição atômica", "Sprint planning baseado em velocidade", "Dependências explícitas"],
  },
  IMPLEMENT: {
    reminder: "Fase IMPLEMENT: TDD obrigatório — Red → Green → Refactor. Escreva o teste ANTES da implementação. Use `context` para token-efficiency.",
    suggestedTools: ["next", "context", "update_status", "rag_context", "validate_task"],
    principles: ["TDD Red→Green→Refactor", "Anti-one-shot", "Code detachment", "Decomposição atômica"],
  },
  VALIDATE: {
    reminder: "Fase VALIDATE: Valide tasks completadas com testes E2E (Playwright). Verifique critérios de aceitação.",
    suggestedTools: ["validate_task", "velocity", "stats", "list"],
    principles: ["Validação automatizada", "Critérios de aceitação como contrato", "Zero tolerance para regressões"],
  },
  REVIEW: {
    reminder: "Fase REVIEW: Revise o código, verifique blast radius e garanta que nada quebrou. Exporte o grafo para revisão.",
    suggestedTools: ["export", "stats", "velocity", "dependencies"],
    principles: ["Code review obrigatório", "Blast radius check", "Non-regression rule"],
  },
  HANDOFF: {
    reminder: "Fase HANDOFF: Crie o PR, documente decisões e exporte o grafo. Prepare para entrega.",
    suggestedTools: ["export", "snapshot", "stats", "velocity"],
    principles: ["Documentação como entrega", "Grafo exportado", "Knowledge base atualizada"],
  },
  LISTENING: {
    reminder: "Fase LISTENING: Colete feedback e adicione novos nodes ao grafo. Inicie novo ciclo se necessário.",
    suggestedTools: ["add_node", "import_prd", "search", "list"],
    principles: ["Feedback contínuo", "Iteração incremental", "CLAUDE.md como spec evolutiva"],
  },
};

export function getPhaseGuidance(phase: LifecyclePhase): PhaseGuidance {
  return GUIDANCE[phase];
}

// ── Warnings ────────────────────────────────

export interface LifecycleWarning {
  code: string;
  message: string;
  severity: "info" | "warning";
}

/**
 * Detect anti-pattern behaviors based on current phase, graph state, and tool being called.
 * Returns advisory warnings (never blocks execution).
 */
export function detectWarnings(
  doc: GraphDocument,
  phase: LifecyclePhase,
  toolName: string,
): LifecycleWarning[] {
  const warnings: LifecycleWarning[] = [];
  const guidance = GUIDANCE[phase];

  // Warn if tool is not recommended for current phase
  if (!guidance.suggestedTools.includes(toolName)) {
    warnings.push({
      code: "tool_not_recommended",
      message: `Tool "${toolName}" não é recomendada para fase ${phase}. Sugeridas: ${guidance.suggestedTools.join(", ")}`,
      severity: "info",
    });
  }

  // Phase-specific warnings
  if (phase === "ANALYZE" && toolName === "update_status") {
    warnings.push({
      code: "premature_status_change",
      message: "Fase ANALYZE — defina requisitos antes de implementar. Mudança de status prematura.",
      severity: "warning",
    });
  }

  if (phase === "PLAN" && toolName === "update_status") {
    const tasks = doc.nodes.filter((n) => TASK_TYPES.has(n.type));
    const hasSprints = tasks.some((n) => n.sprint != null);
    if (!hasSprints) {
      warnings.push({
        code: "no_sprint_assigned",
        message: "Nenhum sprint atribuído. Atribua sprints antes de iniciar tasks.",
        severity: "warning",
      });
    }
  }

  if (phase === "IMPLEMENT" && toolName === "update_status") {
    const hasAcceptanceCriteria = doc.nodes.some((n) => n.type === "acceptance_criteria");
    if (!hasAcceptanceCriteria) {
      warnings.push({
        code: "no_acceptance_criteria",
        message: "Nenhum critério de aceitação definido. Considere adicionar antes de concluir tasks.",
        severity: "warning",
      });
    }
  }

  return warnings;
}
