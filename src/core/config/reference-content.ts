/**
 * Reference content extracted from ai-memory-generator.ts.
 * Shared between the generator (full mode) and the help MCP tool (on-demand).
 */

export const TOOL_TABLE_FULL = `### Ferramentas MCP disponíveis (46 tools + 6 deprecated)

#### Projeto & Grafo

| Tool | Quando usar |
|------|-------------|
| \`init\` | Inicializar grafo do projeto (cria DB, AI memory files, detecta MCPs) |
| \`list\` | Listar nodes do grafo (filtrar por tipo/status/parent) |
| \`show\` | Ver detalhes de um node específico (metadata, deps, knowledge) |
| \`search\` | Busca full-text no grafo (FTS5 + BM25 ranking) |
| \`export\` | Exportar grafo (JSON completo ou Mermaid diagram) |
| \`snapshot\` | Criar/restaurar snapshots do grafo (backup/rollback) |
| \`metrics\` | Estatísticas do grafo (\`stats\`) ou velocidade por sprint (\`velocity\`) |

#### Nodes & Edges

| Tool | Quando usar |
|------|-------------|
| \`node\` | CRUD de nodes: action \`add\` (criar), \`update\` (atualizar), \`delete\` (remover) |
| \`move_node\` | Mover node para outro parent |
| \`clone_node\` | Clonar node com filhos (deep copy) |
| \`edge\` | Criar/remover relações entre nodes (depends_on, blocks, related_to) |
| \`update_status\` | Mudar status de um node (backlog→ready→in_progress→done) |
| \`bulk_update_status\` | Atualizar status de múltiplos nodes de uma vez |

#### PRD & Planejamento

| Tool | Quando usar |
|------|-------------|
| \`import_prd\` | Importar PRD → segmentar → classificar → extrair → inferir deps → criar grafo + indexar knowledge |
| \`plan_sprint\` | Gerar relatório de planejamento de sprint (capacity, velocity, recomendações) |
| \`analyze\` | 24 modos de análise por fase do lifecycle (ver modos abaixo) |
| \`set_phase\` | Forçar/resetar fase do lifecycle (strict/advisory, gate checks) + Code Intelligence mode (strict/advisory/off) + Tool Prerequisites mode (strict/advisory/off) |

#### Contexto & RAG

| Tool | Quando usar |
|------|-------------|
| \`next\` | Próxima task recomendada (prioridade + deps + knowledge coverage 0-1 + TDD hints + velocity) |
| \`context\` | Contexto comprimido da task (token-efficient, ~73% redução) |
| \`rag_context\` | Contexto RAG phase-aware (tiers: summary/standard/deep, budget 60/30/10) |
| \`reindex_knowledge\` | Rebuild completo do índice de knowledge (BM25 + TF-IDF) |
| \`sync_stack_docs\` | Sincronizar docs das libs do projeto via Context7 |

#### Memórias do Projeto

| Tool | Quando usar |
|------|-------------|
| \`write_memory\` | Escrever memória em workflow-graph/memories/{name}.md (auto-indexa no RAG) |
| \`read_memory\` | Ler conteúdo de uma memória específica |
| \`list_memories\` | Listar todas as memórias disponíveis |
| \`delete_memory\` | Remover memória do filesystem e do knowledge store |

#### Validação

| Tool | Quando usar |
|------|-------------|
| \`validate\` | Validação: action \`task\` (browser A/B com Playwright) ou \`ac\` (critérios de aceitação) |

#### Skills

| Tool | Quando usar |
|------|-------------|
| \`manage_skill\` | Gerenciar skills: action \`list\` (listar/filtrar por fase), \`enable\`/\`disable\`, CRUD de custom skills |

#### Utilitários

| Tool | Quando usar |
|------|-------------|
| \`help\` | Referência on-demand de tools, analyze modes, skills, CLI, workflow (este tool) |
| \`journey\` | Gerenciar journey maps de websites (list, get, search, index para RAG) |
| \`import_graph\` | Importar/merge grafo JSON exportado (local wins, dry_run disponível) |

#### Code Intelligence (LSP)

| Tool | Quando usar |
|------|-------------|
| \`code_intelligence\` | Análise semântica via LSP: definition, references, hover, rename, call_hierarchy, diagnostics, symbols. Multi-language (TS, Python, Rust, Go, Java, C/C++, Ruby, PHP, Kotlin, Swift, C#, Lua) |

#### Knowledge Avançado

| Tool | Quando usar |
|------|-------------|
| \`knowledge_feedback\` | Feedback em docs do knowledge store (helpful/unhelpful/outdated) para melhorar RAG |
| \`knowledge_stats\` | Estatísticas do knowledge store: contagem por source, qualidade, docs mais acessados |
| \`export_knowledge\` | Export/import/preview de knowledge packages para colaboração entre projetos |

#### Siebel CRM (8 tools)

| Tool | Quando usar |
|------|-------------|
| \`siebel_import_sif\` | Importar .SIF (XML Siebel) — parse, extrai objetos, mapeia no grafo, indexa no knowledge |
| \`siebel_analyze\` | Analisar objetos Siebel: impact, dependencies, circular, diff, refactor_script, troubleshoot |
| \`siebel_composer\` | Automação do Siebel Composer via Playwright: navigate, import_sif, edit, publish, capture |
| \`siebel_env\` | Gerenciar ambientes Siebel CRM: list, add, remove |
| \`siebel_validate\` | Validar .SIF: full, naming, security, performance, migration_ready, code_review |
| \`siebel_search\` | Buscar objetos Siebel indexados no knowledge store (BCs, Applets, Views, Workflows) |
| \`siebel_generate_sif\` | Gerar SIF: prepare, finalize, templates, scaffold, clone_adapt, auto_wire, wsdl_to_sif |
| \`siebel_import_docs\` | Importar docs (Swagger/WSDL/PDF/HTML/DOCX/MD) no knowledge store para contexto Siebel |

#### Translation (3 tools)

| Tool | Quando usar |
|------|-------------|
| \`translate_code\` | Traduzir código entre linguagens — cria job, analisa constructs, gera prompt, finaliza com código |
| \`analyze_translation\` | Analisar código-fonte para prontidão de tradução (language, constructs, complexity, translatability) |
| \`translation_jobs\` | Gerenciar jobs de tradução: list, get, delete, stats |`;

