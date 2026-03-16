# Product Backlog — mcp-graph-workflow

> Direcao estrategica: Mover o projeto de "ferramenta tecnicamente impressionante" para "ferramenta inevitavel no workflow do desenvolvedor". Tres frentes: adocao, confiabilidade, diferenciacao.

## Epic: Onboarding & Activation

### Task: Criar comando doctor para diagnostico do ambiente

Sprint: 1 | Prioridade: P0

O projeto depende de Node.js >= 20, SQLite, dashboard, Playwright, `.mcp.json` e integracoes opcionais. Um setup quebrado mata a adocao cedo. Nao existe um unico comando para validar readiness.

- Implementar validacao de Node.js version, write permissions, SQLite database, dashboard build, Playwright, `.mcp.json`, integration status
- Criar output humanizado com checkmarks por check
- Adicionar flag --json para output estruturado
- Implementar sugestoes automaticas de correcao para problemas comuns
- Criar exit code 0 quando todos os checks criticos passam, non-zero caso contrario
- Implementar separacao de niveis ok, warning e error
- Criar testes unitarios para cada checker
- Adicionar documentacao no README e Getting Started

### Task: Criar comando bootstrap para setup guiado de primeiro uso

Sprint: 1 | Prioridade: P0

O conjunto atual de comandos e poderoso mas usuarios novos precisam entender multiplos passos. Isso aumenta o time-to-value.

- Implementar modo interativo com prompts para nome do projeto, path do PRD, stack, auto-start do dashboard
- Criar modo nao-interativo com flag --non-interactive
- Implementar sequencia init, validate env, detect stack, import PRD, build indexes, suggest first sprint, optionally launch dashboard
- Criar output final com proximos comandos recomendados
- Implementar graceful degradation para PRDs minimos
- Criar mensagens de falha recuperaveis e claras
- Adicionar documentacao no README

### Task: Criar modo quickstart de import para PRDs pequenos

Sprint: 2 | Prioridade: P0

Usuarios avaliando o projeto geralmente tem PRDs pequenos, bagunçados ou leves. Precisam de valor rapido sem aprender o modelo completo do grafo.

- Implementar flag --quickstart no import
- Criar inferencia agressiva de hierarquia epic/task a partir da estrutura
- Implementar prioridades default sensiveis
- Criar acceptance criteria minimos quando ausentes
- Implementar heuristicas simples de dependencia
- Adicionar marcacao needsReview true para itens de baixa confianca
- Implementar protecao contra sobrescrita de campos explicitos

## Epic: Planning Intelligence

### Task: Adicionar decision trace e explicabilidade ao next

Sprint: 1 | Prioridade: P0

O next e central para a confianca no produto. Usuarios precisam entender por que uma task foi escolhida e por que outras nao foram.

- Implementar objeto decisionTrace com selectedBecause, rejectedCandidates e alternatives top 5
- Criar listagem de blocking dependency IDs para tasks bloqueadas
- Disponibilizar via MCP tool, REST API e CLI
- Implementar flag --verbose no CLI para trace detalhado
- Criar resultado deterministico para o mesmo estado do grafo
- Implementar testes que verificam reasoning output, nao apenas task selecionada

### Task: Implementar confidence scoring visivel no pipeline de import e dashboard

Sprint: 1 | Prioridade: P0

Confidence scoring ja existe internamente mas nao e totalmente visivel para usuarios.

- Implementar flag --strict no import que rejeita itens abaixo de threshold configuravel
- Criar filtro REST API GET /api/nodes?maxConfidence=0.7
- Implementar filtro confidenceBelow no MCP list tool
- Criar painel Review Queue no dashboard com itens de baixa confianca
- Implementar exibicao de score, razao de classificacao e segmento fonte
- Criar acao de aprovar/override classificacao no review queue
- Adicionar documentacao de semantica de confianca e ranges de score

### Task: Implementar deteccao de tasks duplicadas e requisitos conflitantes

Sprint: 2 | Prioridade: P1

PRDs reais frequentemente contem requisitos repetidos, user stories similares ou acceptance criteria conflitantes. Isso degrada qualidade do grafo.

