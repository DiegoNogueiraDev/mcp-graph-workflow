# Bug Report — mcp-graph v5.17.0

**Projeto:** graph-decompile (GenAI Decompiler MCP)
**Versao:** @mcp-graph-workflow/mcp-graph@5.17.0
**Data:** 2026-03-28
**Autor:** Diego Nogueira (via Claude Code bug hunting)
**Metodo:** Testes sistematicos de todas as 28 ferramentas MCP + analise de codigo-fonte
**Total de bugs:** 101

---

## Indice por Severidade

| Severidade | Qtd | IDs |
|-----------|-----|-----|
| CRITICAL | 5 | #001-#005 |
| HIGH | 18 | #006-#023 |
| MEDIUM | 38 | #024-#061 |
| LOW | 40 | #062-#101 |
| **Total** | **101** | |

---

## CRITICAL (5)

### #001 — Deadlock circular: code_intelligence strict mode bloqueia todas as ferramentas

- **Ferramentas afetadas:** set_phase, reindex_knowledge, init, node, edge, write_memory, import_prd, update_status, clone_node, move_node, validate, journey (TODAS as mutaveis)
- **Reproducao:** Projeto novo com code_intelligence_mode=strict e index vazio → chamar qualquer ferramenta mutavel
- **Esperado:** set_phase e reindex_knowledge deveriam ser isentos do gate
- **Real:** Todas bloqueadas com `code_intelligence_gate_blocked`. A hint sugere rodar ferramentas que tambem estao bloqueadas
- **Evidencia:**
```json
{"error":"code_intelligence_gate_blocked","tool":"set_phase",
 "hint":"Run reindex_knowledge to build the code index, or use set_phase({codeIntelligence:'advisory'})"}
```
- **Codigo:** `dist/mcp/code-intelligence-wrapper.js:238-251`
- **Workaround:** `sqlite3 workflow-graph/graph.db "UPDATE project_settings SET value='off' WHERE key='code_intelligence_mode';"`

### #002 — set_phase force:true nao bypassa code_intelligence gate

- **Ferramenta:** set_phase
- **Reproducao:** `set_phase({phase:"ANALYZE", mode:"advisory", codeIntelligence:"off", prerequisites:"off", force:true})`
- **Esperado:** force:true deveria bypassar todos os gates
- **Real:** Bloqueado — force so bypassa phase transition gates, nao code_intelligence
- **Codigo:** `dist/mcp/tools/set-phase.js:60-65` — force avaliado no handler, mas code-intelligence-wrapper bloqueia ANTES do handler

### #003 — Path traversal em write_memory / read_memory / delete_memory

- **Ferramentas:** write_memory, read_memory, delete_memory
- **Reproducao:** `write_memory({name:"../../etc/passwd", content:"test"})`
- **Esperado:** Rejeitar path traversal
- **Real:** Cria arquivo FORA do diretorio memories/ em `graph-decompile/etc/passwd.md`. read_memory e delete_memory tambem seguem o traversal
- **Impacto:** Escrita/leitura/delecao arbitraria de arquivos onde o processo tem permissao
- **Fix:** `path.resolve()` + `startsWith()` check no diretorio memories/

### #004 — import_prd aceita caminhos arbitrarios (inclui /etc/passwd)

- **Ferramenta:** import_prd
- **Reproducao:** `import_prd({filePath:"/etc/passwd"})`
- **Esperado:** Rejeitar arquivos fora do projeto ou nao-markdown
- **Real:** Importou com sucesso, criou 6 nodes a partir de dados do sistema
- **Impacto:** Leitura de qualquer arquivo acessivel pelo processo; dados sensiveis ingeridos no knowledge store

### #005 — init bloqueado por code_intelligence strict mode

- **Ferramenta:** init
- **Reproducao:** Chamar init quando code_intelligence esta em strict com index vazio
- **Esperado:** init e ferramenta de bootstrap, NUNCA deveria ser bloqueada
- **Real:** `code_intelligence_gate_blocked`
- **Impacto:** Impossivel reinicializar projeto em deadlock

---

## HIGH (18)

### #006 — reindex_knowledge bloqueado pelo index que deveria construir

