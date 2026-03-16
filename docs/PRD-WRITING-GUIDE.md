# Guia de Escrita de PRD para mcp-graph

> Como escrever um PRD que o parser do mcp-graph converte corretamente em um grafo de execução estruturado.

---

## Por que o formato importa?

O `import_prd` usa um pipeline de 4 estágios para converter texto em grafo:

```
Texto → Normalizar → Segmentar (por headings) → Classificar (heurísticas) → Grafar (nodes + edges)
```

Cada **heading markdown** (`#`, `##`, `###`) vira uma **seção** separada. O classificador usa **keywords no titulo** para determinar o tipo do node. Se o titulo nao tem keywords reconhecidas, a seção vira `unknown` e pode ser ignorada ou mal classificada.

---

## Keywords reconhecidas pelo classificador

| Tipo | Keywords no titulo (PT + EN) | Confianca |
|------|------------------------------|-----------|
| **epic** | `epic`, `visao`, `vision`, `objetivo principal`, `produto`, `projeto` | 0.8 |
| **task** | `task`, `entrega`, `implementar`, `criar`, `build`, `design`, `implement` | 0.7–0.85 |
| **requirement** | `requisito`, `requirement` | 0.9 |
| **constraint** | `restricao`, `constraint`, `nao deve`, `sem`, `fora do escopo` | 0.85 |
| **acceptance_criteria** | `aceite`, `criterio`, `acceptance`, `criteria`, `definition of done` | 0.9 |
| **risk** | `risco`, `risk`, `mitigacao`, `mitigation` | 0.7–0.85 |

> Headings de nivel 1 (`#`) sao automaticamente classificados como `epic`.

---

## Estrutura recomendada

### Formato basico

```markdown
# Nome do Projeto (epic automatico)

## Epic: Onboarding & Ativacao

### Task: Criar comando doctor para diagnostico do ambiente

Sprint: 1 | Prioridade: P0

Descricao do que precisa ser feito e por que.

- Implementar validacao de versao do Node.js
- Criar output humanizado com checkmarks
- Adicionar flag --json para output estruturado
- Criar testes unitarios para cada checker

### Task: Criar comando bootstrap para setup guiado

Sprint: 1 | Prioridade: P0

Descricao da task.

- Implementar modo interativo com prompts
- Criar modo nao-interativo com flags
- Adicionar deteccao automatica de stack
```

### Como o parser interpreta isso:

| Heading | Tipo gerado | Motivo |
|---------|-------------|--------|
| `# Nome do Projeto` | `epic` | Nivel 1 = epic automatico |
| `## Epic: Onboarding` | `epic` | Keyword "epic" no titulo |
| `### Task: Criar comando doctor` | `task` | Keyword "task" no titulo (confianca 0.85) |
| `- Implementar validacao...` | `subtask` | Bullet item dentro de `task` section = subtask |

---

## Regras de ouro

### 1. Use keywords no titulo dos headings

**Errado** — nao sera reconhecido como task:
```markdown
### Issue 1 — Add doctor command
### Feature: Doctor diagnostics
### #1 — Doctor
```

**Correto** — keywords que o parser reconhece:
```markdown
### Task: Add doctor command
### Implementar doctor diagnostics
### Criar comando doctor
```

### 2. Bullets dentro de task viram subtasks

Bullets (`- item`) dentro de uma secao `task` sao automaticamente promovidos a `subtask`:

```markdown
### Task: Criar AuthService

- Implementar validacao de JWT
- Criar middleware de autenticacao
- Adicionar testes de integracao
```

Resultado: 1 node `task` + 3 nodes `subtask` com `parentId` apontando para a task.

### 3. Nao use sub-headings para Acceptance Criteria

**Errado** — cria um node separado do tipo `acceptance_criteria` sem relacao com a task:
```markdown
### Task: Criar doctor

#### Acceptance Criteria

- [ ] Valida Node.js version
- [ ] Output com checkmarks
```

**Correto** — bullets diretamente na secao da task:
```markdown
### Task: Criar doctor

- Implementar validacao de Node.js version
- Criar output com checkmarks
- Adicionar flag --json
```

> Acceptance criteria detalhados podem ser adicionados via `update_node` apos o import, ou incluidos como bullets com verbos de acao.

### 4. Use `##` para epics e `###` para tasks

A hierarquia de headings define a estrutura:

```
# Projeto (epic raiz)
  ## Epic: Area funcional
    ### Task: O que fazer
      - Subtask como bullet
    ### Task: Outra coisa
```

### 5. Secoes informativas nao geram nodes

