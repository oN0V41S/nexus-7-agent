---
title: "Job Apply Agent — MCP Server"
status: "approved"
author: "Nexus Orquestrador"
created: "2026-06-19"
updated: "2026-06-19"
version: "0.1.0"
---

# Job Apply Agent — MCP Server

## 1. Visão Geral

**Problema:** O Job Application Workflow atualmente é executado via CLI Python (`python -m src.job_apply_agent`), exigindo setup manual de PYTHONPATH, passagem de argumentos em linha de comando e context switching entre o agente e o terminal. Cada operação leva ~2-3min de overhead operacional.

**Solução:** Criar um MCP Server em TypeScript que exponha todas as 7 operações como tools MCP nativas, invocando os scripts Python existentes via subprocesso. Zero alterações no código-fonte Python.

**ROI Estimado:**

| Item | Valor |
|------|-------|
| **Investimento** (construção do MCP server) | ~8-10h |
| **Economia por operação** | ~2min (CLI manual → MCP tool nativo) |
| **Operações por ciclo de candidatura** | ~20 (search + analyze + kb + adapt + apply + track + dedup) |
| **Economia por ciclo** | ~40min |
| **Break-even** | Após ~15 ciclos de candidatura |
| **Valor estratégico** | Integração com outros agentes, pipelines automatizados, sem overhead de contexto |

**Usuário alvo:** O próprio ecossistema Nexus (agentes OpenCode que executam o pipeline de candidatura).

**Contexto:** O projeto já possui um MCP Server de referência (`nexus-memory-server.ts` em `.opencode/mcp/`) que segue o protocolo stdio JSON-RPC. O novo servidor seguirá o mesmo padrão arquitetural.

**Arquitetura:**

```
.opencode/mcp/job-apply-mcp.ts
  │
  ├── Tools MCP (stdio JSON-RPC)
  │   ├── job_search        → subprocess python3 -m src.job_apply_agent search
  │   ├── job_analyze       → subprocess python3 -m src.job_apply_agent analyze
  │   ├── job_consolidate   → subprocess python3 -m src.job_apply_agent consolidate
  │   ├── job_kb            → subprocess python3 -m src.job_apply_agent kb
  │   ├── job_adapt         → subprocess python3 -m src.job_apply_agent adapt
  │   ├── job_apply         → subprocess python3 -m src.job_apply_agent apply
  │   ├── job_track         → subprocess python3 -m src.job_apply_agent track
  │   └── job_check_duplicate → subprocess python3 -m src.job_apply_agent (lógica de dedup)
  │
  └── Python Subprocess Wrapper
        └── src/job_apply_agent/ (código existente, zero alterações)
```

---

## 2. Requisitos Funcionais

### REQ-001: Servidor MCP Job Apply

**Descrição:** Criar servidor MCP em TypeScript no caminho `.opencode/mcp/job-apply-mcp.ts` seguindo o protocolo stdio JSON-RPC, expondo todas as ferramentas do Job Application Workflow como tools MCP.

**Prioridade:** Alta

**Critérios de Aceitação:**
- [ ] Servidor segue o mesmo padrão do `nexus-memory-server.ts` (stdio JSON-RPC)
- [ ] Responde corretamente a `initialize`, `tools/list` e `tools/call`
- [ ] Registrado no `opencode.json` como servidor MCP
- [ ] Trata erros de subprocesso Python com mensagens descritivas

**Casos de Teste:**
- `CT-001.1`: Servidor inicia e responde `initialize` corretamente
- `CT-001.2`: `tools/list` retorna lista com 7-8 ferramentas
- `CT-001.3`: Servidor retorna erro formatado quando Python não encontrado
- `CT-001.4`: Timeout do subprocesso Python tratado com mensagem de erro

---

### REQ-002: MCP Tool — job_search

**Descrição:** Expor a operação de busca de vagas como MCP tool. Aceita `query`, `location` e `filters`. Invoca `search_all_platforms()` via subprocesso Python.

**Prioridade:** Alta

**Critérios de Aceitação:**
- [ ] Tool aceita parâmetros: `query` (string), `location` (string), `filters` (string, optional)
- [ ] Invoca `python3 -m src.job_apply_agent search <query> <location> [filters]`
- [ ] Retorna resultados estruturados como JSON
- [ ] Erros do Python são capturados e retornados como MCP error

**Casos de Teste:**
- `CT-002.1`: job_search com query e location retorna lista de vagas
- `CT-002.2`: job_search sem argumentos retorna mensagem de erro descritiva
- `CT-002.3`: job_search com Python offline retorna erro MCP formatado

---