- **Ferramenta:** reindex_knowledge
- **Reproducao:** Chamar com code_intelligence strict + index vazio
- **Real:** Bloqueado — mas a hint diz "Run reindex_knowledge"
- **Codigo:** `reindex_knowledge` esta em `ALWAYS_ALLOWED_TOOLS` do lifecycle-wrapper mas NAO em `READ_ONLY_TOOLS` do code-intelligence-wrapper

### #007 — Inconsistencia de whitelists entre wrappers

- **Ferramentas inconsistentes:** init, set_phase, reindex_knowledge, sync_stack_docs
- **lifecycle-wrapper ALWAYS_ALLOWED:** Sim
- **code-intelligence-wrapper READ_ONLY:** Nao
- **Impacto:** Ferramentas permitidas por uma camada sao bloqueadas pela outra

### #008 — import_prd hierarquia incorreta (EPICs como filhos de Requirements)

- **Ferramenta:** import_prd
- **Reproducao:** Importar docs/prd.md
- **Real:** EPIC 1-10 ficam como filhos de "18. Requisitos nao funcionais" (tipo requirement)
- **Codigo:** `dist/core/importer/prd-to-graph.js:233-253` — algoritmo usa apenas heading level, ignora tipo do node
- **Evidencia:**
```json
{"id":"node_7e924c0943f3","type":"epic","title":"EPIC 1 — Foundation",
 "parentId":"node_aab4b3f1b731"}  // parent = "Requisitos nao funcionais" (requirement)
```

### #009 — scope e traceability se contradizem sobre cobertura de requisitos

- **Ferramentas:** analyze(scope) vs analyze(traceability)
- **scope:** `requirementsToTasks: 100%`, `orphanRequirements: 0`
- **traceability:** `coverageRate: 0%`, `orphanRequirements: [todos os 4]`
- **Impacto:** Duas analises dao conclusoes diametralmente opostas sobre o mesmo grafo

### #010 — review_ready reporta 3 tasks bloqueadas quando 0 tem status=blocked

- **Ferramenta:** analyze(review_ready)
- **Real:** Check `no_blocked_tasks` falha com "3 task(s) bloqueada(s)" mas nenhum node tem status blocked
- **Causa provavel:** Confunde "tem dependencias nao resolvidas" com "status=blocked"

### #011 — handoff_ready reporta 3 nodes bloqueados fantasma (mesmo bug do #010)

- **Ferramenta:** analyze(handoff_ready)
- **Real:** `no_blocked_nodes` falha com "3 node(s) bloqueado(s)" — mesma causa raiz

### #012 — listening_ready reporta 3 tasks bloqueadas fantasma (mesmo bug do #010)

- **Ferramenta:** analyze(listening_ready)
- **Real:** `no_blocked` falha com "3 task(s) bloqueada(s)" — mesma causa raiz

### #013 — manage_skill acoes read-only bloqueadas em advisory mode

- **Ferramenta:** manage_skill
- **Acoes bloqueadas:** list, list_custom, get_preferences (TODAS read-only)
- **Real:** `lifecycle_gate_blocked` mesmo em advisory mode
- **Paradoxo:** Acoes mutaveis (enable, create, delete) passam normalmente

### #014 — Phantom nodes / data loss apos transicao strict→advisory

- **Ferramenta:** node(add)
- **Reproducao:** Criar nodes durante transicao de strict para advisory mode
- **Real:** 3 de 4 nodes criados com ok:true desapareceram depois — `show` retorna "Node not found"
- **Impacto:** Perda de dados silenciosa

### #015 — edge list read-only bloqueado como "mutating tool"

- **Ferramenta:** edge(action="list")
- **Real:** Bloqueado por code_intelligence strict mode com "Cannot execute mutating tool in strict mode"
- **Esperado:** Operacao de leitura nao deveria ser classificada como mutavel

### #016 — Negative estimateMinutes aceito sem validacao

- **Ferramenta:** node(add)
- **Reproducao:** `node({action:"add", title:"Test", type:"task", estimateMinutes:-10})`
- **Real:** Aceito, node criado com estimateMinutes: -10
- **Impacto:** Corrompe calculos de velocidade e sprint

### #017 — manage_skill enable aceita skills inexistentes

- **Ferramenta:** manage_skill(action="enable")
- **Reproducao:** `manage_skill({action:"enable", skillName:"nonexistent"})`
- **Real:** `{"ok":true, "enabled":true}` — silenciosamente habilita skill fantasma

