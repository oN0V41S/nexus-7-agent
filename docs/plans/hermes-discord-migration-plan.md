# Plano de Implementação: Migração Nexus → Hermes Agent + Discord

> **Spec:** `docs/spec/hermes-discord-migration.spec.md`
> **Data:** 2026-06-19
> **Status:** PLANEJADO
> **Estimativa Total:** 40-56 horas (6-8 dias de trabalho)

---

## Visão Geral do Plano

Migração completa do ecossistema Nexus 7 Agent (OpenCode) para Hermes Agent com Discord como plataforma de messaging. A migração é dividida em 6 fases com dependências sequenciais e paralelização intra-fase.

### Dependências Entre Fases

```
Phase 1 (Preparation) ──→ Phase 2 (Core Migration) ──→ Phase 3 (Agent Migration)
                                    │                           │
                                    └───────────────────────────┘
                                            │
                                    Phase 4 (Commands & Integration)
                                            │
                                    Phase 5 (Validation)
                                            │
                                    Phase 6 (Rollback Preparation)
```

---

## Fase 1: Preparation (REQ-005, REQ-008)

**Objetivo:** Preparar ambiente Hermes, Discord bot e estratégia de migração de dados.
**Esforço estimado:** 8-10 horas
**Dependências:** Nenhuma (fase inicial)

### 1.1 Configurar Ambiente Hermes Agent

| Tarefa | Detalhes | Sub-Agent | Estimativa |
|--------|----------|-----------|------------|
| Instalar Hermes Agent | `pip install hermes-agent` ou clone do repositório NousResearch | @fixer | 1h |
| Configurar `config.yaml` | Modelos (OpenRouter/Ollama), memória (FTS5), logging | @fixer | 2h |
| Validar instalação | Rodar `hermes --version` e `hermes status` | @quality-assurance-analyst | 0.5h |

**Arquivos Afetados:**
- `~/.hermes/config.yaml` (novo)
- `~/.hermes/models.yaml` (novo, se aplicável)

### 1.2 Criar e Configurar Bot Discord

| Tarefa | Detalhes | Sub-Agent | Estimativa |
|--------|----------|-----------|------------|
| Criar bot no Discord Developer Portal | App novo, bot user, gerar token | Direto (browser) | 0.5h |
| Configurar bot no Hermes | Adicionar token em `config.yaml`, habilitar Discord gateway | @fixer | 1h |
| Habilitar Message Content Intent | No Developer Portal > Bot > Privileged Gateway Intents | Direto | 0.5h |
| Configurar permissões do bot | Canais permitidos, DMs, threads, slash commands | @fixer | 1h |
| Testar conexão básica | Bot online, responde a ping | @quality-assurance-analyst | 0.5h |

**Arquivos Afetados:**
- `~/.hermes/config.yaml` (seção Discord)
- `.env` (variável `DISCORD_BOT_TOKEN`)

**Critérios de Saída (Exit Criteria):**
- [ ] Hermes Agent instalado e respondendo comandos CLI
- [ ] Bot Discord online no servidor de teste
- [ ] Bot responde a mensagem simples de teste
- [ ] Slash commands estão registrados no Discord

### 1.3 Estratégia de Migração de Dados

| Tarefa | Detalhes | Sub-Agent | Estimativa |
|--------|----------|-----------|------------|
| Mapear dados existentes | Listar: SQLite DB, JSON handoffs, logs, MCP data | @explorer | 1h |
| Criar script de backup | Backup completo antes da migração | @fixer | 1h |
| Testar importação de dados | Validar que dados migram corretamente | @quality-assurance-analyst | 1h |

**Arquivos Afetados:**
- `scripts/backup-nexus-data.sh` (novo)
- `scripts/migrate-data.sh` (novo)
- `.opencode/memory/nexus-memory.db` (backup)
- `.opencode/memory/handoffs/*.json` (backup)

---

## Fase 2: Core Migration (REQ-001, REQ-002, REQ-006)

**Objetivo:** Migrar skills, MCPs e custom tools para formato Hermes.
**Esforço estimado:** 12-16 horas
**Dependências:** Fase 1 concluída

### 2.1 Migração de Skills (REQ-001)

