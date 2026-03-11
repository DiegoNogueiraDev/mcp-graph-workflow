# Parte 3: Multi-project, Lifecycle, Integration Mesh, Knowledge Pipeline, Test Pyramid

> Cenários 25-35: Validação de features avançadas — multi-project, lifecycle phase detection, integration mesh (5 MCPs), knowledge pipeline (5 source types, tiered context, budget 60/30/10), hierarquia completa (9 tipos de nó, 8 tipos de edge), pirâmide de testes e Definition of Done.

---

## Cenário 25: Multi-Project — Isolamento de Dados (MCP)

**Objetivo:** Criar 2 projetos via `init`, adicionar nodes em cada, verificar isolamento total de dados.
**Tools cobertos:** `init`, `add_node`, `list`, `stats`

### Step 25.1: Inicializar projeto Alpha

**Tool:** `init`
**Input:**
```json
{ "projectName": "project-alpha" }
```

**Expected:**
- `ok: true`

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 25.2: Adicionar node no Alpha

**Tool:** `add_node`
**Input:**
```json
{ "type": "task", "title": "Alpha Task 1" }
```

**Expected:**
- Node criado no alpha

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 25.3: Verificar stats do Alpha

**Tool:** `stats`
**Input:**
```json
{}
```

**Expected:**
- `totalNodes == 1`, projectName = "project-alpha"

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 25.4: Inicializar projeto Beta

**Tool:** `init`
**Input:**
```json
{ "projectName": "project-beta" }
```

**Expected:**
- `ok: true`, contexto muda para beta

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 25.5: Verificar isolamento — lista vazia no Beta

**Tool:** `list`
**Input:**
```json
{}
```

**Expected:**
- **Lista vazia** — "Alpha Task 1" NÃO aparece (isolamento)

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 25.6: Adicionar node no Beta

**Tool:** `add_node`
**Input:**
```json
{ "type": "task", "title": "Beta Task 1" }
```

**Expected:**
- Node criado no beta

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 25.7: Verificar stats do Beta

**Tool:** `stats`
**Input:**
```json
{}
```

**Expected:**
- `totalNodes == 1`, projectName = "project-beta"

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

## Cenário 26: Multi-Project — API REST + Dashboard (Playwright)

**Objetivo:** Validar endpoints REST (`/project/list`, `/project/active`, `/:id/activate`) e ProjectSelector UI.
**Tools cobertos:** `browser_navigate`, `browser_evaluate`, `browser_snapshot`, `browser_click`, `browser_take_screenshot`
**Depende de:** Cenário 25 (2 projetos existem)
**Ref:** `src/api/routes/project.ts`, `src/web/dashboard/src/components/layout/project-selector.tsx`

### Step 26.1: Navegar para o dashboard

**Tool:** `browser_navigate`
**Input:**
```json
{ "url": "http://localhost:3377" }
```

**Expected:**
- Dashboard carrega

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 26.2: Listar projetos via API

**Tool:** `browser_evaluate`
**Input:**
```javascript
await fetch('/api/v1/project/list').then(r => r.json())
```

**Expected:**
- `total >= 2`, array contém alpha e beta

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 26.3: Verificar projeto ativo via API

**Tool:** `browser_evaluate`
**Input:**
```javascript
await fetch('/api/v1/project/active').then(r => r.json())
```

**Expected:**
- Retorna projeto ativo com `id` e `name`

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 26.4: Verificar ProjectSelector no dashboard

**Tool:** `browser_snapshot`
**Input:**
```json
{}
```

**Expected:**
- ProjectSelector dropdown visível no header (renderiza quando >1 projeto)

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 26.5: Abrir dropdown do ProjectSelector

**Tool:** `browser_click`
**Input:**
```json
{ "element": "ProjectSelector dropdown", "ref": "<ref>" }
```

**Expected:**
- Abre listbox com `role="option"` items

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 26.6: Trocar para project-alpha

**Tool:** `browser_click`
**Input:**
```json
{ "element": "project-alpha option", "ref": "<ref>" }
```

**Expected:**
- Projeto muda; dashboard atualiza

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 26.7: Confirmar projeto ativo via API

**Tool:** `browser_evaluate`
**Input:**
```javascript
await fetch('/api/v1/project/active').then(r => r.json())
```

**Expected:**
- Retorna project-alpha ativo

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 26.8: Screenshot do ProjectSelector

**Tool:** `browser_take_screenshot`

**Expected:**
- Evidência do ProjectSelector

**Actual:**
```
[screenshot path]
```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

## Cenário 27: Store Directory + Init Artifacts

**Objetivo:** Validar que `init` cria `workflow-graph/` (não `.mcp-graph/`), gera AI memory files com markers idempotentes, e re-init não duplica.
**Tools cobertos:** `init`, `stats`, `browser_evaluate`
**Ref:** `src/core/utils/constants.ts` (STORE_DIR, LEGACY_STORE_DIR), `src/core/config/ai-memory-generator.ts`

### Step 27.1: Inicializar projeto

