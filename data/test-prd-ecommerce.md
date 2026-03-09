# PRD: E-Commerce Platform — MVP

## Objetivo

Construir uma plataforma de e-commerce moderna com catálogo de produtos, carrinho de compras, checkout com pagamento via Stripe, e painel administrativo.

## Requisitos

- O sistema deve suportar cadastro e autenticação de usuários (JWT)
- O catálogo deve ter busca full-text e filtros por categoria, preço e avaliação
- O carrinho deve persistir entre sessões (localStorage + API sync)
- O checkout deve integrar com Stripe para pagamento via cartão
- O painel admin deve permitir CRUD de produtos e visualização de pedidos
- Performance: tempo de carregamento < 2s no catálogo
- Segurança: OWASP top 10 compliance

## Épico 1: Autenticação e Usuários

### Task 1.1: Setup do backend com Express + TypeScript
Configurar projeto Node.js com Express, TypeScript strict mode, ESLint, Vitest.
Estimativa: 30 minutos. Tamanho XP: S

### Task 1.2: Modelo de usuário e migrations
Criar schema de usuário com Drizzle ORM + SQLite. Campos: id, email, password_hash, name, role, created_at.
Estimativa: 45 minutos. Tamanho XP: S
Depende de: Task 1.1

### Task 1.3: Endpoints de autenticação
POST /auth/register, POST /auth/login, GET /auth/me. JWT com refresh token.
Estimativa: 60 minutos. Tamanho XP: M
Depende de: Task 1.2

### Task 1.4: Middleware de autorização
Middleware para validar JWT, extrair user, checar roles (admin/customer).
Estimativa: 30 minutos. Tamanho XP: S
Depende de: Task 1.3

## Épico 2: Catálogo de Produtos

### Task 2.1: Schema de produtos
Tabela products: id, name, description, price, category, stock, image_url, rating, created_at.
Estimativa: 30 minutos. Tamanho XP: S

### Task 2.2: CRUD de produtos (admin)
Endpoints REST para criar, listar, atualizar e deletar produtos. Apenas admin.
Estimativa: 60 minutos. Tamanho XP: M
Depende de: Task 2.1, Task 1.4

### Task 2.3: Busca e filtros no catálogo
GET /products com query params: q (full-text), category, min_price, max_price, sort_by.
Estimativa: 90 minutos. Tamanho XP: M
Depende de: Task 2.1

### Task 2.4: Upload de imagens de produtos
Endpoint para upload de imagem com multer, armazenamento local, resize com sharp.
Estimativa: 45 minutos. Tamanho XP: S
Depende de: Task 2.2

## Épico 3: Carrinho de Compras

### Task 3.1: API do carrinho
POST /cart/add, DELETE /cart/remove, GET /cart, PATCH /cart/quantity. Persistência por user_id.
Estimativa: 60 minutos. Tamanho XP: M
Depende de: Task 1.3, Task 2.1

### Task 3.2: Sync carrinho guest → autenticado
Ao fazer login, merge do carrinho localStorage com carrinho do servidor.
Estimativa: 45 minutos. Tamanho XP: M
Depende de: Task 3.1

## Épico 4: Checkout e Pagamento

### Task 4.1: Integração Stripe
Criar PaymentIntent via Stripe SDK, webhook para confirmar pagamento.
Estimativa: 120 minutos. Tamanho XP: L
Depende de: Task 3.1

### Task 4.2: Fluxo de checkout
Tela de resumo do pedido, endereço de entrega, seleção de frete, confirmação.
Estimativa: 90 minutos. Tamanho XP: M
Depende de: Task 4.1

### Task 4.3: Histórico de pedidos
GET /orders (customer), GET /admin/orders (admin). Status: pending, paid, shipped, delivered.
Estimativa: 60 minutos. Tamanho XP: M
Depende de: Task 4.2

## Épico 5: Painel Administrativo

### Task 5.1: Dashboard com métricas
Total de vendas, pedidos por status, produtos mais vendidos, receita por período.
Estimativa: 90 minutos. Tamanho XP: M
Depende de: Task 4.3

### Task 5.2: Gestão de estoque
Alertas de estoque baixo, atualização em massa, relatório de inventário.
Estimativa: 60 minutos. Tamanho XP: M
Depende de: Task 2.2

## Restrições

- Sem Docker no MVP — tudo local com SQLite
- Budget de infra: $0 (desenvolvimento local apenas)
- Prazo: 2 sprints de 1 semana cada

## Critérios de Aceite

- Usuário consegue se cadastrar, logar, e manter sessão
- Catálogo exibe produtos com busca funcional
- Carrinho persiste entre sessões e sincroniza ao logar
- Checkout completa pagamento via Stripe (modo test)
- Admin consegue gerenciar produtos e ver pedidos
- Todos os endpoints têm testes automatizados
- Cobertura de testes > 80%

## Riscos

- Integração Stripe pode ter latência em ambientes de teste
- Upload de imagens pode consumir muito espaço em disco
- Full-text search em SQLite pode ser limitado para catálogos grandes (> 10k produtos)

## Decisões

- Usar SQLite em vez de PostgreSQL para simplicidade no MVP
- JWT stateless (sem blacklist de tokens) para simplificar
- Stripe como único gateway de pagamento
