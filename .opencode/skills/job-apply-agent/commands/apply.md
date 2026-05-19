# /job-apply - Aplicação Semiautomática

Executa a candidatura com aprovação humana via Chrome/Playwright MCP.

## Uso
```
/job-apply [vaga_id | --batch [threshold]]
```

## Modos
- `/job-apply [vaga_id]` → Aplica para vaga específica (requer aprovação humana)
- `/job-apply --batch [threshold]` → Aplica para todas as vagas com score >= threshold (default: 70)

## Processo
1. Voice lint do perfil (verifica se dados obrigatórios estão preenchidos)
2. Localiza currículo adaptado e carta gerados
3. Solicita aprovação humana (via input interativo)
4. Navega para URL da vaga via MCP apropriado (Chrome ou Playwright)
5. Preenche formulário da plataforma
6. Registra resultado (aplicado ou pulado)

## Dependências
- Requer `profile.json` e arquivos gerados por `/job-adapt`
- Requer MCPs configurados (Chrome DevTools, Playwright)

## Execução
Para executar a aplicação, rode o comando Python com o ID da vaga:
```bash
cd /workspaces/nexus-7-agent && PYTHONPATH=src python -m src.job_apply_agent apply [vaga_id]
```

Ou via wrapper:
```bash
cd /workspaces/nexus-7-agent && python3 run_job_agent.py apply [vaga_id]
```

Para modo batch:
```bash
cd /workspaces/nexus-7-agent && python3 run_job_agent.py apply --batch 80
```
