# Dashboard — Guia do Usuário

Guia completo do dashboard web do mcp-graph. Para referência da API REST, veja [REST-API-REFERENCE.md](../reference/REST-API-REFERENCE.md). Para workflows do dia-a-dia usando o dashboard, veja a seção Dashboard Deep Dive no [User Guide](./USER-GUIDE.md).

---

## Primeiro Uso

### Onde ficam os dados?

Cada projeto tem seus dados em uma pasta `workflow-graph/graph.db` dentro do diretório do projeto:

```
meu-projeto/
  ├── src/
  ├── package.json
  └── workflow-graph/       ← criado automaticamente
      └── graph.db          ← banco SQLite local
```

### Passo a passo

**1. Inicialize o projeto** (se ainda não fez):

```bash
cd ~/meu-projeto
npx @mcp-graph-workflow/mcp-graph init
```

Isso cria a pasta `workflow-graph/graph.db` no diretório atual.

**2. Importe um PRD ou crie nodes** via MCP tools no seu editor (Copilot, Claude Code, Cursor).

**3. Abra o dashboard:**

```bash
cd ~/meu-projeto
npx @mcp-graph-workflow/mcp-graph serve
```

Abra `http://localhost:3000`.

> **Importante:** O `serve` sempre abre o banco do diretório onde foi executado. Se o dashboard mostrar "Graph not initialized", verifique se você está no diretório correto e se rodou `init`.

### Trocar para outro projeto

Se você tem vários projetos com `workflow-graph/`, use **Open Folder** no dashboard para trocar sem reiniciar o servidor:

1. Clique **Open Folder** no header
2. Clique **Browse directories...**
3. Navegue até o diretório do outro projeto — pastas com dados aparecem com badge **graph**
4. Clique **Open**

O dashboard atualiza instantaneamente com os dados do outro projeto.

---

## Iniciando o Dashboard

```bash
mcp-graph serve                # porta padrão 3000
mcp-graph serve --port 3334    # porta customizada
```

Abra `http://localhost:3000` no navegador. O dashboard conecta automaticamente via SSE para atualizações em tempo real.

---

## Visão Geral do Layout

