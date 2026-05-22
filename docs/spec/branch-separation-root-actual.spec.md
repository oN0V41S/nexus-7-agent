---
title: "Branch Separation: Root vs Actual"
status: "draft"
author: "Nexus Orquestrador"
created: "2026-05-20"
updated: "2026-05-20"
version: "0.1.0"
---

# Branch Separation: Root vs Actual — Spec

## 1. Visão Geral

**Problema:** O repositório `nexus-7-agent` contém tanto o harness core de orquestração quanto integrações externas (CBM, Notion, Google Workspace, Job Apply, TestSprite, Playwright, Chrome DevTools). Não há uma separação clara entre o "núcleo" reutilizável do harness e as integrações opcionais, o que dificulta usar o harness como template para novos projetos.

**Usuário alvo:** Desenvolvedores que querem iniciar novos projetos usando apenas o harness core do Nexus, sem as integrações específicas.

**Contexto:** O repositório atual tem tudo em `main`. A separação criará duas branches:

- **`root`** — Orphan branch com apenas o harness core (limpa, sem histórico de integrações)
- **`actual`** — Branch com tudo (full build, todas as integrações)

---

## 2. Requisitos Funcionais

### REQ-001: Criar branch orphan `root` com arquivos core do harness

**Descrição:** Criar uma branch `root` sem histórico (`--orphan`) contendo apenas os arquivos do harness core. A branch deve começar com um commit inicial limpo.

**Prioridade:** Alta

**Critérios de Aceitação:**
- [ ] Branch `root` existe no repositório local
- [ ] Branch `root` não tem nenhum commit em comum com `main`/`actual`
- [ ] Branch `root` contém apenas arquivos classificados como "Root": agents core (`orchestrator`, `security-secret-auditor`, `quality-assurance-analyst`, `docs-architect`, `spec-reviewer`), skills core (`harness-workflow`, `spec-driven-dev`, `project-review`, `quality-assurance-analyst`, `documentation-architect`, `commit-push`, `mem-search`, `agent-creator`, `auto-discovery`, `prisma-scaffold`, `react-components`), tools (todos: `nexus-log`, `nexus-memory`, `nexus-handoff`, `spec-validator`, `sqlite-adapter`), `nexus-plugin.ts`, `nexus-memory-server.ts`, `dashboard/server.ts`, comandos core, `AGENTS.md`, `opencode.json`, `.gitignore`, `.env.examle`, `LICENSE`, `README.md`, docs core (`docs/spec/TEMPLATE.spec.md`, `docs/spec/spec-schema.json`, `docs/spec/example.spec.md`, `docs/spec/harness-completo.spec.md`)

**Casos de Teste:**
- `CT-001.1`: `git branch --list root` retorna `root`
- `CT-001.2`: `git log root --oneline` mostra apenas 1 commit
- `CT-001.3`: `git diff main...root --stat` mostra diferenças significativas (root tem menos arquivos)

---

### REQ-002: Remover arquivos de integração da branch `root`

**Descrição:** Garantir que nenhum arquivo de integração esteja presente na branch `root`. Integrações incluem: CBM agent/skill, Notion agent/skill, Google Workspace agent/skill/MCP, Job Apply agent/skill/src, TestSprite agent/skill, Playwright MCP, Chrome DevTools MCP.

**Prioridade:** Alta

**Critérios de Aceitação:**
- [ ] `.opencode/agents/cbm-agent.md` NÃO existe em `root`
- [ ] `.opencode/agents/notion-agent.md` NÃO existe em `root`
- [ ] `.opencode/agents/job-apply-agent.md` NÃO existe em `root`
- [ ] `.opencode/agents/google-workspace-agent.md` NÃO existe em `root`
- [ ] `.opencode/agents/testsprite-mcp-agent.md` NÃO existe em `root`
- [ ] `.opencode/skills/cbm-agent/` NÃO existe em `root`
- [ ] `.opencode/skills/notion-agent-copilot/` NÃO existe em `root`
- [ ] `.opencode/skills/job-apply-agent/` NÃO existe em `root`
- [ ] `.opencode/skills/google-workspace/` NÃO existe em `root`
- [ ] `.opencode/skills/testsprite-mcp/` NÃO existe em `root`
- [ ] `.opencode/mcp/google-workspace/` NÃO existe em `root`
- [ ] `src/` NÃO existe em `root`
- [ ] `run_job_agent.py` NÃO existe em `root`
- [ ] `.playwright-mcp/` NÃO existe em `root`
- [ ] `.github/` NÃO existe em `root`
- [ ] Comandos de integração (`cbm-query.md`, `gw.md`) NÃO existem em `root`
- [ ] Specs de integração (`cbm-integration.spec.md`, `integracao-google-workspace.spec.md`, `job-application-workflow.spec.md`, `integracao-openpets-opencode.spec.md`) NÃO existem em `root`
- [ ] Plans de integração (`docs/superpowers/plans/2026-05-14-job-application-workflow.md`) NÃO existem em `root`

