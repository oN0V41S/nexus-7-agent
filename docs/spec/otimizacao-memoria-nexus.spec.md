---
title: "Otimização do Sistema de Memória e Observações do Nexus"
status: "approved"
author: "Orquestrador Nexus"
created: "2026-05-21"
updated: "2026-05-21"
version: "1.0.0"
---

# Otimização do Sistema de Memória e Observações do Nexus — Spec

## 1. Visão Geral

**Problema:** O plugin Nexus gera automaticamente 838 arquivos `observations--*.json` (3.3 MB) em `.opencode/memory/` a cada execução de tool (write, edit, bash, task, skill). Essas observações são metadados de baixo valor informacional, nunca consultadas pelo Harness, e acumulam-se infinitamente sem política de retenção. Além disso, o SQLite de memória carece de índices básicos e o dashboard não reflete o estado real dos dados.

**Usuário alvo:** Desenvolvedores mantendo o ecossistema Nexus e operadores do pipeline Harness.

**Contexto:** O ecossistema Nexus 7 Agent possui 3 sistemas de armazenamento — nexus-log (logs estruturados), nexus-memory (SQLite com FTS5 para contexto explícito), e observações automáticas do plugin (JSON). As observações duplicam informações já capturadas pelos logs, sem valor adicional para o pipeline.

---

## 2. Requisitos Funcionais

### REQ-001: Remover observações obsoletas

**Descrição:** Deletar todos os arquivos `observations--*.json` acumulados em `.opencode/memory/`, mantendo apenas handoffs e a base SQLite intactos.
**Prioridade:** Alta
**Critérios de Aceitação:**
- [ ] Nenhum arquivo `observations--*.json` existe em `.opencode/memory/`
- [ ] Arquivos de handoff (`.opencode/memory/handoffs/`) são preservados
- [ ] Banco SQLite (`.opencode/memory/nexus-memory.db`) é preservado
**Casos de Teste:**
- `CT-001.1`: Verificar que 0 arquivos `observations--*.json` restam após limpeza
- `CT-001.2`: Verificar que handoffs ainda estão acessíveis
- `CT-001.3`: Verificar que SQLite ainda tem as 7 entradas originais

---

### REQ-002: Corrigir plugin para parar de gerar observations em JSON

**Descrição:** Modificar `nexus-plugin.ts` para não gerar mais arquivos `observations--*.json` automaticamente. Alternativa: registrar observações apenas em modo debug (variável de ambiente `NEXUS_DEBUG=true`), ou via nexus-log em vez de JSON.
**Prioridade:** Alta
**Critérios de Aceitação:
- [ ] Plugin não cria novos arquivos `observations--*.json` após a correção
- [ ] Observações são redirecionadas para `nexus-log` com categoria "observations"
- [ ] Funcionalidade existente do plugin não é afetada (hooks continuam funcionando)
- [ ] Logs incluem: tool name, title, outputSize, sessionID, timestamp
**Casos de Teste:**
- `CT-002.1`: Executar write/edit/bash e verificar que nenhum novo observations--*.json é criado
- `CT-002.2`: Verificar que plugin hooks (tool.execute.after) disparam sem erro
- `CT-002.3`: (Se aplicável) Ativar NEXUS_DEBUG=true e verificar logs de diagnóstico

---

### REQ-003: Adicionar índices no SQLite memory

**Descrição:** Adicionar índices no banco SQLite para queries comuns: `savedAt`, `scope`, `agent`, `sessionID`. Isso melhora performance das consultas do dashboard e do mem-search.
**Prioridade:** Média
**Critérios de Aceitação:**
- [ ] Índice em `(scope, savedAt DESC)` criado
- [ ] Índice em `(agent)` criado
- [ ] Índice em `(sessionID)` criado
- [ ] Schema existente preservado (tabelas, FTS5, triggers)
**Casos de Teste:**
- `CT-003.1`: Verificar índices com `.indices` no SQLite
- `CT-003.2`: Query com filtro por scope executa sem full table scan (EXPLAIN QUERY PLAN)

---

### REQ-004: Atualizar dashboard para exibir dados corretos

**Descrição:** Atualizar `server.ts` para refletir o estado real dos dados após limpeza, incluindo a remoção do contador de observations da UI se aplicável, e garantir que a seção de memórias mostre contexto útil.
**Prioridade:** Baixa
**Critérios de Aceitação:**
- [ ] Dashboard mostra contagem correta de entradas no SQLite
- [ ] Dashboard não referencia mais observations--*.json
- [ ] Seção de handoffs continua funcional
**Casos de Teste:**
- `CT-004.1`: Acessar dashboard e verificar que estatísticas estão consistentes

---

## 3. Requisitos Não-Funcionais

### NFR-001: Zero impacto nas tools existentes

**Descrição:** A limpeza e correção não devem quebrar as tools `nexus-log`, `nexus-memory` e `nexus-handoff` nem o plugin Nexus.
**Métrica:** `nexus-log`, `nexus-memory` e `nexus-handoff` funcionam normalmente após as mudanças.
**Prioridade:** Alta

### NFR-002: Sem perda de dados úteis

**Descrição:** Nenhum dado com valor para o Harness (memórias no SQLite, handoffs) deve ser perdido durante a limpeza.
**Métrica:** `nexus-memory({action:"list"})` e `nexus-handoff({action:"list"})` retornam os mesmos resultados antes e depois.
**Prioridade:** Alta

---

## 4. Dependências

- `nexus-plugin.ts` — arquivo a ser modificado (`.opencode/plugins/nexus-plugin.ts`)
- `nexus-memory.ts` — tool de memória (`.opencode/tools/nexus-memory.ts`)
- `server.ts` — dashboard (`.opencode/dashboard/server.ts`)
- `nexus-memory.db` — banco SQLite existente (`.opencode/memory/nexus-memory.db`)

## 5. Decisões

- Observações redirecionadas para `nexus-log` com categoria "observations" — mantém rastreabilidade sem poluir JSON
- Limpeza única dos 838 arquivos existentes — sem comando permanente

---

## Histórico de Revisões

| Versão | Data | Autor | Mudanças |
|--------|------|-------|----------|
| 1.0.0 | 2026-05-21 | Orquestrador Nexus | Criação inicial |

