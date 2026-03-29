import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getToolReference,
  getAnalyzeModes,
  getSkillsByPhase,
  getCliCommands,
  getKnowledgePipeline,
  getFullReference,
} from "../../core/config/reference-content.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText } from "../response-helpers.js";

const WORKFLOW_SECTION = `### Fluxo de trabalho OBRIGATÓRIO

\`\`\`
next → context → rag_context → [implementar com TDD] → analyze(implement_done) → update_status → next
\`\`\`

### Lifecycle (9 fases)

1. **ANALYZE** — Criar PRD, definir requisitos
2. **DESIGN** — Arquitetura, decisões técnicas
3. **PLAN** — Sprint planning, decomposição
4. **IMPLEMENT** — TDD Red→Green→Refactor
5. **VALIDATE** — Testes E2E, critérios de aceitação
6. **REVIEW** — Code review, blast radius
7. **HANDOFF** — PR, documentação, entrega
8. **DEPLOY** — CI pipeline, release, post-release validation
9. **LISTENING** — Feedback, novo ciclo`;

type HelpTopic =
  | "tools"
  | "analyze_modes"
  | "skills"
  | "cli"
  | "knowledge"
  | "workflow"
  | "all";

function getTopicContent(topic: HelpTopic, phase?: string): string {
  switch (topic) {
    case "tools":
      return getToolReference(phase);
    case "analyze_modes":
      return getAnalyzeModes(phase);
    case "skills":
      return getSkillsByPhase(phase);
    case "cli":
      return getCliCommands();
    case "knowledge":
      return getKnowledgePipeline();
    case "workflow":
      return WORKFLOW_SECTION;
    case "all":
      return getFullReference();
  }
}

export function registerHelp(server: McpServer): void {
  server.tool(
    "help",
    "On-demand reference for mcp-graph tools, analyze modes, skills, CLI commands, and workflow. Use this instead of memorizing static docs.",
    {
      topic: z
        .enum([
          "tools",
          "analyze_modes",
          "skills",
          "cli",
          "knowledge",
          "workflow",
          "all",
        ])
        .describe("Reference topic to query"),
      phase: z
        .string()
        .optional()
        .describe(
          "Lifecycle phase to filter by (ANALYZE, DESIGN, PLAN, IMPLEMENT, VALIDATE, REVIEW, HANDOFF, DEPLOY, LISTENING)",
        ),
    },
    async ({ topic, phase }) => {
      logger.debug("tool:help", { topic, phase });

      const content = getTopicContent(topic, phase);
      const phaseLabel = phase ? ` (fase: ${phase.toUpperCase()})` : "";

      logger.info("tool:help:ok", {
        topic,
        phase,
        chars: content.length,
      });

      return mcpText({
        topic,
        phase: phase ?? null,
        label: `Referência: ${topic}${phaseLabel}`,
        content,
      });
    },
  );
}