export const DEPRECATED_TOOLS_SECTION = `#### Tools Deprecated (backward compat, removidos na v7.0)

| Tool antigo | Usar no lugar |
|-------------|---------------|
| \`add_node\` | \`node\` com action:\`add\` |
| \`update_node\` | \`node\` com action:\`update\` |
| \`delete_node\` | \`node\` com action:\`delete\` |
| \`validate_task\` | \`validate\` com action:\`task\` |
| \`validate_ac\` | \`validate\` com action:\`ac\` |
| \`list_skills\` | \`manage_skill\` com action:\`list\` |`;

export const ANALYZE_MODES_SECTION = `### Modos do analyze por fase

| Fase | Modo | O que verifica |
|------|------|----------------|
| ANALYZE | \`prd_quality\` | Qualidade do PRD (completude, user stories, AC) |
| ANALYZE | \`scope\` | Escopo do grafo (tipos, distribuição, cobertura) |
| ANALYZE | \`ready\` | Definition of Ready (bloqueios, dependências, AC) |
| ANALYZE | \`risk\` | Riscos (complexidade, deps, tamanho, AC faltantes) |
| ANALYZE | \`blockers\` | Bloqueios transitivos de um node |
| ANALYZE | \`cycles\` | Ciclos de dependência no grafo |
| ANALYZE | \`critical_path\` | Caminho crítico (sequência mais longa de deps) |
| PLAN | \`decompose\` | Tasks grandes que precisam ser decompostas |
| DESIGN | \`adr\` | Validação de ADRs (Architecture Decision Records) |
| DESIGN | \`traceability\` | Matriz de rastreabilidade (req → task → test) |
| DESIGN | \`coupling\` | Acoplamento entre módulos |
| DESIGN | \`interfaces\` | Verificação de interfaces e contratos |
| DESIGN | \`tech_risk\` | Riscos técnicos (complexidade, stack, deps externas) |
| DESIGN | \`design_ready\` | Gate DESIGN→PLAN (pré-requisitos atendidos?) |
| IMPLEMENT | \`implement_done\` | Definition of Done (8 checks: 4 required + 4 recommended) |
| IMPLEMENT | \`tdd_check\` | Aderência TDD (specs sugeridos por AC) |
| IMPLEMENT | \`progress\` | Sprint burndown + velocity trend + blockers + ETA |
| VALIDATE | \`validate_ready\` | Gate IMPLEMENT→VALIDATE |
| VALIDATE | \`done_integrity\` | Integridade dos nodes marcados done |
| VALIDATE | \`status_flow\` | Fluxo de status válido (sem pulos) |
| REVIEW | \`review_ready\` | Gate VALIDATE→REVIEW |
| HANDOFF | \`handoff_ready\` | Gate REVIEW→HANDOFF |
| HANDOFF | \`doc_completeness\` | Completude de documentação |
| DEPLOY | \`deploy_ready\` | Gate HANDOFF→DEPLOY (snapshot, tasks done, no blocked) |
| DEPLOY | \`release_check\` | Validação de release readiness |
| LISTENING | \`listening_ready\` | Gate DEPLOY→LISTENING |
| LISTENING | \`backlog_health\` | Saúde do backlog (distribuição, aging) |`;

