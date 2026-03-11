# Caderno de Testes Reais — mcp-graph MCP Tools

> 12 cenários, ~73 steps, 25/25 consolidated tools cobertos (100%) + 3 Playwright MCP tools

**Instruções:** Execute cada step sequencialmente. Capture IDs retornados e substitua nos placeholders `<ID>` dos steps seguintes. Cole o output real no campo "Actual" e marque o resultado.

---

## Cenário 1: Lifecycle Completo (Happy Path)

**Objetivo:** Validar o fluxo principal — da inicialização até sprint planning.
**Tools cobertos:** `init`, `import_prd`, `stats`, `list`, `next`, `context`, `update_status`, `plan_sprint`

### Step 1.1: Inicializar projeto

**Tool:** `init`
**Input:**
```json
{ "projectName": "benchmark" }
```

**Expected:**
- `ok: true`
- Retorna project com nome "benchmark"

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 1.2: Importar PRD

**Tool:** `import_prd`
**Depende de:** Step 1.1

**Input:**
```json
{ "filePath": "./sample-prd.txt" }
```

**Expected:**
- `nodesCreated > 0`
- `edgesCreated > 0`
- Deve gerar nós para os 2 epics e 6 tasks

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 1.3: Verificar estatísticas

**Tool:** `stats`
**Depende de:** Step 1.2

**Input:**
```json
{}
```

**Expected:**
- `totalNodes > 0`
- `projectName` = "benchmark"
- Distribuição de status mostra nodes em "backlog"

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 1.4: Listar todos os nós

**Tool:** `list`
**Depende de:** Step 1.2

**Input:**
```json
{}
```

**Expected:**
- Retorna array de nós
- Inclui epics e tasks do PRD importado
- Cada nó tem id, title, type, status

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 1.5: Obter próxima task recomendada

**Tool:** `next`
**Depende de:** Step 1.2

**Input:**
```json
{}
```

**Expected:**
- Retorna nó sugerido com `reason`
- Task retornada deve ser uma sem dependências bloqueantes (ex: Task 1.1)

**Captured:** `NEXT_TASK_ID` = _<capturar do output>_

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 1.6: Obter contexto compacto da task

**Tool:** `context`
**Depende de:** Step 1.5 (usa `NEXT_TASK_ID`)

**Input:**
```json
{ "id": "<NEXT_TASK_ID>" }
```

**Expected:**
- Retorna contexto com parent, children, dependencies
- Inclui `metrics.reductionPercent`
- Inclui acceptance criteria se disponíveis

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 1.7: Mover task para in_progress

**Tool:** `update_status`
**Depende de:** Step 1.5 (usa `NEXT_TASK_ID`)

**Input:**
```json
{ "id": "<NEXT_TASK_ID>", "status": "in_progress" }
```

**Expected:**
- `ok: true`
- Status alterado para "in_progress"

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 1.8: Concluir task

**Tool:** `update_status`
**Depende de:** Step 1.7 (usa `NEXT_TASK_ID`)

**Input:**
```json
{ "id": "<NEXT_TASK_ID>", "status": "done" }
```

**Expected:**
- `ok: true`
- Status = "done"

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 1.9: Verificar stats após conclusão

**Tool:** `stats`
**Depende de:** Step 1.8

**Input:**
```json
{}
```

**Expected:**
- Contagem de "done" incrementou vs Step 1.3
- totalNodes inalterado

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 1.10: Gerar sprint planning report

**Tool:** `plan_sprint`
**Depende de:** Step 1.8

**Input:**
```json
{}
```

**Expected:**
- Retorna planning report
- Inclui task order, velocity info

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

## Cenário 2: Graph CRUD

**Objetivo:** Validar operações de criação, leitura, atualização e remoção de nós e edges.
**Tools cobertos:** `add_node`, `show`, `update_node`, `add_edge`, `list_edges`, `delete_edge`, `delete_node`

### Step 2.1: Criar epic

**Tool:** `add_node`

**Input:**
```json
{ "type": "epic", "title": "Test Epic CRUD", "priority": 1, "description": "Epic para testes de CRUD" }
```

**Expected:**
- `ok: true`
- ID gerado retornado

**Captured:** `EPIC_ID` = _<capturar>_

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 2.2: Criar task filha do epic

**Tool:** `add_node`
**Depende de:** Step 2.1 (usa `EPIC_ID`)

**Input:**
```json
{ "type": "task", "title": "CRUD Child Task", "parentId": "<EPIC_ID>", "priority": 2, "xpSize": "S" }
```

**Expected:**
- `ok: true`
- parentId = `EPIC_ID`

**Captured:** `TASK_ID` = _<capturar>_

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 2.3: Mostrar epic com filhos

**Tool:** `show`
**Depende de:** Step 2.2 (usa `EPIC_ID`)

**Input:**
```json
{ "id": "<EPIC_ID>" }
```

**Expected:**
- Retorna detalhes do epic
- children inclui `TASK_ID`

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 2.4: Atualizar task

**Tool:** `update_node`
**Depende de:** Step 2.2 (usa `TASK_ID`)

**Input:**
```json
{ "id": "<TASK_ID>", "title": "Updated CRUD Task", "tags": ["test", "crud"], "xpSize": "M" }
```

**Expected:**
- `ok: true`
- title, tags e xpSize atualizados

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 2.5: Criar edge entre nós

**Tool:** `add_edge`
**Depende de:** Step 2.2 (usa `TASK_ID` e um nó do PRD import)

**Input:**
```json
{ "from": "<TASK_ID>", "to": "<ANY_PRD_NODE_ID>", "relationType": "depends_on", "reason": "Teste de dependência" }
```

**Expected:**
- `ok: true`
- Edge retornada com ID

**Captured:** `EDGE_ID` = _<capturar>_

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 2.6: Listar edges do nó

**Tool:** `list_edges`
**Depende de:** Step 2.5 (usa `TASK_ID`)

**Input:**
```json
{ "nodeId": "<TASK_ID>" }
```

**Expected:**
- Retorna array com pelo menos 1 edge
- Edge criada no step 2.5 presente

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 2.7: Deletar edge

**Tool:** `delete_edge`
**Depende de:** Step 2.6 (usa `EDGE_ID`)

**Input:**
```json
{ "id": "<EDGE_ID>" }
```

**Expected:**
- `ok: true`

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 2.8: Verificar edge removida

**Tool:** `list_edges`
**Depende de:** Step 2.7 (usa `TASK_ID`)

**Input:**
```json
{ "nodeId": "<TASK_ID>" }
```