**Tool:** `init`
**Input:**
```json
{ "projectName": "init-artifacts-test" }
```

**Expected:**
- `ok: true`

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 27.2: Verificar stats

**Tool:** `stats`
**Input:**
```json
{}
```

**Expected:**
- `totalNodes == 0`, projectName = "init-artifacts-test"

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 27.3: Verificar diretório workflow-graph/

**Tool:** Manual/Bash

**Expected:**
- `workflow-graph/graph.db` existe (não `.mcp-graph/`)

**Actual:**
```

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 27.4: Verificar CLAUDE.md markers

**Tool:** Manual/Bash

**Expected:**
- `CLAUDE.md` contém `<!-- mcp-graph:start -->` e `<!-- mcp-graph:end -->`
- Seção AI memory presente com markers

**Actual:**
```

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 27.5: Verificar copilot-instructions.md

**Tool:** Manual/Bash

**Expected:**
- `.github/copilot-instructions.md` existe
- Arquivo gerado com lifecycle info

**Actual:**
```

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 27.6: Re-init idempotente

**Tool:** `init`
**Input:**
```json
{ "projectName": "init-artifacts-test" }
```

**Expected:**
- `ok: true`, sem duplicação (idempotente)

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 27.7: Verificar sem projeto duplicado

**Tool:** `browser_evaluate`
**Input:**
```javascript
await fetch('/api/v1/project/list').then(r => r.json())
```

**Expected:**
- `total` não incrementou (sem projeto duplicado)

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

## Cenário 28: Lifecycle Phase Detection — Todas as 6 Fases Detectáveis

**Objetivo:** Validar que respostas MCP incluem `_lifecycle` block com fase correta conforme grafo evolui por TODAS as fases automáticas, incluindo `suggestedTools` e `principles` corretos por fase.
**Tools cobertos:** `init`, `add_node`, `list`, `update_status`, `plan_sprint`, `bulk_update_status`, `stats`
**Ref:** `src/core/planner/lifecycle-phase.ts` (heurísticas), `src/mcp/lifecycle-wrapper.ts` (wrapping)

Fases testadas: ANALYZE → DESIGN → PLAN → IMPLEMENT → VALIDATE → REVIEW

> **Nota:** HANDOFF e LISTENING não são detectados automaticamente por `detectCurrentPhase()`. As 6 fases abaixo cobrem 100% da detecção automática.

**Heurísticas:**
- ANALYZE: 0 nodes
- DESIGN: apenas nodes requirement/epic/decision/constraint/milestone/risk (sem tasks)
- PLAN: tasks existem mas sem sprint
- IMPLEMENT: qualquer task `in_progress`
- VALIDATE: 50%+ tasks done (com sprint)
- REVIEW: todas as tasks done

### Step 28.1: Init → ANALYZE

**Tool:** `init`
**Input:**
```json
{ "projectName": "lifecycle-test" }
```

**Expected:**
- `_lifecycle.phase == "ANALYZE"` (0 nodes)
- `suggestedNext: [import_prd, add_node, search]`
- `principles` inclui "PRD como contrato"

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 28.2: Add epic → DESIGN

**Tool:** `add_node`
**Input:**
```json
{ "type": "epic", "title": "Design Epic" }
```

**Captured:** `EPIC_ID` = _<capturar>_

**Expected:**
- `_lifecycle.phase == "DESIGN"` (apenas epic)
- `suggestedNext: [add_node, edge, decompose, export]`
- `principles` inclui "Skeleton & Organs"

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 28.3: Add requirement → DESIGN mantém

**Tool:** `add_node`
**Input:**
```json
{ "type": "requirement", "title": "Req 1" }
```

**Expected:**
- `_lifecycle.phase == "DESIGN"` (requirement + epic = design only types)
- `reminder` menciona "arquitetura"

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 28.4: Add task → PLAN

**Tool:** `add_node`
**Input:**
```json
{ "type": "task", "title": "Task A", "parentId": "<EPIC_ID>" }
```

**Captured:** `TASK_A_ID` = _<capturar>_

**Expected:**
- `_lifecycle.phase == "PLAN"` (task existe, sem sprint)
- `suggestedNext: [plan_sprint, decompose, sync_stack_docs, edge, dependencies]`

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 28.5: Add Task B

**Tool:** `add_node`
**Input:**
```json
{ "type": "task", "title": "Task B", "parentId": "<EPIC_ID>" }
```

**Captured:** `TASK_B_ID` = _<capturar>_

**Expected:**
- `_lifecycle.phase == "PLAN"`

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 28.6: Add Task C

**Tool:** `add_node`
**Input:**
```json
{ "type": "task", "title": "Task C", "parentId": "<EPIC_ID>" }
```

**Captured:** `TASK_C_ID` = _<capturar>_

**Expected:**
- `_lifecycle.phase == "PLAN"`

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 28.7: Add Task D

**Tool:** `add_node`
**Input:**
```json
{ "type": "task", "title": "Task D", "parentId": "<EPIC_ID>" }
```

**Captured:** `TASK_D_ID` = _<capturar>_

**Expected:**
- `_lifecycle.phase == "PLAN"`

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 28.8: Task A in_progress → IMPLEMENT

**Tool:** `update_status`
**Input:**
```json
{ "id": "<TASK_A_ID>", "status": "in_progress" }
```

**Expected:**
- `_lifecycle.phase == "IMPLEMENT"`
- `suggestedNext: [next, context, update_status, rag_context, validate_task]`
- `principles` inclui "TDD Red→Green→Refactor"
- `reminder` menciona "teste ANTES"

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 28.9: Task A done → PLAN (25% done, sem sprint)

**Tool:** `update_status`
**Input:**
```json
{ "id": "<TASK_A_ID>", "status": "done" }
```

**Expected:**
- `_lifecycle.phase == "PLAN"` (1/4 done = 25%, sem sprint → PLAN)

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 28.10: Sprint planning

**Tool:** `plan_sprint`
**Input:**
```json
{}
```

**Expected:**
- Atribui sprints
- `_lifecycle.phase` pode mudar conforme sprint assignment

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 28.11: Bulk update 3 tasks done → VALIDATE

**Tool:** `bulk_update_status`
**Input:**
```json
{ "ids": ["<TASK_A_ID>", "<TASK_B_ID>", "<TASK_C_ID>"], "status": "done" }
```

**Expected:**
- `_lifecycle.phase == "VALIDATE"` (3/4 done = 75% ≥ 50%, com sprint)
- `suggestedNext: [validate_task, velocity, stats, list]`
- `principles` inclui "Validação automatizada"
- `reminder` menciona "Playwright" e "E2E"

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 28.12: Last task done → REVIEW

**Tool:** `update_status`
**Input:**
```json
{ "id": "<TASK_D_ID>", "status": "done" }
```

**Expected:**
- `_lifecycle.phase == "REVIEW"` (4/4 done = 100%)
- `suggestedNext: [export, stats, velocity, dependencies]`
- `principles` inclui "Code review obrigatório", "Blast radius check", "Non-regression rule"

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 28.13: Stats confirma REVIEW

**Tool:** `stats`
**Input:**
```json
{}
```

**Expected:**
- `_lifecycle` block presente, `phase == "REVIEW"`

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 28.14: Verificar estrutura _lifecycle completa

**Tool:** Verify

**Expected:**
- `{ phase: string, reminder: string, suggestedNext: string[], principles: string[] }`
- Todos os campos preenchidos em PT-BR

**Actual:**
```

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

