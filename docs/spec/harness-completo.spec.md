---
title: "Harness Completo - Registro de MCPs e Criação de Módulos"
status: "draft"
author: "Nexus Orquestrador"
created: "2026-05-19"
updated: "2026-05-19"
version: "0.1.0"
---

# Harness Completo - Registro de MCPs e Criação de Módulos

## Problema

O ecossistema Nexus 7 Agent possui MCPs configurados no `opencode.json` que não têm agentes/skills dedicados, e servidores MCP locais que não estão registrados na configuração. Isso cria gaps na cobertura do harness.

## Usuário Alvo

Desenvolvedores que usam o ecossistema Nexus e precisam de agentes especializados para cada MCP disponível.

---

## Requisitos Funcionais

### REQ-001: Registrar Google Workspace MCP no opencode.json
**Prioridade:** alta

O servidor Google Workspace existe em `.opencode/mcp/google-workspace/` mas não está registrado na seção `mcp` do `opencode.json`.

**Critérios de Aceitação:**
- Seção `mcp.google-workspace` adicionada ao `opencode.json`
- Configuração aponta para o servidor local existente
- JSON válido após modificação

**Casos de Teste:**
- CT-001.1: Caminho feliz — Google Workspace MCP registrado e JSON válido
- CT-001.2: Configuração aponta para servidor existente em `.opencode/mcp/google-workspace/`

### REQ-002: Registrar Nexus Memory Server MCP no opencode.json
**Prioridade:** alta

O servidor Nexus Memory existe em `.opencode/mcp/nexus-memory-server.ts` mas não está registrado na seção `mcp` do `opencode.json`.

**Critérios de Aceitação:**
- Seção `mcp.nexus-memory-server` adicionada ao `opencode.json`
- Configuração aponta para o servidor TypeScript existente
- JSON válido após modificação

**Casos de Teste:**
- CT-002.1: Caminho feliz — Nexus Memory Server MCP registrado e JSON válido
- CT-002.2: Configuração aponta para servidor existente em `.opencode/mcp/nexus-memory-server.ts`

### REQ-003: Criar agente @playwright-agent para Playwright MCP
**Prioridade:** media

O Playwright MCP está configurado no `opencode.json` mas não há agente dedicado no ecossistema Nexus.

**Critérios de Aceitação:**
- Arquivo `.opencode/agents/playwright-agent.md` criado
- Frontmatter YAML válido com description e mode
- Documenta as ferramentas Playwright MCP disponíveis
- Inclui workflow de uso e quando usar/não usar

**Casos de Teste:**
- CT-003.1: Caminho feliz — Agente criado com frontmatter válido
- CT-003.2: Agente documenta ferramentas Playwright MCP
- CT-003.3: Agente inclui seção "Quando Usar" e "Quando NÃO Usar"

### REQ-004: Criar skill playwright-automation para Playwright
**Prioridade:** media

Skill dedicada para automação Playwright via MCP.

**Critérios de Aceitação:**
- Arquivo `.opencode/skills/playwright-automation/SKILL.md` criado
- Frontmatter YAML válido com name e description
- Inclui workflows de automação (navegar, clicar, preencher, extrair)
- Referencia o agente @playwright-agent

**Casos de Teste:**
- CT-004.1: Caminho feliz — Skill criada com frontmatter válido
- CT-004.2: Skill inclui workflows de automação
- CT-004.3: Skill referencia @playwright-agent

### REQ-005: Criar agente @chrome-devtools-agent para Chrome DevTools MCP
**Prioridade:** media

O Chrome DevTools MCP está configurado no `opencode.json` mas não há agente dedicado.

**Critérios de Aceitação:**
- Arquivo `.opencode/agents/chrome-devtools-agent.md` criado
- Frontmatter YAML válido com description e mode
- Documenta as ferramentas Chrome DevTools MCP disponíveis
- Inclui workflow de uso e quando usar/não usar

