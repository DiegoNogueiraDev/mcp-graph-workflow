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

export interface McpAgentSuggestion {
  name: string;
  action: string;
  tools?: string[];
}

export interface PhaseGuidance {
  reminder: string;
  suggestedTools: string[];
  principles: string[];
  suggestedMcpAgents?: McpAgentSuggestion[];
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
    suggestedMcpAgents: [
      { name: "serena", action: "Análise semântica de symbols para entender arquitetura existente", tools: ["find_symbol", "get_symbols_overview"] },
      { name: "gitnexus", action: "Análise de impacto e blast radius da proposta arquitetural", tools: ["impact", "context"] },
    ],
  },
  PLAN: {
    reminder: "Fase PLAN: Planeje o sprint, decomponha tasks grandes e sincronize documentação das libs.",
    suggestedTools: ["plan_sprint", "decompose", "sync_stack_docs", "edge", "dependencies"],
    principles: ["Decomposição atômica", "Sprint planning baseado em velocidade", "Dependências explícitas"],
    suggestedMcpAgents: [
      { name: "context7", action: "Consultar docs atualizadas das libs do stack", tools: ["resolve-library-id", "query-docs"] },
    ],
  },
  IMPLEMENT: {
    reminder: "Fase IMPLEMENT: TDD obrigatório — Red → Green → Refactor. Escreva o teste ANTES da implementação. Use `context` para token-efficiency.",
    suggestedTools: ["next", "context", "update_status", "rag_context", "validate_task"],
    principles: ["TDD Red→Green→Refactor", "Anti-one-shot", "Code detachment", "Decomposição atômica"],
    suggestedMcpAgents: [
      { name: "serena", action: "Edição semântica de symbols e navegação por referências", tools: ["find_symbol", "replace_symbol_body", "find_referencing_symbols"] },
      { name: "gitnexus", action: "Impact analysis antes de editar, detect_changes antes de commit", tools: ["impact", "detect_changes", "context"] },
      { name: "context7", action: "Consultar API docs das libs em uso", tools: ["query-docs"] },
    ],
  },
  VALIDATE: {
    reminder: "Fase VALIDATE: Valide tasks completadas com testes E2E (Playwright). Verifique critérios de aceitação.",
    suggestedTools: ["validate_task", "velocity", "stats", "list"],
    principles: ["Validação automatizada", "Critérios de aceitação como contrato", "Zero tolerance para regressões"],
    suggestedMcpAgents: [
      { name: "gitnexus", action: "Verificar escopo das mudanças com detect_changes", tools: ["detect_changes"] },
      { name: "playwright", action: "Testes E2E no browser, screenshots e validação visual", tools: ["browser_navigate", "browser_snapshot", "browser_click"] },
    ],
  },
  REVIEW: {
    reminder: "Fase REVIEW: Revise o código, verifique blast radius e garanta que nada quebrou. Exporte o grafo para revisão.",
    suggestedTools: ["export", "stats", "velocity", "dependencies"],
    principles: ["Code review obrigatório", "Blast radius check", "Non-regression rule"],
    suggestedMcpAgents: [
      { name: "serena", action: "Verificar callers e referências dos symbols modificados", tools: ["find_referencing_symbols"] },
      { name: "gitnexus", action: "Blast radius final e verificação de escopo", tools: ["impact", "detect_changes"] },
    ],
  },
  HANDOFF: {
    reminder: "Fase HANDOFF: Crie o PR, documente decisões e exporte o grafo. Prepare para entrega.",
    suggestedTools: ["export", "snapshot", "stats", "velocity"],
    principles: ["Documentação como entrega", "Grafo exportado", "Knowledge base atualizada"],
    suggestedMcpAgents: [
      { name: "gitnexus", action: "Scope check final antes do PR", tools: ["detect_changes"] },
    ],
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
  severity: "info" | "warning" | "error";
}

// ── Strictness Mode ────────────────────────────
export type StrictnessMode = "strict" | "advisory";

// ── Phase Gates ────────────────────────────────

export interface PhaseGateResult {
  allowed: boolean;
  reason: string | null;
  unmetConditions: string[];
}

type PhaseGateCheck = (doc: GraphDocument) => PhaseGateResult;

