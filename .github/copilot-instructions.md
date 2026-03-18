<!-- mcp-graph:start -->
## mcp-graph — mcp-graph-workflow

Este projeto usa **mcp-graph** para gestão de execução via grafo persistente.
Dados em `workflow-graph/graph.db`.

### Ferramentas MCP (principais)

| Tool | Uso |
|------|-----|
| `next` | Próxima task recomendada (prioridade + deps + knowledge coverage + TDD hints) |
| `context` | Contexto comprimido (token-efficient, ~73% redução) |
| `update_status` | Mudar status (backlog→ready→in_progress→done) |
| `import_prd` | Importar PRD → segmentar → classificar → extrair → criar grafo |
| `plan_sprint` | Planejamento de sprint (capacity, velocity) |
| `analyze` | 24 modos de análise por fase do lifecycle |
| `set_phase` | Forçar/resetar fase do lifecycle (gate checks) |
| `validate_task` | Validar com Playwright (A/B, CSS scoping) |
| `validate_ac` | Validar critérios de aceitação (checklist automático) |
| `rag_context` | Contexto RAG phase-aware (budget 60/30/10) |

### Fluxo: `next → context → [TDD] → update_status → next`

### Lifecycle (8 fases)

1. **ANALYZE** — Criar PRD, definir requisitos (`import_prd`, `add_node`)
2. **DESIGN** — Arquitetura, decisões técnicas (`add_node`, `edge`, `analyze`)
3. **PLAN** — Sprint planning, decomposição (`plan_sprint`, `analyze`, `sync_stack_docs`)
4. **IMPLEMENT** — TDD Red→Green→Refactor (`next`, `context`, `update_status`, `analyze` — modes: implement_done, tdd_check, progress)
5. **VALIDATE** — Testes E2E, critérios de aceitação (`validate_task`, `metrics`)
6. **REVIEW** — Code review, blast radius (`export`, `metrics`)
7. **HANDOFF** — PR, documentação, entrega (`export`, `snapshot`)
8. **LISTENING** — Feedback, novo ciclo (`add_node`, `import_prd`)

### Princípios XP Anti-Vibe-Coding

- **TDD obrigatório** — Teste antes do código. Sem teste = sem implementação.
- **Anti-one-shot** — Nunca gere sistemas inteiros em um prompt. Decomponha em tasks atômicas.
- **Decomposição atômica** — Cada task deve ser completável em ≤2h.
- **Code detachment** — Se a IA errou, explique o erro via prompt. Nunca edite manualmente.
- **CLAUDE.md como spec evolutiva** — Documente padrões e decisões aqui.
<!-- mcp-graph:end -->