**Expected:**
- Edge deletada no step 2.7 NÃO aparece mais
- Apenas edges parent_of/child_of restantes (se houver)

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 2.9: Deletar nó

**Tool:** `delete_node`
**Depende de:** Step 2.2 (usa `TASK_ID`)

**Input:**
```json
{ "id": "<TASK_ID>" }
```

**Expected:**
- `ok: true`

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 2.10: Verificar nó deletado

**Tool:** `show`
**Depende de:** Step 2.9 (usa `TASK_ID`)

**Input:**
```json
{ "id": "<TASK_ID>" }
```

**Expected:**
- `isError: true` ou mensagem de "not found"

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

## Cenário 3: Search & RAG

**Objetivo:** Validar busca full-text (BM25) e construção de contexto RAG em diferentes tiers.
**Tools cobertos:** `search`, `rag_context`

### Step 3.1: Busca BM25 simples

**Tool:** `search`
**Depende de:** Cenário 1 (grafo populado)

**Input:**
```json
{ "query": "autenticação", "limit": 5 }
```

**Expected:**
- Retorna resultados com scores BM25
- Nós do Epic 1 (Autenticação) rankeados no topo

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 3.2: Busca com rerank TF-IDF

**Tool:** `search`

**Input:**
```json
{ "query": "autenticação", "limit": 5, "rerank": true }
```

**Expected:**
- Resultados rerankeados via TF-IDF
- Ordem pode diferir do step 3.1

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 3.3: RAG context — standard

**Tool:** `rag_context`

**Input:**
```json
{ "query": "login", "tokenBudget": 2000 }
```

**Expected:**
- Retorna context dentro do token budget
- Inclui nós relevantes sobre login/autenticação

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 3.4: RAG context — summary tier

**Tool:** `rag_context`

**Input:**
```json
{ "query": "login", "tokenBudget": 2000, "detail": "summary" }
```

**Expected:**
- Tier summary — contexto mais compacto que standard
- Dentro do token budget

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 3.5: RAG context — deep tier

**Tool:** `rag_context`

**Input:**
```json
{ "query": "login", "tokenBudget": 8000, "detail": "deep" }
```

**Expected:**
- Tier deep — mais detalhes que standard
- Inclui acceptance criteria, dependencies, descriptions completas

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

## Cenário 4: Knowledge Pipeline

**Objetivo:** Validar reindexação de knowledge e integração com busca/RAG.
**Tools cobertos:** `reindex_knowledge`, `search`, `rag_context`

### Step 4.1: Reindexar embeddings

**Tool:** `reindex_knowledge`

**Input:**
```json
{ "sources": ["embeddings"] }
```

**Expected:**
- Retorna resultado com contagem de embeddings processados
- Sem erros

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 4.2: Busca após reindex

**Tool:** `search`

**Input:**
```json
{ "query": "dashboard métricas" }
```

**Expected:**
- Retorna resultados relevantes (Epic 2 / tasks de dashboard)

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 4.3: RAG após reindex

**Tool:** `rag_context`

**Input:**
```json
{ "query": "burndown chart" }
```

**Expected:**
- Contexto RAG funcional com nós sobre burndown/dashboard

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

## Cenário 5: Planning

**Objetivo:** Validar decomposição, análise de dependências, velocidade e sprint planning.
**Tools cobertos:** `decompose`, `dependencies`, `velocity`, `plan_sprint`, `add_node`

### Step 5.1: Decompose — scan geral

**Tool:** `decompose`

**Input:**
```json
{}
```

**Expected:**
- Retorna lista de tasks candidatas à decomposição
- Tasks XL ou sem subtasks podem aparecer

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 5.2: Criar task XL

**Tool:** `add_node`

**Input:**
```json
{ "type": "task", "title": "Mega Task para Decomposição", "xpSize": "XL", "estimateMinutes": 480, "description": "Task intencionalmente grande para testar decompose" }
```

**Captured:** `XL_TASK_ID` = _<capturar>_

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 5.3: Decompose — task específica

**Tool:** `decompose`
**Depende de:** Step 5.2 (usa `XL_TASK_ID`)

**Input:**
```json
{ "nodeId": "<XL_TASK_ID>" }
```

**Expected:**
- Detecta task XL como candidata à decomposição
- Sugere subtasks ou indica que é grande demais

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 5.4: Análise de ciclos

**Tool:** `dependencies`

**Input:**
```json
{ "mode": "cycles" }
```

**Expected:**
- `cycles` array retornado
- Vazio = sem ciclos (esperado para o PRD importado)

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 5.5: Caminho crítico

**Tool:** `dependencies`

**Input:**
```json
{ "mode": "critical_path" }
```

**Expected:**
- `criticalPath` array retornado
- Cadeia de dependências mais longa identificada

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 5.6: Velocity

**Tool:** `velocity`

**Input:**
```json
{}
```

**Expected:**
- Métricas de velocidade retornadas
- Inclui dados do sprint atual (mesmo que parciais)

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 5.7: Sprint planning — report

**Tool:** `plan_sprint`

**Input:**
```json
{ "mode": "report" }
```

**Expected:**
- Planning report completo
- Inclui task order, risk assessment, velocity estimates

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 5.8: Sprint planning — next

**Tool:** `plan_sprint`

**Input:**
```json
{ "mode": "next" }
```

**Expected:**
- Enhanced next task com knowledge coverage
- Diferente do `next` simples — inclui mais contexto

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

## Cenário 6: Snapshots

**Objetivo:** Validar criação, listagem e restauração de snapshots do grafo.
**Tools cobertos:** `create_snapshot`, `list_snapshots`, `restore_snapshot`, `stats`, `add_node`, `list`

### Step 6.1: Criar snapshot

**Tool:** `create_snapshot`

**Input:**
```json
{}
```

**Expected:**
- `snapshotId` retornado (número)

**Captured:** `SNAPSHOT_ID` = _<capturar>_

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 6.2: Listar snapshots

**Tool:** `list_snapshots`

**Input:**
```json
{}
```

**Expected:**
- Array com pelo menos 1 snapshot
- Snapshot do step 6.1 presente

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 6.3: Gravar totalNodes antes

**Tool:** `stats`

**Input:**
```json
{}
```

**Expected:**
- Gravar `totalNodes` = N para comparação posterior

**Captured:** `NODES_BEFORE` = _<capturar totalNodes>_

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 6.4: Adicionar nó temporário

**Tool:** `add_node`

**Input:**
```json
{ "type": "task", "title": "Temporary Node for Snapshot Test" }
```

