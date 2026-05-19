# /job-track - Rastreamento e Relatórios

Gerencia histórico de candidaturas no Notion.

## Uso
```
/job-track [status | export]
```

## Ações
- `/job-track` → Lista candidaturas com filtros
- `/job-track export csv` → Exporta CSV
- `/job-track export json` → Exporta JSON
- `/job-track update [id] [novo_status]` → Atualiza status

## Status
- submitted → error → interview → rejected → accepted

## Integração
- Banco Notion para visualização e atualização manual
- applied.jsonl local para desduplicação rápida
