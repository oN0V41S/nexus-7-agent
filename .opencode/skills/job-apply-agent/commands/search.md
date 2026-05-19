# /job-search - Busca Multi-plataforma

Busca vagas em LinkedIn, Glassdoor, Indeed e Monster.

## Uso
```
/job-search [termo] [localização] [filtros]
```

## Parâmetros
- `termo`: Título ou palavra-chave (ex: "Frontend Engineer")
- `localização`: Cidade/país (ex: "São Paulo, Brazil")
- `filtros`: Opcional. tipo=CLT|PJ|remote|full-time|contract, senioridade=junior|pleno|senior, data=24h|7d|30d

## Plataformas
- LinkedIn → Chrome DevTools MCP (sessão autenticada)
- Glassdoor, Indeed, Monster → Playwright MCP (headless)

## Output
Lista consolidada de vagas com título, empresa, local, descrição, URL e plataforma de origem.