**Expected:**
- Nó criado

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 6.5: Verificar totalNodes incrementou

**Tool:** `stats`

**Input:**
```json
{}
```

**Expected:**
- `totalNodes` = `NODES_BEFORE` + 1

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 6.6: Restaurar snapshot

**Tool:** `restore_snapshot`
**Depende de:** Step 6.1 (usa `SNAPSHOT_ID`)

**Input:**
```json
{ "snapshotId": <SNAPSHOT_ID> }
```

**Expected:**
- `ok: true`
- Grafo restaurado ao estado do snapshot

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 6.7: Verificar totalNodes restaurado

**Tool:** `stats`

**Input:**
```json
{}
```

**Expected:**
- `totalNodes` = `NODES_BEFORE` (restaurado, sem o nó temporário)

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 6.8: Verificar nó temporário removido

**Tool:** `list`

**Input:**
```json
{}
```

**Expected:**
- Nó "Temporary Node for Snapshot Test" NÃO aparece na lista

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

## Cenário 7: Export

**Objetivo:** Validar exportação do grafo em JSON e Mermaid.
**Tools cobertos:** `export_graph`, `export_mermaid`

### Step 7.1: Export JSON

**Tool:** `export_graph`

**Input:**
```json
{}
```

**Expected:**
- JSON válido com `nodes[]` e `edges[]`
- Todos os nós do grafo presentes

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 7.2: Export Mermaid — flowchart

**Tool:** `export_mermaid`

**Input:**
```json
{}
```

**Expected:**
- String com diagrama Mermaid válido
- Começa com `graph` ou `flowchart`

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 7.3: Export Mermaid — mindmap

**Tool:** `export_mermaid`

**Input:**
```json
{ "format": "mindmap" }
```

**Expected:**
- String com `mindmap` no início
- Estrutura hierárquica dos nós

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 7.4: Export Mermaid — filtrado por status

**Tool:** `export_mermaid`

**Input:**
```json
{ "filterStatus": ["in_progress", "backlog"] }
```

**Expected:**
- Flowchart apenas com nós nos status especificados
- Nós "done" não aparecem

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

## Cenário 8: Bulk Operations

**Objetivo:** Validar criação em lote e atualização de status em massa.
**Tools cobertos:** `add_node`, `bulk_update_status`, `list`

### Step 8.1: Criar task A

**Tool:** `add_node`

**Input:**
```json
{ "type": "task", "title": "Bulk Task A", "priority": 3 }
```

**Captured:** `BULK_A_ID` = _<capturar>_

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 8.2: Criar task B

**Tool:** `add_node`

**Input:**
```json
{ "type": "task", "title": "Bulk Task B", "priority": 3 }
```

**Captured:** `BULK_B_ID` = _<capturar>_

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 8.3: Criar task C

**Tool:** `add_node`

**Input:**
```json
{ "type": "task", "title": "Bulk Task C", "priority": 3 }
```

**Captured:** `BULK_C_ID` = _<capturar>_

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 8.4: Bulk update status

**Tool:** `bulk_update_status`
**Depende de:** Steps 8.1-8.3

**Input:**
```json
{ "ids": ["<BULK_A_ID>", "<BULK_B_ID>", "<BULK_C_ID>"], "status": "ready" }
```

**Expected:**
- `ok: true`
- Todos os 3 nós atualizados

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 8.5: Verificar status via list

**Tool:** `list`

**Input:**
```json
{ "status": "ready" }
```

**Expected:**
- Pelo menos 3 nós com status "ready"
- Tasks A, B e C presentes

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

## Cenário 9: Clone & Move

**Objetivo:** Validar clonagem (shallow e deep) e movimentação de nós na hierarquia.
**Tools cobertos:** `add_node`, `clone_node`, `move_node`, `show`

### Step 9.1: Criar epic para clone

**Tool:** `add_node`

**Input:**
```json
{ "type": "epic", "title": "Clone Source Epic", "description": "Epic original para teste de clone" }
```

**Captured:** `CLONE_EPIC_ID` = _<capturar>_

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 9.2: Criar task filha

**Tool:** `add_node`
**Depende de:** Step 9.1

**Input:**
```json
{ "type": "task", "title": "Clone Source Task", "parentId": "<CLONE_EPIC_ID>", "tags": ["original"] }
```

**Captured:** `CLONE_TASK_ID` = _<capturar>_

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 9.3: Clone shallow

**Tool:** `clone_node`
**Depende de:** Step 9.2

**Input:**
```json
{ "id": "<CLONE_TASK_ID>" }
```

**Expected:**
- Novo nó criado com ID diferente
- Title contém "Copy" ou é idêntico ao original
- Sem filhos clonados (shallow)

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 9.4: Clone deep (epic inteiro)

**Tool:** `clone_node`
**Depende de:** Step 9.1

**Input:**
```json
{ "id": "<CLONE_EPIC_ID>", "deep": true }
```

**Expected:**
- Epic clonado com novo ID
- Task filha também clonada
- Hierarquia preservada

**Captured:** `CLONED_EPIC_ID` = _<capturar>_

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 9.5: Criar novo epic destino

**Tool:** `add_node`

**Input:**
```json
{ "type": "epic", "title": "Move Destination Epic" }
```

**Captured:** `DEST_EPIC_ID` = _<capturar>_

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 9.6: Mover task para novo parent

**Tool:** `move_node`
**Depende de:** Steps 9.2, 9.5

**Input:**
```json
{ "id": "<CLONE_TASK_ID>", "newParentId": "<DEST_EPIC_ID>" }
```

**Expected:**
- `ok: true`
- Task movida para novo parent

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 9.7: Verificar novo parent

**Tool:** `show`
**Depende de:** Step 9.6

**Input:**
```json
{ "id": "<DEST_EPIC_ID>" }
```

**Expected:**
- children inclui `CLONE_TASK_ID`

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 9.8: Verificar parent original

**Tool:** `show`
**Depende de:** Step 9.6

**Input:**
```json
{ "id": "<CLONE_EPIC_ID>" }
```

**Expected:**
- children NÃO inclui `CLONE_TASK_ID` (foi movida)

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

## Cenário 10: Validation (Browser)

**Objetivo:** Validar captura e comparação via browser.
**Tools cobertos:** `validate_task`

> ⚠️ **SKIP condition:** Este cenário requer Playwright MCP server configurado. Marcar SKIP se indisponível.

### Step 10.1: Validação simples

**Tool:** `validate_task`