### REQ-003: MCP Tool — job_analyze

**Descrição:** Expor análise de compatibilidade como MCP tool. Aceita `job_id` opcional. Invoca `cmd_analyze()` via subprocesso Python.

**Prioridade:** Alta

**Critérios de Aceitação:**
- [ ] Tool aceita parâmetro opcional: `job_id` (string)
- [ ] Invoca `python3 -m src.job_apply_agent analyze [job_id]`
- [ ] Retorna análise com score, gaps, strengths como JSON
- [ ] Valida dependências (profile.json e search_results.json)

**Casos de Teste:**
- `CT-003.1`: job_analyze sem argumentos analisa todas as vagas
- `CT-003.2`: job_analyze com job_id específico analisa apenas uma vaga
- `CT-003.3`: job_analyze sem profile.json retorna erro descritivo

---

### REQ-004: MCP Tool — job_consolidate

**Descrição:** Expor consolidação de PDFs em DOCX/KB como MCP tool. Aceita lista de paths de PDF.

**Prioridade:** Alta

**Critérios de Aceitação:**
- [ ] Tool aceita `pdf_paths` (array de strings) e `output_dir` (string, optional)
- [ ] Invoca `python3 -m src.job_apply_agent consolidate <paths>`
- [ ] Retorna paths dos artefatos gerados (docx_path, pdf_path, kb_path)
- [ ] Valida que arquivos existem antes de processar

**Casos de Teste:**
- `CT-004.1`: job_consolidate com PDFs válidos retorna paths de saída
- `CT-004.2`: job_consolidate sem PDFs retorna erro
- `CT-004.3`: job_consolidate com PDF inexistente retorna erro

---

### REQ-005: MCP Tool — job_kb

**Descrição:** Expor geração de Knowledge Base como MCP tool. Aceita paths de PDF/DOCX e flags opcionais.

**Prioridade:** Alta

**Critérios de Aceitação:**
- [ ] Tool aceita `file_paths` (array de strings), `--json` e `--docx` como flags
- [ ] Invoca `python3 -m src.job_apply_agent kb <paths> [--json] [--docx]`
- [ ] Retorna path da KB gerada
- [ ] Trata entradas DOCX e PDF corretamente

**Casos de Teste:**
- `CT-005.1`: job_kb com PDF gera KB.md
- `CT-005.2`: job_kb com DOCX gera KB.md
- `CT-005.3`: job_kb com --json também salva profile.json

---

### REQ-006: MCP Tool — job_adapt

**Descrição:** Expor geração de currículo adaptado como MCP tool. Aceita `job_id`.

**Prioridade:** Média

**Critérios de Aceitação:**
- [ ] Tool aceita `job_id` (string)
- [ ] Invoca `python3 -m src.job_apply_agent adapt <job_id>`
- [ ] Retorna paths do currículo adaptado (MD + DOCX) e carta (TXT)
- [ ] Valida dependências (profile.json e analyzed_results.json)

**Casos de Teste:**
- `CT-006.1`: job_adapt com job_id válido gera currículo + carta
- `CT-006.2`: job_adapt sem profile.json retorna erro descritivo
- `CT-006.3`: job_adapt com job_id inexistente retorna erro

---

### REQ-007: MCP Tool — job_apply

**Descrição:** Expor aplicação semiautomática como MCP tool. Aceita `job_id` ou `--batch <threshold>`.

**Prioridade:** Média

**Critérios de Aceitação:**
- [ ] Tool aceita `job_id` (string) ou `batch` (object com `threshold: number`)
- [ ] Invoca `python3 -m src.job_apply_agent apply <job_id | --batch N>`
- [ ] Retorna resultado da aplicação (sucesso/falha)
- [ ] Integra aprovação humana antes da submissão

**Casos de Teste:**
- `CT-007.1`: job_apply com job_id aplica para vaga específica
- `CT-007.2`: job_apply --batch 80 aplica para vagas com score >= 80
- `CT-007.3`: job_apply detecta duplicatas antes de aplicar

---

### REQ-008: MCP Tool — job_track

**Descrição:** Expor rastreamento de candidaturas como MCP tool. Suporta `list`, `export` (csv/json) e `update <job_id> <status>`.

**Prioridade:** Média

**Critérios de Aceitação:**
- [ ] Tool aceita `action` (string: "list" | "export" | "update")
- [ ] `list` retorna lista formatada de candidaturas
- [ ] `export` com `format` (csv | json) salva arquivo
- [ ] `update` com `job_id` + `status` altera status