**Casos de Teste:**
- CT-005.1: Caminho feliz — Agente criado com frontmatter válido
- CT-005.2: Agente documenta ferramentas Chrome DevTools MCP
- CT-005.3: Agente inclui seção "Quando Usar" e "Quando NÃO Usar"

### REQ-006: Criar skill chrome-devtools para DevTools
**Prioridade:** media

Skill dedicada para Chrome DevTools via MCP.

**Critérios de Aceitação:**
- Arquivo `.opencode/skills/chrome-devtools/SKILL.md` criado
- Frontmatter YAML válido com name e description
- Inclui workflows de debugging (performance, network, console)
- Referencia o agente @chrome-devtools-agent

**Casos de Teste:**
- CT-006.1: Caminho feliz — Skill criada com frontmatter válido
- CT-006.2: Skill inclui workflows de debugging
- CT-006.3: Skill referencia @chrome-devtools-agent

### REQ-007: Atualizar opencode.json com agentes/ferramentas/permissões consolidados
**Prioridade:** alta

Consolidar todos os novos agentes e ferramentas no `opencode.json`.

**Critérios de Aceitação:**
- Seção `agent` inclui playwright-agent e chrome-devtools-agent
- Seção `permission` inclui ferramentas dos novos agentes
- JSON válido após todas as modificações

**Casos de Teste:**
- CT-007.1: Caminho feliz — opencode.json válido com todos os agentes
- CT-007.2: Novos agentes têm permissões configuradas
- CT-007.3: JSON parseável sem erros

### REQ-008: Atualizar AGENTS.md com novos agentes, skills e comandos
**Prioridade:** media

Documentação do projeto deve refletir todos os módulos do harness.

**Critérios de Aceitação:**
- Tabela de Agentes inclui @playwright-agent e @chrome-devtools-agent
- Tabela de Skills inclui playwright-automation e chrome-devtools
- Tabela de Comandos inclui novos comandos (se houver)

**Casos de Teste:**
- CT-008.1: Caminho feliz — AGENTS.md atualizado com todos os módulos
- CT-008.2: Tabelas consistentes com arquivos existentes

### REQ-009: Verificar/adicionar tools MCP nas permissões de agents existentes
**Prioridade:** alta

Garantir que agents existentes (notion-agent, cbm-agent, google-workspace-agent) tenham as ferramentas MCP corretamente configuradas.

**Critérios de Aceitação:**
- @notion-agent tem tools para Notion MCP
- @cbm-agent tem tools para codebase-memory-mcp
- @google-workspace-agent tem tools para Google Workspace MCP
- Permissões consistentes com os MCPs configurados

**Casos de Teste:**
- CT-009.1: Caminho feliz — Todos os agents existentes têm tools MCP configuradas
- CT-009.2: Permissões consistentes entre agents e MCPs

### REQ-010: Adicionar comandos customizados (playwright, devtools) no opencode.json
**Prioridade:** media

Adicionar comandos `/playwright` e `/devtools` para acesso rápido aos novos agentes.

**Critérios de Aceitação:**
- Comando `playwright` adicionado na seção `command` do `opencode.json`
- Comando `devtools` adicionado na seção `command` do `opencode.json`
- Comandos referenciam os agentes corretos
- JSON válido após modificação

**Casos de Teste:**
- CT-010.1: Caminho feliz — Comandos adicionados e JSON válido
- CT-010.2: Comandos referenciam agentes corretos

---

## Requisitos Não-Funcionais

### NFR-001: Validação JSON
**Prioridade:** alta

Todo arquivo JSON modificado deve ser válido e parseável.

**Métrica:** `node -e "JSON.parse(require('fs').readFileSync('opencode.json'))"` sem erro.

### NFR-002: Consistência de Frontmatter
**Prioridade:** media

Todos os arquivos .md de agentes e skills devem ter frontmatter YAML válido.

**Métrica:** Frontmatter parseável com fields obrigatórios (description, mode para agents; name, description para skills).