## Cenário 29: Dashboard Multi-Project Data Refresh (Playwright)

**Objetivo:** Confirmar que trocar de projeto atualiza TODOS os dados no dashboard sem data leakage.
**Tools cobertos:** `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_evaluate`, `browser_take_screenshot`
**Depende de:** Cenários 25-26 (2 projetos com dados diferentes)
**Ref:** `src/web/dashboard/src/providers/project-provider.tsx`

### Step 29.1: Navegar para o dashboard

**Tool:** `browser_navigate`
**Input:**
```json
{ "url": "http://localhost:3377" }
```

**Expected:**
- Dashboard carrega

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 29.2: Anotar dados do projeto ativo

**Tool:** `browser_snapshot`

**Expected:**
- Anotar node count do projeto ativo

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 29.3: Trocar para projeto com dados diferentes

**Tool:** `browser_click`
**Input:**
```json
{ "element": "ProjectSelector → projeto diferente", "ref": "<ref>" }
```

**Expected:**
- Dashboard atualiza

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 29.4: Verificar dados mudaram

**Tool:** `browser_snapshot`

**Expected:**
- Node count diferente do step 29.2 (isolamento confirmado)

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 29.5: Verificar Insights tab com dados corretos

**Tool:** `browser_click`
**Input:**
```json
{ "element": "Insights tab", "ref": "<ref>" }
```

**Expected:**
- Cards de métricas refletem dados do projeto ativo (não do anterior)

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 29.6: Voltar ao projeto anterior

**Tool:** `browser_click`
**Input:**
```json
{ "element": "ProjectSelector → projeto anterior", "ref": "<ref>" }
```

**Expected:**
- Dados restauram ao original

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 29.7: Screenshot final

**Tool:** `browser_take_screenshot`

**Expected:**
- Evidência final

**Actual:**
```
[screenshot path]
```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

## Cenário 30: Integration Mesh — Orquestração dos 5 MCPs

**Objetivo:** Validar que os 5 MCPs (mcp-graph, Serena, GitNexus, Context7, Playwright) funcionam em conjunto, que o EventBus dispara eventos corretos, e que o IntegrationOrchestrator reage a eles.
**Tools cobertos:** `init`, `import_prd`, `reindex_knowledge`, `sync_stack_docs`, `validate_task`, `search`, `rag_context`, `stats`
**Ref:** `src/core/integrations/integration-orchestrator.ts`, `src/core/events/event-types.ts`, `src/core/integrations/tool-status.ts`

