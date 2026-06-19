# Skill: OpenSRE Integration

Automação de investigação de incidentes (RCA) usando OpenSRE dentro do ecossistema Nexus.

## Quando Usar

- Um alerta de produção exige diagnóstico rápido
- Precisa de análise de causa raiz automatizada entre logs, métricas e traces
- Quer simular investigação de incidentes para testes
- Esteira de observabilidade integrada ao pipeline Nexus

## Workflow

### 1. Investigar um Alerta

```bash
# Com template genérico
python3 -m opensre investigate --print-template generic

# Com arquivo JSON de alerta
python3 -m opensre investigate -i .opencode/opensre/alerts/sample-generic.json

# Modo interativo (colar o JSON)
python3 -m opensre investigate --interactive

# Serviço remoto (se configurado)
python3 -m opensre investigate --service api-gateway
```

### 2. Gerenciar Integrações

```bash
# Listar serviços disponíveis
opensre integrations list

# Configurar integração (ex: Datadog)
opensre integrations setup datadog

# Verificar conectividade
opensre integrations verify
```

### 3. Executar Testes Sintéticos

```bash
# Listar testes disponíveis
opensre tests list

# Rodar benchmark RCA sintético (RDS PostgreSQL)
opensre tests synthetic

# Rodar teste específico por ID
opensre tests run <test-id>
```

### 4. Diagnóstico do Ambiente

```bash
opensre doctor
opensre health
```

## Integração com o Harness Nexus

O OpenSRE pode ser integrado ao pipeline Nexus nos estágios:

- **MONITOR** → Investigação automática de alertas
- **ANALYZE** → RCA como insumo para análise de causa raiz
- **REVIEW** → Relatório de incidente como artefato de revisão

### Uso Programático (Python)

```python
from opensre import OpenSREAgent

agent = OpenSREAgent()
report = agent.investigate(alert_payload="...")
print(report.root_cause)
print(report.evidence)
```

## Configuração de LLM

O OpenSRE suporta múltiplos provedores configuráveis via variáveis de ambiente:

| Variável | Exemplo |
|---|---|
| `OPENAI_API_KEY` | `sk-...` |
| `ANTHROPIC_API_KEY` | `sk-ant-...` |
| `GEMINI_API_KEY` | `AIza...` |
| `OPENROUTER_API_KEY` | `sk-or-...` |
| `OLLAMA_BASE_URL` | `http://localhost:11434` |

## Critérios de Qualidade

- [ ] LLM configurado (ao menos um provedor)
- [ ] Integrações de observabilidade configuradas
- [ ] Alerta simulado testado com `opensre investigate`
- [ ] Relatório RCA exportado para `.opencode/logs/opensre/`

Base directory: file:///workspaces/nexus-7-agent/.opencode/skills/opensre-skill