const PHASE_GATES: Partial<Record<`${LifecyclePhase}_to_${LifecyclePhase}`, PhaseGateCheck>> = {
  ANALYZE_to_DESIGN: (doc) => {
    const hasEpicOrRequirement = doc.nodes.some((n) => n.type === "epic" || n.type === "requirement");
    return {
      allowed: hasEpicOrRequirement,
      reason: hasEpicOrRequirement ? null : "Nenhum epic ou requirement encontrado",
      unmetConditions: hasEpicOrRequirement ? [] : ["Criar pelo menos 1 node tipo 'epic' ou 'requirement'"],
    };
  },
  DESIGN_to_PLAN: (doc) => {
    const hasDecisionOrConstraint = doc.nodes.some((n) => n.type === "decision" || n.type === "constraint");
    return {
      allowed: hasDecisionOrConstraint,
      reason: hasDecisionOrConstraint ? null : "Nenhum decision ou constraint encontrado",
      unmetConditions: hasDecisionOrConstraint ? [] : ["Criar pelo menos 1 node tipo 'decision' ou 'constraint'"],
    };
  },
  PLAN_to_IMPLEMENT: (doc) => {
    const tasks = doc.nodes.filter((n) => TASK_TYPES.has(n.type));
    const hasSprints = tasks.some((n) => n.sprint != null);
    return {
      allowed: hasSprints,
      reason: hasSprints ? null : "Nenhuma task com sprint atribuído",
      unmetConditions: hasSprints ? [] : ["Atribuir sprint a pelo menos 1 task"],
    };
  },
  IMPLEMENT_to_VALIDATE: (doc) => {
    const tasks = doc.nodes.filter((n) => TASK_TYPES.has(n.type));
    const doneTasks = tasks.filter((n) => n.status === "done");
    const halfDone = tasks.length > 0 && doneTasks.length >= tasks.length * 0.5;
    const hasAC = doc.nodes.some((n) => n.type === "acceptance_criteria" || (n.acceptanceCriteria && n.acceptanceCriteria.length > 0));
    const conditions: string[] = [];
    if (!halfDone) conditions.push(`Pelo menos 50% das tasks devem estar done (atual: ${tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0}%)`);
    if (!hasAC) conditions.push("Definir acceptance criteria para validação");
    return {
      allowed: halfDone && hasAC,
      reason: conditions.length > 0 ? conditions.join("; ") : null,
      unmetConditions: conditions,
    };
  },
  VALIDATE_to_REVIEW: (doc) => {
    const tasks = doc.nodes.filter((n) => TASK_TYPES.has(n.type));
    const doneTasks = tasks.filter((n) => n.status === "done");
    const enough = tasks.length > 0 && doneTasks.length >= tasks.length * 0.8;
    return {
      allowed: enough,
      reason: enough ? null : `Pelo menos 80% das tasks devem estar done (atual: ${tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0}%)`,
      unmetConditions: enough ? [] : [`Completar tasks: ${doneTasks.length}/${tasks.length} done`],
    };
  },
  REVIEW_to_HANDOFF: (doc) => {
    const tasks = doc.nodes.filter((n) => TASK_TYPES.has(n.type));
    const allDone = tasks.length > 0 && tasks.every((n) => n.status === "done");
    return {
      allowed: allDone,
      reason: allDone ? null : "Nem todas as tasks estão done",
      unmetConditions: allDone ? [] : ["Todas as tasks devem estar com status 'done'"],
    };
  },
  HANDOFF_to_LISTENING: (doc) => {
    // This gate is checked via options.hasSnapshots in the wrapper
    // Here we just check if there are any done tasks (minimal gate)
    const tasks = doc.nodes.filter((n) => TASK_TYPES.has(n.type));
    const allDone = tasks.length > 0 && tasks.every((n) => n.status === "done");
    return {
      allowed: allDone,
      reason: allDone ? null : "Todas as tasks devem estar done antes de LISTENING",
      unmetConditions: allDone ? [] : ["Completar todas as tasks"],
    };
  },
};

/**
 * Validate whether a phase transition is allowed based on graph state.
 */
export function validatePhaseTransition(
  doc: GraphDocument,
  fromPhase: LifecyclePhase,
  toPhase: LifecyclePhase,
): PhaseGateResult {
  const key = `${fromPhase}_to_${toPhase}` as `${LifecyclePhase}_to_${LifecyclePhase}`;
  const gate = PHASE_GATES[key];

  if (!gate) {
    // No gate defined for this transition — allowed by default
    return { allowed: true, reason: null, unmetConditions: [] };
  }

  return gate(doc);
}

// ── Tool Phase Restrictions ────────────────────

