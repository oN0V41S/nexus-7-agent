# Investigação de Incidentes com OpenSRE

Realiza análise automatizada de causa raiz (RCA) para incidentes de produção usando o OpenSRE.

## Uso

- `/opensre investigate -i <arquivo>` — Investigar alerta de um arquivo JSON
- `/opensre investigate --interactive` — Colar o payload do alerta
- `/opensre health` — Verificar status das integrações
- `/opensre investigate --service <nome>` — Investigar serviço remoto

## Alertas de Exemplo

- `.opencode/opensre/alerts/sample-generic.json` — Template genérico
- `.opencode/opensre/alerts/sample-datadog.json` — Template Datadog

## Script de Apoio

```bash
python3 .opencode/opensre/scripts/nexus-opensre.py investigate <alert.json>
python3 .opencode/opensre/scripts/nexus-opensre.py template generic
python3 .opencode/opensre/scripts/nexus-opensre.py health
```
