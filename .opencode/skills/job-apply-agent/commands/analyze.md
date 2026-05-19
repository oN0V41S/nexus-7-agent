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
- Usa Ollama como LLM padrão
