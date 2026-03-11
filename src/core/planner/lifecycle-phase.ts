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

const DESIGN_ONLY_TYPES = new Set(["requirement", "epic", "decision", "constraint", "milestone", "risk"]);
const TASK_TYPES = new Set(["task", "subtask"]);

/**
 * Detect the current lifecycle phase from the graph state.
 *
 * Heuristics:
 * - No nodes → ANALYZE
 * - Only requirement/epic/decision nodes → DESIGN
 * - Tasks exist but no sprint assigned → PLAN
 * - Any task in_progress → IMPLEMENT
 * - Most tasks done, some remaining → VALIDATE
 * - All actionable nodes done → REVIEW
 */
export function detectCurrentPhase(doc: GraphDocument): LifecyclePhase {
  const { nodes } = doc;

  if (nodes.length === 0) {
    return "ANALYZE";
  }

  const tasks = nodes.filter((n) => TASK_TYPES.has(n.type));
  const hasOnlyDesignNodes = nodes.every((n) => DESIGN_ONLY_TYPES.has(n.type));

  if (hasOnlyDesignNodes || tasks.length === 0) {
    return "DESIGN";
  }

  const inProgress = tasks.filter((n) => n.status === "in_progress");
  if (inProgress.length > 0) {
    return "IMPLEMENT";
  }

  const doneTasks = tasks.filter((n) => n.status === "done");
  const allDone = nodes.every((n) => n.status === "done" || !TASK_TYPES.has(n.type) && DESIGN_ONLY_TYPES.has(n.type));

  if (doneTasks.length === tasks.length && tasks.length > 0) {
    return "REVIEW";
  }

  const hasSprints = tasks.some((n) => n.sprint != null);

  if (!hasSprints) {
    return "PLAN";
  }

  // Most done but some remaining → VALIDATE
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
