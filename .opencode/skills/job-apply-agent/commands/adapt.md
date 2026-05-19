# /job-adapt - Geração Contextualizada

Gera currículo adaptado à vaga e carta de apresentação usando Ollama + fallback.

## Uso
```
/job-adapt [vaga_id]
```

## Processo
1. Carrega perfil do candidato (profile.json)
2. Carrega análise da vaga (analyzed_results.json)
3. Gera resumo profissional adaptado via Ollama
4. Gera carta de apresentação via Ollama
5. Gera PDFs de saída

## Dependências
- Requer `profile.json` (gerado por `/job-consolidate`)
- Requer `analyzed_results.json` (gerado por `/job-analyze`)

## Arquivos gerados
- `~/.job-apply-agent/output/[vaga_id]/resume_adapted.pdf`
- `~/.job-apply-agent/output/[vaga_id]/cover_letter.pdf`

## Execução
Para gerar os materiais, rode o comando Python com o ID da vaga:
```bash
cd /workspaces/nexus-7-agent && PYTHONPATH=src python -m src.job_apply_agent adapt [vaga_id]
```

Ou via wrapper:
```bash
cd /workspaces/nexus-7-agent && python3 run_job_agent.py adapt [vaga_id]
```
