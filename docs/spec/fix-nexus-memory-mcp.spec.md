---
title: "Fix MCP Nexus-Memory Server — Diagnóstico e Reparo"
status: "implemented"
author: "Nexus Orquestrador"
created: "2026-05-22"
updated: "2026-05-22"
version: "0.1.0"
---

# Fix MCP Nexus-Memory Server

## Contexto

O ecossistema Nexus possui um servidor MCP (`nexus-memory-server`) para expor as funções de memória persistente (save, load, search, list, delete) via protocolo MCP. O servidor está implementado em `.opencode/mcp/nexus-memory-server.ts` e configurado em `opencode.json` como:

```json
"nexus-memory-server": {
  "type": "local",
  "command": ["npx", "tsx", ".opencode/mcp/nexus-memory-server.ts"],
  "enabled": true
}
```

**Diagnóstico inicial:**
- O servidor funciona quando testado diretamente via stdin (responde `initialize`, `tools/list`, `tools/call`)
- `tsx` está instalado (v4.22.3) e `better-sqlite3` está nas dependências
- O banco SQLite existe em `.opencode/memory/nexus-memory.db` (45KB)
- Aparentemente o OpenCode não está detectando ou comunicando com o servidor MCP corretamente

Além do MCP, há também a **custom tool** `nexus-memory` em `.opencode/tools/nexus-memory.ts` que funciona diretamente via OpenCode. Há sobreposição de funcionalidade entre a custom tool e o MCP server.

## Requisitos Funcionais

### REQ-001: Diagnóstico Completo do MCP Server
**Prioridade:** Alta

Diagnosticar por que o MCP nexus-memory-server não está sendo reconhecido/funcionando pelo OpenCode, considerando:
- Possível necessidade de `notifications/initialized` após `initialize`
- Timeout na inicialização
- Problema de descoberta de ferramentas MCP
- Conflito com a custom tool `nexus-memory`

**Critérios de Aceitação:**
- [ ] Identificar a causa raiz (ou causas) do MCP server não funcionar
- [ ] Verificar logs do OpenCode para erros de MCP
- [ ] Testar comunicação completa: initialize → tools/list → tools/call
- [ ] Documentar todas as descobertas

### REQ-002: Reparo do MCP Server
**Prioridade:** Alta

Corrigir o MCP server para que ele seja corretamente inicializado e utilizado pelo OpenCode.

**Critérios de Aceitação:**
- [ ] MCP server aparece na lista de MCPs disponíveis no OpenCode
- [ ] Ferramentas (nexus_memory_save, load, search, list, delete) são expostas
- [ ] Chamadas de ferramentas via MCP funcionam corretamente
- [ ] Servidor não morre após primeira requisição

### REQ-003: Eliminar Duplicidade Custom Tool vs MCP Server
**Prioridade:** Média

Analisar e resolver a duplicidade entre a custom tool `nexus-memory` (`.opencode/tools/nexus-memory.ts`) e o MCP server. Decidir se ambas devem coexistir ou se uma deve ser removida/depreciada.

**Critérios de Aceitação:**
- [ ] Análise de prós/contras de cada abordagem (custom tool vs MCP)
- [ ] Decisão documentada (manter ambas, remover uma, ou integrar)
- [ ] Se remover: atualizar referências em skills, comandos e agentes
- [ ] Se manter ambas: documentar quando usar cada uma

### REQ-004: Testes de Integração
**Prioridade:** Média

Criar testes para validar que o MCP server funciona corretamente após o reparo.

**Critérios de Aceitação:**
- [ ] Teste de inicialização do servidor (stdio)
- [ ] Teste de ferramenta nexus_memory_save + load
- [ ] Teste de ferramenta nexus_memory_search (FTS5)
- [ ] Teste de ferramenta nexus_memory_list
- [ ] Teste de ferramenta nexus_memory_delete
- [ ] Teste de erro para parâmetros inválidos

## Requisitos Não-Funcionais

### NFR-001: Estabilidade
**Prioridade:** Alta

O MCP server não deve cair após uso prolongado ou após múltiplas chamadas de ferramentas.

**Métrica:** Servidor responde corretamente após 100+ chamadas consecutivas.