**Input:**
```json
{ "url": "https://example.com" }
```

**Expected:**
- Retorna dados da página (wordCount, title, etc.)
- Sem erros de captura

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 10.2: Comparação A/B

**Tool:** `validate_task`

**Input:**
```json
{ "url": "https://example.com", "compareUrl": "https://example.org" }
```

**Expected:**
- Retorna comparison com diff entre as duas páginas
- Ambas as URLs capturadas

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

## Cenário 11: Stack Docs

**Objetivo:** Validar sincronização de documentação de stack via Context7.
**Tools cobertos:** `sync_stack_docs`, `reindex_knowledge`

> ⚠️ **SKIP condition:** Este cenário requer Context7 MCP server configurado. Marcar SKIP se indisponível.

### Step 11.1: Sincronizar docs

**Tool:** `sync_stack_docs`

**Input:**
```json
{ "libraries": ["zod"] }
```

**Expected:**
- `ok: true`
- `librariesProcessed` inclui "zod"

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 11.2: Reindexar docs

**Tool:** `reindex_knowledge`

**Input:**
```json
{ "sources": ["docs"] }
```

**Expected:**
- Docs reindexados com sucesso
- Inclui docs sincronizados no step 11.1

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

## Cenário 12: Frontend Dashboard E2E (via Playwright MCP)

**Objetivo:** Validar que o dashboard web renderiza dados corretamente e que as tabs funcionam.
**Tools cobertos:** Playwright MCP — `browser_navigate`, `browser_snapshot`, `browser_click`
**Pré-requisito:** Dashboard rodando em `http://localhost:3377` (ou porta configurada)

### Step 12.1: Navegar para o dashboard

**Tool:** `browser_navigate`
**Input:**
```json
{ "url": "http://localhost:3377" }
```

**Expected:**
- Página carrega sem erros
- Header com nome do projeto visível

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 12.2: Verificar Graph tab (default)

**Tool:** `browser_snapshot`

**Expected:**
- Tab "Graph" ativa por padrão
- Canvas area do React Flow renderizada
- Sem erros no console

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 12.3: Navegar para PRD & Backlog

**Tool:** `browser_click` no botão "PRD & Backlog" → `browser_snapshot`

**Expected:**
- Tab "PRD & Backlog" fica ativa
- Lista de nodes do grafo é exibida
- Nodes têm título e status

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 12.4: Navegar para Insights

**Tool:** `browser_click` no botão "Insights" → `browser_snapshot`

**Expected:**
- Tab "Insights" fica ativa
- Cards de métricas visíveis (Total Tasks, Completion %, etc.)
- Seção de Bottlenecks presente

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 12.5: Navegar para Benchmark

**Tool:** `browser_click` no botão "Benchmark" → `browser_snapshot`

**Expected:**
- Tab "Benchmark" fica ativa
- Token Economy section com 4 cards de métricas
- Avg Compress %, Tokens Saved/Task, Nodes, Edges
- Compression bars por task visíveis

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 12.6: Verificar consistência — compression % no dashboard vs MCP stats

**Tool:** Comparar output de `stats` MCP tool com dados exibidos no Benchmark tab

**Expected:**
- `totalNodes` no dashboard = `totalNodes` do `stats` MCP
- `totalEdges` no dashboard = `totalEdges` do `stats` MCP
- Avg compression % condizente com dados medidos nos Steps 1.6, 3.3, 3.5

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 12.7: Verificar consistência — nodes/edges vs export_graph

**Tool:** Comparar output de `export` (action: "json") com dados do dashboard

**Expected:**
- Contagem de nodes no dashboard = length de `nodes` no export
- Contagem de edges no dashboard = length de `edges` no export

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 12.8: Screenshot final de evidência

**Tool:** `browser_snapshot`

**Expected:**
- Dashboard renderizado completamente
- Todos os tabs navegáveis sem erros
- Screenshot salvo como evidência

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

## Cobertura de Tools

| # | Tool | Cenários |
|---|------|----------|
| 1 | `init` | 1 |
| 2 | `import_prd` | 1 |
| 3 | `stats` | 1, 6, 12 |
| 4 | `list` | 1, 6, 8 |
| 5 | `next` | 1 |
| 6 | `context` | 1 |
| 7 | `update_status` | 1 |
| 8 | `plan_sprint` | 1, 5 |
| 9 | `add_node` | 2, 5, 6, 8, 9 |
| 10 | `show` | 2, 9 |
| 11 | `update_node` | 2 |
| 12 | `edge` (add/delete/list) | 2 |
| 13 | `delete_node` | 2 |
| 14 | `search` | 3, 4 |
| 15 | `rag_context` | 3, 4 |
| 16 | `reindex_knowledge` | 4, 11 |
| 17 | `decompose` | 5 |
| 18 | `dependencies` | 5 |
| 19 | `velocity` | 5 |
| 20 | `snapshot` (create/list/restore) | 6 |
| 21 | `export` (json/mermaid) | 7, 12 |
| 22 | `bulk_update_status` | 8 |
| 23 | `clone_node` | 9 |
| 24 | `move_node` | 9 |
| 25 | `validate_task` | 10 |
| 26 | `sync_stack_docs` | 11 |

**Total: 25/25 consolidated tools (100%)** — reduced from 31 to 25 via tool consolidation (edge, snapshot, export)

### Cenário 12 — Playwright MCP Tools (External)

| # | Tool | Used in |
|---|------|---------|
| P1 | `browser_navigate` | 12.1 |
| P2 | `browser_snapshot` | 12.2, 12.4, 12.5, 12.8 |
| P3 | `browser_click` | 12.3, 12.4, 12.5 |

---

## Parte 2: Benchmark E2E Completo — Testes Reais com Playwright MCP

> Cenários 13-24: Validação end-to-end usando o próprio mcp-graph como dataset de teste.
> PRD fixture: `src/tests/fixtures/self-test-prd.txt` (3 Epics, 12 Tasks com dependências reais)
> Server: `npx tsx src/tests/e2e/test-server.ts` em `http://localhost:3377`

---

## Cenário 13: Self-Test — Import PRD Real do Projeto

**Objetivo:** Importar um PRD real do próprio mcp-graph via modal de upload no dashboard e validar que o grafo é populado corretamente.
**Tools cobertos:** `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_file_upload`

### Step 13.1: Navegar para o dashboard

**Tool:** `browser_navigate`
**Input:**
```json
{ "url": "http://localhost:3377" }
```

**Expected:**
- Página carrega sem erros
- Header visível com título do projeto

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 13.2: Snapshot inicial do dashboard