> **Eventos validados:** `import:completed` → reindex automático, `knowledge:indexed` → tracking, `capture:completed` → index no Knowledge Store

### Step 30.1: Inicializar projeto

**Tool:** `init`
**Input:**
```json
{ "projectName": "mesh-test" }
```

**Expected:**
- `ok: true`

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 30.2: Import PRD → Event import:completed

**Tool:** `import_prd`
**Input:**
```json
{ "filePath": "./sample-prd.txt" }
```

**Expected:**
- `nodesCreated > 0`, `edgesCreated > 0`
- **Event `import:completed` disparado** → deve triggerar reindex automático

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 30.3: Busca pós-import

**Tool:** `search`
**Input:**
```json
{ "query": "autenticação" }
```

**Expected:**
- Busca FTS5+BM25 funciona pós-import
- Resultados rankeados por relevância

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 30.4: Sync stack docs → Context7

**Tool:** `sync_stack_docs`
**Input:**
```json
{ "libraries": ["zod"] }
```

**Expected:**
- **Context7 integração**: resolve library ID → query docs → cache
- `librariesProcessed` inclui "zod"
- **Indexa docs no Knowledge Store** (`sourceType: "docs"`)

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 30.5: Reindex Serena memories

**Tool:** `reindex_knowledge`
**Input:**
```json
{ "sources": ["serena"] }
```

**Expected:**
- **Serena integração**: lê `.serena/memories/`, indexa no Knowledge Store (`sourceType: "serena"`)
- Retorna contagem de docs indexados

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 30.6: Rebuild embeddings

**Tool:** `reindex_knowledge`
**Input:**
```json
{ "sources": ["embeddings"] }
```

**Expected:**
- **Embedding pipeline**: rebuild TF-IDF com vocabulário unificado (nodes + knowledge docs)
- Retorna contagem de embeddings

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 30.7: Validate task → Playwright capture

**Tool:** `validate_task`
**Input:**
```json
{ "url": "http://localhost:3377" }
```

**Expected:**
- **Playwright integração**: captura página, extrai conteúdo
- **Auto-indexa no Knowledge Store** (`sourceType: "web_capture"`, `sourceId: "capture:http://localhost:3377"`)
- Retorna `wordCount`, `title`

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 30.8: RAG pipeline completo

**Tool:** `rag_context`
**Input:**
```json
{ "query": "dashboard", "tokenBudget": 4000 }
```

**Expected:**
- **RAG pipeline completo**: busca semântica em TODAS as fontes (graph + serena + docs + web_capture)
- Context montado com budget 60/30/10
- `tokenUsage.used <= 4000`

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 30.9: Stats finais

**Tool:** `stats`
**Input:**
```json
{}
```

**Expected:**
- Stats refletem todos os dados: nodes do PRD + knowledge de múltiplas fontes

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

## Cenário 31: Knowledge Pipeline — 5 Source Types + Tiered Context + Budget

**Objetivo:** Validar que o Knowledge Store suporta todos os 5 source types, que o tiered context gera os 3 níveis corretos (summary/standard/deep), e que o budget allocation 60/30/10 é respeitado.
**Tools cobertos:** `rag_context`, `search`, `reindex_knowledge`, `context`
**Ref:** `src/core/context/context-assembler.ts` (budget 60/30/10), `src/core/context/tiered-context.ts` (3 tiers), `src/schemas/knowledge.schema.ts` (5 source types)

> **5 Source Types:** `upload`, `serena`, `code_context`, `docs`, `web_capture`
> **3 Tiers:** summary (~20 tokens/node), standard (~150 tokens/node), deep (~500+ tokens/node)
> **Budget:** 60% graph, 30% knowledge, 10% overhead

### Step 31.1: RAG summary tier

**Tool:** `rag_context`
**Input:**
```json
{ "query": "login", "tokenBudget": 2000, "detail": "summary" }
```

**Expected:**
- **Tier summary**: contexto compacto (~20 tokens/node)
- `tokenUsage.used <= 2000`
- Inclui IDs, tipos, títulos, status

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 31.2: RAG standard tier

**Tool:** `rag_context`
**Input:**
```json
{ "query": "login", "tokenBudget": 2000, "detail": "standard" }
```

**Expected:**
- **Tier standard**: contexto médio (~150 tokens/node)
- `tokenUsage.used <= 2000`
- Inclui parent, children, blockers, deps, AC

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 31.3: RAG deep tier

**Tool:** `rag_context`
**Input:**
```json
{ "query": "login", "tokenBudget": 8000, "detail": "deep" }
```

**Expected:**
- **Tier deep**: contexto completo (~500+ tokens/node)
- Inclui knowledge snippets BM25-ranked
- `tokenUsage.used <= 8000`

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 31.4: Comparar tokens dos 3 tiers

**Tool:** Verify

**Expected:**
- `tokens_summary < tokens_standard < tokens_deep`
- Deep inclui snippets que summary/standard não têm