- Implementar deteccao de near-duplicates durante import com similarity score
- Criar deteccao de acceptance criteria conflitantes entre tasks relacionadas
- Implementar sugestao de merge candidates sem auto-merge por default
- Criar alertas de dependencias contraditorias ou referencias circulares
- Implementar warnings no CLI output, API response e dashboard
- Criar threshold de similaridade configuravel

### Task: Criar engine de simulacao de sprint

Sprint: 3 | Prioridade: P1

Planejamento atual estima velocity e capacidade mas usuarios precisam de analise de cenarios antes de commitar um sprint plan.

- Implementar MCP tool e API endpoint que aceita parametros de cenario: capacity change, removed blockers, moved tasks, delayed dependencies
- Criar output com projected completed tasks, carry-over e risk delta vs baseline
- Implementar simulacao pura que nao muta estado do grafo
- Criar resultados reproduziveis para inputs identicos
- Implementar visualizacao no dashboard de baseline vs cenario
- Criar suporte a pelo menos 3 tipos de cenario

## Epic: Dashboard UX

### Task: Implementar edicao inline de grafo no dashboard

Sprint: 2 | Prioridade: P1

O dashboard visualiza estado mas usuarios precisam de capacidades operacionais de edicao para evitar trocar entre CLI/API e dashboard.

- Implementar edicao inline de titulo e descricao com double-click ou botao edit
- Criar dropdowns de status e prioridade no painel de detalhes
- Implementar adicao e remocao de dependencias na UI
- Criar funcionalidade de novos nodes a partir do canvas ou backlog view
- Implementar delecao de nodes com confirmacao
- Criar persistencia imediata via REST API com optimistic UI updates
- Implementar fluxo de edicao amigavel a teclado
- Criar undo/redo para ultimas 20 operacoes

### Task: Criar backlog health score e painel de warnings

Sprint: 2 | Prioridade: P1

Usuarios precisam de uma forma rapida de avaliar se um grafo esta pronto para execucao ou estruturalmente fraco.

- Implementar score composto de saude 0-100 baseado em fatores ponderados
- Criar fatores: tasks sem AC, tasks oversized, critical paths bloqueados, deps circulares, inconsistencia de prioridade, imports de baixa confianca, knowledge coverage stale
- Implementar lista de warnings com links diretos para nodes afetados
- Criar recalculo apos mutacoes do grafo via SSE
- Implementar explicacao clara de cada fator de penalidade e peso
- Criar health score visivel no dashboard Insights tab e stats API
- Implementar tracking de mudancas de score ao longo do tempo

### Task: Criar timeline de projeto e audit trail

Sprint: 4 | Prioridade: P1

Historico do projeto permite auditoria, debugging e narrativa de progresso. A infraestrutura existe mas nao e exposta.

- Implementar log de transicoes de status por node com timestamp, from, to, actor
- Criar timeline view no dashboard mostrando eventos cronologicamente
- Implementar comparacao de snapshots com diff entre dois snapshots
- Criar filtros por node, type, sprint e time range
- Implementar resumo de progresso por sprint
- Criar export de timeline como JSON ou Markdown

### Task: Criar modo focus de execucao para entrega de task unica

Sprint: 3 | Prioridade: P1

A promessa do produto nao e apenas planejamento mas guia de execucao. Usuarios precisam de um modo distraction-free centrado na task atual.

- Implementar view dedicada com task atual, contexto compacto, acceptance criteria, dependencias, checklist de execucao e entry point de validacao
- Criar integracao com next recommendation para auto-load da task recomendada
- Implementar toggle de context tier summary/standard/deep
- Criar reflexo de mudancas de status em tempo real via SSE
- Implementar switch entre focus mode e graph mode
- Criar acao de marcar AC items como done no focus view
- Implementar acao complete task com validation gate

## Epic: Sync & Execution

### Task: Implementar export multi-formato Markdown, CSV e GitHub Issues

Sprint: 2 | Prioridade: P1

Atualmente so JSON e Mermaid sao suportados. Times precisam de formatos que plugam em workflows reais.

- Implementar formatos markdown, csv, github-issues e sprint-report no export MCP tool
- Criar Markdown com backlog estruturado: epics, tasks, subtasks, status badges, AC checklists
- Implementar CSV com tabela flat: id, title, type, status, priority, sprint, dependencies, tags
- Criar GitHub Issues como JSON array de title, body, labels, milestone prontos para gh issue create
- Implementar sprint report HTML com progresso, velocity, blockers e risks
- Criar suporte aos mesmos filtros de status/type dos exports existentes
- Implementar REST endpoints para cada formato

