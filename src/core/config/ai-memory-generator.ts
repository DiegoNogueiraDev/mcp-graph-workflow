/**
 * Generates AI instruction sections for CLAUDE.md and .github/copilot-instructions.md.
 * Both outputs are idempotent (use markers to detect existing sections).
 */

export const MARKER_START = "<!-- mcp-graph:start -->";
export const MARKER_END = "<!-- mcp-graph:end -->";

const MANDATORY_EXECUTION_RULE = `### ⚠️ Regra de Execução OBRIGATÓRIA

**O mcp-graph é a fonte de verdade ABSOLUTA. Nenhuma implementação acontece fora do grafo.**

1. **Node deve existir** — antes de escrever QUALQUER código, o node correspondente DEVE existir no grafo
2. **Fluxo obrigatório** — \`next → context → rag_context → [implementar com TDD] → analyze(implement_done) → update_status → next\` — SEM EXCEÇÕES
3. **Epic = estrutura primeiro** — criar Epic + tasks filhas + edges ANTES de implementar
4. **Status tracking** — \`update_status → in_progress\` ANTES de codar, \`→ done\` APÓS completar
5. **Validação** — usar \`validate\` (action: \`ac\`) após cada task para checar critérios de aceitação
6. **Zero trabalho não-rastreado** — se não tem node no grafo, CRIAR PRIMEIRO

> **Sem node no grafo = sem código escrito.**`;

const TOOL_TABLE_FULL = `#### Projeto & Grafo

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
| \`update_status\` | Mudar status de um node (backlog\u2192ready\u2192in_progress\u2192done) |
| \`bulk_update_status\` | Atualizar status de m\u00FAltiplos nodes de uma vez |

#### PRD & Planejamento

| Tool | Quando usar |
|------|-------------|
| \`import_prd\` | Importar PRD \u2192 segmentar \u2192 classificar \u2192 extrair \u2192 inferir deps \u2192 criar grafo + indexar knowledge |
| \`plan_sprint\` | Gerar relat\u00F3rio de planejamento de sprint (capacity, velocity, recomenda\u00E7\u00F5es) |
| \`analyze\` | 24 modos de an\u00E1lise por fase do lifecycle (ver modos abaixo) |
| \`set_phase\` | For\u00E7ar/resetar fase do lifecycle (strict/advisory, gate checks) + Code Intelligence mode (strict/advisory/off) + Tool Prerequisites mode (strict/advisory/off) |

#### Contexto & RAG

| Tool | Quando usar |
|------|-------------|
| \`next\` | Pr\u00F3xima task recomendada (prioridade + deps + knowledge coverage 0-1 + TDD hints + velocity) |
| \`context\` | Contexto comprimido da task (token-efficient, ~73% redu\u00E7\u00E3o) |
| \`rag_context\` | Contexto RAG phase-aware (tiers: summary/standard/deep, budget 60/30/10) |
| \`reindex_knowledge\` | Rebuild completo do \u00EDndice de knowledge (BM25 + TF-IDF) |
| \`sync_stack_docs\` | Sincronizar docs das libs do projeto via Context7 |

#### Mem\u00F3rias do Projeto

| Tool | Quando usar |
|------|-------------|
| \`write_memory\` | Escrever mem\u00F3ria em workflow-graph/memories/{name}.md (auto-indexa no RAG) |
| \`read_memory\` | Ler conte\u00FAdo de uma mem\u00F3ria espec\u00EDfica |
| \`list_memories\` | Listar todas as mem\u00F3rias dispon\u00EDveis |
| \`delete_memory\` | Remover mem\u00F3ria do filesystem e do knowledge store |

#### Valida\u00E7\u00E3o

| Tool | Quando usar |
|------|-------------|
| \`validate\` | Validação: action \`task\` (browser A/B com Playwright) ou \`ac\` (critérios de aceitação) |

#### Skills

| Tool | Quando usar |
|------|-------------|
| \`manage_skill\` | Gerenciar skills: action \`list\` (listar/filtrar por fase), \`enable\`/\`disable\`, CRUD de custom skills |

#### Tools Deprecated (backward compat, removidos na v7.0)

| Tool antigo | Usar no lugar |
|-------------|---------------|
| \`add_node\` | \`node\` com action:\`add\` |
| \`update_node\` | \`node\` com action:\`update\` |
| \`delete_node\` | \`node\` com action:\`delete\` |
| \`validate_task\` | \`validate\` com action:\`task\` |
| \`validate_ac\` | \`validate\` com action:\`ac\` |
| \`list_skills\` | \`manage_skill\` com action:\`list\` |`;

