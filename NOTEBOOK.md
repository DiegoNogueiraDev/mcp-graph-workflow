# Caderno de Testes Reais — mcp-graph MCP Tools

> 35 cenários, ~165 steps, 25/25 consolidated tools + 7 Playwright tools

**Instruções:** Execute cada step sequencialmente. Capture IDs retornados e substitua nos placeholders `<ID>` dos steps seguintes. Cole o output real no campo "Actual" e marque o resultado.

---

## Partes

| Parte | Arquivo | Cenários | Foco |
|-------|---------|----------|------|
| **1** | [parte-1-mcp-tools.md](docs/notebooks/parte-1-mcp-tools.md) | 1-12 (~73 steps) | 25/25 MCP tools + 3 Playwright básicos |
| **2** | [parte-2-playwright-e2e.md](docs/notebooks/parte-2-playwright-e2e.md) | 13-24 (~75 steps) | Benchmark E2E com Playwright (7 tools) |
| **3** | [parte-3-advanced-features.md](docs/notebooks/parte-3-advanced-features.md) | 25-35 (~90 steps) | Multi-project, lifecycle, integration mesh, knowledge pipeline, test pyramid |

---

## Pré-requisitos

- **Parte 1:** Projeto inicializado, `./sample-prd.txt` disponível
- **Parte 2:** Dashboard rodando em `http://localhost:3377` (`npx tsx src/tests/e2e/test-server.ts`)
- **Parte 3:** Partes 1-2 executadas (dados existentes), Serena + GitNexus configurados (cenários 30, 32 — SKIP se indisponível)

---

## Cenários por Parte

### Parte 1: MCP Tools (cenários 1-12)

| # | Cenário | Tools principais |
|---|---------|-----------------|
| 1 | Lifecycle Completo (Happy Path) | `init`, `import_prd`, `stats`, `list`, `next`, `context`, `update_status`, `plan_sprint` |
| 2 | Graph CRUD | `add_node`, `show`, `update_node`, `edge`, `delete_node` |
| 3 | Search & RAG | `search`, `rag_context` |
| 4 | Knowledge Pipeline | `reindex_knowledge`, `search`, `rag_context` |
| 5 | Planning | `decompose`, `dependencies`, `velocity`, `plan_sprint` |
| 6 | Snapshots | `snapshot` (create/list/restore), `stats`, `add_node` |
| 7 | Export | `export` (json/mermaid) |
| 8 | Bulk Operations | `add_node`, `bulk_update_status`, `list` |
| 9 | Clone & Move | `clone_node`, `move_node`, `show` |
| 10 | Validation (Browser) | `validate_task` |
| 11 | Stack Docs | `sync_stack_docs`, `reindex_knowledge` |
| 12 | Frontend Dashboard E2E | `browser_navigate`, `browser_snapshot`, `browser_click` |

### Parte 2: Playwright E2E (cenários 13-24)

| # | Cenário | Tools principais |
|---|---------|-----------------|
| 13 | Self-Test Import PRD | `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_file_upload` |
| 14 | Graph Tab Exploração | `browser_click`, `browser_snapshot`, `browser_fill_form`, `browser_take_screenshot` |
| 15 | PRD & Backlog Tab | `browser_click`, `browser_snapshot`, `browser_take_screenshot` |
| 16 | Code Graph Tab | `browser_click`, `browser_snapshot`, `browser_take_screenshot` |
| 17 | Insights Tab | `browser_click`, `browser_snapshot`, `browser_take_screenshot` |
| 18 | Benchmark Tab | `browser_click`, `browser_snapshot`, `browser_take_screenshot` |
| 19 | CRUD via API + Dashboard | `browser_evaluate`, `browser_snapshot`, `browser_take_screenshot` |
| 20 | Edge Creation + Relationships | `browser_evaluate`, `browser_click`, `browser_snapshot` |
| 21 | Import Modal Upload | `browser_click`, `browser_file_upload`, `browser_take_screenshot` |
| 22 | Cross-Tab Consistency | `browser_click`, `browser_snapshot`, `browser_evaluate` |
| 23 | Search & Filter Deep | `browser_fill_form`, `browser_click`, `browser_snapshot` |
| 24 | Theme Toggle | `browser_click`, `browser_snapshot`, `browser_take_screenshot` |