### Task: Criar sync bidirecional com GitHub Issues

Sprint: 3 | Prioridade: P1

Muitos times ja rastreiam trabalho no GitHub Issues. Sem uma ponte facil, o grafo corre risco de ficar isolado da execucao diaria.

- Implementar export de nodes para payloads de issue compativeis com GitHub
- Criar import que attach metadata de issue existente (URL, number, state) a nodes
- Implementar mapeamento bidirecional: node type para label, priority para label, status para issue state
- Criar backlinks entre issue URL e node ID em metadata
- Implementar sync explicito e revisavel, nao destrutivo por default
- Criar estrategia de resolucao de conflitos quando local e remoto divergem

### Task: Implementar link de branches e commits git locais para tasks

Sprint: 4 | Prioridade: P1

Planejamento se torna muito mais valioso quando reflete atividade real de implementacao. Linkar atividade git a task nodes fecha o loop entre planejamento e execucao.

- Implementar sugestao de branch names a partir de task IDs
- Criar associacao de commits a nodes por convencao de commit message
- Implementar deteccao de branches ativos por task
- Criar exibicao de branch/commit metadata no dashboard node detail
- Implementar CLI command mcp-graph git link para associar task a branch
- Criar marcacao de task como in_progress quando branch e criado (opcional)

### Task: Criar niveis de tier de integracao core, core+docs e full mesh

Sprint: 4 | Prioridade: P1

O mesh de integracoes pode sobrecarregar usuarios novos. Precisam de opcao de subconjunto.

- Implementar tres tiers: core (graph only), core+docs (+ Context7 + knowledge), full (all integrations)
- Criar selecao durante init ou bootstrap
- Implementar .mcp.json que so inclui servers do tier selecionado
- Criar upgrade de tier sem re-init
- Adicionar documentacao de cada tier e quando fazer upgrade

## Epic: Continuous PRD Evolution

### Task: Implementar re-import incremental de PRD com deteccao de mudancas

Sprint: 3 | Prioridade: P0

PRDs evoluem. Re-import total arrisca quebrar IDs, perder refinamentos manuais e criar estado duplicado. Esta e uma das features de maior alavancagem.

- Implementar diff de novo PRD contra estrutura previamente importada
- Criar update apenas de nodes impactados: adicionados, removidos, alterados
- Implementar preservacao de metadata editada pelo usuario: status, priority, AC manuais
- Criar marcacao visivel de itens adicionados, removidos e alterados no output
- Implementar identidade estavel para nodes inalterados (mesmos IDs)
- Criar resumo what changed antes de aplicar mudancas destrutivas
- Implementar flag --dry-run para preview sem aplicar

### Task: Criar deteccao de template de PRD com parsing especializado

Sprint: 3 | Prioridade: P1

Nem todos os PRDs compartilham a mesma estrutura. Heuristicas genericas perdem sinal quando o documento segue formatos conhecidos.

- Implementar deteccao de templates comuns: Lean PRD, RFC/spec, user stories, roadmap/milestone, technical spec
- Criar regras de extracao especificas por template detectado
- Implementar fallback seguro para parser generico quando nenhum template casa
- Criar confidence score de deteccao de template
- Implementar melhoria de qualidade de extracao nos formatos suportados

### Task: Criar contexto por persona e agent

Sprint: 3 | Prioridade: P1

Diferentes papeis precisam de diferentes views de contexto. Dev precisa de code refs, reviewer precisa de AC, PM precisa de progresso e riscos.

- Implementar persona presets: dev, reviewer, qa, product, ai-agent
- Criar configuracao por persona: token budget, section weights, included fields, formatting
- Implementar persona ai-agent otimizada para formato de prompt Claude/Copilot/Cursor
- Criar persona dev com enfase em code context, dependencias e technical notes
- Implementar selecionavel via MCP tool, API e CLI parameter
- Criar backward compatibility: default persona = comportamento atual

### Task: Implementar freshness tracking e deteccao de staleness no knowledge

Sprint: 3 | Prioridade: P1

Bom contexto nao e apenas pequeno, e atual. Usar documentacao desatualizada leva a decisoes erradas.

