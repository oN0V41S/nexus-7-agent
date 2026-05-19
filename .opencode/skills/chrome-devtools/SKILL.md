---
name: chrome-devtools
description: Debugging frontend via Chrome DevTools MCP — performance, network, console, memory, accessibility
---

# Chrome DevTools Skill

Skill para debugging frontend usando Chrome DevTools MCP. Use esta skill quando precisar analisar performance, network, console, memory ou accessibility de páginas web.

## Quando Usar Esta Skill

- Analisar performance de carregamento de páginas
- Debugar erros de JavaScript no console
- Inspecionar network requests e responses
- Identificar memory leaks em SPAs
- Verificar acessibilidade de páginas
- Executar auditorias Lighthouse
- Emular dispositivos móveis e condições de rede
- Analisar Core Web Vitals (LCP, INP, CLS)

## Quando NÃO Usar Esta Skill

- Para automação de formulários/cliques (use Playwright)
- Para scraping de dados (use Playwright)
- Para tarefas que não envolvem debugging frontend

## Workflows

### Analisar Performance

```
1. chrome-devtools_navigate_page(url) → abrir página
2. chrome-devtools_performance_start_trace(reload=true) → iniciar trace
3. Aguardar carregamento completo
4. chrome-devtools_performance_stop_trace() → parar trace
5. chrome-devtools_performance_analyze_insight(insightName) → detalhes
```

### Debugar Network Issues

```
1. chrome-devtools_navigate_page(url) → abrir página
2. chrome-devtools_list_network_requests() → ver todos os requests
3. chrome-devtools_get_network_request(reqid) → inspecionar específico
4. Analisar status codes, headers, timing
```

### Verificar Acessibilidade

```
1. chrome-devtools_navigate_page(url) → abrir página
2. chrome-devtools_take_snapshot(verbose=true) → árvore completa
3. Analisar estrutura de acessibilidade
4. chrome-devtools_lighthouse_audit() → score completo
```

### Debugar Memory Leaks

```
1. chrome-devtools_navigate_page(url) → abrir página
2. Interagir com a página
3. chrome-devtools_take_memory_snapshot() → capturar heap
4. Analisar distribuição de objetos
```

### Emular Dispositivo Móvel

```
1. chrome-devtools_emulate(viewport="375x812, mobile, touch") → iPhone
2. chrome-devtools_navigate_page(url) → abrir página
3. chrome-devtools_take_screenshot() → screenshot mobile
```

## Ferramentas Principais

| Ferramenta | Uso |
|------------|-----|
| `chrome-devtools_navigate_page` | Abrir URL |
| `chrome-devtools_take_snapshot` | Árvore de acessibilidade |
| `chrome-devtools_take_screenshot` | Capturar screenshot |
| `chrome-devtools_list_console_messages` | Ler console |
| `chrome-devtools_list_network_requests` | Ver requests de rede |
| `chrome-devtools_performance_start_trace` | Trace de performance |
| `chrome-devtools_take_memory_snapshot` | Heap snapshot |
| `chrome-devtools_lighthouse_audit` | Auditoria Lighthouse |
| `chrome-devtools_emulate` | Emular dispositivo/rede |

## Critérios de Qualidade

- [ ] Sempre navegar para a página antes de análise
- [ ] Usar traces com reload=true para medições precisas
- [ ] Salvar traces e snapshots para análise posterior
- [ ] Incluir Lighthouse audits em revisões de qualidade
- [ ] Documentar findings com screenshots e métricas

## Agente Recomendado

Use `@chrome-devtools-agent` para tarefas de debugging Chrome DevTools.
