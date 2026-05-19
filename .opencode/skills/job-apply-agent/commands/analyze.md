# /job-analyze - Análise de Compatibilidade

Calcula match score (0-100%) para vagas encontradas.

## Uso
```
/job-analyze [vaga_id | --all]
```

## Processo
1. Extrai requisitos técnicos e soft skills da descrição
2. Compara com profile.json do candidato
3. Calcula score
4. Destaca gaps e pontos fortes
5. Ranqueia vagas por compatibilidade

## Dependências
- Requer `profile.json` (gerado por `/job-consolidate`)
- Requer `search_results.json` (gerado por `/job-search`)
- Usa Ollama como LLM padrão (fallback heurístico automático)

## Execução
Para executar a análise, rode o comando Python com os argumentos recebidos:
```bash
cd /workspaces/nexus-7-agent && PYTHONPATH=src python -m src.job_apply_agent analyze [vaga_id | --all]
```

Ou via wrapper:
```bash
cd /workspaces/nexus-7-agent && python3 run_job_agent.py analyze [vaga_id | --all]
```

Se `--all` for informado, analisa todas as vagas. Se um `vaga_id` for informado, analisa apenas aquela.