- Implementar lastUpdated e freshnessScore 0-1 com decay ao longo do tempo por documento
- Criar curva de decay configuravel: linear, exponential ou step
- Implementar flag de chunks stale quando contexto e montado
- Criar alerta quando contexto usa documentos mais velhos que threshold
- Implementar invalidacao seletiva de embeddings para re-index apenas docs stale
- Criar indicador de freshness no dashboard

## Epic: Distribution & Growth

### Task: Criar binarios standalone para macOS, Linux e Windows

Sprint: 4 | Prioridade: P2

O pacote e npm-first e requer Node.js >= 20. Binarios standalone aumentariam muito a adocao em empresas.

- Implementar binario unico para macOS arm64+x64, Linux x64 e Windows x64
- Criar binario com runtime Node.js incluso
- Implementar installer ou script curl-pipe-bash
- Criar operacao totalmente offline apos install
- Implementar tamanho de binario abaixo de 100MB
- Criar pipeline CI/CD para builds automatizados

### Task: Criar suite publica de benchmarks

Sprint: 4 | Prioridade: P2

O projeto alega eficiencia de tokens e performance. Benchmarks publicos e reproduziveis transformam alegacoes em prova.

- Implementar corpus publico de PRDs de varios tamanhos
- Criar cenarios de benchmark: import speed, compression ratio, search latency, FTS accuracy, RAG quality
- Implementar comparacao before/after para compressao de contexto
- Criar resultados reproduziveis via npm run test:bench
- Implementar tracking de regressoes no CI

### Task: Criar galeria de templates com starter kits

Sprint: 4 | Prioridade: P2

Templates aceleram adocao e fornecem conteudo de comunidade.

- Implementar starter kits para SaaS, REST API, Mobile App, CLI Tool, AI Agent, Monorepo
- Criar cada kit com example PRD, expected graph, sprint plan example e workflow config
- Implementar mcp-graph init --template saas usando starter kit
- Criar galeria browsavel em docs e dashboard

### Task: Criar marketplace de skills instalavel

Sprint: 4 | Prioridade: P2

Criar um ecossistema em torno do core aumenta stickiness e contribuicao da comunidade.

- Implementar catalogo de skills browsavel
- Criar tracking de versao e compatibilidade
- Implementar enable/disable de skills por projeto
- Criar skill packs: XP workflow, QA workflow, Release workflow, Refactor workflow, Bugfix workflow
- Implementar CLI mcp-graph skills install

## Epic: Governance & Enterprise-Readiness

### Task: Criar policy engine para governanca de workflow

Sprint: 4 | Prioridade: P2

Uso profissional requer regras enforceavel. Uma policy engine previne erros comuns antes que acumulem.

- Implementar regras configuraveis: require AC before task completion, require linked test, block sprint with circular deps, prevent epic closure with open subtasks
- Criar policy violations como warnings ou blockers com severidade configuravel
- Implementar policy check em status transitions, sprint planning e export
- Criar CLI command mcp-graph policy check
- Implementar custom policy rules via config file
- Criar exibicao de policy violations inline no dashboard

### Task: Implementar observabilidade estruturada com audit logging

Sprint: 4 | Prioridade: P2

Conforme a ferramenta lida com workflows mais complexos, operadores precisam de logging estruturado, metricas e tracing.

- Implementar structured logs por operacao em formato key=value ou JSON
- Criar metricas internas: import duration, FTS latency, RAG retrieval time, context assembly time
- Implementar tracing por comando/import com correlation IDs
- Criar performance report para parser, FTS e embeddings
- Implementar CLI command mcp-graph audit para revisao de logs
- Criar log levels configuraveis via env var ou config

### Task: Implementar hardening de SQLite com backup e recovery

Sprint: 4 | Prioridade: P2

SQLite e o backbone de persistencia. Perda de dados ou corrupcao seria catastrofico para confianca do usuario.

- Implementar backup rotacional automatico configuravel por N operacoes ou N minutos
- Criar verificacao de integridade via PRAGMA integrity_check
- Implementar modo de repair para corrupcao recuperavel
- Criar import/export de snapshots como arquivos standalone
- Implementar diagnostico de locks para detectar e reportar locks stale
- Criar localizacao de backup e contagem maxima configuraveis