| Skill Nexus | Ação | Complexidade | Sub-Agent | Estimativa |
|-------------|------|--------------|-----------|------------|
| `harness-workflow` | Reescrever como Hermes skill (agentskills.io format) | Alta | @docs-architect + @fixer | 4h |
| `mem-search` | Substituir pelo Hermes memory built-in (FTS5) | Baixa | @fixer | 1h |
| `agent-creator` | Adaptar para Hermes skill creation API | Média | @fixer | 2h |
| `cbm-agent` | Converter para Hermes tool + MCP config | Alta | @cbm-agent + @fixer | 3h |
| `project-review` | Reescrever como Hermes skill customizada | Média | @fixer | 2h |

**Arquivos Afetados (Nexus → Hermes):**

| Nexus (origem) | Hermes (destino) | Ação |
|-----------------|-------------------|------|
| `.opencode/skills/harness-workflow/SKILL.md` | `~/.hermes/skills/harness-workflow/SKILL.md` | Reescrever |
| `.opencode/skills/mem-search/SKILL.md` | N/A (built-in) | Mapear para Hermes memory |
| `.opencode/skills/agent-creator/SKILL.md` | `~/.hermes/skills/agent-creator/SKILL.md` | Adaptar |
| `.opencode/skills/cbm-agent/SKILL.md` | `~/.hermes/skills/cbm-agent/SKILL.md` | Reescrever |
| `.opencode/skills/project-review/SKILL.md` | `~/.hermes/skills/project-review/SKILL.md` | Reescrever |

**Critérios de Validação:**
- [ ] CT-001.1: 5 skills convertidas para formato Hermes
- [ ] CT-001.2: Cada skill mantém funcionalidade core
- [ ] CT-001.3: `hermes skills list` reconhece todas
- [ ] CT-001.4: Skills invocáveis via slash commands no Discord

### 2.2 Migração de MCPs (REQ-002)

| MCP Nexus | Equivalente Hermes | Ação | Sub-Agent | Estimativa |
|-----------|-------------------|------|-----------|------------|
| `nexus-memory-server` | Hermes memory (FTS5 built-in) | Substituir | @fixer | 1h |
| `job-apply-mcp` | Hermes tool customizada | Adaptar código | @fixer | 3h |
| `google-workspace` | Hermes config.yaml MCP section | Configurar | @fixer | 2h |

**Arquivos Afetados:**

| Nexus (origem) | Hermes (destino) | Ação |
|-----------------|-------------------|------|
| `.opencode/mcp/nexus-memory-server.ts` | N/A (built-in) | Desativar, mapear APIs |
| `.opencode/mcp/google-workspace/server.mjs` | `~/.hermes/config.yaml` (seção MCP) | Mover config |
| `job-apply-mcp/` (diretório) | `~/.hermes/tools/job-apply/` | Adaptar como Hermes tool |

**Detalhes de Migração por MCP:**

#### nexus-memory-server → Hermes Memory
```
Nexus API                          → Hermes Equivalente
─────────────────────────────────────────────────────
nexus_memory_save(key, value)      → hermes.memory.save(key, value)
nexus_memory_load(key)             → hermes.memory.load(key)
nexus_memory_search(query)         → hermes.memory.search(query)
nexus_memory_list(limit)           → hermes.memory.list(limit)
nexus_memory_delete(key)           → hermes.memory.delete(key)
```

#### job-apply-mcp → Hermes Tool
```
Nexus MCP Tool                     → Hermes Tool
─────────────────────────────────────────────────────
job_search(query, location)        → hermes.tool("job-search")
job_analyze(job_id)                → hermes.tool("job-analyze")
job_consolidate(pdf_paths)         → hermes.tool("job-consolidate")
job_adapt(job_id)                  → hermes.tool("job-adapt")
job_apply(job_id)                  → hermes.tool("job-apply")
job_track(action, job_id)          → hermes.tool("job-track")
job_kb(file_paths)                 → hermes.tool("job-kb")
```

### 2.3 Migração de Custom Tools (REQ-006)

| Tool Nexus | Equivalente Hermes | Ação | Sub-Agent | Estimativa |
|------------|-------------------|------|-----------|------------|
| `nexus-log` | Hermes logging built-in | Substituir | @fixer | 0.5h |
| `nexus-memory` | Hermes memory (FTS5) | Substituir | @fixer | 0.5h |
| `nexus-handoff` | Hermes session management | Substituir | @fixer | 1h |
| `spec-validator` | Hermes tool customizada | Adaptar | @fixer | 1h |

