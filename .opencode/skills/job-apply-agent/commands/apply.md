# /job-apply - Aplicação Semiautomática

Executa candidatura com aprovação humana.

## Uso
```
/job-apply [vaga_id | --batch X%]
```

## Processo
1. Exibe resumo: descrição + currículo adaptado + carta
2. Ações: Aprovar / Rejeitar / Editar
3. Se aprovado: submete via Chrome MCP (LinkedIn) ou Playwright MCP (ATS)
4. Confirma submissão
5. Registra no Notion + applied.jsonl

## ATS Suportados
- LinkedIn Easy Apply (Chrome MCP)
- Greenhouse, Workday, Ashby, Lever, iCIMS, Taleo (Playwright MCP)

## Segurança
- CAPTCHA → log como skip, notifica usuário
- Sessão expirada → pausa, solicita login manual