**Tool:** `browser_snapshot`

**Expected:**
- Dashboard renderizado com tabs visíveis
- Header mostra stats do projeto (nodes importados do fixture)

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 13.3: Clicar "Import PRD" no header

**Tool:** `browser_click`
**Input:**
```json
{ "element": "Import PRD button", "ref": "<ref>" }
```

**Expected:**
- Modal de import abre
- Dropzone ou file input visível

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 13.4: Upload do self-test-prd.txt

**Tool:** `browser_file_upload`
**Input:**
```json
{ "paths": ["src/tests/fixtures/self-test-prd.txt"] }
```

**Expected:**
- Arquivo aceito pelo input
- Processamento inicia (loading indicator)

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 13.5: Verificar resultado do import

**Tool:** `browser_snapshot`

**Expected:**
- Mensagem de sucesso ou modal fecha
- Header mostra "0/N done" com N > 10
- Graph tab mostra nodes do PRD importado

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 13.6: Screenshot do graph populado

**Tool:** `browser_take_screenshot`

**Expected:**
- Graph com 3+ epics e 10+ tasks visíveis
- Edges conectando nodes com dependências

**Actual:**
```
[screenshot path]
```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

## Cenário 14: Graph Tab — Exploração Completa

**Objetivo:** Validar TODAS as funcionalidades interativas do Graph tab.
**Tools cobertos:** `browser_click`, `browser_snapshot`, `browser_fill_form`, `browser_take_screenshot`

### Step 14.1: Verificar ReactFlow renderiza nodes e edges

**Tool:** `browser_snapshot`

**Expected:**
- ReactFlow canvas visível com nodes posicionados
- Edges visíveis conectando nodes
- Tabela de nodes abaixo do graph

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 14.2: Clicar num node na tabela → NodeDetailPanel abre

**Tool:** `browser_click`
**Input:**
```json
{ "element": "first row in node table", "ref": "<ref>" }
```

**Expected:**
- NodeDetailPanel abre no lado direito
- Mostra: ID, Type, Status, Priority, Relationships

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 14.3: Verificar campos do NodeDetailPanel

**Tool:** `browser_snapshot`

**Expected:**
- Campo ID presente e não vazio
- Campo Type (epic/task)
- Campo Status (backlog/ready/in_progress/done)
- Campo Priority (high/medium/low)
- Seção Relationships (se houver dependências)

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 14.4: Clicar link em Relationships → navegar para node relacionado

**Tool:** `browser_click`
**Input:**
```json
{ "element": "relationship link in detail panel", "ref": "<ref>" }
```

**Expected:**
- NodeDetailPanel atualiza para mostrar o node relacionado
- Campos mudam para refletir o novo node

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 14.5: Usar search box → filtrar tabela

**Tool:** `browser_fill_form`
**Input:**
```json
{ "element": "search input", "ref": "<ref>", "value": "SQLite" }
```

**Expected:**
- Tabela filtra para mostrar apenas nodes contendo "SQLite"
- Contagem de resultados atualiza

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 14.6: Clicar header "Type" → sort funciona

**Tool:** `browser_click`
**Input:**
```json
{ "element": "Type column header", "ref": "<ref>" }
```

**Expected:**
- Tabela reordena por Type (epic primeiro ou task primeiro)
- Indicador de sort visível no header

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 14.7: Toggle filtros de Status

**Tool:** `browser_click`
**Input:**
```json
{ "element": "backlog status filter checkbox", "ref": "<ref>" }
```

**Expected:**
- Apenas nodes com status "backlog" na tabela
- Graph atualiza para destacar/filtrar nodes

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 14.8: Toggle filtros de Type

**Tool:** `browser_click`
**Input:**
```json
{ "element": "epic type filter checkbox", "ref": "<ref>" }
```

**Expected:**
- Apenas epics na tabela
- Graph mostra apenas epic nodes

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 14.9: Clicar "Show all nodes" → mais nodes aparecem

**Tool:** `browser_click`
**Input:**
```json
{ "element": "Show all nodes toggle", "ref": "<ref>" }
```

**Expected:**
- Mais nodes aparecem na tabela (se havia limite)
- Graph expande para mostrar todos

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 14.10: Clicar "Clear" → filtros resetam

**Tool:** `browser_click`
**Input:**
```json
{ "element": "Clear filters button", "ref": "<ref>" }
```

**Expected:**
- Todos os filtros limpos
- Tabela mostra todos os nodes novamente
- Search box vazio

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 14.11: Screenshot final com graph completo

**Tool:** `browser_take_screenshot`

**Expected:**
- Graph completo com todos os nodes e edges
- Tabela mostrando todos os nodes sem filtros

**Actual:**
```
[screenshot path]
```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

## Cenário 15: PRD & Backlog Tab — Gestão Visual

**Objetivo:** Validar o split-pane com diagram + backlog sidebar.
**Tools cobertos:** `browser_click`, `browser_snapshot`, `browser_take_screenshot`

### Step 15.1: Clicar tab "PRD & Backlog"

**Tool:** `browser_click`
**Input:**
```json
{ "element": "PRD & Backlog tab", "ref": "<ref>" }
```

**Expected:**
- Tab ativa muda para "PRD & Backlog"
- Layout split-pane visível

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 15.2: Verificar progress bar

**Tool:** `browser_snapshot`

**Expected:**
- Progress bar visível mostrando X/Y done
- Y corresponde ao total de tasks do PRD
- Porcentagem de conclusão exibida

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 15.3: Verificar ReactFlow diagram renderiza

**Tool:** `browser_snapshot`

**Expected:**
- ReactFlow canvas com nodes do PRD
- Hierarquia epic → task visível
- Edges de dependência renderizados

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 15.4: Verificar backlog list no lado direito

**Tool:** `browser_snapshot`

**Expected:**
- Lista de items no painel direito
- Cada item mostra nome, status, tipo
- Items são clicáveis

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 15.5: Clicar item no backlog → detail panel abre

**Tool:** `browser_click`
**Input:**
```json
{ "element": "first backlog item", "ref": "<ref>" }
```

**Expected:**
- Detail panel abre com informações do item
- Mostra title, status, type, acceptance criteria

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 15.6: Screenshot do layout completo

**Tool:** `browser_take_screenshot`

**Expected:**
- Split layout: diagram à esquerda, backlog à direita
- Progress bar no topo
- Dados reais do PRD visíveis

**Actual:**
```
[screenshot path]
```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

## Cenário 16: Code Graph Tab — Integração Serena + GitNexus