**Arquivos Afetados:**

| Nexus (origem) | Hermes (destino) | Ação |
|-----------------|-------------------|------|
| `.opencode/tools/nexus-log.ts` | N/A (built-in) | Mapear APIs |
| `.opencode/tools/nexus-memory.ts` | N/A (built-in) | Mapear APIs |
| `.opencode/tools/nexus-handoff.ts` | `~/.hermes/tools/handoff/` | Adaptar |
| `.opencode/tools/spec-validator.ts` | `~/.hermes/tools/spec-validator/` | Adaptar |
| `.opencode/tools/sqlite-adapter.ts` | N/A (Hermes usa SQLite nativo) | Remover |
| `.opencode/tools/mongodb-adapter.ts` | Hermes config (se MongoDB sync) | Configurar |

**Mapeamento de APIs Custom Tools → Hermes:**

```
Nexus Tool API                      → Hermes Equivalente
─────────────────────────────────────────────────────────
nexus-log({level, message, cat})    → hermes.log({level, message, category})
nexus-memory({action: "save"})      → hermes.memory.save()
nexus-memory({action: "search"})    → hermes.memory.search()
nexus-handoff({action: "create"})   → hermes.session.create_handoff()
nexus-handoff({action: "apply"})    → hermes.session.apply_handoff()
spec-validator({filePath})          → hermes.tool("spec-validator")
```

**Critérios de Saída (Exit Criteria):**
- [ ] CT-002.1: nexus-memory-server substituído pelo Hermes memory
- [ ] CT-002.2: job-apply-mcp integrado como Hermes tool
- [ ] CT-002.3: google-workspace configurado no Hermes config.yaml
- [ ] CT-006.1-4: Todas as custom tools migradas

---

## Fase 3: Agent Migration (REQ-003, REQ-004)

**Objetivo:** Migrar plugins e definições de agentes para formato Hermes.
**Esforço estimado:** 8-10 horas
**Dependências:** Fase 2 concluída

### 3.1 Migração de Plugins → Hermes Hooks (REQ-003)

| Plugin Nexus | Equivalente Hermes | Ação | Sub-Agent | Estimativa |
|--------------|-------------------|------|-----------|------------|
| `nexus-plugin` (observabilidade) | Hermes logging hooks | Substituir | @fixer | 1.5h |
| `metrics-collector` | Hermes metrics built-in | Substituir | @fixer | 1h |
| `cache-manager` | Hermes cache built-in | Substituir | @fixer | 0.5h |
| `context-manager` | Hermes session management | Integrar | @fixer | 1h |

**Arquivos Afetados:**

| Nexus (origem) | Hermes (destino) | Ação |
|-----------------|-------------------|------|
| `.opencode/plugins/nexus-plugin.ts` | `~/.hermes/hooks/logging.ts` | Reescrever |
| `.opencode/plugins/metrics-collector.ts` | `~/.hermes/hooks/metrics.ts` | Reescrever |
| `.opencode/plugins/cache-manager.ts` | N/A (built-in) | Remover |
| `.opencode/plugins/context-manager.ts` | `~/.hermes/hooks/context.ts` | Reescrever |

**Mapeamento de Hooks:**

```
Nexus Plugin Event                  → Hermes Hook
─────────────────────────────────────────────────────
onToolCall(tool, args)              → hermes.hooks.before_tool_call()
onToolResult(tool, result)         → hermes.hooks.after_tool_call()
onSessionStart()                    → hermes.hooks.on_session_start()
onSessionEnd()                      → hermes.hooks.on_session_end()
```

### 3.2 Migração de Agentes → Hermes Subagents (REQ-004)

