---
title: "Integração codebase-memory-mcp no Ecossistema Nexus"
status: "implemented"
author: "Nexus Orquestrador"
created: "2026-05-13"
updated: "2026-05-13"
version: "1.0.0"
---

# Integração codebase-memory-mcp no Nexus — Spec

## 1. Visão Geral

**Problema:** O Nexus não possui um agente especializado em análise estrutural de código. O MCP server `codebase-memory-mcp` (CBM) oferece 14 ferramentas de code intelligence via knowledge graph (tree-sitter, 155 linguagens, consultas sub-ms), mas não está integrado ao ecossistema Nexus.

**Usuário alvo:** O orquestrador Nexus e os agentes `@orchestrator`, `@quality-assurance-analyst`, `@security-secret-auditor` — qualquer agente que precise entender a estrutura do código.

**Contexto:** O CBM é um MCP server externo em C, single binary, zero dependências. Já tem suporte nativo a OpenCode (auto-detecta e configura). Precisamos integrá-lo formalmente no ecossistema Nexus: instalar, configurar, criar agente wrapper e skill.

---

## 2. Requisitos Funcionais

### REQ-001: Instalar binary do codebase-memory-mcp

**Descrição:** Baixar e instalar o binary do CBM para Linux amd64 no ambiente de desenvolvimento.
**Prioridade:** Alta
**Critérios de Aceitação:**
- [x] Binary `codebase-memory-mcp` disponível no `$PATH`
- [x] Versão mais recente (v0.6.1+) instalada
- [x] `codebase-memory-mcp --version` retorna sem erro
- [x] Binary verificável via SHA-256 checksum
**Casos de Teste:**
- `CT-001.1`: Executar `codebase-memory-mcp --version` → saída contém versão
- `CT-001.2`: Verificar que binary está em `~/.local/bin/` ou diretório configurado
- `CT-001.3`: Executar `echo '{}' | codebase-memory-mcp` → resposta JSON-RPC válida
- `CT-001.4`: Binary não encontrado no PATH → instalação via script setup.sh

### REQ-002: Indexar o repositório Nexus

**Descrição:** Executar `index_repository` para construir o knowledge graph do repositório Nexus.
**Prioridade:** Alta
**Critérios de Aceitação:**
- [x] Comando via CLI: `codebase-memory-mcp cli index_repository '{"repo_path": "/workspaces/nexus-7-agent"}'`
- [x] Graph contém nós para funções, classes, arquivos do projeto
- [x] Indexação persiste entre sessões (SQLite em `~/.cache/codebase-memory-mcp/`)
**Casos de Teste:**
- `CT-002.1`: Indexar repositório → mensagem de sucesso com contagem de nós/arestas
- `CT-002.2`: `list_projects` → lista o projeto "nexus-7-agent"
- `CT-002.3`: `get_architecture` → retorna linguagens, pacotes, entry points
- `CT-002.4`: Path inválido no `index_repository` → mensagem de erro "directory not found"

### REQ-003: Configurar MCP server no OpenCode

**Descrição:** Registrar o CBM como MCP server no `opencode.json` do Nexus para que todos os agentes possam utilizar suas tools.
**Prioridade:** Alta
**Critérios de Aceitação:**
- [x] Entry em `mcpServers` no `opencode.json` apontando para o binary
- [x] Após restart, agentes Nexus enxergam as 14 tools do CBM
- [x] Configuração global (não por projeto)
**Casos de Teste:**
- `CT-003.1`: Verificar `opencode.json` contém entry `codebase-memory-mcp`
- `CT-003.2`: Verificar que o comando do MCP server é o path absoluto do binary
- `CT-003.3`: `opencode.json` com sintaxe inválida → MCP server não carrega, log de erro

### REQ-004: Criar agente Nexus @cbm-agent

**Descrição:** Criar agente especializado `@cbm-agent` no ecossistema Nexus que saiba usar as 14 tools do codebase-memory-mcp para análise de código.
**Prioridade:** Alta
**Critérios de Aceitação:**
- [x] Agente criado em `.opencode/agents/cbm-agent.md`
- [x] Descrição clara das 14 tools disponíveis
- [x] Workflow de uso: search_graph → trace → architecture
- [x] Registrado em `AGENTS.md`
**Casos de Teste:**
- `CT-004.1`: Arquivo `.opencode/agents/cbm-agent.md` existe com frontmatter válido
- `CT-004.2`: `AGENTS.md` contém linha na tabela de agentes
- `CT-004.3`: Modo = subagent (delegável pelo orquestrador)
- `CT-004.4`: `opencode.json` sem entry do agente → task com `@cbm-agent` falha com "agent not found"

