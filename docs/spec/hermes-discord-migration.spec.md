---
title: "Migração do Ecossistema Nexus para Hermes Agent com Discord"
status: draft
version: 1.0.0
author: Nexus Orchestrator
date: 2026-06-19
---

# Especificação: Migração do Ecossistema Nexus para Hermes Agent com Discord

## Visão Geral

Esta especificação descreve a migração do ecossistema Nexus 7 Agent (skills, MCPs, plugins e agentes) para o Hermes Agent com integração ao Discord. O objetivo é preservar toda a funcionalidade existente enquanto se aproveita a infraestrutura madura do Hermes para messaging, memory, skills e orquestração.

## Contexto

### Ecossistema Atual (Nexus 7 Agent)

| Componente | Quantidade | Descrição |
|---|---|---|
| **Skills** | 5 ativas | harness-workflow, mem-search, agent-creator, cbm-agent, project-review |
| **MCPs** | 3 servidores | nexus-memory-server, job-apply-mcp, google-workspace |
| **Plugins** | 4 arquivos | nexus-plugin, metrics-collector, cache-manager, context-manager |
| **Agentes** | 12 definições | orchestrator, spec-reviewer, security-auditor, qa-analyst, docs-architect, cbm-agent, testsprite, notion, google-workspace, playwright, chrome-devtools, job-apply |
| **Custom Tools** | 4 tools | nexus-log, nexus-memory, nexus-handoff, spec-validator |
| **Comandos** | 15+ comandos | /super-pipeline, /spec-gen, /security, /qa, /docs, etc. |

### Hermes Agent (Alvo)

- **Framework:** Hermes Agent (NousResearch)
- **Plataforma de Messaging:** Discord (com suporte a Telegram, Slack, WhatsApp, Signal)
- **Skills Hub:** agentskills.io (padrão aberto)
- **Memória:** FTS5 session search + LLM summarization + Honcho dialectic user modeling
- **Orquestração:** Subagents paralelos, cron scheduler, RPC tools
- **Modelos:** OpenRouter (200+), Nous Portal, OpenAI, Ollama, etc.

## Requisitos

### REQ-001: Migração de Skills

**Descrição:** Migrar as 5 skills ativas do Nexus para o formato Hermes Agent skills.

| CT-ID | Critério de Aceitação |
|---|---|
| CT-001.1 | Todas as 5 skills são convertidas para o formato Hermes (agentskills.io standard) |
| CT-001.2 | Cada skill mantém sua funcionalidade core |
| CT-001.3 | Skills são reconhecidas pelo `hermes skills list` |
| CT-001.4 | Skills podem ser invocadas via slash commands no Discord |

**Skills a Migrar:**

| Skill Nexus | Função Hermes Equivalente | Complexidade |
|---|---|---|
| `harness-workflow` | Pipeline skill customizada | Alta |
| `mem-search` | Hermes memory (FTS5 built-in) | Baixa |
| `agent-creator` | Hermes skill creation (built-in) | Média |
| `cbm-agent` | Hermes tool + MCP | Alta |
| `project-review` | Hermes skill customizada | Média |

### REQ-002: Migração de MCPs

**Descrição:** Migrar os 3 servidores MCP do Nexus para o Hermes Agent.

| CT-ID | Critério de Aceitação |
|---|---|
| CT-002.1 | nexus-memory-server é substituído pelo Hermes memory built-in |
| CT-002.2 | job-apply-mcp é integrado como Hermes tool |
| CT-002.3 | google-workspace MCP é configurado no Hermes config.yaml |
| CT-002.4 | Todos os MCPs são acessíveis via Discord |

**MCPs a Migrar:**

| MCP Nexus | Equivalente Hermes | Ação |
|---|---|---|
| `nexus-memory-server` | Hermes memory (FTS5) | Substituir |
| `job-apply-mcp` | Hermes tool customizada | Adaptar |
| `google-workspace` | Hermes config.yaml | Configurar |

### REQ-003: Migração de Plugins

**Descrição:** Migrar os plugins do Nexus para hooks/features do Hermes.

| CT-ID | Critério de Aceitação |
|---|---|
| CT-003.1 | nexus-plugin (observabilidade) é substituído pelo Hermes logging |
| CT-003.2 | metrics-collector é integrado ao Hermes metrics |
| CT-003.3 | cache-manager é substituído pelo Hermes cache built-in |
| CT-003.4 | context-manager é integrado ao Hermes session management |

### REQ-004: Migração de Agentes

**Descrição:** Migrar as 12 definições de agentes do Nexus para subagents Hermes.

| CT-ID | Critério de Aceitação |
|---|---|
| CT-004.1 | Agentes são convertidos para Hermes subagent format |
| CT-004.2 | Orquestrador é configurado como Hermes primary agent |
| CT-004.3 | Subagents são invocáveis via Discord |
| CT-004.4 | Roles e permissões são mantidas |