const TOOL_PHASE_RESTRICTIONS: Record<string, Set<LifecyclePhase>> = {
  update_status: new Set(["ANALYZE"]),
  bulk_update_status: new Set(["ANALYZE"]),
  plan_sprint: new Set(["ANALYZE"]),
  validate_task: new Set(["ANALYZE", "DESIGN", "PLAN"]),
  decompose: new Set(["ANALYZE"]),
  velocity: new Set(["ANALYZE", "DESIGN"]),
};

const ALWAYS_ALLOWED_TOOLS = new Set([
  "init", "set_phase", "list", "show", "search", "stats", "export", "snapshot",
  "add_node", "edge", "import_prd", "context", "rag_context", "next",
  "sync_stack_docs", "reindex_knowledge", "dependencies",
]);

/**
 * Check if a tool is allowed in the current phase.
 * Returns warnings with severity based on strictness mode.
 */
export function checkToolGate(
  doc: GraphDocument,
  phase: LifecyclePhase,
  toolName: string,
  mode: StrictnessMode = "strict",
): LifecycleWarning[] {
  if (ALWAYS_ALLOWED_TOOLS.has(toolName)) {
    return [];
  }

  const restrictions = TOOL_PHASE_RESTRICTIONS[toolName];
  if (!restrictions || !restrictions.has(phase)) {
    return [];
  }

  const severity = mode === "strict" ? "error" : "warning";
  return [{
    code: "tool_phase_blocked",
    message: `Tool "${toolName}" não é permitida na fase ${phase}. Avance para a fase apropriada primeiro.`,
    severity,
  }];
}

// ── Status Gate ────────────────────────────────

export interface StatusGateResult {
  warnings: LifecycleWarning[];
}

/**
 * Check if a status transition is allowed for a specific node in the current phase.
 */
export function checkStatusGate(
  doc: GraphDocument,
  phase: LifecyclePhase,
  nodeId: string,
  newStatus: string,
  mode: StrictnessMode = "strict",
): StatusGateResult {
  const warnings: LifecycleWarning[] = [];
  const severity = mode === "strict" ? "error" : "warning";

  const node = doc.nodes.find((n) => n.id === nodeId);

  if (newStatus === "done" && phase === "IMPLEMENT") {
    // Check if node or parent has acceptance criteria
    const hasAC = node?.acceptanceCriteria && node.acceptanceCriteria.length > 0;
    const parentId = node?.parentId;
    const parent = parentId ? doc.nodes.find((n) => n.id === parentId) : undefined;
    const parentHasAC = parent?.acceptanceCriteria && parent.acceptanceCriteria.length > 0;
    const globalAC = doc.nodes.some((n) => n.type === "acceptance_criteria");

    if (!hasAC && !parentHasAC && !globalAC) {
      warnings.push({
        code: "done_without_acceptance_criteria",
        message: `Node "${nodeId}" marcado como done sem acceptance criteria definidos.`,
        severity,
      });
    }
  }

  if (newStatus === "in_progress" && phase === "PLAN") {
    const tasks = doc.nodes.filter((n) => TASK_TYPES.has(n.type));
    const taskNode = tasks.find((n) => n.id === nodeId);
    if (taskNode && !taskNode.sprint) {
      warnings.push({
        code: "in_progress_without_sprint",
        message: `Task "${nodeId}" iniciada sem sprint atribuído.`,
        severity,
      });
    }
  }

  if (newStatus === "done" && node && node.status !== "in_progress") {
    warnings.push({
      code: "done_without_in_progress",
      message: `Node "${nodeId}" marcado como done sem ter passado por in_progress (status atual: ${node.status}).`,
      severity: "warning", // Always warning, even in strict — this is a soft guideline
    });
  }

  return { warnings };
}

/**
 * Detect anti-pattern behaviors based on current phase, graph state, and tool being called.
 * In advisory mode: returns warnings (never blocks execution).
 * In strict mode: returns errors that block execution.
 */
export function detectWarnings(
  doc: GraphDocument,
  phase: LifecyclePhase,
  toolName: string,
  mode: StrictnessMode = "strict",
): LifecycleWarning[] {
  const warnings: LifecycleWarning[] = [];
  const guidance = GUIDANCE[phase];

  // Check tool phase restrictions (strict → error, advisory → warning)
  const gateWarnings = checkToolGate(doc, phase, toolName, mode);
  warnings.push(...gateWarnings);

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
      severity: mode === "strict" ? "error" : "warning",
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
