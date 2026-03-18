/**
 * Built-in Skills Registry — 19 skills mapped to lifecycle phases.
 * Each skill is a structured instruction set for agentic workflows.
 */

import type { LifecyclePhase } from "../planner/lifecycle-phase.js";

export interface BuiltInSkill {
  name: string;
  description: string;
  category: string;
  phases: LifecyclePhase[];
  instructions: string;
}

export const BUILT_IN_SKILLS: readonly BuiltInSkill[] = [
  // ── ANALYZE ──────────────────────────────────
  {
    name: "create-prd-chat-mode",
    description: "Guia interativo para criação de PRD a partir de conversa com o usuário",
    category: "analyze",
    phases: ["ANALYZE"],
    instructions:
      "Conduza uma conversa estruturada para extrair requisitos do usuário. " +
      "Pergunte sobre problema, usuários-alvo, critérios de sucesso e restrições. " +
      "Gere um PRD markdown com seções: Problema, Solução, Requisitos Funcionais, " +
      "Requisitos Não-Funcionais, Critérios de Aceitação, Riscos.",
  },
  {
    name: "business-analyst",
    description: "Análise de negócio para requisitos e viabilidade",
    category: "analyze",
    phases: ["ANALYZE"],
    instructions:
      "Analise a proposta de negócio do ponto de vista de viabilidade técnica e comercial. " +
      "Identifique stakeholders, mapeie processos AS-IS/TO-BE, defina KPIs mensuráveis. " +
      "Output: relatório de análise com recomendações priorizadas.",
  },
  {
    name: "product-manager",
    description: "Visão de produto, roadmap e priorização",
    category: "analyze",
    phases: ["ANALYZE"],
    instructions:
      "Assuma o papel de PM sênior. Defina visão do produto, personas, jobs-to-be-done. " +
      "Priorize features via RICE ou MoSCoW. Garanta alinhamento entre valor de negócio " +
      "e esforço técnico. Output: roadmap priorizado com justificativas.",
  },

  // ── DESIGN ──────────────────────────────────
  {
    name: "breakdown-epic-arch",
    description: "Decomposição de epic em componentes arquiteturais",
    category: "design",
    phases: ["DESIGN"],
    instructions:
      "Receba um epic e decomponha em componentes arquiteturais. Identifique bounded contexts, " +
      "defina interfaces entre módulos, documente decisões via ADR. Considere escalabilidade, " +
      "manutenibilidade e testabilidade. Output: diagrama de componentes + ADRs.",
  },
  {
    name: "context-architect",
    description: "Arquitetura de contexto e dependências entre módulos",
    category: "design",
    phases: ["DESIGN"],
    instructions:
      "Mapeie o contexto do sistema: dependências externas, integrações, fluxos de dados. " +
      "Use C4 model para documentar system context e container views. Identifique pontos " +
      "de acoplamento e proponha abstrações. Output: diagrama C4 + dependency map.",
  },
  {
    name: "backend-architect",
    description: "Design de arquitetura backend e APIs",
    category: "design",
    phases: ["DESIGN"],
    instructions:
      "Projete a arquitetura backend: API design (REST/GraphQL), data model, " +
      "autenticação, cache strategy, error handling. Siga princípios SOLID e clean architecture. " +
      "Documente contratos via OpenAPI. Output: API spec + data model + ADR.",
  },

  // ── PLAN ────────────────────────────────────
  {
    name: "breakdown-feature-prd",
    description: "Decomposição de feature PRD em tasks atômicas",
    category: "plan",
    phases: ["PLAN"],
    instructions:
      "Receba um PRD e decomponha cada feature em tasks atômicas (≤2h cada). " +
      "Defina dependências entre tasks, estime complexidade, atribua a sprints. " +
      "Cada task deve ter acceptance criteria testáveis. Output: lista de tasks com deps.",
  },
  {
    name: "track-with-mcp-graph",
    description: "Sincronizar trabalho com o grafo de execução mcp-graph",
    category: "plan",
    phases: ["PLAN"],
    instructions:
      "Use as tools do mcp-graph para manter o grafo sincronizado com o trabalho real. " +
      "Workflow: import_prd → decompose → plan_sprint → edge (dependências). " +
      "Garanta que cada node tem AC, sprint e prioridade definidos antes de IMPLEMENT.",
  },

  // ── IMPLEMENT ────────────────────────────────
  {
    name: "subagent-driven-development",
    description: "Desenvolvimento orientado por sub-agentes especializados",
    category: "implement",
    phases: ["IMPLEMENT"],
    instructions:
      "Decomponha a implementação em sub-tasks que podem ser delegadas a agentes especializados. " +
      "Cada sub-agente recebe contexto mínimo (via `context` tool) e entrega código testado. " +
      "Orquestre: next → context → implement (TDD) → update_status. Anti-one-shot obrigatório.",
  },
  {
    name: "xp-bootstrap",
    description: "Bootstrap de projeto seguindo metodologia XP anti-vibe-coding",
    category: "implement",
    phases: ["IMPLEMENT"],
    instructions:
      "Siga o workflow XP sequencial: Isolation → Foundation → TDD → Implementation → " +
      "Optimization → Interface → Deploy. Cada fase tem gates de qualidade. " +
      "TDD obrigatório em todas as fases. Skeleton & Organs: dev define arquitetura, AI implementa.",
  },

  // ── VALIDATE ─────────────────────────────────
  {
    name: "playwright-explore-website",
    description: "Exploração automatizada de website via Playwright",
    category: "validate",
    phases: ["VALIDATE"],
    instructions:
      "Use Playwright MCP para navegar no site/app, capturar screenshots, verificar elementos. " +
      "Explore fluxos de usuário, verifique responsividade, identifique broken links. " +
      "Documente findings com screenshots anotados. Output: relatório de exploração.",
  },
  {
    name: "playwright-generate-test",
    description: "Geração de testes E2E a partir de exploração Playwright",
    category: "validate",
    phases: ["VALIDATE"],
    instructions:
      "A partir dos acceptance criteria, gere testes E2E com Playwright. " +
      "Cada AC deve ter pelo menos 1 teste. Use page objects, fixtures e assertions robustas. " +
      "Testes devem ser determinísticos e independentes. Output: test files prontos para CI.",
  },
  {
    name: "playwright-tester-mode",
    description: "Modo de teste interativo com Playwright",
    category: "validate",
    phases: ["VALIDATE"],
    instructions:
      "Execute testes E2E em modo interativo usando Playwright MCP tools. " +
      "Navegue, clique, preencha forms, valide snapshots. Reporte falhas com contexto " +
      "completo (screenshot, DOM state, console errors). Output: test results + evidence.",
  },
  {
    name: "e2e-testing",
    description: "Framework completo de testes end-to-end",
    category: "validate",
    phases: ["VALIDATE"],
    instructions:
      "Implemente cobertura E2E completa: happy paths, edge cases, error scenarios. " +
      "Use test pyramid: unit → integration → E2E. Configure CI pipeline para executar " +
      "testes em cada PR. Defina thresholds de cobertura. Output: test suite + CI config.",
  },

  // ── REVIEW ──────────────────────────────────
  {
    name: "code-reviewer",
    description: "Code review estruturado com checklist de qualidade",
    category: "review",
    phases: ["REVIEW"],
    instructions:
      "Revise o código contra checklist: correctness, security (OWASP top 10), performance, " +
      "readability, test coverage, error handling. Use Code Intelligence para blast radius. " +
      "Comente inline com severity (blocker/major/minor/nit). Output: review com action items.",
  },
  {
    name: "code-review-checklist",
    description: "Checklist detalhado para code review",
    category: "review",
    phases: ["REVIEW"],
    instructions:
      "Aplique checklist sistemático: [ ] Testes escritos antes (TDD)? [ ] Sem mocks desnecessários? " +
      "[ ] Logger em paths críticos? [ ] Error handling tipado? [ ] Sem dead code? " +
      "[ ] Build + typecheck + tests passam? Documente cada item com evidência.",
  },
  {
    name: "review-and-refactor",
    description: "Review com foco em refatoração e melhoria contínua",
    category: "review",
    phases: ["REVIEW"],
    instructions:
      "Analise o código para oportunidades de refatoração: DRY violations, complex conditionals, " +
      "missing abstractions, code smells. Proponha refactors com justificativa e impacto. " +
      "Garanta non-regression via testes antes e depois. Output: refactor plan + PRs.",
  },
  {
    name: "log-standardization-framework",
    description: "Padronização de logs e observabilidade",
    category: "review",
    phases: ["REVIEW"],
    instructions:
      "Audite logs do projeto: [ ] Logger usado (nunca console.log)? [ ] Structured logging? " +
      "[ ] Entry points logados (info)? [ ] Error paths com stack trace? [ ] External calls " +
      "com timing (debug)? Corrija violações. Output: log audit report + fixes.",
  },
  {
    name: "observability-engineer",
    description: "Engenharia de observabilidade — métricas, traces, alertas",
    category: "review",
    phases: ["REVIEW"],
    instructions:
      "Configure observabilidade: métricas de aplicação, distributed tracing, health checks. " +
      "Defina SLIs/SLOs para endpoints críticos. Configure alertas para anomalias. " +
      "Garanta que logs são queryable (structured, not free-text). Output: observability setup.",
  },
] as const;

/**
 * Get all built-in skills.
 */
export function getBuiltInSkills(): readonly BuiltInSkill[] {
  return BUILT_IN_SKILLS;
}

/**
 * Get built-in skills filtered by lifecycle phase.
 */
export function getSkillsByPhase(phase: LifecyclePhase): BuiltInSkill[] {
  return BUILT_IN_SKILLS.filter((s) => s.phases.includes(phase));
}

/**
 * Get a built-in skill by name.
 */
export function getSkillByName(name: string): BuiltInSkill | undefined {
  return BUILT_IN_SKILLS.find((s) => s.name === name);
}
