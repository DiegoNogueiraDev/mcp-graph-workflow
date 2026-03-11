# Parte 1: MCP Tools — Testes Reais

> Cenários 1-12: Validação de todos os 25/25 consolidated MCP tools + 3 Playwright tools básicos.
> PRD fixture: `./sample-prd.txt`

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

## Cobertura de Tools — Parte 1

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
