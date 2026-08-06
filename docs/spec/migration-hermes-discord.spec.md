---
title: "Migração Nexus 7 Agent para Hermes com Discord"
status: "approved"
version: "1.0.0"
author: "Nexus Orchestrator"
created: "2026-06-19"
---

# Especificação: Migração para Hermes com Discord

## Visão Geral

Migração completa do ecossistema Nexus 7 Agent (OpenCode) para Hermes Agent com integração Discord como interface principal. A migração preserva todas as funcionalidades existentes (skills, MCPs, plugins, agentes) enquanto adiciona capacidades nativas do Discord (slash commands, threads, kanban, voz).

## Contexto Arquitetural

### Arquitetura Atual (OpenCode)
- **Runtime**: Node.js/TypeScript
- **Interface**: CLI + Dashboard web
- **Skills**: 8 skills em `.opencode/skills/`
- **MCP Servers**: 3 servidores (Nexus Memory, Job Apply, Google Workspace)
- **Plugins**: 4 plugins (Nexus Plugin, Context Manager, Cache Manager, Metrics Collector)
- **Agentes**: 12 agentes definidos em `.opencode/agents/`
- **Comandos**: 14 comandos customizados
- **Tools**: 5 ferramentas customizadas (nexus-log, nexus-memory, nexus-handoff, spec-validator, adapters)

### Arquitetura Alvo (Hermes + Discord)
- **Runtime**: Python (Hermes Agent)
- **Interface**: Discord (principal) + CLI + outros 22 plataformas
- **Skills**: Formato agentskills.io + Skills Hub
- **MCP**: Suporte nativo via `config.yaml`
- **Plugins**: Sistema de plugins Python (tools, hooks, CLI, platforms)
- **Agentes**: Hermes Agent com subagent spawning + kanban
- **Comandos**: Discord slash commands (Application Commands)
- **Memory**: FTS5 + Honcho user modeling (opcional)

## Requisitos

### NFR-001: Compatibilidade com Discord
- Bot deve responder a @mentions e slash commands
- Suporte a threads para conversas longas
- Permissões por guild/role (DISCORD_ALLOWED_ROLES)
- Suporte a arquivos (PDFs, imagens, documentos)

### NFR-002: Preservação de Funcionalidade
- Todas as 8 skills devem ser migradas
- Todos os 3 MCP servers devem funcionar
- Todos os 12 agentes devem estar acessíveis
- Pipeline de 6 estágios (SPEC→PLAN→ANALYZE→BUILD→REVIEW→DOCUMENT) deve ser preservado

### NFR-003: Memória Persistente
- Handoffs entre sessões devem funcionar
- Histórico de conversas no Discord
- Busca textual (FTS5) preservada
- Sync remoto via MongoDB (opcional)

### NFR-004: Segurança
- Redaction por padrão
- Role-allowlists do Discord
- TOCTOU hardening
- Credenciais nunca expostas em logs

### NFR-005: Performance
- Resposta < 3s para comandos simples
- Suporte a streaming de respostas longas
- Cache de respostas para queries frequentes

## Requisitos Funcionais

### REQ-001: Migração de Skills
Migrar as 8 skills do formato OpenCode para o formato Hermes (agentskills.io).

**Critérios de Aceitação:**
- CT-001.1: Skill `harness-workflow` funcional no Hermes
- CT-001.2: Skill `cbm-agent` conecta ao knowledge graph
- CT-001.3: Skill `job-apply-agent` executa pipeline completo
- CT-001.4: Skill `mem-search` busca memória persistente
- CT-001.5: Todas as skills são acessíveis via slash commands no Discord

### REQ-002: Migração de MCP Servers
Migrar os 3 MCP servers para o formato Hermes.

**Critérios de Aceitação:**
- CT-002.1: Nexus Memory Server funcional com SQLite + FTS5
- CT-002.2: Job Apply MCP Server conecta ao backend Python
- CT-002.3: Google Workspace MCP autentica via OAuth 2.0
- CT-002.4: Todos os tools MCP são acessíveis via Hermes

### REQ-003: Migração de Plugins
Migrar os 4 plugins OpenCode para o formato Hermes.

**Critérios de Aceitação:**
- CT-003.1: Nexus Plugin (logging, auto-observação) funcional
- CT-003.2: Context Manager preserva contexto em conversas longas
- CT-003.3: Cache Manager mantém cache de respostas
- CT-003.4: Metrics Collector exporta métricas

### REQ-004: Migração de Agentes
Migrar os 12 agentes para o formato Hermes.

**Critérios de Aceitação:**
- CT-004.1: Orchestrator executa pipeline de 6 estágios
- CT-004.2: Sub-agents são invocáveis via `task`
- CT-004.3: Security Auditor executa auditoria completa
- CT-004.4: QA Analyst escreve e executa testes
- CT-004.5: Docs Architect gera documentação

### REQ-005: Integração Discord
Implementar bot Discord com todas as funcionalidades.

