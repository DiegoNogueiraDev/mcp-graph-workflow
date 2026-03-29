<!-- mcp-graph:start -->
## mcp-graph — mcp-graph-workflow

Este projeto usa **mcp-graph** para gestão de execução via grafo persistente (SQLite).
Dados armazenados em `workflow-graph/graph.db` (local, gitignored).

### ⚠️ Regra de Execução OBRIGATÓRIA

**O mcp-graph é a fonte de verdade ABSOLUTA. Nenhuma implementação acontece fora do grafo.**

1. **Node deve existir** — antes de escrever QUALQUER código, o node correspondente DEVE existir no grafo
2. **Fluxo obrigatório** — `next → context → rag_context → [implementar com TDD] → analyze(implement_done) → update_status → next` — SEM EXCEÇÕES
3. **Epic = estrutura primeiro** — criar Epic + tasks filhas + edges ANTES de implementar
4. **Status tracking** — `update_status → in_progress` ANTES de codar, `→ done` APÓS completar
5. **Validação** — usar `validate` (action: `ac`) após cada task para checar critérios de aceitação
6. **Zero trabalho não-rastreado** — se não tem node no grafo, CRIAR PRIMEIRO

> **Sem node no grafo = sem código escrito.**

### Ferramentas MCP disponíveis (46 tools + 6 deprecated)

#### Projeto & Grafo

| Tool | Quando usar |
|------|-------------|
| `init` | Inicializar grafo do projeto (cria DB, AI memory files, detecta MCPs) |
| `list` | Listar nodes do grafo (filtrar por tipo/status/parent) |
| `show` | Ver detalhes de um node específico (metadata, deps, knowledge) |
| `search` | Busca full-text no grafo (FTS5 + BM25 ranking) |
| `export` | Exportar grafo (JSON completo ou Mermaid diagram) |
| `snapshot` | Criar/restaurar snapshots do grafo (backup/rollback) |
| `metrics` | Estatísticas do grafo (`stats`) ou velocidade por sprint (`velocity`) |

#### Nodes & Edges

| Tool | Quando usar |
|------|-------------|
| `node` | CRUD de nodes: action `add` (criar), `update` (atualizar), `delete` (remover) |
| `move_node` | Mover node para outro parent |
| `clone_node` | Clonar node com filhos (deep copy) |
| `edge` | Criar/remover relações entre nodes (depends_on, blocks, related_to) |
| `update_status` | Mudar status de um node (backlog→ready→in_progress→done) |
| `bulk_update_status` | Atualizar status de múltiplos nodes de uma vez |

#### PRD & Planejamento

| Tool | Quando usar |
|------|-------------|
| `import_prd` | Importar PRD → segmentar → classificar → extrair → inferir deps → criar grafo + indexar knowledge |
| `plan_sprint` | Gerar relatório de planejamento de sprint (capacity, velocity, recomendações) |
| `analyze` | 24 modos de análise por fase do lifecycle (ver modos abaixo) |
| `set_phase` | Forçar/resetar fase do lifecycle (strict/advisory, gate checks) + Code Intelligence mode (strict/advisory/off) + Tool Prerequisites mode (strict/advisory/off) |

#### Contexto & RAG

| Tool | Quando usar |
|------|-------------|
| `next` | Próxima task recomendada (prioridade + deps + knowledge coverage 0-1 + TDD hints + velocity) |
| `context` | Contexto comprimido da task (token-efficient, ~73% redução) |
| `rag_context` | Contexto RAG phase-aware (tiers: summary/standard/deep, budget 60/30/10) |
| `reindex_knowledge` | Rebuild completo do índice de knowledge (BM25 + TF-IDF) |
| `sync_stack_docs` | Sincronizar docs das libs do projeto via Context7 |

#### Memórias do Projeto

| Tool | Quando usar |
|------|-------------|
| `write_memory` | Escrever memória em workflow-graph/memories/{name}.md (auto-indexa no RAG) |
| `read_memory` | Ler conteúdo de uma memória específica |
| `list_memories` | Listar todas as memórias disponíveis |
| `delete_memory` | Remover memória do filesystem e do knowledge store |

#### Validação

| Tool | Quando usar |
|------|-------------|
| `validate` | Validação: action `task` (browser A/B com Playwright) ou `ac` (critérios de aceitação) |

#### Skills

| Tool | Quando usar |
|------|-------------|
| `manage_skill` | Gerenciar skills: action `list` (listar/filtrar por fase), `enable`/`disable`, CRUD de custom skills |

#### Utilitários

| Tool | Quando usar |
|------|-------------|
| `help` | Referência on-demand de tools, analyze modes, skills, CLI, workflow |
| `journey` | Gerenciar journey maps de websites (list, get, search, index para RAG) |
| `import_graph` | Importar/merge grafo JSON exportado (local wins, dry_run disponível) |