**Actual:**
```

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 31.5: Verificar budget allocation

**Tool:** `rag_context`
**Input:**
```json
{ "query": "dashboard", "tokenBudget": 4000 }
```

**Expected:**
- **Budget allocation**: `tokenUsage.breakdown` mostra `graph` (~60% de 4000 = ~2400) e `knowledge` (~30% de 4000 = ~1200)
- Total `used <= 4000`

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 31.6: Compact context com métricas

**Tool:** `context`
**Input:**
```json
{ "id": "<ANY_TASK_ID>" }
```

**Expected:**
- **Compact context**: retorna `TaskContext` com `metrics.reductionPercent` (esperado ~70-85%)
- Inclui parent, children, blockers, dependsOn, acceptanceCriteria, sourceRef

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 31.7: BM25 + TF-IDF rerank

**Tool:** `search`
**Input:**
```json
{ "query": "autenticação", "rerank": true }
```

**Expected:**
- **BM25 + TF-IDF rerank**: resultados com scores
- Ordem pode diferir de busca sem rerank

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 31.8: Busca multi-source

**Tool:** `search`
**Input:**
```json
{ "query": "zod validation" }
```

**Expected:**
- Busca retorna resultados de **múltiplas fontes** (nodes do PRD + docs do Context7 se disponíveis)

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

## Cenário 32: REVIEW Phase — Blast Radius + Serena + Code Review

**Objetivo:** Validar o fluxo completo da Fase 6 (REVIEW) do LIFECYCLE.md: blast radius check via GitNexus, referências via Serena, e verificação de qualidade.
**Tools cobertos:** MCP tools + Serena + GitNexus (integrations diretas)
**Ref:** `src/core/integrations/enriched-context.ts`, `src/core/integrations/tool-status.ts`

> **Nota:** Requer GitNexus e Serena configurados. Marcar SKIP se indisponíveis.

### Step 32.1: Verificar fase REVIEW

**Tool:** `stats`
**Input:**
```json
{}
```

**Expected:**
- Verificar que estamos na fase REVIEW (`_lifecycle.phase == "REVIEW"`) ou preparar grafo para review

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 32.2: Serena — symbols overview do store

**Tool:** Serena `get_symbols_overview`
**Input:** `src/core/store/`

**Expected:**
- Retorna symbols do módulo store: SqliteStore, métodos, etc.

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 32.3: Serena — referências ao SqliteStore

**Tool:** Serena `find_referencing_symbols`
**Input:** `SqliteStore`

**Expected:**
- Lista de referências: quantos módulos importam SqliteStore, quais arquivos

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 32.4: Serena — overview da classe SqliteStore

**Tool:** Serena `find_symbol`
**Input:** `SqliteStore`, include_body=false, depth=1

**Expected:**
- Overview da classe: métodos públicos, sem body
- Confirma API pública

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 32.5: GitNexus — blast radius

**Tool:** GitNexus `gitnexus_impact`
**Input:** `{ target: "SqliteStore", direction: "upstream" }`

**Expected:**
- **Blast radius**: d=1 (WILL BREAK), d=2 (LIKELY AFFECTED), d=3 (MAY NEED TESTING)
- Risk level retornado

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 32.6: GitNexus — detect changes

**Tool:** GitNexus `gitnexus_detect_changes`
**Input:** `{ scope: "all" }`

**Expected:**
- Detecta arquivos modificados na branch atual
- Confirma que mudanças são esperadas

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 32.7: Export para review visual

**Tool:** `export`
**Input:**
```json
{ "action": "mermaid" }
```

**Expected:**
- Exporta grafo para visualização
- Mermaid válido para review visual

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 32.8: Code review checklist

**Tool:** Verify

**Expected:**
1. Callers de symbols modificados tratam erros?
2. Logs estruturados em paths críticos?
3. Sem segredos em logs?
4. AC atendidos?
5. `_lifecycle.principles` inclui "Blast radius check"?

**Actual:**
```

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

## Cenário 33: Hierarquia Completa de Nós — 9 Tipos + 8 Relações

**Objetivo:** Validar criação de TODOS os 9 tipos de nó e TODOS os 8 tipos de edge, confirmando que o modelo de dados do LIFECYCLE.md é completamente suportado.
**Tools cobertos:** `init`, `add_node`, `edge`, `show`, `list`, `export`
**Ref:** `src/core/graph/graph-types.ts` (NodeType, RelationType), `src/schemas/node.schema.ts`, `src/schemas/edge.schema.ts`

> **9 Tipos de Nó:** epic, task, subtask, requirement, constraint, milestone, acceptance_criteria, risk, decision
> **8 Tipos de Edge:** parent_of, child_of, depends_on, blocks, related_to, priority_over, implements, derived_from

### Step 33.1: Inicializar projeto

**Tool:** `init`
**Input:**
```json
{ "projectName": "hierarchy-test" }
```

**Expected:**
- `ok: true`

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 33.2: Criar epic

**Tool:** `add_node`
**Input:**
```json
{ "type": "epic", "title": "Epic Principal" }
```

**Captured:** `EPIC_ID` = _<capturar>_

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 33.3: Criar requirement