### #018 — edge weight fora do range 0-1 aceito

- **Ferramenta:** edge(add)
- **Reproducao:** `edge({action:"add", ..., weight:-1})` ou `weight:2`
- **Real:** Aceito e armazenado. Schema diz "Edge weight 0-1" mas nao valida
- **Impacto:** Corrompe algoritmos de grafo que assumem pesos normalizados

### #019 — Race condition no gate de code_intelligence

- **Ferramenta:** node(add) em batch paralelo
- **Reproducao:** Enviar multiplos node(add) em paralelo durante strict mode
- **Real:** Alguns calls passam e outros sao bloqueados no mesmo batch. Mode muda silenciosamente de strict para advisory
- **Impacto:** Comportamento nao-deterministico do gate de seguranca

### #020 — import_prd com filePath vazio produz EISDIR

- **Ferramenta:** import_prd
- **Reproducao:** `import_prd({filePath:""})`
- **Real:** `EISDIR: illegal operation on a directory, read` em vez de validacao clara

### #021 — init aceita projectName com path traversal

- **Ferramenta:** init
- **Reproducao:** `init({projectName:"../../traversal"})`
- **Real:** Aceito como nome de projeto sem sanitizacao
- **Impacto:** Risco latente se o nome for usado para construir paths no filesystem

### #022 — journey tool inteiramente bloqueado (incluindo acoes read-only)

- **Ferramenta:** journey
- **Real:** Todas as 5 acoes (list, get, search, search com query, index) retornam code_intelligence_gate_blocked
- **Esperado:** journey(action="list") e journey(action="search") sao read-only

### #023 — export JSON indexes nao filtrados quando nodes/edges sao filtrados

- **Ferramenta:** export(action="json")
- **Reproducao:** `export({action:"json", filterStatus:["done"]})` ou `filterType:["epic"]`
- **Real:** nodes/edges filtrados corretamente, mas indexes.byId contém TODOS os 32 nodes
- **Impacto:** Dados inconsistentes; desperdica tokens

---

## MEDIUM (38)

### #024 — search `total` reflete count pos-limit, nao total real (quebra paginacao)
- **Ferramenta:** search
- **Reproducao:** `search({query:"workspace", limit:1})` → total:1. Sem limit → total:3
- **Impacto:** Caller nao sabe que existem mais resultados

### #025 — analyze(blockers) com nodeId inexistente retorna ok:true em vez de erro
- **Ferramenta:** analyze(blockers, nodeId="nonexistent")
- **Real:** `{ok:true, blockers:[]}` — indistinguivel de node real sem blockers

### #026 — analyze(implement_done) com nodeId inexistente retorna ok:true
- **Ferramenta:** analyze(implement_done, nodeId="nonexistent")
- **Real:** `{ok:true, title:"(not found)", score:0, grade:"F"}` — ok:true e enganoso

### #027 — analyze(review_ready) ac_coverage passa vacuamente com 0 done tasks
- **Real:** `ac_coverage: "100% done tasks com AC"` quando 0 tasks estao done (0/0 = 100%)

### #028 — analyze(risk) fabrica scores de probabilidade/impacto nao presentes nos metadados
- **Real:** Retorna probability=4, impact=3 sem indicar que sao valores sinteticos/default

### #029 — analyze(coupling) mostra todos fanIn/fanOut como 0 com 65 edges existentes
- **Real:** 27 de 32 nodes mostram fanIn:0, fanOut:0. So conta depends_on/blocks, ignora parent_of

### #030 — analyze(scope) requirementsToTasks:100% incorreto
- **Real:** 4 requirements, 5 tasks, nenhuma ligacao entre eles, mas scope diz 100% cobertura

### #031 — analyze(decompose) retorna vazio com 18 epics sem tasks filhas
- **Real:** `{results:[]}` — epics sem decomposicao nao sao detectados

### #032 — show com id="" retorna "Node not found: " (mensagem confusa)
- **Ferramenta:** show
- **Real:** String vazia passa para DB lookup; mensagem tem dois-pontos sem nada depois

### #033 — context com id="" mesmo bug do #032
- **Ferramenta:** context
- **Real:** `Node not found: ` com trailing vazio

### #034 — context reductionPercent=0 quando compact > original
- **Ferramenta:** context
- **Real:** compactChars(9562) > originalChars(4131) mas reductionPercent=0 em vez de negativo