### NFR-002: Logging e Observabilidade
**Prioridade:** Média

O servidor deve logar eventos importantes (inicialização, erros, chamadas de ferramentas) para facilitar debugging futuro.

**Métrica:** Logs devem conter timestamp, nível e mensagem descritiva.

## Casos de Teste

### CT-001.1: Inicialização bem-sucedida
**REQ:** REQ-001
**Descrição:** Enviar `initialize` e verificar resposta com protocolVersion e serverInfo
**Passos:**
1. Iniciar servidor via `npx tsx .opencode/mcp/nexus-memory-server.ts`
2. Enviar JSON-RPC `initialize`
3. Verificar resposta contém `protocolVersion: "2024-11-05"` e `serverInfo.name: "nexus-memory-server"`

### CT-001.2: Listagem de ferramentas
**REQ:** REQ-001
**Descrição:** Chamar `tools/list` e verificar 5 ferramentas expostas
**Passos:**
1. Após initialize, enviar `tools/list`
2. Verificar lista contém nexus_memory_save, load, search, list, delete

### CT-002.1: Save e Load via MCP
**REQ:** REQ-002
**Descrição:** Salvar e carregar um valor na memória via MCP
**Passos:**
1. Chamar `tools/call` com `nexus_memory_save` (key="test", value='{"msg":"hello"}')
2. Chamar `tools/call` com `nexus_memory_load` (key="test")
3. Verificar valor retornado corresponde ao salvo

### CT-002.2: Busca FTS5 via MCP
**REQ:** REQ-002
**Descrição:** Buscar texto na memória via FTS5 search
**Passos:**
1. Salvar entrada com valor contendo termo buscável
2. Chamar `nexus_memory_search` com query contendo o termo
3. Verificar entrada é encontrada nos resultados

### CT-002.3: Erro em parâmetros inválidos
**REQ:** REQ-002
**Descrição:** Chamar save sem key obrigatória e verificar erro
**Passos:**
1. Chamar `nexus_memory_save` sem parâmetro `key`
2. Verificar resposta contém `error.code` e mensagem descritiva

### CT-003.1: Duplicidade documentada
**REQ:** REQ-003
**Descrição:** Verificar que a decisão sobre duplicidade custom tool vs MCP foi documentada
**Passos:**
1. Executar análise de prós/contras
2. Verificar decisão documentada em ADR ou na spec
3. Se opção for "remover uma", verificar referências atualizadas

### CT-003.2: Sem quebra de referências após decisão
**REQ:** REQ-003
**Descrição:** Se a opção for remover uma das implementações, verificar que não há referências quebradas
**Passos:**
1. Identificar qual implementação será removida
2. Buscar referências ao nome da tool em skills, comandos e agentes
3. Verificar todas foram atualizadas ou removidas

### CT-004.1: Resiliência a múltiplas chamadas
**REQ:** REQ-004, NFR-001
**Descrição:** Realizar 100 chamadas consecutivas sem falha (usando keys diferentes para evitar colisão)
**Passos:**
1. Loop de 100 iterações com keys únicas: `save("key-{i}")` + `load("key-{i}")` + `search` + `list`
2. Ao final, loop de cleanup: `delete("key-{i}")` para cada key
3. Verificar todas as respostas são bem-sucedidas
4. Verificar servidor ainda responde após o loop

### CT-NFR-002.1: Logging de inicialização
**REQ:** NFR-002
**Descrição:** Verificar que o servidor loga eventos de inicialização
**Passos:**
1. Iniciar servidor capturando stderr
2. Verificar mensagem de log contém "running" ou "started"
3. Chamar uma ferramenta e verificar log de execução

## Arquivos Afetados

- `.opencode/mcp/nexus-memory-server.ts` — Servidor MCP (modificar)
- `.opencode/tools/nexus-memory.ts` — Custom tool (analisar, possivelmente modificar)
- `.opencode/tools/sqlite-adapter.ts` — Adapter SQLite (se necessidade de correção)
- `.opencode/package.json` — Dependências (se necessário)
- `opencode.json` — Configuração MCP (se necessário)
- `docs/spec/fix-nexus-memory-mcp.spec.md` — Esta spec