**Objetivo:** Validar os 3 modos (Explorer, Query, Symbol) e badges de integração.
**Tools cobertos:** `browser_click`, `browser_snapshot`, `browser_take_screenshot`

### Step 16.1: Clicar tab "Code Graph"

**Tool:** `browser_click`
**Input:**
```json
{ "element": "Code Graph tab", "ref": "<ref>" }
```

**Expected:**
- Tab ativa muda para "Code Graph"
- Header "Code Intelligence" visível

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 16.2: Verificar badges de integração

**Tool:** `browser_snapshot`

**Expected:**
- Badge "GitNexus: Inactive" com botão "Analyze & Start"
- Badge "Serena: Active" (ou status atual) com contagem de memories
- Layout com painel esquerdo (controles) e direito (visualização)

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 16.3: Explorer mode — expandir folders

**Tool:** `browser_click`
**Input:**
```json
{ "element": "Explorer mode tab/button", "ref": "<ref>" }
```

**Expected:**
- File tree visível com folders do projeto
- Folders são expandíveis (clicáveis)

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 16.4: Query mode — verificar input

**Tool:** `browser_click`
**Input:**
```json
{ "element": "Query mode tab/button", "ref": "<ref>" }
```

**Expected:**
- Input de query visível
- Placeholder ou label indicando tipo de busca

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 16.5: Symbol mode — verificar inputs

**Tool:** `browser_click`
**Input:**
```json
{ "element": "Symbol mode tab/button", "ref": "<ref>" }
```

**Expected:**
- Inputs para Context e Impact analysis visíveis
- Painel direito mostra "No symbol graph" (estado vazio)

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 16.6: Screenshot de cada modo

**Tool:** `browser_take_screenshot`

**Expected:**
- Captura mostrando o modo ativo com seus controles
- Badges de integração visíveis no header da tab

**Actual:**
```
[screenshot path]
```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

## Cenário 17: Insights Tab — Métricas e Bottlenecks

**Objetivo:** Validar que as métricas refletem dados reais do grafo.
**Tools cobertos:** `browser_click`, `browser_snapshot`, `browser_take_screenshot`

### Step 17.1: Clicar tab "Insights"

**Tool:** `browser_click`
**Input:**
```json
{ "element": "Insights tab", "ref": "<ref>" }
```

**Expected:**
- Tab ativa muda para "Insights"
- Cards de métricas visíveis

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 17.2: Verificar 4 cards de métricas

**Tool:** `browser_snapshot`

**Expected:**
- Card "Total Tasks" com número > 0
- Card "Completion %" com porcentagem
- Card "Completed" com contagem
- Card "Avg Points" com média
- Valores consistentes com dados do grafo

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 17.3: Verificar distribuição de status

**Tool:** `browser_snapshot`

**Expected:**
- Barra horizontal com segmentos coloridos por status
- Cores: backlog (cinza), ready (azul), in_progress (amarelo), done (verde)
- Proporções batem com dados reais

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 17.4: Verificar seção Bottlenecks

**Tool:** `browser_snapshot`

**Expected:**
- Lista de bottlenecks identificados:
  - Blocked tasks (tasks com dependências não resolvidas)
  - Missing acceptance criteria
  - Oversized tasks (XL sem decomposição)
- Cada item mostra node ID e motivo

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 17.5: Verificar seção Recommendations

**Tool:** `browser_snapshot`

**Expected:**
- Cards de recomendação com:
  - Phase sugerida (IMPLEMENT, VALIDATE, etc.)
  - Skill recomendada
  - Ação sugerida

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 17.6: Screenshot completo

**Tool:** `browser_take_screenshot`

**Expected:**
- Layout completo do Insights tab
- Métricas, bottlenecks e recommendations visíveis

**Actual:**
```
[screenshot path]
```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

## Cenário 18: Benchmark Tab — Token Economy Real

**Objetivo:** Validar métricas de compressão e custo com dados reais.
**Tools cobertos:** `browser_click`, `browser_snapshot`, `browser_take_screenshot`

### Step 18.1: Clicar tab "Benchmark"

**Tool:** `browser_click`
**Input:**
```json
{ "element": "Benchmark tab", "ref": "<ref>" }
```

**Expected:**
- Tab ativa muda para "Benchmark"
- Cards de métricas de token economy visíveis

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 18.2: Verificar 4 cards principais

**Tool:** `browser_snapshot`

**Expected:**
- Card "Avg Compress %" com porcentagem > 0
- Card "Tokens Saved/Task" com número > 0
- Card "Nodes" com contagem
- Card "Edges" com contagem
- Nodes/Edges batem com stats do MCP

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 18.3: Verificar compression bars

**Tool:** `browser_snapshot`

**Expected:**
- Top 15 tasks com barras de compressão
- Cada barra mostra % de compressão
- Barras ordenadas por compressão (maior → menor)

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 18.4: Verificar "Dependency Intelligence"

**Tool:** `browser_snapshot`

**Expected:**
- "Auto-inferred deps" com contagem
- "Blocked tasks" com contagem
- "Cycles detected" (0 se grafo é acíclico)

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 18.5: Verificar "Formulas & Justification"

**Tool:** `browser_snapshot`

**Expected:**
- Seção explicativa com fórmulas de compressão
- Justificativa do cálculo de tokens

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 18.6: Verificar "Cost Savings"

**Tool:** `browser_snapshot`

**Expected:**
- Comparação de custo Opus vs Sonnet
- Economia em tokens por tarefa
- Valores baseados nos dados reais do grafo

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 18.7: Screenshot completo

**Tool:** `browser_take_screenshot`

**Expected:**
- Layout completo do Benchmark tab
- Todos os cards e seções visíveis

**Actual:**
```
[screenshot path]
```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

## Cenário 19: CRUD via API + Dashboard Refresh

**Objetivo:** Criar/atualizar/deletar nodes via API e verificar que o dashboard reflete as mudanças (SSE).
**Tools cobertos:** `browser_navigate`, `browser_snapshot`, `browser_evaluate`, `browser_take_screenshot`

### Step 19.1: Contar nodes atuais no Graph tab

**Tool:** `browser_snapshot`

**Expected:**
- Tabela de nodes visível
- Anotar contagem total de rows

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 19.2: Criar novo node via API

**Tool:** `browser_evaluate`
**Input:**
```javascript
await fetch('/api/v1/nodes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'E2E Test Node — API CRUD',
    type: 'task',
    status: 'backlog',
    priority: 'medium',
    description: 'Created via Playwright E2E test to validate SSE updates'
  })
}).then(r => r.json())
```