| Agente Nexus | Tipo Hermes | Prioridade | Sub-Agent | Estimativa |
|--------------|-------------|------------|-----------|------------|
| `@orchestrator` | Primary agent | Alta | @fixer | 2h |
| `@spec-reviewer` | Subagent | Alta | @fixer | 0.5h |
| `@security-secret-auditor` | Subagent | Alta | @fixer | 0.5h |
| `@quality-assurance-analyst` | Subagent | Alta | @fixer | 0.5h |
| `@docs-architect` | Subagent | Média | @fixer | 0.5h |
| `@cbm-agent` | Subagent + Tool | Alta | @cbm-agent + @fixer | 1h |
| `@testsprite-mcp-agent` | Subagent | Média | @fixer | 0.5h |
| `@notion-agent` | Subagent | Média | @fixer | 0.5h |
| `@google-workspace-agent` | Subagent | Média | @fixer | 0.5h |
| `@playwright-agent` | Subagent | Baixa | @fixer | 0.5h |
| `@chrome-devtools-agent` | Subagent | Baixa | @fixer | 0.5h |
| `@job-apply-agent` | Subagent | Alta | @fixer | 1h |

**Arquivos Afetados:**

| Nexus (origem) | Hermes (destino) | Ação |
|-----------------|-------------------|------|
| `.opencode/agents/orchestrator.md` | `~/.hermes/agents/orchestrator.yaml` | Reescrever |
| `.opencode/agents/spec-reviewer.md` | `~/.hermes/agents/spec-reviewer.yaml` | Reescrever |
| `.opencode/agents/security-secret-auditor.md` | `~/.hermes/agents/security-auditor.yaml` | Reescrever |
| `.opencode/agents/quality-assurance-analyst.md` | `~/.hermes/agents/qa-analyst.yaml` | Reescrever |
| `.opencode/agents/docs-architect.md` | `~/.hermes/agents/docs-architect.yaml` | Reescrever |
| `.opencode/agents/cbm-agent.md` | `~/.hermes/agents/cbm-agent.yaml` | Reescrever |
| `.opencode/agents/testsprite-mcp-agent.md` | `~/.hermes/agents/testsprite.yaml` | Reescrever |
| `.opencode/agents/notion-agent.md` | `~/.hermes/agents/notion-agent.yaml` | Reescrever |
| `.opencode/agents/google-workspace-agent.md` | `~/.hermes/agents/google-workspace.yaml` | Reescrever |
| `.opencode/agents/playwright-agent.md` | `~/.hermes/agents/playwright.yaml` | Reescrever |
| `.opencode/agents/chrome-devtools-agent.md` | `~/.hermes/agents/chrome-devtools.yaml` | Reescrever |
| `.opencode/agents/job-apply-agent.md` | `~/.hermes/agents/job-apply.yaml` | Reescrever |

**Formato de Agente Hermes (exemplo):**

```yaml
# ~/.hermes/agents/orchestrator.yaml
name: orchestrator
type: primary
description: "Orquestrador principal do ecossistema Nexus"
model: openrouter/anthropic/claude-sonnet-4-20250514
skills:
  - harness-workflow
  - mem-search
  - cbm-agent
tools:
  - memory
  - logging
  - session
subagents:
  - spec-reviewer
  - security-auditor
  - qa-analyst
  - docs-architect
  - cbm-agent
  - job-apply
hooks:
  - logging
  - metrics
discord:
  allowed_channels:
    - "nexus-commands"
    - "nexus-dev"
  dm_enabled: true
  threads_enabled: true
```

**Critérios de Saída (Exit Criteria):**
- [ ] CT-003.1-4: Plugins migrados para hooks Hermes
- [ ] CT-004.1-4: Agentes convertidos para subagents Hermes
- [ ] Orchestrator configurado como primary agent
- [ ] Subagents invocáveis via Discord

---

## Fase 4: Commands & Integration (REQ-007)

**Objetivo:** Converter comandos para slash commands do Discord e integrar tudo.
**Esforço estimado:** 6-8 horas
**Dependências:** Fases 2 e 3 concluídas

### 4.1 Conversão de Comandos para Slash Commands