**Tool:** `add_node`
**Input:**
```json
{ "type": "requirement", "title": "Req: Sistema deve autenticar" }
```

**Captured:** `REQ_ID` = _<capturar>_

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 33.4: Criar decision

**Tool:** `add_node`
**Input:**
```json
{ "type": "decision", "title": "ADR: Usar JWT" }
```

**Captured:** `DEC_ID` = _<capturar>_

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 33.5: Criar constraint

**Tool:** `add_node`
**Input:**
```json
{ "type": "constraint", "title": "Constraint: Sem dependências externas" }
```

**Captured:** `CON_ID` = _<capturar>_

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 33.6: Criar milestone

**Tool:** `add_node`
**Input:**
```json
{ "type": "milestone", "title": "Milestone: MVP Auth" }
```

**Captured:** `MIL_ID` = _<capturar>_

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 33.7: Criar risk

**Tool:** `add_node`
**Input:**
```json
{ "type": "risk", "title": "Risk: Token expiration sem refresh" }
```

**Captured:** `RISK_ID` = _<capturar>_

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 33.8: Criar task

**Tool:** `add_node`
**Input:**
```json
{ "type": "task", "title": "Task: Implementar login", "parentId": "<EPIC_ID>" }
```

**Captured:** `TASK_ID` = _<capturar>_

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 33.9: Criar subtask

**Tool:** `add_node`
**Input:**
```json
{ "type": "subtask", "title": "Subtask: Criar endpoint /auth/login", "parentId": "<TASK_ID>" }
```

**Captured:** `SUB_ID` = _<capturar>_

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 33.10: Criar acceptance_criteria

**Tool:** `add_node`
**Input:**
```json
{ "type": "acceptance_criteria", "title": "AC: Retorna JWT com exp 1h" }
```

**Captured:** `AC_ID` = _<capturar>_

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 33.11: Listar todos — 9 tipos

**Tool:** `list`
**Input:**
```json
{}
```

**Expected:**
- **9 nós criados**, cada um com tipo correto
- Todos aparecem na lista

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 33.12: Edge — implements

**Tool:** `edge`
**Input:**
```json
{ "action": "add", "from": "<TASK_ID>", "to": "<REQ_ID>", "relationType": "implements" }
```

**Expected:**
- Edge criada: task implements requirement

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 33.13: Edge — derived_from

**Tool:** `edge`
**Input:**
```json
{ "action": "add", "from": "<DEC_ID>", "to": "<REQ_ID>", "relationType": "derived_from" }
```

**Expected:**
- Edge: decision derived_from requirement

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 33.14: Edge — depends_on

**Tool:** `edge`
**Input:**
```json
{ "action": "add", "from": "<SUB_ID>", "to": "<TASK_ID>", "relationType": "depends_on" }
```

**Expected:**
- Edge: subtask depends_on task

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 33.15: Edge — blocks

**Tool:** `edge`
**Input:**
```json
{ "action": "add", "from": "<TASK_ID>", "to": "<SUB_ID>", "relationType": "blocks" }
```

**Expected:**
- Edge: task blocks subtask

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 33.16: Edge — related_to

**Tool:** `edge`
**Input:**
```json
{ "action": "add", "from": "<RISK_ID>", "to": "<TASK_ID>", "relationType": "related_to" }
```

**Expected:**
- Edge: risk related_to task

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 33.17: Edge — parent_of

**Tool:** `edge`
**Input:**
```json
{ "action": "add", "from": "<EPIC_ID>", "to": "<TASK_ID>", "relationType": "parent_of" }
```

**Expected:**
- Edge: epic parent_of task

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 33.18: Edge — child_of

**Tool:** `edge`
**Input:**
```json
{ "action": "add", "from": "<TASK_ID>", "to": "<EPIC_ID>", "relationType": "child_of" }
```

**Expected:**
- Edge: task child_of epic

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 33.19: Edge — priority_over

**Tool:** `edge`
**Input:**
```json
{ "action": "add", "from": "<TASK_ID>", "to": "<MIL_ID>", "relationType": "priority_over" }
```

**Expected:**
- Edge: task priority_over milestone

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 33.20: Show task com todas as relações

**Tool:** `show`
**Input:**
```json
{ "id": "<TASK_ID>" }
```

**Expected:**
- Task mostra TODAS as relações: implements, depends_on, blocks, related_to, parent_of, child_of, priority_over
- Children inclui subtask

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 33.21: Export Mermaid com todos os tipos

**Tool:** `export`
**Input:**
```json
{ "action": "mermaid" }
```

**Expected:**
- Diagrama Mermaid com 9 nós e 8 edges de tipos diferentes
- Grafo válido

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 33.22: Export JSON com todos os tipos

**Tool:** `export`
**Input:**
```json
{ "action": "json" }
```

**Expected:**
- JSON com `nodes[9]` e `edges[8]`, todos os tipos presentes

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

## Cenário 34: VALIDATE — Pirâmide de Testes + TDD + Definition of Done