**Expected:**
- Response com `ok: true`
- Node criado com ID retornado

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 19.3: Verificar novo node no dashboard

**Tool:** `browser_snapshot`

**Expected:**
- Novo node "E2E Test Node — API CRUD" aparece na tabela
- Contagem de rows = anterior + 1

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 19.4: Atualizar status via API

**Tool:** `browser_evaluate`
**Input:**
```javascript
// Use o ID retornado no step 19.2
await fetch('/api/v1/nodes/<ID>/status', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'in_progress' })
}).then(r => r.json())
```

**Expected:**
- Response com `ok: true`
- Node status atualizado

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 19.5: Verificar status atualizado no dashboard

**Tool:** `browser_snapshot`

**Expected:**
- Node "E2E Test Node" mostra status "in_progress"
- Cor/badge atualizado na tabela

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 19.6: Deletar node via API

**Tool:** `browser_evaluate`
**Input:**
```javascript
// Use o ID retornado no step 19.2
await fetch('/api/v1/nodes/<ID>', {
  method: 'DELETE'
}).then(r => r.json())
```

**Expected:**
- Response com `ok: true`

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 19.7: Verificar node removido do dashboard

**Tool:** `browser_snapshot`

**Expected:**
- Node "E2E Test Node" não aparece mais na tabela
- Contagem de rows = original

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 19.8: Screenshot antes e depois

**Tool:** `browser_take_screenshot`

**Expected:**
- Estado final consistente com estado pré-CRUD

**Actual:**
```
[screenshot path]
```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

## Cenário 20: Edge Creation + Relationships

**Objetivo:** Criar edges via API e validar no NodeDetailPanel.
**Tools cobertos:** `browser_evaluate`, `browser_click`, `browser_snapshot`, `browser_take_screenshot`

### Step 20.1: Obter IDs de 2 nodes existentes

**Tool:** `browser_evaluate`
**Input:**
```javascript
await fetch('/api/v1/nodes?limit=2').then(r => r.json())
```

**Expected:**
- Array com pelo menos 2 nodes
- Anotar IDs para uso posterior

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 20.2: Criar edge via API

**Tool:** `browser_evaluate`
**Input:**
```javascript
await fetch('/api/v1/edges', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from: '<NODE_ID_1>',
    to: '<NODE_ID_2>',
    relationType: 'depends_on'
  })
}).then(r => r.json())
```

**Expected:**
- Response com `ok: true`
- Edge criada com relação "depends_on"

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 20.3: Clicar no node source → verificar Relationships

**Tool:** `browser_click`
**Input:**
```json
{ "element": "source node in table", "ref": "<ref>" }
```

**Expected:**
- NodeDetailPanel abre
- Seção Relationships mostra edge "depends_on" para target

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 20.4: Clicar no node target → verificar incoming

**Tool:** `browser_click`
**Input:**
```json
{ "element": "target node in table", "ref": "<ref>" }
```

**Expected:**
- NodeDetailPanel abre
- Seção Relationships mostra incoming "depends_on" do source

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 20.5: Screenshot do panel com relationships

**Tool:** `browser_take_screenshot`

**Expected:**
- NodeDetailPanel visível com relationships populadas
- Edge "depends_on" claramente indicada

**Actual:**
```
[screenshot path]
```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

## Cenário 21: Import Modal — Upload Real

**Objetivo:** Testar o fluxo completo de import via modal no dashboard.
**Tools cobertos:** `browser_click`, `browser_snapshot`, `browser_file_upload`, `browser_take_screenshot`

### Step 21.1: Clicar "Import PRD" no header

**Tool:** `browser_click`
**Input:**
```json
{ "element": "Import PRD button", "ref": "<ref>" }
```

**Expected:**
- Modal de import abre com overlay
- Dropzone ou file input visível

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 21.2: Verificar modal layout

**Tool:** `browser_snapshot`

**Expected:**
- Modal visível com:
  - Título "Import PRD"
  - Área de upload (drag & drop ou file picker)
  - Botão de fechar/cancelar

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 21.3: Upload do PRD fixture

**Tool:** `browser_file_upload`
**Input:**
```json
{ "paths": ["src/tests/fixtures/self-test-prd.txt"] }
```

**Expected:**
- Arquivo aceito
- Loading indicator aparece durante processamento

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 21.4: Verificar resultado do import

**Tool:** `browser_snapshot`

**Expected:**
- Mensagem de sucesso com contagem de nodes/edges criados
- Modal fecha ou mostra resultado
- Dashboard atualiza com novos dados

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 21.5: Screenshot do modal + resultado

**Tool:** `browser_take_screenshot`

**Expected:**
- Captura do estado final pós-import
- Novos nodes visíveis no graph

**Actual:**
```
[screenshot path]
```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

## Cenário 22: Cross-Tab Consistency

**Objetivo:** Verificar que dados são consistentes entre todas as tabs.
**Tools cobertos:** `browser_click`, `browser_snapshot`, `browser_evaluate`, `browser_take_screenshot`

### Step 22.1: Graph tab — contar total de nodes

**Tool:** `browser_snapshot`
**Pré-condição:** Estar no Graph tab

**Expected:**
- Anotar total de nodes na tabela (N_graph)

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 22.2: Benchmark tab — verificar card "Nodes"

**Tool:** `browser_click` → `browser_snapshot`

**Expected:**
- Card "Nodes" mostra N_benchmark
- N_benchmark == N_graph

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 22.3: Insights tab — verificar "Total Tasks"

**Tool:** `browser_click` → `browser_snapshot`

**Expected:**
- Card "Total Tasks" mostra N_insights
- N_insights é consistente (pode diferir se conta apenas tasks, não epics)

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 22.4: PRD & Backlog — verificar progress bar

**Tool:** `browser_click` → `browser_snapshot`

**Expected:**
- Progress bar mostra X/Y done
- Y é consistente com N_graph (ou N_tasks)

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 22.5: Comparar via API stats

**Tool:** `browser_evaluate`
**Input:**
```javascript
await fetch('/api/v1/stats').then(r => r.json())
```

**Expected:**
- `totalNodes` bate com contagens visuais
- `totalEdges` bate com card "Edges" do Benchmark

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 22.6: Screenshot de cada tab mostrando números

**Tool:** `browser_take_screenshot`

**Expected:**
- Série de screenshots mostrando consistência entre tabs

**Actual:**
```
[screenshot paths]
```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

## Cenário 23: Search & Filter Deep Test