| Comando Nexus | Slash Command Discord | Ação | Sub-Agent | Estimativa |
|---------------|----------------------|------|-----------|------------|
| `/super-pipeline` | `/pipeline` | Converter | @fixer | 1h |
| `/spec-gen` | `/spec-gen` | Converter | @fixer | 0.5h |
| `/spec-review` | `/spec-review` | Converter | @fixer | 0.5h |
| `/cbm-query` | `/cbm` | Converter | @fixer | 0.5h |
| `/plan` | `/plan` | Converter | @fixer | 0.5h |
| `/security` | `/security` | Converter | @fixer | 0.5h |
| `/qa` | `/qa` | Converter | @fixer | 0.5h |
| `/docs` | `/docs` | Converter | @fixer | 0.5h |
| `/memory` | `/memory` | Converter | @fixer | 0.5h |
| `/criar-agente` | `/create-agent` | Converter | @fixer | 0.5h |
| `/commit-&-docs` | `/commit-docs` | Converter | @fixer | 0.5h |
| `/gw` | `/google` | Converter | @fixer | 0.5h |
| `/playwright` | `/playwright` | Converter | @fixer | 0.5h |
| `/devtools` | `/devtools` | Converter | @fixer | 0.5h |
| Job commands | `/job-*` | Converter | @fixer | 1h |

**Arquivos Afetados:**

| Nexus (origem) | Hermes (destino) | Ação |
|-----------------|-------------------|------|
| `.opencode/commands/*.md` (14 arquivos) | `~/.hermes/commands/*.yaml` | Reescrever |

**Formato de Comando Hermes (exemplo):**

```yaml
# ~/.hermes/commands/pipeline.yaml
name: pipeline
description: "Executa o pipeline harness completo com sub-agents"
slash_command: /pipeline
parameters:
  - name: task
    type: string
    description: "Descrição da tarefa"
    required: true
  - name: phases
    type: string
    description: "Fases específicas (ex: spec,plan,build)"
    required: false
handler: orchestrator
skills:
  - harness-workflow
```

### 4.2 Integração e Testes End-to-End

| Tarefa | Detalhes | Sub-Agent | Estimativa |
|--------|----------|-----------|------------|
| Registrar slash commands no Discord | Usar Discord API ou Hermes CLI | @fixer | 0.5h |
| Testar cada comando individualmente | Validar que todos respondem | @quality-assurance-analyst | 1h |
| Testar pipeline completo via Discord | Executar `/pipeline` com tarefa real | @quality-assurance-analyst | 1h |
| Testar DMs e threads | Validar funcionamento em diferentes contextos | @quality-assurance-analyst | 0.5h |

**Critérios de Saída (Exit Criteria):**
- [ ] CT-007.1: /pipeline funciona via Discord
- [ ] CT-007.2: /spec-gen funciona via Discord
- [ ] CT-007.3: Todos os comandos de agentes funcionam
- [ ] CT-007.4: Comandos têm autocomplete no Discord

---

## Fase 5: Validation (REQ-009)

**Objetivo:** Validar que toda a funcionalidade migrou corretamente.
**Esforço estimado:** 4-6 horas
**Dependências:** Fase 4 concluída

### 5.1 Suite de Testes

| Tarefa | Detalhes | Sub-Agent | Estimativa |
|--------|----------|-----------|------------|
| Pipeline completo via Discord | Executar SPEC→PLAN→ANALYZE→BUILD→REVIEW→DOCUMENT | @quality-assurance-analyst | 1h |
| Todos os agentes respondem | Testar invocação de cada subagent | @quality-assurance-analyst | 1h |
| MCPs funcionam via Hermes | Testar job-apply, google-workspace | @quality-assurance-analyst | 1h |
| Performance via Discord | Latência < 5s para respostas | @quality-assurance-analyst | 0.5h |
| Memória e handoffs | Salvar/carregar contexto entre sessões | @quality-assurance-analyst | 0.5h |
| Segurança | Tokens não expostos, permissões corretas | @security-secret-auditor | 1h |

### 5.2 Matriz de Validação por REQ

| REQ-ID | CTs | Status | Notas |
|--------|-----|--------|-------|
| REQ-001 | CT-001.1 a CT-001.4 | ⬜ | Skills migradas |
| REQ-002 | CT-002.1 a CT-002.4 | ⬜ | MCPs migrados |
| REQ-003 | CT-003.1 a CT-003.4 | ⬜ | Plugins migrados |
| REQ-004 | CT-004.1 a CT-004.4 | ⬜ | Agentes migrados |
| REQ-005 | CT-005.1 a CT-005.7 | ⬜ | Discord configurado |
| REQ-006 | CT-006.1 a CT-006.4 | ⬜ | Custom tools migradas |
| REQ-007 | CT-007.1 a CT-007.4 | ⬜ | Comandos convertidos |
| REQ-008 | CT-008.1 a CT-008.4 | ⬜ | Dados preservados |
| REQ-009 | CT-009.1 a CT-009.4 | ⬜ | Validação completa |
| REQ-0010 | CT-0010.1 a CT-0010.3 | ⬜ | Rollback preparado |