```
┌─────────────────────────────────────────────────────────────┐
│ [mcp-graph]  My Project  1/3 done  [Open Folder] [Import PRD] [Capture] [☀] │  ← Header
├─────────────────────────────────────────────────────────────┤
│ Graph | PRD & Backlog | Code Graph | Memories | Insights | Benchmark | Logs     │  ← Tabs
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                    Conteúdo da Tab Ativa                     │  ← Área Principal
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Header

| Elemento | Descrição |
|----------|-----------|
| **Nome do projeto** | Projeto ativo no momento (ex: "My Project") |
| **X/Y done** | Progresso: nodes concluídos / total |
| **Open Folder** | Trocar o projeto ativo (muda o DB sem reiniciar) |
| **Import PRD** | Importar arquivo PRD (.md, .txt, .pdf, .html) |
| **Capture** | Capturar conteúdo de página web via Playwright |
| **Tema (☀/☾)** | Alternar entre modo escuro e claro |

### Seletor de Projeto

Ao lado do nome do projeto, há um dropdown para trocar entre projetos existentes no mesmo DB. Para trocar o DB inteiro (outro diretório), use **Open Folder**.

---

## Tabs

### Graph

A tab principal — visualização interativa do grafo de execução.

**Grafo Visual (React Flow):**
- Arraste para mover o grafo
- Scroll para zoom in/out
- Clique em um node para ver detalhes
- Controles: Zoom In, Zoom Out, Fit View

**Filtros:**
- **Status:** backlog, ready, in progress, blocked, done
- **Type:** epic, task, subtask, requirement, constraint, milestone, acceptance criteria, risk, decision
- **Layout:** Top → Down ou Left → Right
- **Show all nodes:** Mostra nodes filhos (tasks dentro de epics). Desabilitado por padrão (mostra apenas top-level)
- **Clear:** Remove todos os filtros

**Tabela de Nodes:**
- Busca por texto (campo "Search nodes...")
- Colunas: Title, Type, Status, Priority, Size, Sprint
- Clique em uma linha para ver o painel de detalhes
- Ordenação clicando no header da coluna

**Painel de Detalhes (ao clicar em um node):**
- Informações completas do node
- Acceptance criteria
- Metadata
- Dependências (edges)

### PRD & Backlog

Visão organizada do backlog com hierarquia epic → task.

- **Grafo simplificado** com nodes do PRD importado
- **Progresso** por epic (X/Y done, porcentagem)
- **Next task** recomendada (baseada em prioridade e dependências)
- **Lista hierárquica** com status visual (cores por status)
- **Show all nodes** checkbox para expandir/colapsar hierarquia

### Code Graph

Visualização do grafo de código do projeto (engine nativo, sem dependências externas).

- **Status:** indica se o índice de código está atualizado
- **Reindex:** botão para reconstruir o índice via `reindex_knowledge`
- **Grafo de código:** symbols (funções, classes) e relações (calls, imports)
- **Busca por símbolo:** pesquisa no grafo de código via FTS5
- **Impact analysis:** análise de impacto (upstream/downstream) de um símbolo

### Memories

Visualização das memórias do projeto (sistema nativo de conhecimento).

- **Explorador de arquivos:** tree view das memórias organizadas por diretório
- **Visualização:** conteúdo da memória selecionada
- **CRUD:** criar, ler, listar e deletar memórias via MCP tools (write_memory, read_memory, list_memories, delete_memory)
- Memórias armazenadas em `workflow-graph/memories/` e auto-indexadas no knowledge store

### Insights

Métricas e análise do projeto.

- **Metrics:** Total tasks, completion rate, velocity, avg points
- **Status distribution:** gráfico de barras com distribuição por status
- **Bottlenecks:** tasks bloqueadas, sem acceptance criteria, oversized
- **Recommendations:** sugestões de skills/ações por fase do lifecycle
- **Sprint progress:** progresso por sprint (se configurado)

### Benchmark

Métricas de performance do sistema de compressão de contexto.

- **Token Economy:** compressão média, tokens salvos por task
- **Cost Savings:** economia estimada por task (Opus vs Sonnet)
- **Per-task metrics:** detalhamento por task individual
- **Dependency Intelligence:** edges inferidas, cycles detectados

### Logs

Log em tempo real do servidor.

- **Filtros:** por nível (info, warn, error, debug)
- **Busca:** pesquisa no conteúdo dos logs
- **Auto-scroll:** novas entradas aparecem automaticamente via SSE
- **Clear:** limpar logs

---

## Modais

### Import PRD

Importar um arquivo PRD para criar nodes e edges no grafo.

1. Clique em **Import PRD** no header
2. Arraste o arquivo ou clique para selecionar
3. Formatos suportados: `.md`, `.txt`, `.pdf`, `.html`
4. Marque **"Force re-import"** para reimportar um arquivo já importado
5. Clique **Import**
6. O grafo é atualizado automaticamente

### Capture

Capturar conteúdo de uma página web.

1. Clique em **Capture** no header
2. Cole a URL da página
3. Opcionais: CSS selector, wait for selector
4. Clique **Capture**
5. O conteúdo é extraído e adicionado ao knowledge store

### Open Folder

Trocar o projeto ativo sem reiniciar o servidor. Permite visualizar diferentes projetos no mesmo dashboard.

1. Clique em **Open Folder** no header
2. O modal mostra:
   - **Current:** caminho do projeto ativo
   - **Input:** campo para digitar/colar o caminho de outro projeto
   - **Recent folders:** lista de pastas recentes (clicáveis)
3. Digite o caminho do diretório do projeto e clique **Open**, ou clique em uma pasta recente
4. O dashboard atualiza instantaneamente (grafo, stats, tabs)

**Notas:**
- O diretório deve conter `workflow-graph/graph.db` (ou `.mcp-graph/graph.db` legado)
- Se o path for inválido, uma mensagem de erro aparece em vermelho
- O projeto anterior **não é afetado** — seus dados permanecem intactos no disco
- Pastas recentes são persistidas entre sessões (max 10)
- A pasta atual aparece marcada como **(current)** e desabilitada na lista

---

## Features

### Atualizações em Tempo Real (SSE)

O dashboard recebe eventos do servidor via Server-Sent Events. Qualquer mudança feita via MCP tools, CLI, ou API atualiza o dashboard automaticamente:
- Criação/edição/deleção de nodes e edges
- Import de PRDs
- Indexação de knowledge
- Sync de docs

### Multi-Projeto

Dois níveis de multi-projeto:

1. **Projetos no mesmo DB:** Use o seletor de projeto no header (dropdown ao lado do nome)
2. **Projetos em diretórios diferentes:** Use **Open Folder** para trocar o DB inteiro

### Tema Escuro/Claro

Clique no botão ☀/☾ no canto direito do header. A preferência é salva no localStorage.

---

## Troubleshooting

### Dashboard não carrega

- Verifique se o servidor está rodando: `curl http://localhost:3000/health`
- Verifique o console do navegador (F12) para erros
- Certifique-se de que o build do dashboard existe: `npm run build`

### "Graph not initialized"

O projeto não foi inicializado. Duas opções:
- Via CLI: `mcp-graph init`
- Via MCP: use a tool `init`
- Via API: `POST /api/v1/project/init`

### Open Folder retorna erro

- **"Directory does not exist"**: o caminho digitado não existe
- **"No graph database found"**: o diretório não contém `workflow-graph/graph.db` — inicialize o projeto primeiro com `mcp-graph init` naquele diretório

### SSE desconecta frequentemente

Normal durante swaps de projeto ou reconexões de rede. O dashboard reconecta automaticamente.

### Tabs em branco após swap

Force um refresh no navegador (F5). Isso reconecta o SSE e recarrega todos os dados.