#### Code Intelligence (LSP)

| Tool | Quando usar |
|------|-------------|
| `code_intelligence` | Análise semântica via LSP: definition, references, hover, rename, call_hierarchy, diagnostics, symbols. Multi-language (TS, Python, Rust, Go, Java, C/C++, Ruby, PHP, Kotlin, Swift, C#, Lua) |

#### Knowledge Avançado

| Tool | Quando usar |
|------|-------------|
| `knowledge_feedback` | Feedback em docs do knowledge store (helpful/unhelpful/outdated) para melhorar RAG |
| `knowledge_stats` | Estatísticas do knowledge store: contagem por source, qualidade, docs mais acessados |
| `export_knowledge` | Export/import/preview de knowledge packages para colaboração entre projetos |

#### Siebel CRM (8 tools)

| Tool | Quando usar |
|------|-------------|
| `siebel_import_sif` | Importar .SIF (XML Siebel) — parse, extrai objetos, mapeia no grafo, indexa no knowledge |
| `siebel_analyze` | Analisar objetos Siebel: impact, dependencies, circular, diff, refactor_script, troubleshoot |
| `siebel_composer` | Automação do Siebel Composer via Playwright: navigate, import_sif, edit, publish, capture |
| `siebel_env` | Gerenciar ambientes Siebel CRM: list, add, remove |
| `siebel_validate` | Validar .SIF: full, naming, security, performance, migration_ready, code_review |
| `siebel_search` | Buscar objetos Siebel indexados no knowledge store (BCs, Applets, Views, Workflows) |
| `siebel_generate_sif` | Gerar SIF: prepare, finalize, templates, scaffold, clone_adapt, auto_wire, wsdl_to_sif |
| `siebel_import_docs` | Importar docs (Swagger/WSDL/PDF/HTML/DOCX/MD) no knowledge store para contexto Siebel |

#### Translation (3 tools)

| Tool | Quando usar |
|------|-------------|
| `translate_code` | Traduzir código entre linguagens — cria job, analisa constructs, gera prompt, finaliza com código |
| `analyze_translation` | Analisar código-fonte para prontidão de tradução (language, constructs, complexity, translatability) |
| `translation_jobs` | Gerenciar jobs de tradução: list, get, delete, stats |

#### Tools Deprecated (backward compat, removidos na v7.0)

| Tool antigo | Usar no lugar |
|-------------|---------------|
| `add_node` | `node` com action:`add` |
| `update_node` | `node` com action:`update` |
| `delete_node` | `node` com action:`delete` |
| `validate_task` | `validate` com action:`task` |
| `validate_ac` | `validate` com action:`ac` |
| `list_skills` | `manage_skill` com action:`list` |

### Modos do analyze por fase

| Fase | Modo | O que verifica |
|------|------|----------------|
| ANALYZE | `prd_quality` | Qualidade do PRD (completude, user stories, AC) |
| ANALYZE | `scope` | Escopo do grafo (tipos, distribuição, cobertura) |
| ANALYZE | `ready` | Definition of Ready (bloqueios, dependências, AC) |
| ANALYZE | `risk` | Riscos (complexidade, deps, tamanho, AC faltantes) |
| ANALYZE | `blockers` | Bloqueios transitivos de um node |
| ANALYZE | `cycles` | Ciclos de dependência no grafo |
| ANALYZE | `critical_path` | Caminho crítico (sequência mais longa de deps) |
| PLAN | `decompose` | Tasks grandes que precisam ser decompostas |
| DESIGN | `adr` | Validação de ADRs (Architecture Decision Records) |
| DESIGN | `traceability` | Matriz de rastreabilidade (req → task → test) |
| DESIGN | `coupling` | Acoplamento entre módulos |
| DESIGN | `interfaces` | Verificação de interfaces e contratos |
| DESIGN | `tech_risk` | Riscos técnicos (complexidade, stack, deps externas) |
| DESIGN | `design_ready` | Gate DESIGN→PLAN (pré-requisitos atendidos?) |
| IMPLEMENT | `implement_done` | Definition of Done (8 checks: 4 required + 4 recommended) |
| IMPLEMENT | `tdd_check` | Aderência TDD (specs sugeridos por AC) |
| IMPLEMENT | `progress` | Sprint burndown + velocity trend + blockers + ETA |
| VALIDATE | `validate_ready` | Gate IMPLEMENT→VALIDATE |
| VALIDATE | `done_integrity` | Integridade dos nodes marcados done |
| VALIDATE | `status_flow` | Fluxo de status válido (sem pulos) |
| REVIEW | `review_ready` | Gate VALIDATE→REVIEW |
| HANDOFF | `handoff_ready` | Gate REVIEW→HANDOFF |
| HANDOFF | `doc_completeness` | Completude de documentação |
| LISTENING | `listening_ready` | Gate HANDOFF→LISTENING |
| LISTENING | `backlog_health` | Saúde do backlog (distribuição, aging) |

### Fluxo de trabalho OBRIGATÓRIO

```
next → context → rag_context → [implementar com TDD] → analyze(implement_done) → update_status → next
```

### Lifecycle (8 fases)

1. **ANALYZE** — Criar PRD, definir requisitos (`import_prd`, `add_node`)
2. **DESIGN** — Arquitetura, decisões técnicas (`add_node`, `edge`, `analyze`)
3. **PLAN** — Sprint planning, decomposição (`plan_sprint`, `analyze`, `sync_stack_docs`)
4. **IMPLEMENT** — TDD Red→Green→Refactor (`next`, `context`, `update_status`, `analyze` — modes: implement_done, tdd_check, progress)
5. **VALIDATE** — Testes E2E, critérios de aceitação (`validate_task`, `metrics`)
6. **REVIEW** — Code review, blast radius (`export`, `metrics`)
7. **HANDOFF** — PR, documentação, entrega (`export`, `snapshot`)
8. **LISTENING** — Feedback, novo ciclo (`add_node`, `import_prd`)

### Pipeline de Conhecimento (Knowledge Store + RAG)

Fontes indexadas automaticamente:
- **Project memories** — ao escrever com `write_memory` (auto-indexa)
- **PRD imports** — ao importar com `import_prd`
- **Browser captures** — ao validar com `validate_task`
- **Stack docs** — ao sincronizar com `sync_stack_docs`
- **Sprint reports** — ao gerar com `plan_sprint`

Recuperação: `rag_context` monta contexto phase-aware com budget de tokens:
- 60% contexto do grafo (nodes, deps, status)
- 30% knowledge store (BM25 + TF-IDF)
- 10% metadata de fase

Manual: `reindex_knowledge` para rebuild completo do índice.

### Skills Built-in (40 skills)

40 skills mapeadas às fases do lifecycle. Use `list_skills` para descobrir por fase ou ver instruções completas.

#### Skills por fase

| Fase | Skills sugeridas |
|------|-----------------|
| ANALYZE | `create-prd-chat-mode`, `business-analyst`, `product-manager` |
| DESIGN | `breakdown-epic-arch`, `context-architect`, `backend-architect` |
| PLAN | `breakdown-feature-prd`, `track-with-mcp-graph` |
| IMPLEMENT | `subagent-driven-development`, `xp-bootstrap`, `self-healing-awareness` |
| VALIDATE | `playwright-explore-website`, `playwright-generate-test`, `e2e-testing` |
| REVIEW | `code-reviewer`, `code-review-checklist`, `review-and-refactor`, `observability-engineer` |

#### Categorias adicionais (multi-fase)

| Categoria | Skills |
|-----------|--------|
| software-design | SOLID, KISS, YAGNI, DRY, clean-architecture, composition-over-inheritance |
| security | `owasp-web-security`, `auth-and-secrets`, `database-and-deps-security` |
| ddd | `domain-driven-design` (DESIGN, PLAN) |
| testing | `comprehensive-testing-reference`, `self-healing-awareness` (IMPLEMENT, VALIDATE) |
| cost-reducer | `cloud-infra-cost`, `code-level-savings`, `finops-services` (DESIGN, REVIEW) |
| frontend-design | `ui-ux-patterns` (DESIGN, IMPLEMENT) |

#### Custom Skills

Crie skills específicas do projeto via `manage_skill` (create/enable/disable). Custom skills são armazenadas no grafo e aparecem junto com as built-in em `list_skills`.

#### Self-Healing Awareness

A skill `self-healing-awareness` monitora padrões de erro recorrentes e sugere correções automaticamente. Ativa nas fases IMPLEMENT e VALIDATE.

### Princípios XP Anti-Vibe-Coding

- **TDD obrigatório** — Teste antes do código. Sem teste = sem implementação.
- **Anti-one-shot** — Nunca gere sistemas inteiros em um prompt. Decomponha em tasks atômicas.
- **Decomposição atômica** — Cada task deve ser completável em ≤2h.
- **Code detachment** — Se a IA errou, explique o erro via prompt. Nunca edite manualmente.
- **CLAUDE.md como spec evolutiva** — Documente padrões e decisões aqui.

### Comandos essenciais

```bash
npx mcp-graph stats            # Estatísticas do grafo
npx mcp-graph list             # Listar nodes
npx mcp-graph update           # Atualizar configs para última versão
npx mcp-graph doctor           # Validar ambiente de execução
npx mcp-graph doctor --json    # Diagnóstico em JSON estruturado
npx mcp-graph serve --port 3000  # Dashboard visual
```
<!-- mcp-graph:end -->