### REQ-005: Criar skill cbm-agent

**Descrição:** Criar skill dedicada que documenta como usar as tools do CBM, incluindo exemplos de queries Cypher, busca estrutural, rastreamento de chamadas e análise de arquitetura.
**Prioridade:** Média
**Critérios de Aceitação:**
- [x] Skill criada em `.opencode/skills/cbm-agent/SKILL.md`
- [x] Exemplos de uso para cada tool relevante
- [x] Workflow de análise de código (roteiro para o agente)
- [x] Registrada em `AGENTS.md`
**Casos de Teste:**
- `CT-005.1`: Arquivo SKILL.md existe com frontmatter válido
- `CT-005.2`: Contém exemplos de search_graph, trace_call_path, get_architecture
- `CT-005.3`: Contém workflow de "entender código desconhecido"
- `CT-005.4`: Skill carregada com `skill("cbm-agent")` → instruções disponíveis sem erro

### REQ-006: Criar comando /cbm-query

**Descrição:** Criar comando customizado `/cbm-query` que delega consultas ao CBM via subagent, permitindo queries Cypher rápidas sem sair do chat.
**Prioridade:** Média
**Critérios de Aceitação:**
- [x] Comando criado em `.opencode/commands/cbm-query.md`
- [x] Aceita argumento: query Cypher ou nome de função
- [x] Delega ao `@cbm-agent`
**Casos de Teste:**
- `CT-006.1`: Arquivo de comando existe
- `CT-006.2`: Descrição menciona delegação ao @cbm-agent
- `CT-006.3`: Query Cypher inválida (`MATCH (n` sem fechar) → mensagem de erro de parse

### REQ-007: Auto-indexação no pipeline

**Descrição:** O pipeline do Nexus deve indexar automaticamente o repositório (ou verificar indexação existente) antes de executar estágios que dependem de análise de código (ANALYZE).
**Prioridade:** Baixa
**Critérios de Aceitação:**
- [x] Estágio ANALYZE do pipeline verifica se repositório está indexado
- [x] Se não estiver, executa `index_repository` automaticamente
**Casos de Teste:**
- `CT-007.1`: Executar pipeline → mensagem "Verificando indexação CBM..."
- `CT-007.2`: Se não indexado, `index_repository` é chamado via CLI
- `CT-007.3`: Binary CBM não encontrado no ANALYZE → log de aviso, pipeline continua (fallback seguro)

---

## 3. Requisitos Não-Funcionais

### NFR-001: Performance de indexação

**Descrição:** A indexação do repositório Nexus deve ser rápida o suficiente para não bloquear o pipeline.
**Métrica:** Indexação completa em < 30 segundos para o repositório Nexus.
**Prioridade:** Média

### NFR-002: Zero impacto nos estágios existentes

**Descrição:** A integração do CBM não deve quebrar nenhum estágio existente do pipeline Nexus.
**Métrica:** Todos os testes e verificações existentes continuam passando.
**Prioridade:** Alta

### NFR-003: Documentação em português

**Descrição:** Toda documentação do agente e skill deve seguir o padrão do ecossistema Nexus (português).
**Métrica:** Arquivos revisados para conformidade.
**Prioridade:** Baixa

---

## 4. Dependências

- Binary `codebase-memory-mcp` para Linux amd64 (última release)
- Acesso à internet para download (ou binary já presente)
- OpenCode com suporte a MCP servers
- `opencode.json` configurável (permissão de escrita)

## 5. Questões em Aberto

- O binary deve ser versionado no repositório ou baixado via script de setup?
- Deve haver fallback se o binary não estiver disponível?
- O CBM já suporta OpenCode nativamente — devemos usar a instalação padrão ou customizar?

---

## Histórico de Revisões

| Versão | Data | Autor | Mudanças |
|--------|------|-------|----------|
| 0.1.0 | 2026-05-13 | Nexus Orquestrador | Criação inicial |
| 0.2.0 | 2026-05-13 | Nexus Orquestrador | Adicionados CTs de erro/edge case por REQ |
| 1.0.0 | 2026-05-13 | Nexus Orquestrador | Implementação completa: binary v0.6.1, repo indexado (629 nós), 14 MCP tools, agente/skill/comando, integração no pipeline ANALYZE |
