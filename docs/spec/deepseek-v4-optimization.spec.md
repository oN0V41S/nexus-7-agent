---
title: "Otimização do DeepSeek-V4 Flash 200k para Implementação e Execução de Tarefas"
status: "draft"
version: "1.1.0"
author: "Nexus Orchestrator"
created: "2026-06-19"
---

# DeepSeek-V4 Flash 200k Optimization

## Resumo

Otimizar o desempenho do modelo deepseek-v4 Flash 200k no ecossistema Nexus 7 Agent, focando em três áreas principais: performance (latência e throughput), qualidade de código gerado e redução de custos. O gargalo principal identificado é a perda de contexto em conversas longas. Adicionalmente, configurar arquitetura de modelos dual: orquestradores com maior contexto e deepseek como executor dedicado.

## Contexto

O deepseek-v4 Flash é utilizado como modelo de código e executor de tarefas no harness Nexus, sendo a opção mais custo-objetiva atualmente. O modelo é configurado no GitHub Actions workflow (`.github/workflows/opencode.yml`) e opera em modo streaming com 200k tokens de contexto.

### Arquitetura Atual
- **Modelo:** deepseek-v4-flash-free via OpenCode API
- **Contexto:** 200k tokens
- **Uso:** Implementação de código + execução de tarefas
- **Gargalo:** Perda de contexto em conversas longas
- **Problema:** Todos os agentes usam o mesmo modelo sem distinção de papel

### Arquitetura Alvo (Dual Model)
- **Orquestradores (primary):** Modelo de maior contexto (ex: gemini-2.5-pro) — visão global do pipeline
- **Executores (subagent):** deepseek-v4-flash-free — tarefas táticas e implementação
- **Vantagem:** Custo reduzido + qualidade mantida + contexto adequado por papel

## Requisitos

### NFR-001: Performance
- Reduzir latência de resposta em 30% via otimização de prompts
- Manter throughput mínimo de 100 tokens/segundo

### NFR-002: Qualidade
- Reduzir taxa de erros de código em 40%
- Melhorar aderência a padrões do projeto

### NFR-003: Custo
- Reduzir consumo de tokens em 25%
- Manter qualidade aceitável com prompts otimizados

### REQ-001: Gerenciamento de Contexto
**Descrição:** Implementar sistema de gerenciamento de contexto para evitar perda de informações em conversas longas.

**Critérios de Aceitação:**
- CT-001: Sistema deve manter contexto relevante por até 50 mensagens
- CT-002: Resumo automático a cada 10 mensagens
- CT-003: Priorização de contexto por relevância

### REQ-002: Otimização de Prompts
**Descrição:** Criar templates de prompts otimizados para diferentes tarefas (implementação, debugging, análise).

**Critérios de Aceitação:**
- CT-004: Prompts para implementação de código
- CT-005: Prompts para execução de tarefas
- CT-006: Prompts para debugging

### REQ-003: Sistema de Cache
**Descrição:** Implementar cache de respostas para tarefas similares.

**Critérios de Aceitação:**
- CT-007: Cache de código gerado frequentemente
- CT-008: TTL configurável por tipo de tarefa
- CT-009: Invalidação automática quando código-base muda

### REQ-004: Métricas e Monitoramento
**Descrição:** Implementar coleta de métricas de performance e qualidade.

**Critérios de Aceitação:**
- CT-010: Latência por tipo de tarefa
- CT-011: Taxa de erro por tipo de código
- CT-012: Consumo de tokens por sessão

### REQ-005: Configuração de Modelos por Agente
**Descrição:** Configurar explicitamente o modelo deepseek-v4-flash para todos os sub-agents no opencode.json, reservando o modelo de maior contexto (ex: Gemini) apenas para orquestradores primários.

**Motivação:**
- Sub-agents são executores de tarefas — não precisam de 200k contexto
- Deepseek-v4-flash é mais barato e suficiente para execução pontual
- Orquestradores precisam de maior contexto para manter visão global do pipeline
- Permite escalar orquestradores para modelos maiores sem afetar custo dos executores

**Critérios de Aceitação:**
- CT-013: Todos os sub-agents (mode=subagent) devem ter `"model": "deepseek-v4-flash-free"` definido
- CT-014: Primary agents (orchestrator, job-apply-agent) devem usar modelo de maior contexto configurável
- CT-015: Validação de que nenhuma configuração de modelo ficou órfã
- CT-016: Documentação da arquitetura dual no AGENTS.md

**Arquivos Afetados:**
- `opencode.json` — Adicionar campo `model` em cada definição de agente
- `AGENTS.md` — Documentar arquitetura dual de modelos

**Mapeamento de Agentes:**

| Agente | Mode | Modelo Alvo |
|--------|------|-------------|
| orchestrator | primary | gemini-2.5-pro (ou outro maior) |
| job-apply-agent | primary | gemini-2.5-pro (ou outro maior) |
| security-secret-auditor | subagent | deepseek-v4-flash-free |
| quality-assurance-analyst | subagent | deepseek-v4-flash-free |
| docs-architect | subagent | deepseek-v4-flash-free |
| testsprite-mcp-agent | subagent | deepseek-v4-flash-free |
| cbm-agent | subagent | deepseek-v4-flash-free |
| notion-agent | subagent | deepseek-v4-flash-free |
| playwright-agent | subagent | deepseek-v4-flash-free |
| chrome-devtools-agent | subagent | deepseek-v4-flash-free |
| oracle | subagent | deepseek-v4-flash-free |
| explorer | subagent | deepseek-v4-flash-free |
| fixer | subagent | deepseek-v4-flash-free |
| librarian | subagent | deepseek-v4-flash-free |
| designer | subagent | deepseek-v4-flash-free |
| spec-reviewer | subagent | deepseek-v4-flash-free |
| google-workspace-agent | subagent | deepseek-v4-flash-free |
| councillor | subagent | deepseek-v4-flash-free |
| observer | subagent | deepseek-v4-flash-free |

## Fora do Escopo

- Migração para outros provedores de IA (deepseek permanece como executor)
- Modificações no harness Nexus existente além de configuração de modelo

## Riscos

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Complexidade de implementação | Alto | Foco em módulos independentes |
| Regressão de qualidade | Médio | Testes A/B antes de deploy |
| Aumento de latência | Baixo | Monitoramento contínuo |
| Incompatibilidade de modelo primário | Médio | Fallback para deepseek nos primaries |

## Dependências

- OpenCode API (provedor deepseek + gemini)
- Harness Nexus existente
- Plugins de observabilidade

## Aprovação

- [x] Usuário (REQ-005 aprovada em 2026-06-19)
- [ ] Oracle (revisão arquitetural)
- [ ] Security Auditor (se aplicável)
