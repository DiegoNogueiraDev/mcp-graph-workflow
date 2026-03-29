# Complete Partial Tasks — MCP Bug Investigation

## Goal
Entregar 100% as 3 tasks parcialmente concluidas (A2+, C3, D Layer 5) usando TDD.

## Tasks

### Task 1: A2+ — Parser adapters para 9 linguagens faltantes
**Node:** `node_a8836e2e0991` (in_progress)
**Gap:** Apenas Ruby tem parser adapter. Faltam: PHP, Swift, Kotlin, Scala, Elixir, Dart, Haskell, C++, Lua.

- [ ] **1.1** RED: Criar `src/tests/translation/multi-language-parsers-wave2.test.ts` com testes para os 9 parsers. Cada parser deve: ter `languageId` correto, retornar `>0` constructs para snippet valido, retornar `[]` para input vazio, detectar pelo menos `uc_fn_def` + `uc_class_def` (ou equivalente da linguagem) + `uc_if_else`. Rodar `npm test` — todos RED.
  → Verify: 9 describe blocks, todos falhando

- [ ] **1.2** GREEN: Criar os 9 parser adapters em `src/core/translation/parsers/`:
  - `php-parser-adapter.ts`
  - `swift-parser-adapter.ts`
  - `kotlin-parser-adapter.ts`
  - `scala-parser-adapter.ts`
  - `elixir-parser-adapter.ts`
  - `dart-parser-adapter.ts`
  - `haskell-parser-adapter.ts`
  - `cpp-parser-adapter.ts`
  - `lua-parser-adapter.ts`
  Seguir o pattern de `ruby-parser-adapter.ts`: `LINE_RULES[]` + `parseSnippet()` line-by-line.
  → Verify: `npm test` — todos GREEN

- [ ] **1.3** Registrar os 9 adapters + Ruby no `PARSERS` Map em `translation-orchestrator.ts` (linhas 101-108). Importar as classes e adicionar entradas `["php", new PhpParserAdapter()]`, etc. Ruby tambem nao esta registrado (tem adapter mas falta no Map).
  → Verify: `PARSERS.size` deve ser 16 (6 existentes + 10 novos incluindo Ruby)

- [ ] **1.4** REFACTOR: Revisar regexes, remover duplicacoes, rodar `npm run build && npm test && npm run lint`.
  → Verify: Build + tests + lint passando

---

### Task 2: C3 — Remover fallback "default" dos MCP tools
**Node:** `node_f0a05618d34c` (in_progress)
**Gap:** API usa `requireProjectId()` com throw, mas 2 MCP tools usam `?? "default"`.

- [ ] **2.1** RED: Criar teste em `src/tests/mcp/translate-code-project.test.ts` que verifica: quando `store.getProject()` retorna `null`, o tool retorna `mcpError` (nao `"default"`). Idem para `translation-jobs`.
  → Verify: Teste falhando (atualmente retorna "default" sem erro)

- [ ] **2.2** GREEN: Em `src/mcp/tools/translate-code.ts` (linha 110), substituir `store.getProject()?.id ?? "default"` por validacao que retorna `mcpError("No active project. Use init or activate a project first.")`. Idem em `src/mcp/tools/translation-jobs.ts` (linha 39).
  → Verify: `npm test` — GREEN

- [ ] **2.3** Rodar `npm run build && npm run lint`.
  → Verify: Build + lint passando

---

### Task 3: D Layer 5 — Integrar pre-indexed-analyzer no orchestrator
**Node:** `node_8dee7fd4e551` (in_progress)
**Gap:** `pre-indexed-analyzer.ts` existe mas `analyzeFromIndex()` nunca e chamado.

- [ ] **3.1** RED: Criar teste em `src/tests/translation/pre-indexed-integration.test.ts`:
  - Quando CodeStore tem symbols indexados para um arquivo, `analyzeSource()` com `filePath` deve retornar analysis baseada no index (sem precisar parsear)
  - Quando CodeStore nao tem dados, deve cair no fallback (parser normal)
  - Quando `filePath` nao e passado, deve usar parser normal
  → Verify: Testes falhando

- [ ] **3.2** GREEN: Modificar `TranslationOrchestrator`:
  - Constructor: adicionar `private readonly codeStore?: CodeStore` como 3o param opcional
  - `analyzeSource()`: adicionar params opcionais `filePath?: string, projectId?: string`
  - No inicio de `analyzeSource()`, se `filePath + projectId + codeStore` presentes, chamar `analyzeFromIndex()`. Se retornar resultado, retornar early.
  → Verify: `npm test` — GREEN

- [ ] **3.3** Atualizar os 3 locais que instanciam `TranslationOrchestrator` para passar `CodeStore`:
  - `src/mcp/tools/translate-code.ts` `getOrchestrator()` (linha 47-56)
  - `src/mcp/tools/analyze-translation.ts` `getOrchestrator()` (linha 47-56)
  - `src/api/routes/translation.ts` `getOrchestrator()` (linha 40-49)
  Pattern: `const codeStore = new CodeStore(db);` → passar como 3o arg.
  → Verify: `npm test && npm run build`

- [ ] **3.4** Atualizar call sites de `analyzeSource()` para passar `filePath` e `projectId` quando disponiveis (apenas nos fluxos que ja recebem `filePath` como input do usuario).
  → Verify: `npm test && npm run build && npm run lint`

---

### Task 4: Verificacao final
- [ ] **4.1** Rodar suite completa: `npm run build && npm run typecheck && npm test && npm run lint`
  → Verify: Zero errors em todos
- [ ] **4.2** Atualizar status dos 3 nodes para `done` no grafo + atualizar epics pai se 100%
  → Verify: `mcp-graph list --status done` confirma

## Done When
- [ ] 16 parser adapters registrados e testados (6 existentes + 10 novos)
- [ ] Zero uso de `?? "default"` para project ID em MCP tools
- [ ] `analyzeFromIndex()` integrado e chamado quando filePath disponivel
- [ ] `npm run build && npm run typecheck && npm test && npm run lint` — zero errors