**Objetivo:** Validar o fluxo da Fase 5 (VALIDATE) do LIFECYCLE.md — executar pirâmide de testes (unit, integration, smoke, E2E) e confirmar Definition of Done.
**Ref:** `docs/LIFECYCLE.md` Fase 5 + CLAUDE.md "Testing & Quality Methodology"

> **Pirâmide de Testes:** Unit (Vitest) → Integration (in-memory SQLite) → E2E (Playwright) → Smoke (CLI/dashboard)
> **Mock Data Policy:** In-memory SQLite para store tests, factory functions mínimas, mock ONLY de boundaries externas
> **Definition of Done:** TDD → Tests → AC → Build+TypeCheck+Lint → Logger

### Step 34.1: Unit tests

**Tool:** Manual/Bash — `npm test 2>&1 | tail -10`

**Expected:**
- **Unit tests passam** — `885+ passed`, zero falhas novas (5 ambientais OK)

**Actual:**
```

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 34.2: Build

**Tool:** Manual/Bash — `npm run build`

**Expected:**
- **Build passa** — `tsc` compila sem erros

**Actual:**
```

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 34.3: Linter

**Tool:** Manual/Bash — `npm run lint`

**Expected:**
- **Linter passa** — sem novas violações

**Actual:**
```

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 34.4: Verificar TDD para features recentes

**Tool:** Verify

**Expected:**
- Confirmar tests existem ANTES da implementação:
  - `ai-memory-generator.test.ts` (7 testes)
  - `lifecycle-phase.test.ts` (10 testes)
  - `lifecycle-wrapper.test.ts` (3 testes)
  - `multi-project.test.ts` (10 testes)
  - `store-migration.test.ts` (4 testes)

**Actual:**
```

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 34.5: Verificar arrange-act-assert

**Tool:** Verify

**Expected:**
- Abrir `lifecycle-phase.test.ts`: cada `it()` tem setup (arrange), call (act), expect (assert) claros

**Actual:**
```

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 34.6: Verificar mock data policy

**Tool:** Verify

**Expected:**
- Unit tests usam `:memory:` SQLite
- Nenhum mock desnecessário de módulos internos
- Factory functions criam 1 objeto mínimo

**Actual:**
```

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 34.7: Verificar integration tests

**Tool:** Verify

**Expected:**
- `multi-project.test.ts` usa real SqliteStore com `:memory:`
- `store-migration.test.ts` usa temp dirs reais

**Actual:**
```

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 34.8: Smoke E2E via validate_task

**Tool:** `validate_task`
**Input:**
```json
{ "url": "http://localhost:3377" }
```

**Expected:**
- **Smoke E2E**: Dashboard renderiza sem erros
- `wordCount > 0`, `title` presente

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 34.9: Definition of Done checklist

**Tool:** Verify

**Expected:**
- ✅ TDD test ANTES?
- ✅ Todos os testes passam?
- ✅ AC atendidos?
- ✅ Build+TypeCheck+Lint?
- ✅ Logger em paths críticos?

**Actual:**
```

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

## Cenário 35: Smoke Test Completo + E2E Browser + Console Errors

**Objetivo:** Executar smoke tests de TODAS as tabs do dashboard e validação E2E via Playwright, seguindo skills do LIFECYCLE: `playwright-explore-website` → `playwright-generate-test` → `playwright-tester-mode`.
**Tools cobertos:** `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_evaluate`, `browser_console_messages`, `browser_take_screenshot`, `validate_task`
**Ref:** `docs/LIFECYCLE.md` Fase 5 — Skills em sequência

### Step 35.1: Navegar para o dashboard

**Tool:** `browser_navigate`
**Input:**
```json
{ "url": "http://localhost:3377" }
```

**Expected:**
- Dashboard carrega sem erros JS

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 35.2: Verificar console limpo

**Tool:** `browser_console_messages`
**Input:**
```json
{}
```

**Expected:**
- **Zero erros** no console
- Nenhum `Uncaught`, `TypeError`, `NetworkError`

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 35.3: Snapshot do header

**Tool:** `browser_snapshot`

**Expected:**
- Header renderiza: título, stats badge, tabs navegáveis

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 35.4: Graph tab

**Tool:** `browser_click`
**Input:**
```json
{ "element": "Graph tab", "ref": "<ref>" }
```

**Expected:**
- ReactFlow canvas renderiza, tabela de nodes presente

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 35.5: PRD & Backlog tab

**Tool:** `browser_click`
**Input:**
```json
{ "element": "PRD & Backlog tab", "ref": "<ref>" }
```

**Expected:**
- Split-pane layout, progress bar visível

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 35.6: Insights tab

**Tool:** `browser_click`
**Input:**
```json
{ "element": "Insights tab", "ref": "<ref>" }
```

**Expected:**
- Cards: Total Tasks, Completion %, Completed, Avg Points — valores > 0

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 35.7: Benchmark tab

**Tool:** `browser_click`
**Input:**
```json
{ "element": "Benchmark tab", "ref": "<ref>" }
```

