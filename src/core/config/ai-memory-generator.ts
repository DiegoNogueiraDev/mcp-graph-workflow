/**
 * Generates AI instruction sections for CLAUDE.md and .github/copilot-instructions.md.
 * Both outputs are idempotent (use markers to detect existing sections).
 */

import {
  TOOL_TABLE_FULL,
  DEPRECATED_TOOLS_SECTION,
  ANALYZE_MODES_SECTION,
  KNOWLEDGE_PIPELINE_SECTION,
  SKILLS_SECTION,
  CLI_COMMANDS as CLI_COMMANDS_REF,
} from "./reference-content.js";

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

const LIFECYCLE_SUMMARY = `### Lifecycle (9 fases)

1. **ANALYZE** \u2014 Criar PRD, definir requisitos (\`import_prd\`, \`add_node\`)
2. **DESIGN** \u2014 Arquitetura, decis\u00F5es t\u00E9cnicas (\`add_node\`, \`edge\`, \`analyze\`)
3. **PLAN** \u2014 Sprint planning, decomposi\u00E7\u00E3o (\`plan_sprint\`, \`analyze\`, \`sync_stack_docs\`)
4. **IMPLEMENT** \u2014 TDD Red\u2192Green\u2192Refactor (\`next\`, \`context\`, \`update_status\`, \`analyze\` \u2014 modes: implement_done, tdd_check, progress)
5. **VALIDATE** \u2014 Testes E2E, crit\u00E9rios de aceita\u00E7\u00E3o (\`validate_task\`, \`metrics\`)
6. **REVIEW** \u2014 Code review, blast radius (\`export\`, \`metrics\`)
7. **HANDOFF** \u2014 PR, documenta\u00E7\u00E3o, entrega (\`export\`, \`snapshot\`)
8. **DEPLOY** \u2014 CI pipeline, release, post-release validation (\`export\`, \`snapshot\`, \`analyze\`)
9. **LISTENING** \u2014 Feedback, novo ciclo (\`add_node\`, \`import_prd\`)`;

const XP_PRINCIPLES = `### Princ\u00EDpios XP Anti-Vibe-Coding

- **TDD obrigat\u00F3rio** \u2014 Teste antes do c\u00F3digo. Sem teste = sem implementa\u00E7\u00E3o.
- **Anti-one-shot** \u2014 Nunca gere sistemas inteiros em um prompt. Decomponha em tasks at\u00F4micas.
- **Decomposi\u00E7\u00E3o at\u00F4mica** \u2014 Cada task deve ser complet\u00E1vel em \u22642h.
- **Code detachment** \u2014 Se a IA errou, explique o erro via prompt. Nunca edite manualmente.
- **CLAUDE.md como spec evolutiva** \u2014 Documente padr\u00F5es e decis\u00F5es aqui.`;


const LEAN_DISCOVERY_HINT = `> **Referências detalhadas on-demand:** Use \`help\` tool para consultar: \`tools\`, \`analyze_modes\`, \`skills\`, \`cli\`, \`knowledge\`, \`workflow\`.`;

function buildSectionBody(projectName: string, mode: "lean" | "full" = "full"): string {
  const header = `## mcp-graph — ${projectName}

Este projeto usa **mcp-graph** para gestão de execução via grafo persistente (SQLite).
Dados armazenados em \`workflow-graph/graph.db\` (local, gitignored).

${MANDATORY_EXECUTION_RULE}`;

  const workflow = `### Fluxo de trabalho OBRIGATÓRIO

\`\`\`
next → context → rag_context → [implementar com TDD] → analyze(implement_done) → update_status → next
\`\`\``;

  if (mode === "lean") {
    return `${header}

${workflow}

${LIFECYCLE_SUMMARY}

${XP_PRINCIPLES}

${LEAN_DISCOVERY_HINT}`;
  }

  // Full mode — backward compatible output
  return `${header}

${TOOL_TABLE_FULL}

${DEPRECATED_TOOLS_SECTION}

${ANALYZE_MODES_SECTION}

${workflow}

${LIFECYCLE_SUMMARY}

${KNOWLEDGE_PIPELINE_SECTION}

${SKILLS_SECTION}

${XP_PRINCIPLES}

${CLI_COMMANDS_REF}`;
}

export function generateClaudeMdSection(projectName: string, mode: "lean" | "full" = "full"): string {
  return `
${MARKER_START}
${buildSectionBody(projectName, mode)}
${MARKER_END}
`;
}

export function generateCopilotInstructions(projectName: string, mode: "lean" | "full" = "full"): string {
  return `${MARKER_START}
${buildSectionBody(projectName, mode)}
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