**Critérios de Saída (Exit Criteria):**
- [ ] CT-009.1: Pipeline completo funciona via Discord
- [ ] CT-009.2: Todos os agentes respondem corretamente
- [ ] CT-009.3: MCPs funcionam via Hermes
- [ ] CT-009.4: Performance é equivalente ou melhor

---

## Fase 6: Rollback Preparation (REQ-0010)

**Objetivo:** Documentar e testar procedimentos de rollback.
**Esforço estimado:** 2-4 horas
**Dependências:** Fase 5 concluída

### 6.1 Documentação de Rollback

| Tarefa | Detalhes | Sub-Agent | Estimativa |
|--------|----------|-----------|------------|
| Documentar procedimento de rollback | Passo a passo detalhado | @docs-architect | 1h |
| Criar script de rollback | `scripts/rollback-to-nexus.sh` | @fixer | 1h |
| Testar rollback em ambiente isolado | Validar que Nexus original volta a funcionar | @quality-assurance-analyst | 1h |

### 6.2 Procedimento de Rollback

```bash
# Rollback para Nexus 7 Agent
# Tempo estimado: < 30 minutos

# 1. Parar Hermes Agent
hermes stop

# 2. Restaurar configurações Nexus
cp -r .opencode-backup/.opencode .opencode

# 3. Restaurar dados
cp .opencode-backup/memory/nexus-memory.db .opencode/memory/
cp -r .opencode-backup/memory/handoffs/ .opencode/memory/handoffs/

# 4. Reiniciar OpenCode
opencode serve

# 5. Validar
# - Pipeline funciona via OpenCode
# - Agentes respondem
# - Dados estão intactos
```

**Arquivos Afetados:**
- `scripts/rollback-to-nexus.sh` (novo)
- `docs/runbooks/rollback-hermes-migration.md` (novo)

**Critérios de Saída (Exit Criteria):**
- [ ] CT-0010.1: Nexus original continua funcionando
- [ ] CT-0010.2: Dados não são perdidos
- [ ] CT-0010.3: Rollback executado em < 30 minutos

---

## Matriz de Sub-Agents por Fase

| Fase | Sub-Agents Necessários | Prioridade |
|------|----------------------|------------|
| **Fase 1** | @fixer, @quality-assurance-analyst, @explorer | Alta |
| **Fase 2** | @fixer, @cbm-agent, @docs-architect, @quality-assurance-analyst | Alta |
| **Fase 3** | @fixer, @cbm-agent | Alta |
| **Fase 4** | @fixer, @quality-assurance-analyst | Média |
| **Fase 5** | @quality-assurance-analyst, @security-secret-auditor | Alta |
| **Fase 6** | @fixer, @quality-assurance-analyst, @docs-architect | Média |

## Timeline Estimada

```
Semana 1: [Fase 1 ████████] [Fase 2 ████████]
Semana 2: [Fase 2 ████████] [Fase 3 ████████]
Semana 3: [Fase 4 ████████] [Fase 5 ████]
Semana 4: [Fase 6 ████] → Deploy
```

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Hermes API instável | Média | Alto | Manter Nexus como fallback |
| Dados perdidos na migração | Baixa | Crítico | Backup completo antes + testes |
| Discord rate limits | Baixa | Médio | Implementar retry + backoff |
| MCPs incompatíveis | Média | Alto | Testar cada MCP isoladamente |
| Performance degradação | Baixa | Médio | Benchmark antes/depois |

---

## Checklist Final de Aprovação

- [ ] Spec aprovada pelo usuário
- [ ] Plano aprovado pelo usuário
- [ ] Fase 1 concluída (Preparation)
- [ ] Fase 2 concluída (Core Migration)
- [ ] Fase 3 concluída (Agent Migration)
- [ ] Fase 4 concluída (Commands & Integration)
- [ ] Fase 5 concluída (Validation)
- [ ] Fase 6 concluída (Rollback Preparation)
- [ ] Deploy realizado
- [ ] Rollback testado