**Agentes a Migrar:**

| Agente Nexus | Tipo Hermes | Prioridade |
|---|---|---|
| `@orchestrator` | Primary agent | Alta |
| `@spec-reviewer` | Subagent | Alta |
| `@security-secret-auditor` | Subagent | Alta |
| `@quality-assurance-analyst` | Subagent | Alta |
| `@docs-architect` | Subagent | Média |
| `@cbm-agent` | Subagent + Tool | Alta |
| `@testsprite-mcp-agent` | Subagent | Média |
| `@notion-agent` | Subagent | Média |
| `@google-workspace-agent` | Subagent | Média |
| `@playwright-agent` | Subagent | Baixa |
| `@chrome-devtools-agent` | Subagent | Baixa |
| `@job-apply-agent` | Subagent | Alta |

### REQ-005: Configuração do Discord

**Descrição:** Configurar o Hermes Agent para operação via Discord.

| CT-ID | Critério de Aceitação |
|---|---|
| CT-005.1 | Bot Discord é criado no Developer Portal |
| CT-005.2 | Bot token é configurado no Hermes config.yaml |
| CT-005.3 | Message Content Intent está habilitado |
| CT-005.4 | Bot responde em canais permitidos |
| CT-005.5 | Slash commands funcionam |
| CT-005.6 | DMs são processados corretamente |
| CT-005.7 | Threads são suportadas |

### REQ-006: Custom Tools

**Descrição:** Migrar as custom tools do Nexus para Hermes tools.

| CT-ID | Critério de Aceitação |
|---|---|
| CT-006.1 | nexus-log é substituído pelo Hermes logging |
| CT-006.2 | nexus-memory é substituído pelo Hermes memory |
| CT-006.3 | nexus-handoff é substituído pelo Hermes session management |
| CT-006.4 | spec-validator é integrado como Hermes tool |

### REQ-007: Comandos Customizados

**Descrição:** Migrar os comandos do Nexus para slash commands do Discord.

| CT-ID | Critério de Aceitação |
|---|---|
| CT-007.1 | /super-pipeline funciona via Discord |
| CT-007.2 | /spec-gen funciona via Discord |
| CT-007.3 | Todos os comandos de agentes funcionam via Discord |
| CT-007.4 | Comandos têm autocomplete no Discord |

### REQ-008: Dados e Persistência

**Descrição:** Migrar dados persistentes do Nexus para o Hermes.

| CT-ID | Critério de Aceitação |
|---|---|
| CT-008.1 | Handoffs existentes são importados |
| CT-008.2 | Sessões de memória são preservadas |
| CT-008.3 | MongoDB sync continua funcionando |
| CT-008.4 | Logs históricos são acessíveis |

### REQ-009: Testes e Validação

**Descrição:** Validar que toda a funcionalidade migrou corretamente.

| CT-ID | Critério de Aceitação |
|---|---|
| CT-009.1 | Pipeline completo funciona via Discord |
| CT-009.2 | Todos os agentes respondem corretamente |
| CT-009.3 | MCPs funcionam via Hermes |
| CT-009.4 | Performance é equivalente ou melhor |

### REQ-0010: Rollback

**Descrição:** Plano de rollback caso a migração falhe.

| CT-ID | Critério de Aceitação |
|---|---|
| CT-0010.1 | Nexus original continua funcionando |
| CT-0010.2 | Dados não são perdidos |
| CT-0010.3 | Rollback pode ser executado em < 30 minutos |

## Restrições

1. **Compatibilidade:** O ecossistema Nexus atual deve continuar funcionando durante a migração
2. **Dados:** Nenhum dado pode ser perdido durante a migração
3. **Performance:** A latência de resposta via Discord não deve exceder 5 segundos
4. **Segurança:** Tokens e secrets devem ser gerenciados de forma segura
5. **Custo:** A migração não deve aumentar significativamente os custos de infraestrutura

## Dependências

- Hermes Agent instalado e configurado
- Bot Discord criado e com permissões adequadas
- Acesso ao Hermes config.yaml
- MongoDB (opcional, para sync remota)

## Fora do Escopo

- Migração do Dashboard web (pode ser feita futuramente)
- Migração do OpenSRE (pode ser feita futuramente)
- Criação de novas funcionalidades (apenas migração das existentes)

## Decisões de Arquitetura

| Decisão | Opção | Justificativa |
|---|---|---|
| Memória | Hermes memory (FTS5) | Built-in, não precisa de servidor externo |
| Skills | agentskills.io standard | Padrão aberto, compatível com ecossistema Hermes |
| MCPs | Hermes config.yaml | Integração nativa |
| Agentes | Hermes subagents | Suporte nativo a orquestração |
| Discord | Hermes messaging gateway | Suporte completo a threads, DMs, slash commands |