export const KNOWLEDGE_PIPELINE_SECTION = `### Pipeline de Conhecimento (Knowledge Store + RAG)

Fontes indexadas automaticamente:
- **Project memories** — ao escrever com \`write_memory\` (auto-indexa)
- **PRD imports** — ao importar com \`import_prd\`
- **Browser captures** — ao validar com \`validate_task\`
- **Stack docs** — ao sincronizar com \`sync_stack_docs\`
- **Sprint reports** — ao gerar com \`plan_sprint\`

Recuperação: \`rag_context\` monta contexto phase-aware com budget de tokens:
- 60% contexto do grafo (nodes, deps, status)
- 30% knowledge store (BM25 + TF-IDF)
- 10% metadata de fase

Manual: \`reindex_knowledge\` para rebuild completo do índice.`;

export const SKILLS_SECTION = `### Skills Built-in (40 skills)

40 skills mapeadas às fases do lifecycle. Use \`list_skills\` para descobrir por fase ou ver instruções completas.

#### Skills por fase

| Fase | Skills sugeridas |
|------|-----------------|
| ANALYZE | \`create-prd-chat-mode\`, \`business-analyst\`, \`product-manager\` |
| DESIGN | \`breakdown-epic-arch\`, \`context-architect\`, \`backend-architect\` |
| PLAN | \`breakdown-feature-prd\`, \`track-with-mcp-graph\` |
| IMPLEMENT | \`subagent-driven-development\`, \`xp-bootstrap\`, \`self-healing-awareness\` |
| VALIDATE | \`playwright-explore-website\`, \`playwright-generate-test\`, \`e2e-testing\` |
| REVIEW | \`code-reviewer\`, \`code-review-checklist\`, \`review-and-refactor\`, \`observability-engineer\` |

#### Categorias adicionais (multi-fase)

| Categoria | Skills |
|-----------|--------|
| software-design | SOLID, KISS, YAGNI, DRY, clean-architecture, composition-over-inheritance |
| security | \`owasp-web-security\`, \`auth-and-secrets\`, \`database-and-deps-security\` |
| ddd | \`domain-driven-design\` (DESIGN, PLAN) |
| testing | \`comprehensive-testing-reference\`, \`self-healing-awareness\` (IMPLEMENT, VALIDATE) |
| cost-reducer | \`cloud-infra-cost\`, \`code-level-savings\`, \`finops-services\` (DESIGN, REVIEW) |
| frontend-design | \`ui-ux-patterns\` (DESIGN, IMPLEMENT) |

#### Custom Skills

Crie skills específicas do projeto via \`manage_skill\` (create/enable/disable). Custom skills são armazenadas no grafo e aparecem junto com as built-in em \`list_skills\`.

#### Self-Healing Awareness

A skill \`self-healing-awareness\` monitora padrões de erro recorrentes e sugere correções automaticamente. Ativa nas fases IMPLEMENT e VALIDATE.`;