**Casos de Teste:**
- `CT-008.1`: job_track list retorna candidaturas
- `CT-008.2`: job_track export csv gera CSV
- `CT-008.3`: job_track update altera status
- `CT-008.4`: job_track update com status inválido retorna erro

---

### REQ-009: MCP Tool — job_check_duplicate

**Descrição:** Expor verificação de duplicidade como MCP tool. Aceita `company` e `title`. Útil para agentes verificarem antes de aplicar.

**Prioridade:** Baixa

**Critérios de Aceitação:**
- [ ] Tool aceita `company` (string) e `title` (string)
- [ ] Invoca `check_duplicate()` do Python
- [ ] Retorna `{ "duplicate": true/false }`
- [ ] Matching case-insensitive com variações de nome

**Casos de Teste:**
- `CT-009.1`: job_check_duplicate detecta duplicata exata
- `CT-009.2`: job_check_duplicate não dispara falso positivo
- `CT-009.3`: job_check_duplicate com variações de nome de empresa

---

## 3. Requisitos Não-Funcionais

### NFR-001: Performance

**Descrição:** O MCP server deve responder a `tools/list` em <100ms. Tools que invocam subprocesso Python têm latência natural do Python (~1-30s dependendo da operação).

**Métrica:** Latência de resposta para `initialize` e `tools/list` < 100ms.

**Prioridade:** Alta

### NFR-002: Compatibilidade com Python Existente

**Descrição:** Zero alterações no código Python existente. O MCP server é puramente um wrapper de subprocesso.

**Métrica:** Nenhum arquivo em `src/job_apply_agent/` deve ser modificado.

**Prioridade:** Alta

### NFR-003: Tratamento de Erros

**Descrição:** Todo erro de subprocesso Python (código de saída != 0, timeout, exceção) deve ser capturado e retornado como MCP error com mensagem descritiva.

**Métrica:** 100% dos cenários de erro identificados nos CTs retornam MCP error.

**Prioridade:** Alta

### NFR-004: Testabilidade

**Descrição:** O MCP server deve ser testável isoladamente (mock do subprocesso Python para testes unitários).

**Métrica:** Cobertura de testes > 80% no MCP server.

**Prioridade:** Média

### NFR-005: Segurança

**Descrição:** O MCP server não deve expor paths internos do sistema. Argumentos das tools devem ser sanitizados antes de passar ao subprocesso.

**Métrica:** Nenhum path absoluto do servidor vaza nas respostas. Sanitização de argumentos para prevenir shell injection.

**Prioridade:** Alta

---

## 4. Dependências

### Internas
- `src/job_apply_agent/` — código Python existente (não modificar)
- `.opencode/mcp/nexus-memory-server.ts` — padrão de referência para MCP Server
- `opencode.json` — registro do novo MCP server
- TypeScript + Node.js (runtime do servidor)

### Externas
- MCP SDK (Model Context Protocol) — ou implementação manual via stdio
- Python 3.12+ com dependências instaladas (PyMuPDF, python-docx, httpx, fpdf2)

---

## 5. Questões em Aberto

- [ ] Usar MCP SDK oficial (`@modelcontextprotocol/sdk`) ou implementação manual como o `nexus-memory-server.ts`?
- [ ] Como lidar com a entrada interativa do `job_apply` (aprovação humana)? A tool precisa de um mecanismo de confirmação.
- [ ] O `job_kb` aceita múltiplos PDFs ou um por vez? (Decisão: aceitar array)

---

## 6. Plano de Implementação Sugerido

| Fase | Tarefa | Esforço | Depende |
|------|--------|---------|---------|
| 1 | Scaffold do MCP server (base + initialize + tools/list) | 2h | — |
| 2 | Subprocess Python wrapper + tratamento de erros | 1h | Fase 1 |
| 3 | Tools de busca e análise (REQ-002, REQ-003) | 1.5h | Fase 2 |
| 4 | Tools de consolidação e KB (REQ-004, REQ-005) | 1.5h | Fase 2 |
| 5 | Tools de geração e aplicação (REQ-006, REQ-007) | 1.5h | Fase 2 |
| 6 | Tools de tracking e dedup (REQ-008, REQ-009) | 1h | Fase 2 |
| 7 | Testes unitários do MCP server | 2h | Fases 3-6 |
| 8 | Configuração opencode.json + registro | 0.5h | Fase 1 |
| 9 | Teste integrado + documentação final | 1h | Fases 7-8 |

**Total estimado: 10h**

---

## Histórico de Revisões

| Versão | Data | Autor | Mudanças |
|--------|------|-------|----------|
| 0.1.0 | 2026-06-19 | Nexus Orquestrador | Criação inicial |
