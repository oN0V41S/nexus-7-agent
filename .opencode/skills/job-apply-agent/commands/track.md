# /job-track - Rastreamento e Relatórios

Gerencia histórico de candidaturas.

## Uso
```
/job-track [ação] [args]
```

## Ações
- `/job-track` → Lista todas as candidaturas
- `/job-track export csv` → Exporta CSV
- `/job-track export json` → Exporta JSON
- `/job-track update [id] [novo_status]` → Atualiza status

## Status válidos
- applied, reviewing, interview, offer, rejected, accepted, ghosted, withdrawn

## Base de dados
- Local: `~/.job-apply-agent/applied.jsonl`
- Integração futura: Notion MCP

## Execução
Para listar candidaturas:
```bash
cd /workspaces/nexus-7-agent && PYTHONPATH=src python -m src.job_apply_agent track
```

Para exportar:
```bash
cd /workspaces/nexus-7-agent && python3 run_job_agent.py track export csv
cd /workspaces/nexus-7-agent && python3 run_job_agent.py track export json
```

Para atualizar status:
```bash
cd /workspaces/nexus-7-agent && python3 run_job_agent.py track update [id] [novo_status]
```
