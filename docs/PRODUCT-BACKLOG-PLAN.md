# Plano: Product Backlog Estratégico — mcp-graph-workflow

## Contexto

O projeto mcp-graph-workflow (v5.4.0) é uma ferramenta madura com 30 MCP tools, 44 REST endpoints, dashboard React, 910+ testes. Já existe um `docs/PRODUCT-BACKLOG.md` com 5 epics e ~20 tasks, mas é puramente tático (lista de features). O usuário quer um **backlog enriquecido** que aplique frameworks de produto e leis de engenharia para guiar decisões estratégicas.

**O que muda:** Não é código — é um documento estratégico que substitui o backlog existente.

## O Que Será Entregue

Um novo arquivo `docs/PRODUCT-BACKLOG.md` que:
1. Preserva todos os itens do backlog existente (nada se perde)
2. Enriquece cada item com RICE Score, Kano, MoSCoW e lei/teoria aplicável
3. Adiciona seções estratégicas (visão, Opportunity Solution Tree, DORA targets)
4. Reformula user stories com JTBD
5. Adiciona itens novos que emergem da aplicação das teorias

## Estrutura do Documento

```
# Product Backlog — mcp-graph-workflow

## 1. Visão Estratégica
   - Missão do produto
   - Opportunity Solution Tree (resultado → oportunidade → solução → experimento)
   - Métricas DORA targets
   - Regra 70/30 (funcional/não-funcional por sprint)

## 2. Referência: Leis e Frameworks Aplicados
   - Tabela concisa de cada lei/framework e como se aplica ao mcp-graph

## 3. Pilares Estratégicos (Epics)
   Para cada epic:
   - JTBD framing
   - Kano classification do pilar

   Para cada task dentro do epic:
   - JTBD ("Quando... preciso de... para...")
   - Tabela: RICE | Kano | MoSCoW | WSJF | Lei Aplicável
   - Acceptance Criteria
   - Sprint target

## 4. Itens Não-Funcionais (Backlog Técnico)
   - Items derivados das leis de engenharia
   - Conway, CAP, Brooks, Gall, 12-Factor, DORA

## 5. Guia de Aplicação Prática
   - Como usar RICE na sprint planning
   - Como balancear 70/30
   - Como evoluir o backlog (Continuous Discovery)
```

## Epics Planejados (7 + 1 novo)

### Existentes (enriquecidos)
1. **Onboarding & Activation** — Kano: Must-be | Lei de Hick (simplificar), Gall (começar simples)
2. **Planning Intelligence** — Kano: Performance | Pareto (otimizar os 20% vitais)
3. **Dashboard UX** — Kano: Performance | Hick (menos opções), Jakob (padrões familiares), Zeigarnik (progresso)
4. **Sync & Execution** — Kano: Performance | Conway (arquitetura ↔ organização)
5. **Continuous PRD Evolution** — Kano: Delighter | OODA (ciclos rápidos)
6. **Distribution & Growth** — Kano: Performance | Cathedral/Bazaar (abrir ecossistema)
7. **Governance & Enterprise** — Kano: Must-be (enterprise) | 12-Factor, DORA

### Novo (emerge das teorias)
8. **Developer Experience & Observability** — Derivado de DORA + Brooks + 12-Factor
   - Métricas DORA internas do workflow
   - Redução de cognitive load (Hick)
   - Feedback loops mais curtos (OODA)

## Scoring Framework

Cada item terá uma tabela:

```
| Métrica     | Valor | Justificativa |
|-------------|-------|---------------|
| Reach       | 8/10  | Todos os usuários |
| Impact      | 3/3   | Alto — desbloqueante |
| Confidence  | 0.8   | Protótipo validado |
| Effort      | 3/10  | ~1 sprint |
| RICE Score  | 6.4   | (8×3×0.8)/3 |
| Kano        | Must-be | Sem isso, churn |
| MoSCoW      | Must   | MVP gate |
| WSJF        | Alto   | Custo de atraso alto, esforço baixo |
| Lei         | Gall   | Sistema complexo evolui de simples |
```

## Opportunity Solution Tree

```
Resultado de Negócio: "Ferramenta inevitável no workflow do dev"
├── Oportunidade: Time-to-value < 5min
│   ├── Solução: Bootstrap command
│   └── Solução: Quickstart import
├── Oportunidade: Confiança nas recomendações
│   ├── Solução: Decision trace no next
│   └── Solução: Confidence scoring visível
├── Oportunidade: Execução sem friction
│   ├── Solução: Focus mode
│   └── Solução: Inline editing
├── Oportunidade: Integração com workflow existente
│   ├── Solução: GitHub Issues sync
│   └── Solução: Git branch linking
└── Oportunidade: Evolução contínua do PRD
    ├── Solução: Re-import incremental
    └── Solução: Template detection
```

## DORA Metrics Targets (para o próprio mcp-graph como produto)

| Métrica | Target | Como medir |
|---------|--------|------------|
| Deployment Frequency | Weekly releases | GitHub releases/semana |
| Lead Time for Changes | < 2 dias | PR open → merge |
| Time to Restore | < 4h | Issue critical → fix deployed |
| Change Failure Rate | < 5% | Releases com rollback / total |

## Passos de Execução

1. **Criar branch** `claude/product-backlog-creation-hRWqb` (se não existe)
2. **Escrever** `docs/PRODUCT-BACKLOG.md` completo com toda a estrutura acima
3. **Commit** com mensagem descritiva
4. **Push** para a branch

## Verificação

- [ ] Documento renderiza corretamente em Markdown
- [ ] Todos os 20+ itens do backlog existente estão preservados
- [ ] Cada item tem RICE score, Kano, MoSCoW
- [ ] JTBD framing em pelo menos os epics
- [ ] Opportunity Solution Tree presente
- [ ] DORA targets definidos
- [ ] Seção de leis aplicadas como referência
- [ ] Itens não-funcionais derivados das teorias
- [ ] Documento em português

## Arquivos Modificados

- `docs/PRODUCT-BACKLOG.md` — reescrita completa (único arquivo)