Secoes sem keywords reconhecidas viram `unknown` e nao geram nodes. Isso e util para contexto:

```markdown
### Context

Descricao do problema atual...

### Technical Notes

Detalhes de implementacao...
```

Essas secoes sao ignoradas pelo grafo (a menos que >50% dos bullets sejam tasks, caso em que a secao e promovida).

### 6. Dependencias podem ser inferidas por keywords

Se a descricao de uma task menciona o titulo de outra task junto com keywords de dependencia, o parser cria edges automaticamente:

**Keywords de dependencia:** `antes de`, `apos`, `depois de`, `depende de`, `before`, `after`, `depends on`

```markdown
### Task: Criar auth router

Depende de AuthService estar implementado. Criar apos AuthService.
```

### 7. Numeracao implica dependencia sequencial

Bullets numerados criam dependencias sequenciais automaticamente:

```markdown
### Task: Pipeline de deploy

1. Configurar CI/CD
2. Criar Dockerfile
3. Adicionar health check
```

Resultado: item 2 `depends_on` item 1, item 3 `depends_on` item 2.

---

## Templates prontos

### Template minimo (quickstart)

```markdown
# Meu Projeto

## Epic: MVP

### Task: Criar backend API

- Implementar endpoints REST
- Configurar banco de dados
- Adicionar autenticacao

### Task: Criar frontend

- Implementar tela de login
- Criar dashboard principal
- Adicionar navegacao
```

### Template completo (recomendado)

```markdown
# Nome do Projeto

> Descricao breve do projeto e objetivo principal.

## Epic: Onboarding

### Requisito: Usuarios devem conseguir comecar em menos de 5 minutos

### Task: Criar wizard de setup

Sprint: 1 | Prioridade: P0

O usuario precisa de um fluxo guiado para configurar o projeto pela primeira vez.

- Implementar deteccao automatica de stack
- Criar prompts interativos para configuracao
- Adicionar modo nao-interativo com flags
- Criar testes de integracao

### Task: Criar documentacao de quick-start

Sprint: 1 | Prioridade: P1

- Criar guia passo-a-passo com screenshots
- Adicionar video tutorial de 2 minutos
- Criar exemplos para cada stack suportado

### Restricao: Nao depender de servicos externos

O projeto deve funcionar 100% offline apos instalacao.

### Risco: Complexidade da deteccao de stack

Deteccao automatica pode falhar para monorepos ou stacks nao-convencionais.

## Epic: Core Features

### Task: Implementar motor de busca

Sprint: 2 | Prioridade: P0

- Criar indice FTS5 para busca full-text
- Implementar ranking BM25
- Adicionar suporte a queries em portugues e ingles
```

---

## O que evitar

| Antipadrao | Problema | Solucao |
|------------|----------|---------|
| `### Issue 1 — Title` | "Issue" nao e keyword reconhecida | Use `### Task: Title` |
| `### Feature: Title` | "Feature" nao e keyword reconhecida | Use `### Task: Title` ou `### Implementar Title` |
| `#### Acceptance Criteria` como sub-heading | Cria node AC separado sem pai | Coloque bullets direto na secao da task |
| `- [ ] checkbox items` | `[ ]` nao e tratado especialmente | Use `- item` sem checkbox |
| Tabelas markdown | Parser nao extrai dados de tabelas | Use bullets ou texto corrido |
| Headings sem keywords | Secao fica `unknown`, ignorada | Adicione keyword: `Task:`, `Epic:`, `Requisito:` |

---

## Apos o import

Depois de `import_prd`, refine o grafo com ferramentas MCP:

1. **`list`** — Verificar nodes criados
2. **`show <id>`** — Ver detalhes de cada node
3. **`update_node <id>`** — Adicionar `acceptanceCriteria`, `tags`, `estimateMinutes`, `xpSize`
4. **`edge`** — Criar dependencias manuais
5. **`decompose`** — Detectar tasks grandes para quebrar
6. **`plan_sprint`** — Gerar plano de sprint

---

## Referencia tecnica

O pipeline de import esta em:

| Modulo | Arquivo | Funcao |
|--------|---------|--------|
| Normalizar | `src/core/parser/normalize.ts` | Padroniza line endings, bullets, whitespace |
| Segmentar | `src/core/parser/segment.ts` | Divide por headings markdown |
| Classificar | `src/core/parser/classify.ts` | Heuristicas de keywords (PT + EN) |
| Extrair | `src/core/parser/extract.ts` | Orquestra pipeline, promove subtasks |
| Grafar | `src/core/importer/prd-to-graph.ts` | Converte em nodes + edges + deps |