**Objetivo:** Testar busca e filtros combinados no Graph tab.
**Tools cobertos:** `browser_fill_form`, `browser_click`, `browser_snapshot`, `browser_take_screenshot`

### Step 23.1: Digitar texto no search box → tabela filtra

**Tool:** `browser_fill_form`
**Input:**
```json
{ "element": "search input", "ref": "<ref>", "value": "Benchmark" }
```

**Expected:**
- Tabela filtra para nodes contendo "Benchmark"
- Resultados visíveis e relevantes

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 23.2: Limpar search → tabela restaura

**Tool:** `browser_fill_form`
**Input:**
```json
{ "element": "search input", "ref": "<ref>", "value": "" }
```

**Expected:**
- Tabela mostra todos os nodes novamente
- Sem filtro ativo

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 23.3: Marcar checkbox "epic" em Type

**Tool:** `browser_click`
**Input:**
```json
{ "element": "epic type filter checkbox", "ref": "<ref>" }
```

**Expected:**
- Apenas epics na tabela
- Contagem reduzida

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 23.4: Marcar checkbox "task" em Type → combinação

**Tool:** `browser_click`
**Input:**
```json
{ "element": "task type filter checkbox", "ref": "<ref>" }
```

**Expected:**
- Epics + tasks na tabela
- Mais resultados que step anterior

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 23.5: Marcar checkbox "backlog" em Status → combinação type + status

**Tool:** `browser_click`
**Input:**
```json
{ "element": "backlog status filter checkbox", "ref": "<ref>" }
```

**Expected:**
- Apenas epics/tasks com status "backlog"
- Filtro combinado funcionando

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 23.6: Clicar "Clear" → tudo volta ao normal

**Tool:** `browser_click`
**Input:**
```json
{ "element": "Clear filters button", "ref": "<ref>" }
```

**Expected:**
- Todos os filtros desativados
- Tabela mostra todos os nodes
- Search vazio

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 23.7: Mudar Layout para "Left → Right"

**Tool:** `browser_click`
**Input:**
```json
{ "element": "Layout direction selector/button", "ref": "<ref>" }
```

**Expected:**
- Graph re-renderiza com layout horizontal (left to right)
- Nodes reposicionados

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 23.8: Screenshot com filtros ativos

**Tool:** `browser_take_screenshot`

**Expected:**
- Graph com layout horizontal
- Filtros visíveis no painel

**Actual:**
```
[screenshot path]
```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

## Cenário 24: Theme Toggle

**Objetivo:** Validar dark/light theme em todas as tabs.
**Tools cobertos:** `browser_click`, `browser_snapshot`, `browser_take_screenshot`

### Step 24.1: Verificar theme atual (dark por padrão)

**Tool:** `browser_snapshot`

**Expected:**
- Background escuro
- Texto claro
- Botão de toggle theme visível (☀ ou 🌙)

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 24.2: Clicar botão de theme toggle

**Tool:** `browser_click`
**Input:**
```json
{ "element": "theme toggle button", "ref": "<ref>" }
```

**Expected:**
- Theme muda para light
- Background claro, texto escuro
- Ícone do botão muda

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 24.3: Navegar por cada tab — verificar rendering

**Tool:** `browser_click` → `browser_snapshot` (para cada tab)

**Expected:**
- Graph tab: cores claras, nodes e edges visíveis
- PRD & Backlog: layout ok com theme claro
- Code Graph: badges e tree legíveis
- Insights: cards e barras com contraste adequado
- Benchmark: bars e seções com tema correto

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 24.4: Toggle de volta para dark

**Tool:** `browser_click`
**Input:**
```json
{ "element": "theme toggle button", "ref": "<ref>" }
```

**Expected:**
- Theme volta para dark
- Todas as cores restauradas

**Actual:**
```json

```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

### Step 24.5: Screenshot em cada theme

**Tool:** `browser_take_screenshot`

**Expected:**
- Screenshots mostrando dark e light themes
- Contraste adequado em ambos

**Actual:**
```
[screenshot paths]
```

**Result:** ⬜ PASS / ⬜ FAIL / ⬜ SKIP

---

## Checklist de Verificação Final

Após rodar todos os cenários:

- [ ] Cenários 1-12 (existentes) — executados previamente
- [ ] Cenário 13: Self-Test Import PRD — executado
- [ ] Cenário 14: Graph Tab Exploração — executado
- [ ] Cenário 15: PRD & Backlog Tab — executado
- [ ] Cenário 16: Code Graph Tab — executado
- [ ] Cenário 17: Insights Tab — executado
- [ ] Cenário 18: Benchmark Tab — executado
- [ ] Cenário 19: CRUD via API — executado
- [ ] Cenário 20: Edge Creation — executado
- [ ] Cenário 21: Import Modal — executado
- [ ] Cenário 22: Cross-Tab Consistency — executado
- [ ] Cenário 23: Search & Filter Deep — executado
- [ ] Cenário 24: Theme Toggle — executado
- [ ] Screenshots capturados como evidência
- [ ] Dados do Benchmark tab validados contra MCP stats
- [ ] Cross-tab consistency confirmada
- [ ] Nenhum erro no console do browser
- [ ] NOTEBOOK.md atualizado com resultados

## Cobertura de Tools — Parte 2

| # | Playwright Tool | Usado em |
|---|----------------|----------|
| P1 | `browser_navigate` | 13.1, 19 |
| P2 | `browser_snapshot` | 13.2, 13.5, 14.1-14.10, 15.2-15.5, 16.2-16.5, 17.2-17.5, 18.2-18.6, 19.1, 19.3, 19.5, 19.7, 20.3-20.4, 21.2, 21.4, 22.1-22.4, 23.1-23.7, 24.1, 24.3 |
| P3 | `browser_click` | 13.3, 14.2, 14.4, 14.6-14.10, 15.1, 15.5, 16.1, 16.3-16.5, 17.1, 18.1, 22.2-22.4, 23.3-23.7, 24.2-24.4 |
| P4 | `browser_file_upload` | 13.4, 21.3 |
| P5 | `browser_take_screenshot` | 13.6, 14.11, 15.6, 16.6, 17.6, 18.7, 19.8, 20.5, 21.5, 22.6, 23.8, 24.5 |
| P6 | `browser_evaluate` | 19.2, 19.4, 19.6, 20.1-20.2, 22.5 |
| P7 | `browser_fill_form` | 14.5, 23.1-23.2 |

**Total: 7 Playwright tools cobertos em 12 cenários, ~75 steps**