export const CLI_COMMANDS = `### Comandos essenciais

\`\`\`bash
npx mcp-graph stats            # Estatísticas do grafo
npx mcp-graph list             # Listar nodes
npx mcp-graph update           # Atualizar configs para última versão
npx mcp-graph doctor           # Validar ambiente de execução
npx mcp-graph doctor --json    # Diagnóstico em JSON estruturado
npx mcp-graph serve --port 3000  # Dashboard visual
\`\`\``;

// ── Phase-to-tools mapping ──────────────────────────

const PHASE_TOOLS: Record<string, string[]> = {
  ANALYZE: [
    "import_prd",
    "node",
    "analyze",
    "validate",
    "search",
    "list",
    "show",
    "help",
    "knowledge_stats",
  ],
  DESIGN: [
    "node",
    "edge",
    "analyze",
    "export",
    "search",
    "show",
    "help",
    "code_intelligence",
    "siebel_analyze",
    "siebel_import_sif",
    "analyze_translation",
  ],
  PLAN: [
    "plan_sprint",
    "analyze",
    "sync_stack_docs",
    "edge",
    "node",
    "search",
    "help",
    "import_graph",
  ],
  IMPLEMENT: [
    "next",
    "context",
    "rag_context",
    "update_status",
    "analyze",
    "validate",
    "write_memory",
    "read_memory",
    "help",
    "code_intelligence",
    "translate_code",
    "siebel_generate_sif",
    "siebel_composer",
    "journey",
  ],
  VALIDATE: [
    "validate",
    "metrics",
    "analyze",
    "export",
    "next",
    "update_status",
    "help",
    "siebel_validate",
    "knowledge_feedback",
  ],
  REVIEW: [
    "export",
    "metrics",
    "analyze",
    "search",
    "show",
    "help",
    "code_intelligence",
    "knowledge_stats",
    "export_knowledge",
  ],
  HANDOFF: [
    "export",
    "snapshot",
    "analyze",
    "write_memory",
    "help",
    "export_knowledge",
    "translation_jobs",
  ],
  DEPLOY: [
    "export",
    "snapshot",
    "analyze",
    "metrics",
    "write_memory",
    "help",
  ],
  LISTENING: [
    "node",
    "import_prd",
    "analyze",
    "search",
    "list",
    "help",
    "knowledge_stats",
    "import_graph",
  ],
};

// ── Phase-to-analyze-modes mapping ──────────────────

const PHASE_ANALYZE_MODES: Record<string, string[]> = {
  ANALYZE: [
    "prd_quality",
    "scope",
    "ready",
    "risk",
    "blockers",
    "cycles",
    "critical_path",
  ],
  PLAN: ["decompose"],
  DESIGN: [
    "adr",
    "traceability",
    "coupling",
    "interfaces",
    "tech_risk",
    "design_ready",
  ],
  IMPLEMENT: ["implement_done", "tdd_check", "progress"],
  VALIDATE: ["validate_ready", "done_integrity", "status_flow"],
  REVIEW: ["review_ready"],
  HANDOFF: ["handoff_ready", "doc_completeness"],
  DEPLOY: ["deploy_ready", "release_check"],
  LISTENING: ["listening_ready", "backlog_health"],
};