### Parte 3: Advanced Features (cenários 25-35)

| # | Cenário | Tools principais |
|---|---------|-----------------|
| 25 | Multi-Project Isolamento | `init`, `add_node`, `list`, `stats` |
| 26 | Multi-Project API + Dashboard | `browser_navigate`, `browser_evaluate`, `browser_click` |
| 27 | Store Directory + Init Artifacts | `init`, `stats`, Manual/Bash |
| 28 | Lifecycle Phase Detection (6 fases) | `init`, `add_node`, `update_status`, `plan_sprint`, `bulk_update_status` |
| 29 | Dashboard Data Refresh | `browser_navigate`, `browser_snapshot`, `browser_click` |
| 30 | Integration Mesh (5 MCPs) | `import_prd`, `sync_stack_docs`, `reindex_knowledge`, `validate_task`, `rag_context` |
| 31 | Knowledge Pipeline (tiers + budget) | `rag_context`, `search`, `context` |
| 32 | REVIEW Phase (blast radius) | `stats`, `export`, Serena, GitNexus |
| 33 | Hierarquia Completa (9+8) | `add_node`, `edge`, `show`, `list`, `export` |
| 34 | VALIDATE — Pirâmide + DoD | `validate_task`, Manual/Bash (`npm test`, `npm run build`) |
| 35 | Smoke Test + E2E Browser | `browser_navigate`, `browser_click`, `browser_evaluate`, `browser_console_messages`, `validate_task` |

---

## Checklist de Verificação Final

### Parte 1
- [ ] Cenários 1-12 — executados

### Parte 2
- [ ] Cenários 13-24 — executados
- [ ] Screenshots capturados como evidência
- [ ] Cross-tab consistency confirmada
- [ ] Nenhum erro no console do browser

### Parte 3
- [ ] Cenário 25: Multi-Project Isolamento — executado
- [ ] Cenário 26: Multi-Project API + Dashboard — executado
- [ ] Cenário 27: Store Directory + Init Artifacts — executado
- [ ] Cenário 28: Lifecycle Phase Detection (6 fases) — executado
- [ ] Cenário 29: Dashboard Data Refresh — executado
- [ ] Cenário 30: Integration Mesh (5 MCPs) — executado
- [ ] Cenário 31: Knowledge Pipeline (tiers + budget) — executado
- [ ] Cenário 32: REVIEW Phase (blast radius) — executado
- [ ] Cenário 33: Hierarquia Completa (9 tipos + 8 relações) — executado
- [ ] Cenário 34: VALIDATE — Pirâmide de Testes + DoD — executado
- [ ] Cenário 35: Smoke Test + E2E Browser — executado
- [ ] _lifecycle block presente em todas as respostas MCP (6 fases validadas)
- [ ] suggestedTools e principles corretos por fase
- [ ] Isolamento de dados entre projetos confirmado
- [ ] AI memory files gerados com markers idempotentes
- [ ] Integration Mesh: 5 MCPs orquestrados via EventBus
- [ ] Knowledge Pipeline: 5 source types indexados, RAG funcional
- [ ] Tiered context: summary < standard < deep em tokens
- [ ] Budget 60/30/10 respeitado
- [ ] Todos os 9 tipos de nó criados e validados
- [ ] Todos os 8 tipos de edge criados e validados
- [ ] Pirâmide de testes: unit + integration + E2E + smoke passando
- [ ] Definition of Done completo (TDD, tests, AC, build, logger)
- [ ] Zero erros no console do browser
