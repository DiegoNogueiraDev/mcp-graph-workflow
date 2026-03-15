# PRD: Dashboard Bugfixes — Favicon 404 + GitNexus Invalid Color

## Bug 1: Favicon 404

**Problema:** O browser requisita `/favicon.ico` mas nenhum arquivo favicon existe. Sem diretório `public/`, sem `<link rel="icon">` no `index.html`.

**Solução:** Criar `src/web/dashboard/public/favicon.svg` (ícone SVG temático de grafo) e adicionar `<link rel="icon" href="/favicon.svg" type="image/svg+xml">` no `index.html`.

**Critérios de aceite:**
- Sem erro 404 de favicon no console do browser
- Favicon visível na aba do browser

## Bug 2: Invalid Canvas Color `#4fc3f73080`

**Problema:** A função `safeColor()` em `gitnexus-tab.tsx` só remove alpha de cores hex de 9 caracteres (`#RRGGBBAA`), mas deveria tratar qualquer cor com mais de 7 caracteres. Quando um nó com cor dimmed (`#4fc3f730`) passa por `safeColor(color, "80")`, produz o valor inválido `#4fc3f73080` (11 chars), causando erro no Canvas2D do Safari.

**Solução:** Alterar a condição de `color.length === 9` para `color.startsWith("#") && color.length > 7`, garantindo que qualquer hex com alpha seja truncado para `#RRGGBB` antes de adicionar o novo alpha.

**Critérios de aceite:**
- Sem erro `addColorStop` no console
- Tab GitNexus renderiza corretamente com hover effects funcionando