### #035 — context sempre usa "task" como chave top-level mesmo para epics
- **Ferramenta:** context
- **Real:** `{"task":{"type":"epic",...}}` — key "task" para qualquer tipo de node

### #036 — clone_node permite self-parenting (newParentId == id)
- **Ferramenta:** clone_node
- **Reproducao:** `clone_node({id:X, newParentId:X})`
- **Real:** Cria clone como filho do original. move_node rejeita corretamente

### #037 — edge list direction inconsistente sem nodeId
- **Ferramenta:** edge(action="list")
- **Reproducao:** direction="from" retorna 0, direction="to" retorna 65 (mesmo grafo)
- **Impacto:** Retorna resultados errados silenciosamente

### #038 — set_phase override nao persiste
- **Ferramenta:** set_phase
- **Reproducao:** set_phase(phase:"IMPLEMENT") retorna ok:true, mas calls subsequentes mostram phase:"ANALYZE"

### #039 — metrics velocity sprint filter silenciosamente ignorado
- **Ferramenta:** metrics(mode="velocity", sprint="nonexistent")
- **Real:** Retorna stats globais sem mencionar o filtro

### #040 — write_memory com name="" cria arquivo .md (hidden file)
- **Ferramenta:** write_memory
- **Real:** Aceita, cria `.md` no diretorio memories/

### #041 — write_memory com content="" cria arquivo vazio
- **Ferramenta:** write_memory
- **Real:** Aceita, indexed:0 mas arquivo existe

### #042 — code_intelligence workspace_symbols anunciado mas nao implementado
- **Ferramenta:** code_intelligence(mode="workspace_symbols")
- **Real:** `{ok:true, supported:false, message:"Use 'search' tool..."}` — deveria ser removido do enum

### #043 — code_intelligence diagnostics retorna sucesso para arquivo inexistente
- **Ferramenta:** code_intelligence(mode="diagnostics", file="nonexistent.ts")
- **Real:** `{ok:true, diagnostics:[]}` — indistinguivel de arquivo sem diagnosticos

### #044 — code_intelligence document_symbols retorna sucesso para arquivo inexistente
- **Ferramenta:** code_intelligence(mode="document_symbols", file="nonexistent.ts")
- **Real:** `{ok:true, symbols:[]}` — mesma inconsistencia do #043

### #045 — Race condition em edge creation (check + insert nao atomico)
- **Codigo:** `dist/mcp/tools/edge.js:40-45`
- **Real:** Verifica duplicata com find() e insere sem transacao. Requests concorrentes podem criar duplicatas

### #046 — update_status nao checa null antes de acessar updated.title
- **Codigo:** `dist/mcp/tools/update-status.js:59`
- **Real:** Se node nao existe, acessa propriedades de null → crash

### #047 — Race condition em node update de parentId (edges delete/insert sem transacao)
- **Codigo:** `dist/mcp/tools/node.js:113-150`
- **Real:** Remove edges antigos, depois adiciona novos — estado inconsistente entre operacoes

### #048 — Snapshot restore nao valida estrutura do JSON
- **Codigo:** `dist/core/store/sqlite-store.js:793-831`
- **Real:** JSON.parse sem validacao — snapshot corrompido causa crash durante INSERT

### #049 — Store swap sem lock (leitura de store half-swapped)
- **Codigo:** `dist/core/store/store-manager.js:46-90`
- **Real:** `this._ref.current = newStore` sem mutex

### #050 — Event emission dentro de transacao (listener que throw corrompe rollback)
- **Codigo:** `dist/core/store/sqlite-store.js:370,415,484`

### #051 — Knowledge store search fetches 2x limit sem cap
- **Codigo:** `dist/core/store/knowledge-store.js:118-134`
- **Real:** `search(query, limit * 2)` sem upper bound

### #052 — batchUpdateStaleness carrega TODOS os docs em memoria
- **Codigo:** `dist/core/store/knowledge-store.js:207-222`
- **Real:** `SELECT id, created_at FROM knowledge_documents` sem paginacao → OOM em datasets grandes

### #053 — LIKE operator nao escaped em tool_call_log
- **Codigo:** `dist/core/store/tool-call-log.js:33-35`
- **Real:** `%${toolArgs}%` sem escape — toolArgs com % matcha qualquer texto

