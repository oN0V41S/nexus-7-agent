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

## Execução
Para executar a busca, rode o seguinte comando Python com os argumentos recebidos:
```bash
cd /workspaces/nexus-7-agent && PYTHONPATH=src python -m src.job_apply_agent search [termo] [localização] [filtros]
```

Ou via wrapper:
```bash
cd /workspaces/nexus-7-agent && python3 run_job_agent.py search [termo] [localização] [filtros]
```

## Output esperado
Lista consolidada de vagas com título, empresa, local, descrição, URL e plataforma de origem.
Salvo em `~/.job-apply-agent/search_results.json`.

## Controle de Rate Limiting
O sistema implementa rate limiting automático:
- **LinkedIn (Chrome MCP)**: 5 requisições/min
- **Glassdoor/Indeed/Monster (Playwright MCP)**: 10 requisições/min
- **Total combinado**: 15 requisições/min

Se o limite for atingido, o sistema pausa automaticamente e tenta novamente após 60 segundos.