const ANALYZE_MODES_SECTION = `### Modos do analyze por fase

| Fase | Modo | O que verifica |
|------|------|----------------|
| ANALYZE | \`prd_quality\` | Qualidade do PRD (completude, user stories, AC) |
| ANALYZE | \`scope\` | Escopo do grafo (tipos, distribui\u00E7\u00E3o, cobertura) |
| ANALYZE | \`ready\` | Definition of Ready (bloqueios, depend\u00EAncias, AC) |
| ANALYZE | \`risk\` | Riscos (complexidade, deps, tamanho, AC faltantes) |
| ANALYZE | \`blockers\` | Bloqueios transitivos de um node |
| ANALYZE | \`cycles\` | Ciclos de depend\u00EAncia no grafo |
| ANALYZE | \`critical_path\` | Caminho cr\u00EDtico (sequ\u00EAncia mais longa de deps) |
| PLAN | \`decompose\` | Tasks grandes que precisam ser decompostas |
| DESIGN | \`adr\` | Valida\u00E7\u00E3o de ADRs (Architecture Decision Records) |
| DESIGN | \`traceability\` | Matriz de rastreabilidade (req \u2192 task \u2192 test) |
| DESIGN | \`coupling\` | Acoplamento entre m\u00F3dulos |
| DESIGN | \`interfaces\` | Verifica\u00E7\u00E3o de interfaces e contratos |
| DESIGN | \`tech_risk\` | Riscos t\u00E9cnicos (complexidade, stack, deps externas) |
| DESIGN | \`design_ready\` | Gate DESIGN\u2192PLAN (pr\u00E9-requisitos atendidos?) |
| IMPLEMENT | \`implement_done\` | Definition of Done (8 checks: 4 required + 4 recommended) |
| IMPLEMENT | \`tdd_check\` | Ader\u00EAncia TDD (specs sugeridos por AC) |
| IMPLEMENT | \`progress\` | Sprint burndown + velocity trend + blockers + ETA |
| VALIDATE | \`validate_ready\` | Gate IMPLEMENT\u2192VALIDATE |
| VALIDATE | \`done_integrity\` | Integridade dos nodes marcados done |
| VALIDATE | \`status_flow\` | Fluxo de status v\u00E1lido (sem pulos) |
| REVIEW | \`review_ready\` | Gate VALIDATE\u2192REVIEW |
| HANDOFF | \`handoff_ready\` | Gate REVIEW\u2192HANDOFF |
| HANDOFF | \`doc_completeness\` | Completude de documenta\u00E7\u00E3o |
| LISTENING | \`listening_ready\` | Gate HANDOFF\u2192LISTENING |
| LISTENING | \`backlog_health\` | Sa\u00FAde do backlog (distribui\u00E7\u00E3o, aging) |`;

const KNOWLEDGE_PIPELINE_SECTION = `### Pipeline de Conhecimento (Knowledge Store + RAG)

Fontes indexadas automaticamente:
- **Project memories** \u2014 ao escrever com \`write_memory\` (auto-indexa)
- **PRD imports** \u2014 ao importar com \`import_prd\`
- **Browser captures** \u2014 ao validar com \`validate_task\`
- **Stack docs** \u2014 ao sincronizar com \`sync_stack_docs\`
- **Sprint reports** \u2014 ao gerar com \`plan_sprint\`

Recupera\u00E7\u00E3o: \`rag_context\` monta contexto phase-aware com budget de tokens:
- 60% contexto do grafo (nodes, deps, status)
- 30% knowledge store (BM25 + TF-IDF)
- 10% metadata de fase

Manual: \`reindex_knowledge\` para rebuild completo do \u00EDndice.`;

const SKILLS_SECTION = `### Skills Built-in (40 skills)

40 skills mapeadas \u00E0s fases do lifecycle. Use \`list_skills\` para descobrir por fase ou ver instru\u00E7\u00F5es completas.

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

Crie skills espec\u00EDficas do projeto via \`manage_skill\` (create/enable/disable). Custom skills s\u00E3o armazenadas no grafo e aparecem junto com as built-in em \`list_skills\`.

#### Self-Healing Awareness

A skill \`self-healing-awareness\` monitora padr\u00F5es de erro recorrentes e sugere corre\u00E7\u00F5es automaticamente. Ativa nas fases IMPLEMENT e VALIDATE.`;