### #054 — Knowledge document content sem limite de tamanho
- **Codigo:** `dist/core/store/knowledge-store.js:40-56`
- **Real:** Aceita content de qualquer tamanho como single row

### #055 — Metadata de edge sem validacao de tamanho JSON
- **Codigo:** `dist/core/store/sqlite-store.js:82-93`
- **Real:** JSON.stringify sem size check — objetos profundos podem exceder limites SQLite

### #056 — Store nao fechado em falha de init
- **Codigo:** `dist/cli/commands/import-cmd.js:19-39`
- **Real:** Store aberto antes do try block — excecao causa leak de conexao

### #057 — Database connection leak em path resolver
- **Codigo:** `dist/core/store/path-resolver.js:60-63`
- **Real:** Erro entre `new Database` e `db.close()` causa leak

### #058 — next-task.js inDegree default errado (1 em vez de 0)
- **Codigo:** `dist/core/planner/next-task.js:145`
- **Real:** `(inDegree.get(neighbor) ?? 1) - 1` — default 1 causa calculo incorreto de grau

### #059 — BM25 compressor off-by-one no token budget
- **Codigo:** `dist/core/context/bm25-compressor.js:80`
- **Real:** Primeiro chunk sempre adicionado mesmo excedendo budget

### #060 — BM25 compressor NaN em document set vazio
- **Codigo:** `dist/core/context/bm25-compressor.js:42`
- **Real:** `avgDl / totalDocs` → Infinity quando totalDocs=0

### #061 — TF-IDF divisao por zero em documento vazio
- **Codigo:** `dist/core/search/tfidf.js:40`
- **Real:** `termFreq / docLen` → NaN quando docLen=0

---

## LOW (40)

### #062 — search com query="" retorna 0 silenciosamente em vez de erro
### #063 — search com query="*" retorna 0 silenciosamente
### #064 — search snippet null para matches apenas no titulo
### #065 — list com offset>total nao indica out-of-range
### #066 — metrics stats sampleSize:5 hardcoded (nao real)
### #067 — metrics stats nao inclui sprint count, fase, knowledge store
### #068 — show erro e string flat vs MCP error estruturado em outros tools
### #069 — Respostas em 3 objetos JSON separados (nao JSON valido)
### #070 — analyze(tech_risk) classifica todos os risks identicamente (sem diferenciacao)
### #071 — analyze(interfaces) omite tasks e risks da analise silenciosamente
### #072 — analyze(backlog_health) so conta tasks (ignora epics/requirements no backlog)
### #073 — analyze(progress) criticalPathRemaining sem criticalPathTotal para comparacao
### #074 — analyze(done_integrity) passa vacuamente com 0 done nodes
### #075 — analyze(ready) check has_requirements conta epics junto com requirements
### #076 — snapshot restore com snapshotId=-1 nao valida (faz DB lookup)
### #077 — edge self-reference check antes de existence check (mensagem enganosa)
### #078 — clone_node/move_node com id="" mensagem confusa "Node not found: "
### #079 — rag_context param chama "detail" mas response usa "tier"
### #080 — rag_context summary tier docs dizem ~20 tok/node, real e ~46
### #081 — write_memory com special chars no name (!@#$%) aceito
### #082 — write_memory sizeBytes nao bate com content length
### #083 — Hardcoded LIMIT 500 em code symbols query
### #084 — knowledge-feedback passa empty string "" para query em vez de null
### #085 — Inconsistent return types em export (mcpText vs raw object)
### #086 — Portuguese strings hardcoded em mensagens de erro (nao i18n)
### #087 — planning-report loop para em 20 iteracoes (trunca silenciosamente)
### #088 — decompose chunkSize formula sempre simplifica para 3
### #089 — compact-context truncateDescription em rel.description potencialmente undefined
### #090 — compact-context reductionPercent pode ser negativo (expansao)
### #091 — Token estimator assume 4 chars/token fixo (impreciso 30-40%)
### #092 — blocked-helpers deduplicacao cria estruturas inconsistentes
### #093 — next-task.js localeCompare em createdAt sem validacao de null
### #094 — velocity.js retorna null para timestamps invalidos sem aviso ao caller
### #095 — status-flow-checker assume createdAt===updatedAt significa sem transicoes
### #096 — definition-of-ready AC check O(n^3) complexidade
### #097 — delivery-checklist vs definition-of-ready usam logica diferente para AC coverage
### #098 — skill-recommender nao valida availableSkills contra null
### #099 — fts-search destructura score duas vezes redundantemente
### #100 — prd-to-graph prioridade case-sensitive ("HIGH" nao reconhecido)
### #101 — prd-to-graph Pass 1.5 sobrescreve parentId ja definido no Pass 1