**Critérios de Aceitação:**
- CT-005.1: Bot responde a @mentions
- CT-005.2: Slash commands funcionam (/super-pipeline, /spec-gen, etc.)
- CT-005.3: Threads são criadas automaticamente para pipelines longos
- CT-005.4: Arquivos (PDFs, imagens) são processados corretamente
- CT-005.5: Permissões por guild/role funcionam

### REQ-006: Comandos Discord
Mapear todos os 14 comandos OpenCode para slash commands Discord.

**Critérios de Aceitação:**
- CT-006.1: `/super-pipeline` executa pipeline completo
- CT-006.2: `/spec-gen` gera spec formal
- CT-006.3: `/security` executa auditoria
- CT-006.4: `/qa` executa testes
- CT-006.5: `/docs` gera documentação
- CT-006.6: `/memory` busca memória persistente
- CT-006.7: Todos os comandos `/job-*` funcionam

### REQ-007: Memória e Handoff
Implementar sistema de memória persistente no Hermes.

**Critérios de Aceitação:**
- CT-007.1: Handoffs são salvos e carregados corretamente
- CT-007.2: Histórico de conversas no Discord é preservado
- CT-007.3: Busca textual (FTS5) funciona
- CT-007.4: Sync remoto via MongoDB (opcional) funciona

### REQ-008: Kanban e Autonomous Workers
Implementar sistema de kanban para tarefas autônomas.

**Critérios de Aceitação:**
- CT-008.1: Kanban board é exibido no Discord
- CT-008.2: Workers executam tarefas autônomas
- CT-008.3: Zombie detection detecta tarefas travadas
- CT-008.4: Swarm topology funciona com múltiplos workers

### REQ-009: Deploy e Operação
Configurar deploy e operação do Hermes.

**Critérios de Aceitação:**
- CT-009.1: Hermes roda como serviço systemd
- CT-009.2: Configuração via `~/.hermes/config.yaml`
- CT-009.3: Variáveis de ambiente em `~/.hermes/.env`
- CT-009.4: Logs são estruturados e persistidos

### REQ-010: Migração de Dados
Migrar dados persistentes do OpenCode para Hermes.

**Critérios de Aceitação:**
- CT-010.1: Dados SQLite são migrados
- CT-010.2: Handoffs JSON são migrados
- CT-010.3: Logs históricos são preservados
- CT-010.4: Specs em `docs/spec/` são mantidos

## Estrutura de Migração

### Fase 1: Core Infrastructure (Plugin-First)
- [ ] REQ-003: Migrar plugins (Nexus Plugin, Context Manager, Cache Manager, Metrics Collector)
- [ ] REQ-007: Implementar memória e handoff
- [ ] REQ-009: Configurar deploy e operação

### Fase 2: MCP Bridge
- [ ] REQ-002: Migrar MCP servers (Nexus Memory, Job Apply, Google Workspace)

### Fase 3: Skills Translation
- [ ] REQ-001: Migrar skills (harness-workflow, cbm-agent, job-apply-agent, mem-search, etc.)

### Fase 4: Pipeline Workflow
- [ ] REQ-004: Migrar agentes (orchestrator, security, QA, docs, etc.)
- [ ] REQ-006: Implementar comandos Discord

### Fase 5: Discord Integration
- [ ] REQ-005: Implementar bot Discord completo
- [ ] REQ-008: Implementar kanban e autonomous workers
- [ ] REQ-010: Migrar dados persistentes

## Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Incompatibilidade de MCP servers | Alto | Testar cada MCP individualmente antes de migrar |
| Perda de dados durante migração | Alto | Backup completo antes de iniciar + validação pós-migração |
| Discord rate limiting | Médio | Implementar queue de mensagens + retry logic |
| Performance inferior | Médio | Benchmarking Comparativo + otimização de hot paths |
| Funcionalidade ausente no Hermes | Baixo | Verificar roadmap do Hermes + contribuir se necessário |

## Dependências Externas

- **Hermes Agent**: >= v0.15 (kanban, subagents, swarm)
- **Discord.py**: >= 2.0 (Application Commands, threads)
- **SQLite**: >= 3.40 (FTS5)
- **Python**: >= 3.11
- **MongoDB**: Opcional (sync remoto)
- **Ollama**: Para modelos locais (llama3.1:8b)

## Critérios de Aceitação Gerais

- [ ] Todas as 8 skills funcionam no Hermes
- [ ] Todos os 3 MCP servers estão conectados
- [ ] Todos os 12 agentes são acessíveis
- [ ] Pipeline de 6 estágios executa corretamente
- [ ] Bot Discord responde a todos os 14 comandos
- [ ] Memória persistente funciona (handoffs, histórico, busca)
- [ ] Kanban board está funcional
- [ ] Deploy como serviço systemd funciona
- [ ] Dados migrados sem perda
- [ ] Performance >= OpenCode (resposta < 3s)
