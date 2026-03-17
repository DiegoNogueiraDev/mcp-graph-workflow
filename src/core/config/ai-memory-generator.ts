/**
 * Generates AI instruction sections for CLAUDE.md and .github/copilot-instructions.md.
 * Both outputs are idempotent (use markers to detect existing sections).
 */

export const MARKER_START = "<!-- mcp-graph:start -->";
export const MARKER_END = "<!-- mcp-graph:end -->";

const TOOL_REFERENCE = `| Tool | Quando usar |
|------|-------------|
| \`init\` | Inicializar grafo do projeto |
| \`import_prd\` | Importar PRD (texto/markdown) para o grafo |
| \`list\` | Listar nodes do grafo (filtrar por tipo/status) |
| \`show\` | Ver detalhes de um node específico |
| \`next\` | Próxima task recomendada (prioridade + dependências + knowledge coverage + TDD hints) |
| \`context\` | Contexto comprimido da task (token-efficient) |
| \`update_status\` | Mudar status de um node (backlog→ready→in_progress→done) |
| \`add_node\` | Criar node manualmente |
| \`update_node\` | Atualizar campos de um node |
| \`delete_node\` | Remover node do grafo |
| \`edge\` | Criar/remover relações entre nodes |
| \`analyze\` | Analisar grafo (qualidade, escopo, riscos, dependências, decomposição) |
| \`search\` | Busca full-text no grafo (FTS5 + BM25) |
| \`rag_context\` | Contexto RAG com knowledge base |
| \`plan_sprint\` | Gerar relatório de planejamento de sprint |
| \`metrics\` | Métricas do projeto (stats ou velocity) |
| \`export\` | Exportar grafo (JSON ou Mermaid) |
| \`snapshot\` | Criar/restaurar snapshots do grafo |
| \`move_node\` | Mover node para outro parent |
| \`clone_node\` | Clonar node com filhos |
| \`sync_stack_docs\` | Sincronizar docs das libs do projeto |
| \`reindex_knowledge\` | Reindexar knowledge store |
| \`validate_task\` | Validar task com browser (Playwright) |`;

const LIFECYCLE_SUMMARY = `### Lifecycle (8 fases)

1. **ANALYZE** — Criar PRD, definir requisitos (\`import_prd\`, \`add_node\`)
2. **DESIGN** — Arquitetura, decisões técnicas (\`add_node\`, \`edge\`, \`analyze\`)
3. **PLAN** — Sprint planning, decomposição (\`plan_sprint\`, \`analyze\`, \`sync_stack_docs\`)
4. **IMPLEMENT** — TDD Red→Green→Refactor (\`next\`, \`context\`, \`update_status\`, \`analyze\` — modes: implement_done, tdd_check, progress)
5. **VALIDATE** — Testes E2E, critérios de aceitação (\`validate_task\`, \`metrics\`)
6. **REVIEW** — Code review, blast radius (\`export\`, \`metrics\`)
7. **HANDOFF** — PR, documentação, entrega (\`export\`, \`snapshot\`)
8. **LISTENING** — Feedback, novo ciclo (\`add_node\`, \`import_prd\`)`;

const XP_PRINCIPLES = `### Princípios XP Anti-Vibe-Coding

- **TDD obrigatório** — Teste antes do código. Sem teste = sem implementação.
- **Anti-one-shot** — Nunca gere sistemas inteiros em um prompt. Decomponha em tasks atômicas.
- **Decomposição atômica** — Cada task deve ser completável em ≤2h.
- **Code detachment** — Se a IA errou, explique o erro via prompt. Nunca edite manualmente.
- **CLAUDE.md como spec evolutiva** — Documente padrões e decisões aqui.`;

export function generateClaudeMdSection(projectName: string): string {
  return `
${MARKER_START}
## mcp-graph — ${projectName}

Este projeto usa **mcp-graph** para gestão de execução via grafo persistente (SQLite).
Dados armazenados em \`workflow-graph/graph.db\` (local, gitignored).

### Ferramentas MCP disponíveis (26 tools)

${TOOL_REFERENCE}

### Fluxo de trabalho recomendado

\`\`\`
next → context → [implementar com TDD] → update_status → next
\`\`\`

${LIFECYCLE_SUMMARY}

${XP_PRINCIPLES}

### Comandos essenciais

\`\`\`bash
npx mcp-graph stats          # Estatísticas do grafo
npx mcp-graph list            # Listar nodes
npx mcp-graph serve --port 3000  # Dashboard visual
\`\`\`
${MARKER_END}
`;
}

export function generateCopilotInstructions(projectName: string): string {
  return `${MARKER_START}
## mcp-graph — ${projectName}

Este projeto usa **mcp-graph** para gestão de execução via grafo persistente.
Dados em \`workflow-graph/graph.db\`.

### Ferramentas MCP (principais)

| Tool | Uso |
|------|-----|
| \`next\` | Próxima task recomendada |
| \`context\` | Contexto comprimido (token-efficient) |
| \`update_status\` | Mudar status (backlog→ready→in_progress→done) |
| \`import_prd\` | Importar PRD para o grafo |
| \`plan_sprint\` | Planejamento de sprint |
| \`decompose\` | Decompor tasks grandes |
| \`validate_task\` | Validar com Playwright |

### Fluxo: \`next → context → [TDD] → update_status → next\`

${LIFECYCLE_SUMMARY}

${XP_PRINCIPLES}
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
