# PRD: Code Graph Multi-Language — Indexação Universal

> **Versão:** 1.0
> **Data:** 2026-03-29
> **Autor:** Diego Nogueira
> **Status:** Draft
> **Prioridade:** P1

---

## 1. Problema

O mcp-graph hoje indexa **apenas TypeScript/JavaScript** no Code Graph. Quando instalado em projetos de outras linguagens (Java, Go, Rust, Python, C/C++, Ruby, PHP, Kotlin, Swift, C#, Lua), o Code Intelligence fica vazio — sem symbols, sem impact analysis, sem RAG de código, sem visualização no dashboard.

Isso limita a proposta de valor do mcp-graph como ferramenta universal de gestão de execução com code intelligence integrado.

## 2. Objetivo

Tornar o mcp-graph capaz de **indexar automaticamente qualquer projeto em qualquer linguagem**, extraindo symbols, relações, docstrings e visibilidade de forma **determinística** (AST-based), com IA como fallback apenas para cenários ambíguos.

## 3. Público-alvo

- Desenvolvedores que usam mcp-graph em projetos não-TypeScript
- Equipes com projetos multi-linguagem (ex: backend Go + frontend React)
- Projetos legados em Java, C/C++, Ruby, PHP que precisam de code intelligence

## 4. Princípio Arquitetural

**Determinismo primeiro, IA como fallback.**

```
1. DETERMINÍSTICO — Tree-sitter AST + S-expression queries
2. RULE-BASED — Regras documentadas por linguagem (visibility, docstrings, test patterns)
3. LSP-ENRICHED — Language Server Protocol (opcional, se disponível)
4. AI FALLBACK — LLM como último recurso (syntax errors graves, linguagens sem grammar)
```

## 5. Linguagens Suportadas

| Tier | Linguagens | Prioridade |
|------|-----------|------------|
| Tier 1 (core) | Python, Go, Rust | Alta — grammars mais maduros |
| Tier 2 (enterprise) | Java, C/C++, C# | Alta — projetos enterprise |
| Tier 3 (complementar) | Ruby, PHP, Kotlin, Swift, Lua | Média |
| Existente | TypeScript, JavaScript | Mantido (TsAnalyzer nativo) |

## 6. User Stories

### US-01: Indexação automática de projeto Python
**Como** desenvolvedor Python,
**Quero** instalar o mcp-graph no meu projeto e ter todas as funções, classes e imports indexados automaticamente,
**Para que** o Code Intelligence funcione com impact analysis, RAG e visualização no dashboard.

**Acceptance Criteria:**
- AC-01.1: `npm install mcp-graph` em projeto com `pyproject.toml` → auto-detecta Python
- AC-01.2: `reindex` extrai functions, classes, methods, decorators com nomes e linhas corretos
- AC-01.3: Docstrings (PEP 257) extraídas e armazenadas no campo `docstring`
- AC-01.4: Visibility detectada: `_private`, `__mangled`, public (sem prefixo)
- AC-01.5: Imports (`import`, `from x import y`) geram relações `imports` no grafo
- AC-01.6: Chamadas de função geram relações `calls`
- AC-01.7: Herança (`class Foo(Bar)`) gera relações `extends`
- AC-01.8: Symbols aparecem no dashboard Code Graph tab com filtro "Python"
- AC-01.9: `rag_context` retorna symbols Python com docstrings

### US-02: Indexação automática de projeto Go
**Como** desenvolvedor Go,
**Quero** que funções, structs, interfaces e methods do meu projeto sejam indexados,
**Para que** impact analysis funcione corretamente com as convenções Go.

**Acceptance Criteria:**
- AC-02.1: Projeto com `go.mod` → auto-detecta Go
- AC-02.2: Functions, methods (com receiver), structs, interfaces extraídos
- AC-02.3: Export detection por uppercase: `HandleRequest` = exported, `handleRequest` = unexported
- AC-02.4: GoDoc (comentário `//` antes da declaração) extraído como docstring
- AC-02.5: `*_test.go` excluídos da indexação (test pattern)
- AC-02.6: Package declarations detectadas como `package` symbol kind
- AC-02.7: `vendor/` ignorado na varredura de diretórios

### US-03: Indexação automática de projeto Rust
**Como** desenvolvedor Rust,
**Quero** que functions, structs, traits, impls e modules sejam indexados,
**Para que** blast radius analysis funcione com o sistema de ownership do Rust.

**Acceptance Criteria:**
- AC-03.1: Projeto com `Cargo.toml` → auto-detecta Rust
- AC-03.2: Functions, structs, enums, traits, impl blocks, modules extraídos
- AC-03.3: Visibility: `pub`, `pub(crate)`, `pub(super)`, private (default) detectados
- AC-03.4: Rustdoc (`///`, `//!`) extraídos como docstring
- AC-03.5: `use` declarations geram relações `imports`
- AC-03.6: Macro definitions detectadas como `macro` symbol kind
- AC-03.7: `target/` ignorado

### US-04: Indexação automática de projeto Java
**Como** desenvolvedor Java,
**Quero** que classes, interfaces, methods, annotations e packages sejam indexados,
**Para que** o grafo represente a hierarquia do projeto fielmente.

**Acceptance Criteria:**
- AC-04.1: Projeto com `pom.xml` ou `build.gradle` → auto-detecta Java
- AC-04.2: Classes, interfaces, enums, records, methods, constructors, fields extraídos
- AC-04.3: Visibility: `public`, `protected`, `private`, package-private detectados
- AC-04.4: Javadoc (`/** */`) extraído como docstring
- AC-04.5: Annotations detectadas como `annotation` symbol kind
- AC-04.6: `import` declarations geram relações `imports`
- AC-04.7: `method_invocation` gera relações `calls`
- AC-04.8: `extends`/`implements` geram relações correspondentes
- AC-04.9: `src/test/` e `*Test.java` excluídos da indexação

### US-05: Indexação de projeto C/C++
**Como** desenvolvedor C/C++,
**Quero** que functions, structs, classes, namespaces e includes sejam indexados,
**Para que** impact analysis funcione em codebases C/C++ grandes.

**Acceptance Criteria:**
- AC-05.1: Projeto com `CMakeLists.txt` ou `compile_commands.json` → auto-detecta C/C++
- AC-05.2: Functions, structs, unions, enums (C), classes, namespaces, templates (C++) extraídos
- AC-05.3: `#include` gera relações `imports`
- AC-05.4: `static` = internal linkage detectado como visibility `private`
- AC-05.5: Doxygen (`/** */`, `///`) extraído como docstring
- AC-05.6: `build/`, `cmake-build-*/` ignorados

### US-06: Indexação de projeto C#
**Como** desenvolvedor .NET,
**Quero** que classes, structs, interfaces, methods, properties e namespaces sejam indexados.

**Acceptance Criteria:**
- AC-06.1: Projeto com `.csproj` → auto-detecta C#
- AC-06.2: Classes, structs, interfaces, records, enums, methods, properties, fields extraídos
- AC-06.3: Visibility: `public`, `internal`, `protected`, `private`, `protected internal` detectados
- AC-06.4: XML doc comments (`/// <summary>`) extraídos como docstring
- AC-06.5: `using` directives geram relações `imports`
- AC-06.6: `bin/`, `obj/` ignorados

### US-07: Syntax Enrichment no banco de dados
**Como** o sistema RAG,
**Quero** que cada symbol tenha `docstring`, `source_snippet`, `visibility` e `language` armazenados,
**Para que** queries retornem contexto semântico real (não apenas nomes de funções).

**Acceptance Criteria:**
- AC-07.1: Coluna `language TEXT` no `code_symbols` com default 'typescript'
- AC-07.2: Coluna `docstring TEXT` armazenando documentação extraída do código
- AC-07.3: Coluna `source_snippet TEXT` com primeiras ~20 linhas do corpo do symbol
- AC-07.4: Coluna `visibility TEXT` com public/private/protected/internal/package
- AC-07.5: FTS5 index recriado incluindo `docstring` para busca por descrição
- AC-07.6: Migration backward-compatible (ALTERs com defaults)
- AC-07.7: TsAnalyzer existente populando os novos campos para TS/JS

### US-08: Referência determinística por linguagem
**Como** o sistema de indexação,
**Quero** ter regras determinísticas documentadas para cada linguagem (visibility, docstrings, test patterns, imports, ignored dirs),
**Para que** a extração seja previsível e não dependa de heurísticas de IA.

**Acceptance Criteria:**
- AC-08.1: Arquivo `reference-content.ts` com `LANGUAGE_REFERENCES` tipado
- AC-08.2: Cada linguagem tem: nodeTypes, visibilityRules, docstringPattern, testPatterns, importPatterns, ignoredDirs
- AC-08.3: Regras baseadas em documentação oficial (PEP 257, GoDoc, Rustdoc, Javadoc, etc.)
- AC-08.4: Testes validam que cada referência cobre os cenários da linguagem

### US-09: RAG integration multi-language
**Como** agente usando `rag_context`,
**Quero** que o contexto retornado inclua symbols de todas as linguagens do projeto com docstrings reais,
**Para que** eu tenha entendimento semântico do codebase completo.

**Acceptance Criteria:**
- AC-09.1: `code-context-indexer` cria knowledge docs agrupados por linguagem
- AC-09.2: Docstrings reais incluídas nos docs (não apenas nomes)
- AC-09.3: `code-search` aceita filtro `language` opcional
- AC-09.4: Code Intelligence wrapper inclui language stats no `_code_intelligence` block
- AC-09.5: `rag_context` com query "Python functions" retorna symbols Python

### US-10: Dashboard multi-language
**Como** usuário do dashboard,
**Quero** ver symbols de todas as linguagens no Code Graph tab com filtros e cores por linguagem,
**Para que** eu visualize a estrutura do projeto multi-linguagem.

**Acceptance Criteria:**
- AC-10.1: Cores diferentes por linguagem (Python=#3776ab, Go=#00add8, Rust=#dea584, etc.)
- AC-10.2: Filtro por linguagem no painel de filtros
- AC-10.3: Badge de linguagem nos nodes do grafo
- AC-10.4: Hover em node mostra docstring preview
- AC-10.5: Status endpoint retorna stats por linguagem (`/code-graph/status`)

### US-11: AI Fallback para cenários ambíguos
**Como** o sistema de indexação,
**Quero** ter um fallback baseado em LLM para quando o parser determinístico falha,
**Para que** o sistema nunca retorne vazio mesmo em código quebrado ou linguagens não suportadas.

**Acceptance Criteria:**
- AC-11.1: Linguagem sem grammar tree-sitter → LLM extrai symbols via prompt structured
- AC-11.2: Arquivos com ERROR nodes graves → symbols parciais do tree-sitter + gaps do LLM
- AC-11.3: Resultado do fallback marcado com `metadata.aiGenerated: true`
- AC-11.4: Fallback nunca executado quando parser determinístico funciona

### US-12: Projeto multi-linguagem (mixed)
**Como** desenvolvedor com projeto TS + Python + Go,
**Quero** que todas as linguagens sejam indexadas simultaneamente,
**Para que** o grafo represente o projeto completo.

**Acceptance Criteria:**
- AC-12.1: TsAnalyzer indexa `.ts/.js`, TreeSitterAnalyzer indexa `.py/.go`
- AC-12.2: Sem conflito de extensões (TsAnalyzer tem prioridade para TS/JS)
- AC-12.3: Stats por linguagem corretas no `/code-graph/status`
- AC-12.4: Filtro por linguagem funciona no dashboard
- AC-12.5: Impact analysis funciona cross-language (se symbols compartilham nomes)

### US-13: Tradutor com contexto de referência
**Como** o `translate_code` tool,
**Quero** usar as regras de referência por linguagem para mapear construtos entre source e target,
**Para que** a tradução preserve visibility, naming conventions e padrões idiomáticos.

**Acceptance Criteria:**
- AC-13.1: Tradutor consulta `LANGUAGE_REFERENCES` para source e target language
- AC-13.2: Visibility mapeada: `pub` (Rust) → `public` (Java), Uppercase (Go) → `pub` (Rust)
- AC-13.3: Docstring format convertido: `///` (Rust) → `/** */` (Java) → `"""` (Python)

## 7. Requisitos Não-Funcionais

| Requisito | Meta |
|-----------|------|
| Performance | Indexar 1000+ arquivos multi-lang em < 30s |
| Memory | Grammars WASM carregados lazy (apenas linguagens detectadas) |
| Backward compat | Projetos TS/JS existentes não afetados |
| Graceful degradation | Grammar não instalado → linguagem ignorada (sem crash) |
| Disk footprint | `optionalDependencies` para grammars (~2-5MB cada) |

## 8. Fora de Escopo (v1)

- Mixed-language files (PHP dentro de HTML, JSX com CSS) — skip embedded languages
- Incremental parsing com `tree.edit()` — full reparse por enquanto
- Custom grammars definidos pelo usuário
- Cross-file type resolution (requer type checker, não apenas parser)

## 9. Dependências

| Dependência | Tipo | Versão |
|------------|------|--------|
| `web-tree-sitter` | npm dependency | ^0.24.0 |
| `tree-sitter-python` | npm optionalDep | ^0.23.0 |
| `tree-sitter-go` | npm optionalDep | ^0.23.0 |
| `tree-sitter-rust` | npm optionalDep | ^0.23.0 |
| `tree-sitter-java` | npm optionalDep | ^0.23.0 |
| `tree-sitter-c` | npm optionalDep | ^0.23.0 |
| `tree-sitter-cpp` | npm optionalDep | ^0.23.0 |
| `tree-sitter-ruby` | npm optionalDep | ^0.23.0 |
| `tree-sitter-php` | npm optionalDep | ^0.23.0 |
| `tree-sitter-kotlin` | npm optionalDep | ^0.3.0 |
| `tree-sitter-swift` | npm optionalDep | ^0.5.0 |
| `tree-sitter-c-sharp` | npm optionalDep | ^0.23.0 |
| `tree-sitter-lua` | npm optionalDep | ^0.2.0 |

## 10. Métricas de Sucesso

- 11 linguagens indexando corretamente em projetos reais
- Docstrings extraídas em > 90% dos symbols documentados
- RAG retornando contexto multi-language com docstrings
- Dashboard visualizando grafo multi-language com filtros
- Zero regressão em projetos TS/JS existentes
- Performance < 30s para 1000 arquivos