**Casos de Teste:**
- `CT-002.1`: `ls .opencode/agents/` em `root` lista apenas 5 agentes (orchestrator, security-secret-auditor, quality-assurance-analyst, docs-architect, spec-reviewer)
- `CT-002.2`: `ls .opencode/skills/` em `root` lista apenas 11 skills core
- `CT-002.3`: `ls src/` em `root` retorna "No such file or directory"

---

### REQ-003: Ajustar `opencode.json` para a branch `root`

**Descrição:** O `opencode.json` na branch `root` deve ser uma versão slim contendo apenas agentes core, comandos core e sem MCPs de integração.

**Prioridade:** Alta

**Critérios de Aceitação:**
- [ ] Remover agentes: `cbm-agent`, `notion-agent`, `job-apply-agent`, `testsprite-mcp-agent` do `agent` section
- [ ] Remover comandos: `cbm-query`, `gw`, `job-search`, `job-analyze`, `job-consolidate`, `job-adapt`, `job-apply`, `job-track` do `command` section
- [ ] Remover MCPs: `notion`, `playwright`, `codebase-memory-mcp`, `chrome-devtools` do `mcp` section
- [ ] Manter `orchestrator`, `security-secret-auditor`, `quality-assurance-analyst`, `docs-architect` no `agent` section
- [ ] Manter comandos core: `plan`, `security`, `qa`, `docs`, `memory`, `criar-agente` no `command` section

**Casos de Teste:**
- `CT-003.1`: `jq '.agent | keys' opencode.json` em `root` retorna apenas 4 agentes
- `CT-003.2`: `jq '.command | keys' opencode.json` em `root` retorna apenas 6 comandos
- `CT-003.3`: `jq '.mcp' opencode.json` em `root` retorna objeto vazio ou inexistente

---

### REQ-004: Ajustar `AGENTS.md` para a branch `root`

**Descrição:** O `AGENTS.md` na branch `root` deve conter apenas referências aos agentes, skills e comandos presentes no root. Sem menções a integrações.

**Prioridade:** Média

**Critérios de Aceitação:**
- [ ] Tabela de agentes contém apenas agentes core
- [ ] Tabela de skills contém apenas skills core
- [ ] Tabela de comandos contém apenas comandos core
- [ ] Sem menções a CBM, Notion, Job Apply, Google Workspace, TestSprite

**Casos de Teste:**
- `CT-004.1`: Grep por "cbm-agent" em `AGENTS.md` em `root` retorna vazio
- `CT-004.2`: Grep por "job-apply" em `AGENTS.md` em `root` retorna vazio
- `CT-004.3`: Grep por "notion" em `AGENTS.md` em `root` retorna vazio

---

### REQ-005: Renomear `main` para `actual` (opcional)

**Descrição:** Renomear a branch `main` para `actual` para refletir que ela contém a build completa com todas as integrações. A branch `actual` mantém todo o histórico de commits.

**Prioridade:** Média

**Critérios de Aceitação:**
- [ ] Branch `actual` existe e contém todo o histórico de `main`
- [ ] Branch `main` pode ser recriada como alias ou removida
- [ ] Branch `actual` tem os mesmos arquivos que `main` tinha

**Casos de Teste:**
- `CT-005.1`: `git branch --list actual` retorna `actual`
- `CT-005.2`: `git log actual --oneline | wc -l` é igual ao número de commits que `main` tinha

---

### REQ-006: Ajustar `.env.examle` para a branch `root`

**Descrição:** O `.env.examle` na branch `root` deve conter apenas variáveis de ambiente core (OPENCODE_API_KEY, GEMINI_API_KEY), sem NOTION_TOKEN.

**Prioridade:** Baixa

**Critérios de Aceitação:**
- [ ] `NOTION_TOKEN` NÃO está presente em `.env.examle` no root
- [ ] `OPENCODE_API_KEY` está presente em `.env.examle` no root
- [ ] `GEMINI_API_KEY` está presente em `.env.examle` no root

**Casos de Teste:**
- `CT-006.1`: Grep por "NOTION_TOKEN" em `.env.examle` no root retorna vazio
- `CT-006.2`: Grep por "OPENCODE_API_KEY" em `.env.examle` no root retorna linha

---

## 3. Requisitos Não-Funcionais

### NFR-001: Integridade do histórico

**Descrição:** A branch `main`/`actual` não deve perder nenhum commit existente. A branch `root` deve ser criada sem reescrever ou destruir o histórico existente.

**Métrica:** `git log --oneline main | wc -l` antes e depois da operação deve ser o mesmo número.

**Prioridade:** Alta

### NFR-002: Operação destrutiva zero

**Descrição:** Nenhum dado deve ser perdido. Todas as operações devem ser não-destrutivas para o repositório existente. A branch `actual` é uma preservação completa do estado atual.

**Métrica:** Nenhum commit em `main`/`actual` é reescrito ou perdido.

**Prioridade:** Alta

---

## 4. Dependências

- Git instalado e configurado
- Acesso de escrita ao repositório local
- Permissão de push para origin (se for fazer push)

---

## 5. Questões em Aberto

- Push para origin: fazer push das duas branches ou apenas local por enquanto?

---

## Histórico de Revisões

| Versão | Data | Autor | Mudanças |
|--------|------|-------|----------|
| 0.1.0 | 2026-05-20 | Nexus Orquestrador | Criação inicial |

