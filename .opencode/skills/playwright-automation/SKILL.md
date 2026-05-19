---
name: playwright-automation
description: Automação de navegador via Playwright MCP — navegar, clicar, preencher formulários, extrair dados, testar UI
---

# Playwright Automation Skill

Skill para automação de navegador usando Playwright MCP. Use esta skill quando precisar interagir programaticamente com websites.

## Quando Usar Esta Skill

- Automatizar interações com websites (clicar, digitar, navegar)
- Preencher formulários automaticamente
- Extrair dados de páginas web (scraping)
- Testar fluxos de UI end-to-end
- Tirar screenshots de páginas
- Verificar se elementos existem na página
- Testar responsividade em diferentes tamanhos

## Quando NÃO Usar Esta Skill

- Para debugging de performance (use Chrome DevTools)
- Para análise de memory leaks (use Chrome DevTools)
- Para tarefas que não envolvem interação com navegador

## Workflows

### Navegar e Extrair Dados

```
1. playwright_browser_navigate(url) → abrir página
2. playwright_browser_snapshot() → entender estrutura
3. playwright_browser_click(target) ou playwright_browser_type(target, text) → interagir
4. playwright_browser_snapshot() → verificar resultado
5. Extrair dados do snapshot
```

### Preencher Formulário

```
1. playwright_browser_navigate(url) → abrir página do formulário
2. playwright_browser_snapshot() → identificar campos
3. playwright_browser_fill_form(fields) → preencher múltiplos campos
4. playwright_browser_click(target) → submit
5. playwright_browser_wait_for(text) → confirmar sucesso
```

### Testar Fluxo de UI

```
1. playwright_browser_navigate(url) → página inicial
2. Sequência de interações (click, type, select)
3. playwright_browser_take_screenshot() → documentar
4. playwright_browser_snapshot() → validar estado final
```

### Testar Responsividade

```
1. playwright_browser_resize(width, height) → viewport mobile
2. playwright_browser_navigate(url) → abrir página
3. playwright_browser_take_screenshot() → screenshot mobile
4. Repetir para tablet e desktop
```

## Ferramentas Principais

| Ferramenta | Uso |
|------------|-----|
| `playwright_browser_navigate` | Abrir URL |
| `playwright_browser_snapshot` | Entender estrutura da página |
| `playwright_browser_click` | Clicar em elemento |
| `playwright_browser_type` | Digitar texto |
| `playwright_browser_fill_form` | Preencher múltiplos campos |
| `playwright_browser_take_screenshot` | Capturar screenshot |
| `playwright_browser_wait_for` | Aguardar texto aparecer |
| `playwright_browser_network_requests` | Ver requests de rede |
| `playwright_browser_console_messages` | Ler console |

## Critérios de Qualidade

- [ ] Sempre usar snapshot antes de interagir
- [ ] Usar fill_form em vez de múltiplos type quando possível
- [ ] Usar wait_for em vez de timeouts fixos
- [ ] Salvar screenshots para documentação
- [ ] Fechar abas quando não mais necessárias

## Agente Recomendado

Use `@playwright-agent` para tarefas de automação Playwright.