// ── Phase-to-skills mapping ─────────────────────────

const PHASE_SKILLS: Record<string, string[]> = {
  ANALYZE: ["create-prd-chat-mode", "business-analyst", "product-manager"],
  DESIGN: ["breakdown-epic-arch", "context-architect", "backend-architect"],
  PLAN: ["breakdown-feature-prd", "track-with-mcp-graph"],
  IMPLEMENT: [
    "subagent-driven-development",
    "xp-bootstrap",
    "self-healing-awareness",
  ],
  VALIDATE: [
    "playwright-explore-website",
    "playwright-generate-test",
    "e2e-testing",
  ],
  REVIEW: [
    "code-reviewer",
    "code-review-checklist",
    "review-and-refactor",
    "observability-engineer",
  ],
  DEPLOY: [
    "deployment-engineer",
    "devops-deploy",
    "git-pushing",
  ],
};

// ── Getter functions ────────────────────────────────

/**
 * Get tool reference, optionally filtered by lifecycle phase.
 */
export function getToolReference(phase?: string): string {
  if (!phase) return TOOL_TABLE_FULL;

  const upper = phase.toUpperCase();
  const tools = PHASE_TOOLS[upper];
  if (!tools) return TOOL_TABLE_FULL;

  const lines = TOOL_TABLE_FULL.split("\n");
  const filtered = lines.filter((line) => {
    if (line.startsWith("#") || line.startsWith("|--") || line.trim() === "")
      return true;
    if (line.startsWith("| Tool") || line.startsWith("| `")) {
      if (line.startsWith("| Tool")) return true;
      return tools.some((tool) => line.includes(`\`${tool}\``));
    }
    return true;
  });

  return `### Tools recomendadas para fase ${upper}\n\n${filtered.join("\n")}`;
}

/**
 * Get analyze modes, optionally filtered by lifecycle phase.
 */
export function getAnalyzeModes(phase?: string): string {
  if (!phase) return ANALYZE_MODES_SECTION;

  const upper = phase.toUpperCase();
  const modes = PHASE_ANALYZE_MODES[upper];
  if (!modes) return ANALYZE_MODES_SECTION;

  const lines = ANALYZE_MODES_SECTION.split("\n");
  const filtered = lines.filter((line) => {
    if (
      line.startsWith("#") ||
      line.startsWith("|--") ||
      line.startsWith("| Fase") ||
      line.trim() === ""
    )
      return true;
    return modes.some((mode) => line.includes(`\`${mode}\``));
  });

  return `### Modos analyze para fase ${upper}\n\n${filtered.join("\n")}`;
}

/**
 * Get skills by lifecycle phase.
 */
export function getSkillsByPhase(phase?: string): string {
  if (!phase) return SKILLS_SECTION;

  const upper = phase.toUpperCase();
  const skills = PHASE_SKILLS[upper];
  if (!skills)
    return `### Skills para fase ${upper}\n\nNenhuma skill específica mapeada. Use \`manage_skill(list)\` para ver todas.`;

  return `### Skills para fase ${upper}\n\n${skills.map((s) => `- \`${s}\``).join("\n")}`;
}

/**
 * Get CLI commands reference.
 */
export function getCliCommands(): string {
  return CLI_COMMANDS;
}

/**
 * Get knowledge pipeline documentation.
 */
export function getKnowledgePipeline(): string {
  return KNOWLEDGE_PIPELINE_SECTION;
}

/**
 * Get all reference content combined.
 */
export function getFullReference(): string {
  return [
    TOOL_TABLE_FULL,
    DEPRECATED_TOOLS_SECTION,
    ANALYZE_MODES_SECTION,
    KNOWLEDGE_PIPELINE_SECTION,
    SKILLS_SECTION,
    CLI_COMMANDS,
  ].join("\n\n");
}