const LIFECYCLE_SUMMARY = `### Lifecycle (8 fases)

1. **ANALYZE** \u2014 Criar PRD, definir requisitos (\`import_prd\`, \`add_node\`)
2. **DESIGN** \u2014 Arquitetura, decis\u00F5es t\u00E9cnicas (\`add_node\`, \`edge\`, \`analyze\`)
3. **PLAN** \u2014 Sprint planning, decomposi\u00E7\u00E3o (\`plan_sprint\`, \`analyze\`, \`sync_stack_docs\`)
4. **IMPLEMENT** \u2014 TDD Red\u2192Green\u2192Refactor (\`next\`, \`context\`, \`update_status\`, \`analyze\` \u2014 modes: implement_done, tdd_check, progress)
5. **VALIDATE** \u2014 Testes E2E, crit\u00E9rios de aceita\u00E7\u00E3o (\`validate_task\`, \`metrics\`)
6. **REVIEW** \u2014 Code review, blast radius (\`export\`, \`metrics\`)
7. **HANDOFF** \u2014 PR, documenta\u00E7\u00E3o, entrega (\`export\`, \`snapshot\`)
8. **LISTENING** \u2014 Feedback, novo ciclo (\`add_node\`, \`import_prd\`)`;

const XP_PRINCIPLES = `### Princ\u00EDpios XP Anti-Vibe-Coding

- **TDD obrigat\u00F3rio** \u2014 Teste antes do c\u00F3digo. Sem teste = sem implementa\u00E7\u00E3o.
- **Anti-one-shot** \u2014 Nunca gere sistemas inteiros em um prompt. Decomponha em tasks at\u00F4micas.
- **Decomposi\u00E7\u00E3o at\u00F4mica** \u2014 Cada task deve ser complet\u00E1vel em \u22642h.
- **Code detachment** \u2014 Se a IA errou, explique o erro via prompt. Nunca edite manualmente.
- **CLAUDE.md como spec evolutiva** \u2014 Documente padr\u00F5es e decis\u00F5es aqui.`;

const CLI_COMMANDS = `### Comandos essenciais

\`\`\`bash
npx mcp-graph stats            # Estat\u00EDsticas do grafo
npx mcp-graph list             # Listar nodes
npx mcp-graph update           # Atualizar configs para \u00FAltima vers\u00E3o
npx mcp-graph doctor           # Validar ambiente de execu\u00E7\u00E3o
npx mcp-graph doctor --json    # Diagn\u00F3stico em JSON estruturado
npx mcp-graph serve --port 3000  # Dashboard visual
\`\`\``;

function buildSectionBody(projectName: string): string {
  return `## mcp-graph \u2014 ${projectName}

Este projeto usa **mcp-graph** para gest\u00E3o de execu\u00E7\u00E3o via grafo persistente (SQLite).
Dados armazenados em \`workflow-graph/graph.db\` (local, gitignored).

${MANDATORY_EXECUTION_RULE}

### Ferramentas MCP dispon\u00EDveis (28 tools + 6 deprecated)

${TOOL_TABLE_FULL}

${ANALYZE_MODES_SECTION}

### Fluxo de trabalho OBRIGAT\u00D3RIO

\`\`\`
next \u2192 context \u2192 rag_context \u2192 [implementar com TDD] \u2192 analyze(implement_done) \u2192 update_status \u2192 next
\`\`\`

${LIFECYCLE_SUMMARY}

${KNOWLEDGE_PIPELINE_SECTION}

${SKILLS_SECTION}

${XP_PRINCIPLES}

${CLI_COMMANDS}`;
}

export function generateClaudeMdSection(projectName: string): string {
  return `
${MARKER_START}
${buildSectionBody(projectName)}
${MARKER_END}
`;
}

export function generateCopilotInstructions(projectName: string): string {
  return `${MARKER_START}
${buildSectionBody(projectName)}
${MARKER_END}
`;
}

/**
 * Apply a section to existing content idempotently.
 * If markers exist, replace the section. Otherwise, append.
 */
export function applySection(existingContent: string, newSection: string): string {
  const startIdx = existingContent.indexOf(MARKER_START);
  const endIdx = existingContent.indexOf(MARKER_END);
  const trimmedSection = newSection.trim() + "\n";

  if (startIdx !== -1 && endIdx !== -1) {
    const before = existingContent.substring(0, startIdx).trimEnd();
    const after = existingContent.substring(endIdx + MARKER_END.length).trimStart();
    const beforePart = before.length > 0 ? before + "\n\n" : "";
    const afterPart = after.length > 0 ? "\n" + after : "";
    return beforePart + trimmedSection + afterPart;
  }

  const base = existingContent.trimEnd();
  const prefix = base.length > 0 ? base + "\n\n" : "";
  return prefix + trimmedSection;
}
