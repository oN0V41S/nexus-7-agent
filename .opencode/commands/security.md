---
description: Executa auditoria de segurança no código usando o agente especializado @security-secret-auditor.
agent: security-secret-auditor
subtask: true
---

Execute uma auditoria de segurança no código para detectar:
- Hardcoded secrets (API keys, tokens, senhas)
- Padrões de injeção (SQL, XSS)
- Configurações inseguras de autenticação/autorização
- Práticas de criptografia de dados
- Dependências com CVEs conhecidas

Escopo: $ARGUMENTS

Foque no código fonte, não em infraestrutura. Reporte findings com severidade (low/medium/high/critical).