---

## Resumo de Impacto

### Fluxo esperado (CLAUDE.md)
```
init → set_phase(ANALYZE) → import_prd → next → context → [implementar] → analyze → update_status → next
```

### Fluxo real encontrado
```
init → BLOQUEADO (#001)
set_phase → BLOQUEADO (#001, #002)
reindex_knowledge → BLOQUEADO (#006)
[workaround: sqlite3 direto]
import_prd → Executa mas hierarquia errada (#008)
import_prd → Aceita /etc/passwd (#004)
write_memory → Path traversal (#003)
analyze(scope) → Dados incorretos (#030)
analyze(traceability) → Contradiz scope (#009)
analyze(review_ready) → Phantom blockers (#010)
manage_skill(list) → BLOQUEADO (#013) [em advisory mode!]
edge(list) → BLOQUEADO como "mutating" (#015)
```

---

## Categorias de Bugs

| Categoria | Qtd | Exemplos |
|-----------|-----|---------|
| **Deadlock/Gate** | 12 | #001, #002, #005, #006, #007, #013, #015, #019, #022 |
| **Seguranca** | 4 | #003, #004, #021, #053 |
| **Dados incorretos** | 15 | #008, #009, #010, #024, #028, #029, #030, #031, #034 |
| **Validacao ausente** | 18 | #016, #017, #018, #020, #025, #032, #036, #040, #041 |
| **Concorrencia** | 7 | #014, #019, #045, #047, #049, #050, #057 |
| **Inconsistencia** | 12 | #007, #035, #037, #039, #069, #079, #085, #097 |
| **Calculo errado** | 10 | #027, #034, #058, #059, #060, #061, #088, #091 |
| **UX/Mensagens** | 13 | #032, #033, #062, #063, #064, #066, #068, #076, #078 |
| **Resource leak** | 5 | #051, #052, #054, #056, #057 |
| **Feature incompleta** | 5 | #031, #042, #067, #071, #072 |

---

## Ambiente de Teste

| Item | Valor |
|------|-------|
| OS | macOS Darwin 25.3.0 |
| Node.js | 20+ |
| mcp-graph | @mcp-graph-workflow/mcp-graph@5.17.0 |
| SQLite | workflow-graph/graph.db |
| Projeto | graph-decompile |
| Data | 2026-03-28 |

---

## Workaround Global

```bash
# Desbloquear deadlock
sqlite3 workflow-graph/graph.db "UPDATE project_settings SET value='off' WHERE key='code_intelligence_mode';"
sqlite3 workflow-graph/graph.db "UPDATE project_settings SET value='advisory' WHERE key='lifecycle_strictness_mode';"
sqlite3 workflow-graph/graph.db "UPDATE project_settings SET value='off' WHERE key='tool_prerequisites_mode';"
```

---

## Top 10 Fixes Recomendados (por impacto)

1. **Whitelist set_phase, init, reindex_knowledge no code-intelligence-wrapper** — resolve #001, #002, #005, #006
2. **Path traversal validation em memory tools** — resolve #003 (SECURITY)
3. **Restricao de filepath em import_prd ao diretorio do projeto** — resolve #004 (SECURITY)
4. **Corrigir algoritmo de hierarquia do import_prd** — resolve #008
5. **Unificar whitelists entre lifecycle-wrapper e code-intelligence-wrapper** — resolve #007, #013, #015, #022
6. **Corrigir definicao de "blocked" nos gate checks** — resolve #010, #011, #012
7. **Corrigir analyze(scope) requirementsToTasks** — resolve #009, #030
8. **Validar ranges numericos (estimateMinutes, weight)** — resolve #016, #018
9. **Validar input vazio (id="", name="", query="")** — resolve #032, #033, #040, #062
10. **Adicionar transacoes em operacoes multi-step** — resolve #045, #047, #049
