---
name: prototyping-workflow
description: Use when starting a new UI feature, screen, or component that needs visual validation before production implementation
---

# Prototyping Workflow

Code-as-Prototype: o protótipo **é** código. Deve ser isolado, validável visualmente, e descartável após implementação final.

## Quando Usar

- Feature nova que precisa de validação visual antes de implementar em `src/`
- Tela ou componente com layout incerto que demanda iteração rápida
- Integração com APIs externas onde a UI precisa ser mockada primeiro

## Estrutura Obrigatória

```
prototypes/<feature-name>/
  index.html          # Entry point (CDN: React, Tailwind, Babel)
  App.jsx             # Componente principal
  assets/             # Screenshots de validação
    <timestamp>.png   # Captura via @playwright-agent
```

**Regras:** NUNCA colocar protótipo em `src/`. Screenshots ficam ao lado do código que os gerou.

## Workflow

### 1. Brainstorming

Use `brainstorming` para definir funcionalidade, requisitos visuais e states antes de criar qualquer arquivo.

### 2. Criar Protótipo

**index.html** — Entry point via CDN (zero config):
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Feature — Protótipo</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" src="App.jsx"></script>
</body>
</html>
```

**App.jsx** — React funcional com hooks, dados mockados, Tailwind CSS, validações simuladas.

### 3. Validar Visualmente

Use `@playwright-agent`:
1. `playwright_browser_navigate` → `file:///abs/path/prototypes/<feature>/index.html`
2. `playwright_browser_take_screenshot` → `prototypes/<feature>/assets/<timestamp>.png`
3. `playwright_browser_snapshot` → verificar acessibilidade

### 4. Refinar

Analise screenshot → peça ajustes ao agente → recapture → repita até aprovação.

### 5. Transicionar

Após aprovação: implemente em `src/` usando protótipo como referência → **delete** `prototypes/<feature>/` → registre no handoff.

## Rationalization Table

| Excuse | Reality |
|--------|---------|
| "Coloco em src/ porque é React" | Protótipo não é produção. src/ contém código validado e testado. |
| "Não preciso de screenshot" | Validar visualmente é obrigatório. Você não é o usuário final. |
| "Vou fazer o screenshot depois" | Depois vira nunca. Capture imediatamente. |
| "O protótipo ficou bom, vou manter" | Manter protótipo é dívida técnica. Delete após transição. |

## Red Flags — Pare e Refaça

- Protótipo dentro de `src/components/`
- Screenshot não salvo em `assets/`
- Protótipo não deletado após feature implementada
- Dados reais de API (use mocks)
- Protótipo sem `index.html` como entry point

## Quick Reference

| Item | Convention |
|------|-----------|
| Diretório | `prototypes/<feature-name>/` |
| Stack | React 18, Tailwind (CDN), Babel standalone |
| Dados | Mockados inline, sem chamadas reais |
| Screenshot | `assets/YYYYMMDD-HHmmss.png` |
| Delete | Após feature em produção |

## Common Mistakes

| Erro | Correção |
|------|----------|
| Protótipo em `src/` | Mova para `prototypes/<feature>/` |
| Screenshot na raiz | Mova para `prototypes/<feature>/assets/` |
| Imports ES modules | Use CDN com Babel standalone |
| API calls reais | Mocke com `setTimeout` + dados fixos |