**Expected:**
- Token Economy cards, compression bars

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 35.8: Code Graph tab

**Tool:** `browser_click`
**Input:**
```json
{ "element": "Code Graph tab", "ref": "<ref>" }
```

**Expected:**
- Badges de integração, 3 modos (Explorer/Query/Symbol)

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 35.9: API stats funciona

**Tool:** `browser_evaluate`
**Input:**
```javascript
await fetch('/api/v1/stats').then(r => r.json())
```

**Expected:**
- API funciona: response 200 com `totalNodes`, `totalEdges`, `projectName`

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 35.10: API nodes funciona

**Tool:** `browser_evaluate`
**Input:**
```javascript
await fetch('/api/v1/nodes').then(r => r.json())
```

**Expected:**
- CRUD API funciona: response 200 com array de nodes

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 35.11: validate_task captura

**Tool:** `validate_task`
**Input:**
```json
{ "url": "http://localhost:3377" }
```

**Expected:**
- validate_task funciona: captura, extrai, indexa no Knowledge Store

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 35.12: validate_task A/B comparison

**Tool:** `validate_task`
**Input:**
```json
{ "url": "http://localhost:3377", "compareUrl": "http://localhost:3377/#insights" }
```

**Expected:**
- **A/B comparison**: diff entre 2 URLs
- Comparison report com `wordCountDelta`, `lengthDelta`

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 35.13: Console final limpo

**Tool:** `browser_console_messages`
**Input:**
```json
{}
```

**Expected:**
- Verificação final: nenhum novo erro após navegação completa

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 35.14: Screenshot final

**Tool:** `browser_take_screenshot`

**Expected:**
- Screenshot final de evidência

**Actual:**
```
[screenshot path]
```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

## Checklist de Verificação Final — Parte 3

Após rodar todos os cenários:

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

## Cobertura de Tools — Parte 3

### MCP Tools

| Tool | Cenários |
|------|----------|
| `init` | 25, 27, 28, 30, 33 |
| `add_node` | 25, 28, 33 |
| `list` | 25, 28, 33 |
| `stats` | 25, 27, 28, 30, 32, 34 |
| `update_status` | 28 |
| `plan_sprint` | 28 |
| `bulk_update_status` | 28 |
| `import_prd` | 30 |
| `search` | 30, 31 |
| `rag_context` | 30, 31 |
| `reindex_knowledge` | 30 |
| `sync_stack_docs` | 30 |
| `validate_task` | 30, 34, 35 |
| `context` | 31 |
| `edge` | 33 |
| `show` | 33 |
| `export` | 32, 33 |

### Playwright Tools

| Tool | Cenários |
|------|----------|
| `browser_navigate` | 26, 29, 35 |
| `browser_evaluate` | 26, 27, 29, 35 |
| `browser_snapshot` | 26, 29, 35 |
| `browser_click` | 26, 29, 35 |
| `browser_take_screenshot` | 26, 29, 35 |
| `browser_console_messages` | 35 |

### Serena + GitNexus (Cenário 32)

| Tool | Cenário |
|------|---------|
| `get_symbols_overview` | 32 |
| `find_referencing_symbols` | 32 |
| `find_symbol` | 32 |
| `gitnexus_impact` | 32 |
| `gitnexus_detect_changes` | 32 |

### Features/Metodologia Cobertos

| Feature | Cenário(s) |
|---------|------------|
| Multi-project isolamento | 25 |
| Multi-project REST API | 26 |
| Multi-project Dashboard UI | 26, 29 |
| Store directory `workflow-graph/` | 27 |
| AI memory generation (idempotente) | 27 |
| Lifecycle ANALYZE | 28 |
| Lifecycle DESIGN | 28 |
| Lifecycle PLAN | 28 |
| Lifecycle IMPLEMENT | 28 |
| Lifecycle VALIDATE | 28 |
| Lifecycle REVIEW | 28 |
| `_lifecycle` block + suggestedTools + principles | 28 |
| EventBus: import:completed → reindex | 30 |
| IntegrationOrchestrator | 30 |
| Serena memories indexing | 30 |
| Context7 docs sync | 30 |
| Playwright capture + Knowledge Store index | 30 |
| RAG pipeline end-to-end | 30 |
| Knowledge 5 source types | 31 |
| Tiered context (summary/standard/deep) | 31 |
| Budget allocation 60/30/10 | 31 |
| BM25 + TF-IDF rerank | 31 |
| Compact context compression 70-85% | 31 |
| Blast radius check (GitNexus) | 32 |
| Serena find_referencing_symbols | 32 |
| Code review checklist | 32 |
| 9 tipos de nó | 33 |
| 8 tipos de edge | 33 |
| Hierarquia PRD→epic→task→subtask | 33 |
| Pirâmide de testes | 34 |
| TDD Red→Green→Refactor | 34 |
| Mock data policy | 34 |
| Definition of Done | 34 |
| Smoke test todas as tabs | 35 |
| E2E validate_task A/B comparison | 35 |
| Console errors zero tolerance | 35 |
