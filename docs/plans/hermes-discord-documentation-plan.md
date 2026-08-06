# Plano de Documentação: Migração Nexus 7 Agent → Hermes Agent com Discord

> **Para trabalhadores agênticos:** HABILITE A SUB-SKILL: Use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para implementar este plano tarefa por tarefa. As etapas usam sintaxe de checkbox (`- [ ]`) para rastreamento.

**Objetivo:** Criar documentação completa e maintainável para a migração do ecossistema Nexus 7 Agent (OpenCode) para Hermes Agent com Discord como interface principal.

**Arquitetura:** Documentação em português, seguindo padrões existentes do projeto (ADR format, plan format). Todos os diagramas em Mermaid renderizáveis. Import paths absolutos (`@/features/...`). Atualização frequente junto com código.

**Tech Stack:** Markdown, Mermaid, Swagger/OpenAPI (futuro), Discord.js (referência)

---

## Estrutura de Arquivos

```
docs/
├── migration/
│   ├── README.md                          # Índice da migração
│   ├── 01-prerequisites.md                # Pré-requisitos e setup
│   ├── 02-migration-guide.md              # Guia passo a passo
│   ├── 03-troubleshooting.md              # Solução de problemas
│   └── 04-rollback-plan.md                # Plano de rollback
├── architecture/
│   ├── README.md                          # Índice de arquitetura
│   ├── 01-system-overview.md              # Visão geral do sistema
│   ├── 02-component-mapping.md            # Mapeamento Nexus → Hermes
│   ├── 03-data-flow.md                    # Diagramas de fluxo de dados
│   ├── 04-memory-architecture.md          # Arquitetura de memória
│   └── 05-discord-integration.md          # Integração Discord
├── configuration/
│   ├── README.md                          # Índice de configuração
│   ├── 01-hermes-config.md                # Referência config.yaml
│   ├── 02-discord-bot-setup.md            # Setup do bot Discord
│   ├── 03-environment-variables.md        # Variáveis de ambiente
│   └── 04-mcp-servers.md                  # Configuração de MCPs
├── user-guide/
│   ├── README.md                          # Índice do guia do usuário
│   ├── 01-getting-started.md              # Primeiros passos
│   ├── 02-slash-commands.md               # Comandos slash do Discord
│   ├── 03-workflows.md                    # Workflows comuns
│   ├── 04-examples.md                     # Exemplos e casos de uso
│   └── 05-faq.md                          # Perguntas frequentes
├── developer-guide/
│   ├── README.md                          # Índice do guia do desenvolvedor
│   ├── 01-adding-skills.md                # Como adicionar skills
│   ├── 02-creating-agents.md              # Como criar agentes
│   ├── 03-mcp-development.md              # Desenvolvimento de MCPs
│   ├── 04-plugin-development.md           # Desenvolvimento de plugins
│   └── 05-testing.md                      # Guia de testes
├── adr/
│   ├── README.md                          # Índice de ADRs
│   ├── ADR-002-hermes-choice.md           # Por que Hermes
│   ├── ADR-003-discord-platform.md        # Por que Discord
│   ├── ADR-004-memory-architecture.md     # Decisões de memória
│   ├── ADR-005-skill-format.md            # Formato skills agentskills.io
│   └── ADR-006-plugin-system.md           # Sistema de plugins
└── api/
    ├── README.md                          # Índice de API
    ├── 01-hermes-api.md                   # Referência API Hermes
    ├── 02-discord-api.md                  # Endpoints Discord
    └── 03-migration-endpoints.md          # Endpoints de migração
```

---

## Fase 1: ADRs (Architecture Decision Records)

> **Justificativa:** ADRs documentam o "porquê" das decisões. Devem ser escritos primeiro pois informam todo o resto da documentação.

### Task 1: ADR-002 — Por que Hermes Agent

**Arquivos:**
- Criar: `docs/adr/ADR-002-hermes-choice.md`

- [ ] **Step 1: Criar ADR-002 com estrutura completa**

```markdown
# ADR-002: Escolha do Hermes Agent como Framework

## Status
Aceito (2026-06-19)

## Contexto
O ecossistema Nexus 7 Agent opera sobre OpenCode (Node.js/TypeScript) com interface CLI + Dashboard web. Identificamos as seguintes limitações:
- Interface CLI limita colaboração em equipe
- Sem suporte nativo a messaging platforms
- Sistema de skills customizado (não padronizado)
- Memória dependente de servidor MCP externo

## Decisão
Migrar para Hermes Agent (NousResearch) como framework principal.

### Opções Consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| **Hermes Agent** | Suporte nativo a 23 plataformas, skills padronizadas (agentskills.io), memória built-in (FTS5), subagents paralelos | Framework mais novo, comunidade menor |
| **LangChain/LangGraph** | Ecossistema maduro, muitos exemplos | Não tem interface de messaging, precisa de muito boilerplate |
| **AutoGen** | Multi-agent nativo | Foco em pesquisa, menos em produção |
| **Manter OpenCode** | Sem migração | Limitações de interface persistem |

### Justificativa da Escolha

1. **Multi-plataforma nativa:** Discord, Telegram, Slack, WhatsApp, Signal — sem código extra
2. **Skills padronizadas:** agentskills.io é padrão aberto, reutilizável
3. **Memória built-in:** FTS5 + LLM summarization + Honcho user modeling
4. **Subagents paralelos:** Swarm topology para tarefas concorrentes
5. **Kanban nativo:** Board de tarefas autônomas com zombie detection
6. **Python runtime:** Ecossistema ML/AI mais maduro

## Consequências

### Positivas
- Interface Discord melhora colaboração em equipe
- 23 plataformas disponíveis sem código extra
- Skills reutilizáveis entre projetos
- Memória persistente sem servidor externo
- Kanban para tarefas autônomas

### Negativas
- Migração de 8 skills, 3 MCPs, 12 agentes
- Curva de aprendizado do framework
- Dependência de framework mais novo
- Custo de manutenção durante transição

## Métricas de Sucesso
- Todos os 8 componentes migrados funcionando
- Latência de resposta < 3s via Discord
- Zero perda de dados
- Rollback viável em < 30 minutos
```

- [ ] **Step 2: Commit**

```bash
git add docs/adr/ADR-002-hermes-choice.md
git commit -m "docs: add ADR-002 — Hermes Agent choice rationale"
```

---

### Task 2: ADR-003 — Por que Discord como Plataforma Principal

**Arquivos:**
- Criar: `docs/adr/ADR-003-discord-platform.md`

- [ ] **Step 1: Criar ADR-003**

```markdown
# ADR-003: Discord como Plataforma Principal

## Status
Aceito (2026-06-19)

## Contexto
O Hermes Agent suporta 23 plataformas de messaging. Precisamos escolher uma como interface principal para o ecossistema de agentes.

## Decisão
Discord como plataforma principal, com suporte secundário a Telegram e Slack.

### Opções Consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| **Discord** | Threads nativas, slash commands, permissões por role, suporte a arquivos, voz, kanban via embeds | Requer criação de bot, rate limits |
| **Slack** | Enterprise-ready, blocks UI | Rate limits mais restritivos, custo por workspace |
| **Telegram** | Simples, API rápida | Sem threads nativas, limites de grupo |
| **WhatsApp** | Ubíquidade | API paga, limites rígidos, sem slash commands |

### Justificativa da Escolha

1. **Threads naturais:** Cada pipeline/tarefa pode ter sua thread
2. **Slash commands:** Interface rica com autocomplete e validação
3. **Permissões granulares:** Roles por guild, canais por categoria
4. **Suporte a arquivos:** PDFs, imagens, documentos nativamente
5. **Voz:** Calls para discussões em tempo real
6. **Kanban via embeds:** Boards visuais sem ferramentas externas
7. **Custo zero:** Hospedagem gratuita para bots

## Consequências

### Positivas
- Colaboração em tempo real via threads
- Interface rica com slash commands
- Permissões granulares por equipe
- Integração com ferramentas existentes

### Negativas
- Rate limits do Discord (50 req/s por guild)
- Dependência de plataforma proprietária
- Necessidade de manter bot Discord

## Configuração Necessária
- Bot no Discord Developer Portal
- Message Content Intent habilitado
- Permissões: Send Messages, Use Slash Commands, Embed Links, Attach Files
```

- [ ] **Step 2: Commit**

```bash
git add docs/adr/ADR-003-discord-platform.md
git commit -m "docs: add ADR-003 — Discord as primary platform"
```

---

### Task 3: ADR-004 — Arquitetura de Memória

**Arquivos:**
- Criar: `docs/adr/ADR-004-memory-architecture.md`

- [ ] **Step 1: Criar ADR-004**

```markdown
# ADR-004: Arquitetura de Memória

## Status
Aceito (2026-06-19)

## Contexto
O Nexus usa SQLite + FTS5 via `nexus-memory-server.ts` (MCP). O Hermes tem memória built-in com FTS5 + LLM summarization + Honcho dialectic user modeling.

## Decisão
Substituir `nexus-memory-server` pelo sistema de memória built-in do Hermes, com sincronização MongoDB opcional.

### Componentes de Memória

| Componente | Nexus Atual | Hermes Alvo | Ação |
|------------|-------------|-------------|------|
| Storage | SQLite + FTS5 (MCP server) | SQLite + FTS5 (built-in) | Substituir |
| Search | FTS5 via MCP tool | FTS5 nativo | Substituir |
| Session | Handoffs JSON | Session management | Substituir |
| User Modeling | Honcho (opcional) | Honcho (built-in) | Configurar |
| Remote Sync | MongoDB (dual-write) | MongoDB (plugin) | Configurar |

### Justificativa

1. **Zero servidor externo:** Memória é built-in, não precisa de MCP server
2. **FTS5 nativo:** Busca textual preservada
3. **LLM summarization:** Resumos automáticos de conversas
4. **Honcho integration:** User modeling dialectic opcional
5. **MongoDB sync:** Mantido via plugin para sync remoto

## Consequências

### Positivas
- Eliminação do `nexus-memory-server.ts`
- Menos dependências de infraestrutura
- Funcionalidades nativas (summarization, user modeling)

### Negativas
- Migração de dados SQLite existentes
- Necessidade de adaptar scripts de handoff
- MongoDB sync requer configuração adicional

## Dados a Migrar
- `memories` table → Hermes memory store
- `.opencode/memory/handoffs/` → Hermes session management
- Configuração MongoDB → Hermes config.yaml
```

- [ ] **Step 2: Commit**

```bash
git add docs/adr/ADR-004-memory-architecture.md
git commit -m "docs: add ADR-004 — memory architecture decisions"
```

---

### Task 4: ADR-005 — Formato de Skills (agentskills.io)

**Arquivos:**
- Criar: `docs/adr/ADR-005-skill-format.md`

- [ ] **Step 1: Criar ADR-005**

```markdown
# ADR-005: Formato de Skills — agentskills.io

## Status
Aceito (2026-06-19)

## Contexto
O Nexus usa skills customizadas em `.opencode/skills/` com formato próprio (SKILL.md + scripts). O Hermes usa o padrão agentskills.io com Skills Hub.

## Decisão
Migrar todas as skills para o formato agentskills.io padrão.

### Mapeamento de Skills

| Skill Nexus | Formato Atual | Formato Hermes | Complexidade |
|-------------|---------------|----------------|--------------|
| `harness-workflow` | SKILL.md + scripts | agentskills.io + tools | Alta |
| `mem-search` | SKILL.md | Hermes memory built-in | Baixa |
| `agent-creator` | SKILL.md + templates | Hermes skill creation | Média |
| `cbm-agent` | SKILL.md + MCP | Hermes tool + MCP | Alta |
| `project-review` | SKILL.md | agentskills.io | Média |

### Justificativa

1. **Padrão aberto:** agentskills.io é reutilizável entre projetos
2. **Skills Hub:** Compartilhamento e descoberta de skills
3. **Compatibilidade:** Skills funcionam em qualquer Hermes Agent
4. **Documentação:** Padrão definido para descrição e uso

## Consequências

### Positivas
- Skills reutilizáveis entre projetos
- Comunidade de skills compartilhadas
- Documentação padronizada

### Negativas
- Reescrita das 8 skills existentes
- Necessidade de aprender novo formato
- Possível perda de funcionalidades customizadas
```

- [ ] **Step 2: Commit**

```bash
git add docs/adr/ADR-005-skill-format.md
git commit -m "docs: add ADR-005 — skill format agentskills.io"
```

---

### Task 5: ADR-006 — Sistema de Plugins

**Arquivos:**
- Criar: `docs/adr/ADR-006-plugin-system.md`

- [ ] **Step 1: Criar ADR-006**

```markdown
# ADR-006: Sistema de Plugins

## Status
Aceito (2026-06-19)

## Contexto
O Nexus usa plugins TypeScript em `.opencode/plugins/` com hooks de ciclo de vida. O Hermes usa sistema de plugins Python com tools, hooks, CLI e platforms.

## Decisão
Migrar plugins Nexus para o formato Hermes plugin system.

### Mapeamento de Plugins

| Plugin Nexus | Função | Plugin Hermes | Ação |
|--------------|--------|---------------|------|
| `nexus-plugin.ts` | Observabilidade, logging | Hermes logging built-in | Substituir |
| `metrics-collector.ts` | Métricas | Hermes metrics | Integrar |
| `cache-manager.ts` | Cache | Hermes cache built-in | Substituir |
| `context-manager.ts` | Contexto em conversas | Hermes session management | Integrar |

### Justificativa

1. **Built-in functions:** Logging, cache, metrics são nativos do Hermes
2. **Sistema de hooks:** Ciclo de vida similar ao OpenCode
3. **Python ecosystem:** Mais bibliotecas de ML/AI disponíveis

## Consequências

### Positivas
- Eliminação de plugins customizados
- Funcionalidades built-in testadas
- Menos manutenção

### Negativas
- Necessidade de adaptar hooks existentes
- Possível perda de customizações específicas
```

- [ ] **Step 2: Commit**

```bash
git add docs/adr/ADR-006-plugin-system.md
git commit -m "docs: add ADR-006 — plugin system decisions"
```

---

## Fase 2: Architecture Documentation

> **Justificativa:** Diagramas de arquitetura são a base para guias de migração e configuração.

### Task 6: Visão Geral do Sistema

**Arquivos:**
- Criar: `docs/architecture/README.md`
- Criar: `docs/architecture/01-system-overview.md`

- [ ] **Step 1: Criar README de arquitetura**

```markdown
# Arquitetura — Hermes Agent + Discord

## Documentos

| Documento | Descrição |
|-----------|-----------|
| [01-system-overview](01-system-overview.md) | Visão geral do sistema com diagramas |
| [02-component-mapping](02-component-mapping.md) | Mapeamento Nexus → Hermes |
| [03-data-flow](03-data-flow.md) | Diagramas de fluxo de dados |
| [04-memory-architecture](04-memory-architecture.md) | Arquitetura de memória |
| [05-discord-integration](05-discord-integration.md) | Integração Discord |

## Diagramas

Todos os diagramas usam Mermaid e são renderizáveis no GitHub, Notion e ferramentas compatíveis.
```

- [ ] **Step 2: Criar visão geral com diagrama Mermaid**

```markdown
# Visão Geral do Sistema

## Arquitetura Alvo (Hermes + Discord)

```mermaid
graph TB
    subgraph "Interface"
        DC[Discord Bot]
        CLI[CLI]
        WEB[Web Dashboard]
    end

    subgraph "Hermes Agent Core"
        PA[Primary Agent<br/>Orchestrator]
        SA1[Subagent: Security]
        SA2[Subagent: QA]
        SA3[Subagent: Docs]
        SA4[Subagent: CBM]
        SA5[Subagent: Job Apply]
        SA6[Subagent: Notion]
        SA7[Subagent: Google WS]
        SA8[Subagent: Playwright]
    end

    subgraph "Memory"
        MEM[Hermes Memory<br/>SQLite + FTS5]
        HON[Honcho<br/>User Modeling]
        MGO[MongoDB<br/>Remote Sync]
    end

    subgraph "MCP Servers"
        JOB[Job Apply MCP]
        GW[Google Workspace MCP]
    end

    subgraph "Skills"
        SK1[harness-workflow]
        SK2[cbm-agent]
        SK3[job-apply-agent]
        SK4[project-review]
        SK5[agent-creator]
    end

    subgraph "External"
        OR[OpenRouter]
        OLL[Ollama]
        NOUS[Nous Portal]
    end

    DC --> PA
    CLI --> PA
    WEB --> PA

    PA --> SA1 & SA2 & SA3 & SA4 & SA5 & SA6 & SA7 & SA8
    PA --> MEM
    PA --> SK1 & SK2 & SK3 & SK4 & SK5
    PA --> JOB & GW

    MEM --> HON
    MEM --> MGO

    PA --> OR & OLL & NOUS
```

## Componentes Principais

### Hermes Agent Core
- **Primary Agent:** Orchestrator que gerencia pipeline de 6 estágios
- **Subagents:** 12 agentes especializados invocáveis via Discord
- **Swarm Topology:** Execução paralela de tarefas

### Interface
- **Discord Bot:** Interface principal com slash commands, threads, embeds
- **CLI:** Interface de linha de comando para operações diretas
- **Web Dashboard:** Dashboard para monitoramento (futuro)

### Memória
- **Hermes Memory:** SQLite + FTS5 para busca textual
- **Honcho:** User modeling dialectic (opcional)
- **MongoDB:** Sincronização remota (opcional)

### MCP Servers
- **Job Apply MCP:** Pipeline de candidaturas
- **Google Workspace MCP:** Drive, Docs, Sheets, Gmail

### Skills
- **harness-workflow:** Pipeline de 6 estágios
- **cbm-agent:** Code intelligence via knowledge graph
- **job-apply-agent:** Pipeline de candidaturas
- **project-review:** Revisão de projeto
- **agent-creator:** Criação de novos agentes
```

- [ ] **Step 3: Commit**

```bash
git add docs/architecture/README.md docs/architecture/01-system-overview.md
git commit -m "docs: add architecture overview with Mermaid diagrams"
```

---

### Task 7: Mapeamento de Componentes

**Arquivos:**
- Criar: `docs/architecture/02-component-mapping.md`

- [ ] **Step 1: Criar mapeamento completo**

```markdown
# Mapeamento de Componentes: Nexus → Hermes

## Skills

| Nexus | Hermes | Mudanças |
|-------|--------|----------|
| `.opencode/skills/harness-workflow/SKILL.md` | `hermes skills add harness-workflow` | Reescrita para agentskills.io |
| `.opencode/skills/mem-search/SKILL.md` | Hermes memory built-in | Eliminada (built-in) |
| `.opencode/skills/agent-creator/SKILL.md` | Hermes skill creation | Adaptada |
| `.opencode/skills/cbm-agent/SKILL.md` | Hermes tool + MCP | Reescrita |
| `.opencode/skills/project-review/SKILL.md` | `hermes skills add project-review` | Reescrita |

## MCP Servers

| Nexus | Hermes | Mudanças |
|-------|--------|----------|
| `.opencode/mcp/nexus-memory-server.ts` | Hermes memory built-in | Eliminado |
| `.opencode/mcp/job-apply-mcp.ts` | Hermes tool customizada | Adaptado |
| `.opencode/mcp/google-workspace/` | Hermes config.yaml | Configurado |

## Plugins

| Nexus | Hermes | Mudanças |
|-------|--------|----------|
| `.opencode/plugins/nexus-plugin.ts` | Hermes logging built-in | Eliminado |
| `.opencode/plugins/metrics-collector.ts` | Hermes metrics | Integrado |
| `.opencode/plugins/cache-manager.ts` | Hermes cache built-in | Eliminado |
| `.opencode/plugins/context-manager.ts` | Hermes session management | Integrado |

## Agentes

| Nexus | Hermes | Tipo |
|-------|--------|------|
| `.opencode/agents/orchestrator.md` | Primary Agent | Config principal |
| `.opencode/agents/spec-reviewer.md` | Subagent | Delegável |
| `.opencode/agents/security-secret-auditor.md` | Subagent | Delegável |
| `.opencode/agents/quality-assurance-analyst.md` | Subagent | Delegável |
| `.opencode/agents/docs-architect.md` | Subagent | Delegável |
| `.opencode/agents/cbm-agent.md` | Subagent + Tool | Delegável |
| `.opencode/agents/testsprite-mcp-agent.md` | Subagent | Delegável |
| `.opencode/agents/notion-agent.md` | Subagent | Delegável |
| `.opencode/agents/google-workspace-agent.md` | Subagent | Delegável |
| `.opencode/agents/playwright-agent.md` | Subagent | Delegável |
| `.opencode/agents/chrome-devtools-agent.md` | Subagent | Delegável |
| `.opencode/agents/job-apply-agent.md` | Subagent | Delegável |

## Custom Tools

| Nexus | Hermes | Mudanças |
|-------|--------|----------|
| `nexus-log` | Hermes logging built-in | Eliminada |
| `nexus-memory` | Hermes memory built-in | Eliminada |
| `nexus-handoff` | Hermes session management | Eliminada |
| `spec-validator` | Hermes tool customizada | Adaptada |

## Comandos → Slash Commands

| Nexus Command | Discord Slash Command | Parâmetros |
|---------------|----------------------|------------|
| `/super-pipeline` | `/super-pipeline` | `--feature`, `--model` |
| `/spec-gen` | `/spec-gen` | `--name`, `--template` |
| `/spec-review` | `/spec-review` | `--spec-id` |
| `/cbm-query` | `/cbm-query` | `--query`, `--type` |
| `/plan` | `/plan` | `--feature` |
| `/security` | `/security` | `--scope` |
| `/qa` | `/qa` | `--scope` |
| `/docs` | `/docs` | `--type` |
| `/memory` | `/memory` | `--action`, `--key` |
| `/criar-agente` | `/criar-agente` | `--name`, `--description` |
| `/gw` | `/gw` | `--action`, `--target` |
| `/playwright` | `/playwright` | `--action`, `--url` |
| `/devtools` | `/devtools` | `--action`, `--url` |
| `/job-*` | `/job-*` | (varies) |
```

- [ ] **Step 2: Commit**

```bash
git add docs/architecture/02-component-mapping.md
git commit -m "docs: add component mapping Nexus → Hermes"
```

---

### Task 8: Diagramas de Fluxo de Dados

**Arquivos:**
- Criar: `docs/architecture/03-data-flow.md`

- [ ] **Step 1: Criar diagramas de fluxo**

```markdown
# Fluxo de Dados

## Fluxo de uma Requisição Discord

```mermaid
sequenceDiagram
    participant U as Usuário
    participant D as Discord Bot
    participant H as Hermes Core
    participant M as Memory
    participant S as Skills
    participant A as Subagents

    U->>D: /super-pipeline --feature "auth"
    D->>H: Parse slash command
    H->>M: Load context
    M-->>H: Session data
    H->>A: Spawn orchestrator
    A->>S: Load harness-workflow
    S-->>A: Pipeline stages
    A->>A: Execute SPEC → PLAN → ANALYZE
    A->>A: Execute BUILD → REVIEW → DOCUMENT
    A->>M: Save handoff
    A-->>H: Pipeline complete
    H-->>D: Response with embed
    D-->>U: Kanban board + results
```

## Fluxo de Memória

```mermaid
flowchart LR
    A[Usuário msg] --> B{Tipo?}
    B -->|Comando| C[Executar ação]
    B -->|Conversa| D[Salvar contexto]
    B -->|Busca| E[FTS5 search]

    C --> F[Atualizar session]
    D --> G[SQLite + FTS5]
    E --> H[Retornar resultados]

    F --> I{Sync MongoDB?}
    I -->|Sim| J[Dual-write]
    I -->|Não| K[Local apenas]

    J --> L[MongoDB Atlas]
    K --> G
```

## Fluxo de Subagent Spawning

```mermaid
flowchart TB
    A[Primary Agent] --> B{Tarefa complexa?}
    B -->|Sim| C[Spawn subagent]
    B -->|Não| D[Executar direto]

    C --> E[Definir contexto]
    E --> F[Executar tarefa]
    F --> G{Completa?}
    G -->|Sim| H[Return resultado]
    G -->|Não| I[Retry ou fallback]

    H --> J[Consolidar resultados]
    D --> J
    I --> J

    J --> K[Salvar em memory]
    K --> L[Responder usuário]
```
```

- [ ] **Step 2: Commit**

```bash
git add docs/architecture/03-data-flow.md
git commit -m "docs: add data flow diagrams with Mermaid"
```

---

### Task 9: Arquitetura de Memória e Integração Discord

**Arquivos:**
- Criar: `docs/architecture/04-memory-architecture.md`
- Criar: `docs/architecture/05-discord-integration.md`

- [ ] **Step 1: Criar documentação de memória**

```markdown
# Arquitetura de Memória

## Componentes

```mermaid
graph TB
    subgraph "Hermes Memory"
        SQL[SQLite + FTS5]
        SEM[Session Manager]
        SUM[LLM Summarizer]
    end

    subgraph "User Modeling"
        HON[Honcho<br/>Dialectic]
    end

    subgraph "Remote Sync"
        MGO[MongoDB Atlas]
    end

    subgraph "Data Types"
        SES[Sessions]
        HND[Handoffs]
        OBS[Observations]
        PROJ[Project Context]
    end

    SEM --> SQL
    SUM --> SQL
    HON --> SQL
    MGO --> SQL

    SES --> SEM
    HND --> SEM
    OBS --> SQL
    PROJ --> SQL
```

## Escopos de Memória

| Escopo | Descrição | Persistência |
|--------|-----------|--------------|
| `session` | Dados da sessão atual | Temporário |
| `project` | Contexto do projeto | Permanente |
| `agent` | Dados por agente | Permanente |
| `observations` | Observações de sessões | Permanente |

## Handoffs

Handoffs são documentos JSON que preservam contexto entre sessões:

```json
{
  "id": "handoff-2026-06-19-001",
  "title": "Migração Hermes",
  "summary": "Fase 1 concluída...",
  "nextSteps": ["Migrar skills", "Configurar Discord"],
  "artifacts": ["docs/spec/hermes.spec.md"],
  "pending": ["Aprovação do usuário"]
}
```
```

- [ ] **Step 2: Criar documentação de integração Discord**

```markdown
# Integração Discord

## Arquitetura do Bot

```mermaid
graph TB
    subgraph "Discord"
        G[Guild]
        C[Canais]
        T[Threads]
        CM[Canvas/Embeds]
    end

    subgraph "Hermes Discord Gateway"
        BOT[Bot Client]
        CMD[Command Router]
        EVT[Event Handler]
        PERM[Permission Checker]
    end

    subgraph "Hermes Core"
        AG[Agent Runtime]
        MEM[Memory]
        SK[Skills]
    end

    G --> BOT
    C --> BOT
    T --> BOT

    BOT --> CMD
    BOT --> EVT
    BOT --> PERM

    CMD --> AG
    EVT --> AG
    AG --> MEM
    AG --> SK
```

## Recursos do Discord

| Recurso | Uso no Hermes |
|---------|---------------|
| **Slash Commands** | Comandos `/super-pipeline`, `/spec-gen`, etc. |
| **Threads** | Conversas longas, pipelines em execução |
| **Embeds** | Kanban boards, resultados formatados |
| **Files** | Upload de PDFs, imagens, documentos |
| **Roles** | Permissões por equipe |
| **Channels** | Organização por categoria |
| **Voice** | Discussões em tempo real (futuro) |

## Permissões

| Permissão | Necessária | Uso |
|-----------|------------|-----|
| Send Messages | ✅ | Responder a usuários |
| Use Slash Commands | ✅ | Processar comandos |
| Embed Links | ✅ | Exibir resultados formatados |
| Attach Files | ✅ | Enviar arquivos gerados |
| Read Message History | ✅ | Contexto de conversas |
| Manage Threads | ⚠️ Opcional | Criar threads automaticamente |
| Connect (Voice) | ⚠️ Opcional | Calls de voz |
```

- [ ] **Step 3: Commit**

```bash
git add docs/architecture/04-memory-architecture.md docs/architecture/05-discord-integration.md
git commit -m "docs: add memory architecture and Discord integration docs"
```

---

## Fase 3: Configuration Reference

> **Justificativa:** Configuração é o primeiro ponto de contato após migração.

### Task 10: Referência config.yaml

**Arquivos:**
- Criar: `docs/configuration/README.md`
- Criar: `docs/configuration/01-hermes-config.md`

- [ ] **Step 1: Criar referência completa do config.yaml**

```markdown
# Referência: Hermes config.yaml

## Localização
`~/.hermes/config.yaml`

## Estrutura Completa

```yaml
# ~/.hermes/config.yaml
# Configuração do Hermes Agent para Nexus 7 Agent

# === Modelo Principal ===
model:
  provider: openrouter  # openrouter, nous, openai, ollama
  name: deepseek/deepseek-chat  # ID do modelo
  temperature: 0.7
  max_tokens: 8192
  api_key: ${OPENROUTER_API_KEY}  # Referência a .env

# === Modelo para Subagents ===
subagent_model:
  provider: openrouter
  name: deepseek/deepseek-chat
  temperature: 0.5

# === Discord ===
discord:
  token: ${DISCORD_BOT_TOKEN}  # Bot token do Developer Portal
  command_prefix: /
  allowed_guilds:
    - ${DISCORD_GUILD_ID}
  allowed_roles:
    - Admin
    - Developer
    - User
  allowed_channels:
    - bot-commands
    - pipelines
  threads:
    auto_create: true  # Criar thread para pipelines longos
    archive_after: 24h  # Arquivar após 24h
  embeds:
    color: 0x00ff00  # Verde para sucesso
    footer: "Hermes Agent • Nexus 7"

# === Memória ===
memory:
  backend: sqlite  # sqlite, postgresql
  path: ~/.hermes/memory.db
  fts5: true  # Habilitar busca textual
  summarization:
    enabled: true
    model: deepseek/deepseek-chat
    interval: 10  # Resumir a cada 10 mensagens
  honcho:
    enabled: false  # User modeling dialectic
    api_key: ${HONCHO_API_KEY}

# === MongoDB (Sync Remoto) ===
mongodb:
  enabled: false
  uri: ${MONGODB_URI}
  database: nexus-memory
  collections:
    handoffs: handoffs
    sessions: sessions

# === MCP Servers ===
mcp_servers:
  job-apply:
    command: python3
    args:
      - -m
      - src.job_apply_agent
    env:
      PYTHONPATH: /home/novais-kr/Documentos/repos/nexus-7-agent
    tools:
      - job_search
      - job_analyze
      - job_consolidate
      - job_kb
      - job_adapt
      - job_apply
      - job_track
      - job_check_duplicate

  google-workspace:
    command: node
    args:
      - .opencode/mcp/google-workspace/server.mjs
    env:
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
      GOOGLE_REDIRECT_URI: ${GOOGLE_REDIRECT_URI}
    tools:
      - google_drive
      - google_docs
      - google_sheets
      - google_gmail

# === Skills ===
skills:
  directory: ~/.hermes/skills
  auto_discover: true
  hub:
    enabled: true
    url: https://agentskills.io

# === Plugins ===
plugins:
  directory: ~/.hermes/plugins
  enabled:
    - logging
    - metrics
    - cache

# === Logging ===
logging:
  level: info  # debug, info, warn, error
  format: json
  file: ~/.hermes/logs/hermes.log
  rotation:
    max_size: 10MB
    max_files: 5

# === Kanban ===
kanban:
  enabled: true
  board_channel: ${KANBAN_CHANNEL_ID}
  zombie_detection:
    enabled: true
    timeout: 30m  # Detectar tarefas travadas após 30min
  swarm:
    max_workers: 5
    topology: hierarchical  # hierarchical, ring, star

# === Performance ===
performance:
  response_timeout: 30s
  streaming: true
  cache:
    enabled: true
    ttl: 1h
    max_size: 100MB
```

## Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `DISCORD_BOT_TOKEN` | ✅ | Token do bot Discord |
| `DISCORD_GUILD_ID` | ✅ | ID do servidor Discord |
| `OPENROUTER_API_KEY` | ✅ | Chave API OpenRouter |
| `MONGODB_URI` | ❌ | URI do MongoDB (sync remoto) |
| `HONCHO_API_KEY` | ❌ | Chave API Honcho (user modeling) |
| `GOOGLE_CLIENT_ID` | ❌ | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | ❌ | Google OAuth Client Secret |
```

- [ ] **Step 2: Commit**

```bash
git add docs/configuration/README.md docs/configuration/01-hermes-config.md
git commit -m "docs: add Hermes config.yaml reference"
```

---

### Task 11: Setup do Bot Discord

**Arquivos:**
- Criar: `docs/configuration/02-discord-bot-setup.md`

- [ ] **Step 1: Criar guia de setup do bot**

```markdown
# Setup do Bot Discord

## Pré-requisitos

- Conta no Discord
- Acesso ao [Discord Developer Portal](https://discord.com/developers/applications)
- Hermes Agent instalado

## Passo 1: Criar Aplicação

1. Acesse [Discord Developer Portal](https://discord.com/developers/applications)
2. Clique em "New Application"
3. Nome: `Hermes Agent` (ou nome desejado)
4. Clique em "Create"

## Passo 2: Configurar Bot

1. No menu lateral, clique em "Bot"
2. Clique "Add Bot"
3. Copie o **Token** (guarde em local seguro)
4. Em "Privileged Gateway Intents":
   - ✅ Message Content Intent (OBRIGATÓRIO)
   - ✅ Server Members Intent (recomendado)
   - ✅ Presence Intent (opcional)

## Passo 3: Configurar OAuth2

1. No menu lateral, clique em "OAuth2"
2. Copie **Client ID** e **Client Secret**
3. Em "Redirect URLs", adicione:
   ```
   http://localhost:3000/callback
   ```

## Passo 4: Gerar Link de Invite

1. Acesse [Discord Permission Calculator](https://discordapi.com/permissions.html)
2. Selecione permissões:
   - ✅ Send Messages
   - ✅ Use Slash Commands
   - ✅ Embed Links
   - ✅ Attach Files
   - ✅ Read Message History
   - ✅ Manage Threads (opcional)
   - ✅ Connect (opcional, para voz)
3. Cole o **Client ID** da aplicação
4. Copie o link gerado

## Passo 5: Convidar Bot

1. Abra o link gerado no navegador
2. Selecione o servidor
3. Autorize as permissões

## Passo 6: Configurar no Hermes

1. Edite `~/.hermes/config.yaml`
2. Adicione o token:
   ```yaml
   discord:
     token: SEU_TOKEN_AQUI
   ```

3. Ou use variável de ambiente:
   ```bash
   # ~/.hermes/.env
   DISCORD_BOT_TOKEN=seu_token_aqui
   DISCORD_GUILD_ID=seu_guild_id_aqui
   ```

## Passo 7: Testar

1. Inicie o Hermes:
   ```bash
   hermes start
   ```

2. No Discord, digite:
   ```
   /help
   ```

3. O bot deve responder com a lista de comandos

## Solução de Problemas

| Problema | Causa | Solução |
|----------|-------|---------|
| Bot não responde | Token inválido | Verificar token no Developer Portal |
| Slash commands não aparecem | Permissão faltando | Verificar permissões do bot |
| Erro "Missing Intent" | Message Content Intent desabilitado | Habilitar no Developer Portal |
| Bot responde lento | Modelo lento | Verificar configuração do modelo |
```

- [ ] **Step 2: Commit**

```bash
git add docs/configuration/02-discord-bot-setup.md
git commit -m "docs: add Discord bot setup guide"
```

---

### Task 12: Variáveis de Ambiente e Configuração de MCPs

**Arquivos:**
- Criar: `docs/configuration/03-environment-variables.md`
- Criar: `docs/configuration/04-mcp-servers.md`

- [ ] **Step 1: Criar referência de variáveis de ambiente**

```markdown
# Variáveis de Ambiente

## Localização
`~/.hermes/.env`

## Referência Completa

```bash
# === Discord (Obrigatório) ===
DISCORD_BOT_TOKEN=discord_bot_token_here
DISCORD_GUILD_ID=123456789012345678

# === Modelo (Obrigatório) ===
OPENROUTER_API_KEY=sk-or-v1-...
# OU
NOUS_API_KEY=...
# OU
OPENAI_API_KEY=...

# === MongoDB (Opcional - Sync Remoto) ===
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/nexus-memory

# === Honcho (Opcional - User Modeling) ===
HONCHO_API_KEY=...

# === Google Workspace (Opcional) ===
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/callback

# === Segurança ===
HERMES_ENCRYPTION_KEY=...  # Chave para encriptar dados sensíveis
HERMES_LOG_LEVEL=info      # debug, info, warn, error

# === Performance ===
HERMES_CACHE_TTL=3600      # TTL do cache em segundos
HERMES_MAX_WORKERS=5       # Máximo de subagents paralelos
```

## Segurança

⚠️ **NUNCA** commite o arquivo `.env` no git.

O arquivo `.gitignore` deve conter:
```
.env
*.env
.env.*
```
```

- [ ] **Step 2: Criar documentação de MCPs**

```markdown
# Configuração de MCP Servers

## Visão Geral

O Hermes suporta MCP servers via `config.yaml`. Cada MCP server é definido com:
- `command`: Comando para iniciar o servidor
- `args`: Argumentos do comando
- `env`: Variáveis de ambiente para o processo
- `tools`: Lista de tools disponíveis

## Job Apply MCP

### Configuração

```yaml
mcp_servers:
  job-apply:
    command: python3
    args:
      - -m
      - src.job_apply_agent
    env:
      PYTHONPATH: /home/novais-kr/Documentos/repos/nexus-7-agent
      PATH: /usr/local/bin:/usr/bin:/bin
    tools:
      - job_search
      - job_analyze
      - job_consolidate
      - job_kb
      - job_adapt
      - job_apply
      - job_track
      - job_check_duplicate
```

### Tools Disponíveis

| Tool | Descrição | Parâmetros |
|------|-----------|------------|
| `job_search` | Busca vagas | `query`, `location`, `filters` |
| `job_analyze` | Analisa compatibilidade | `job_id` |
| `job_consolidate` | Consolida currículos | `pdf_paths`, `output_dir` |
| `job_kb` | Gera Knowledge Base | `file_paths`, `output_dir` |
| `job_adapt` | Gera currículo adaptado | `job_id` |
| `job_apply` | Executa aplicação | `job_id`, `batch_threshold` |
| `job_track` | Gerencia candidaturas | `action`, `job_id`, `status` |
| `job_check_duplicate` | Verifica duplicatas | `company`, `title` |

## Google Workspace MCP

### Configuração

```yaml
mcp_servers:
  google-workspace:
    command: node
    args:
      - .opencode/mcp/google-workspace/server.mjs
    env:
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
      GOOGLE_REDIRECT_URI: ${GOOGLE_REDIRECT_URI}
    tools:
      - google_drive
      - google_docs
      - google_sheets
      - google_gmail
```

### Autenticação OAuth 2.0

1. Execute o servidor MCP
2. Acesse `http://localhost:3000/auth` no navegador
3. Autorize o acesso ao Google
4. O token será salvo automaticamente

## Nexus Memory (Substituído)

O `nexus-memory-server.ts` do Nexus é **substituído** pelo Hermes memory built-in. Não é necessário configurar MCP server separado.

## Troubleshooting

| Problema | Causa | Solução |
|----------|-------|---------|
| MCP server não inicia | Dependência faltando | `pip install -r requirements.txt` |
| Tools não aparecem | Configuração incorreta | Verificar `config.yaml` |
| Erro de autenticação | Token expirado | Renovar token OAuth |
| Timeout | Modelo lento | Aumentar timeout ou trocar modelo |
```

- [ ] **Step 3: Commit**

```bash
git add docs/configuration/03-environment-variables.md docs/configuration/04-mcp-servers.md
git commit -m "docs: add environment variables and MCP server configuration"
```

---

## Fase 4: Migration Guide

> **Justificativa:** Guia de migração é o documento mais crítico — deve ser claro e completo.

### Task 13: Guia de Migração Completo

**Arquivos:**
- Criar: `docs/migration/README.md`
- Criar: `docs/migration/01-prerequisites.md`
- Criar: `docs/migration/02-migration-guide.md`

- [ ] **Step 1: Criar README da migração**

```markdown
 # Guia de Migração: Nexus 7 Agent → Hermes Agent

## Documentos

| Documento | Descrição |
|-----------|-----------|
| [01-prerequisites](01-prerequisites.md) | Pré-requisitos e setup inicial |
| [02-migration-guide](02-migration-guide.md) | Guia passo a passo |
| [03-troubleshooting](03-troubleshooting.md) | Solução de problemas |
| [04-rollback-plan](04-rollback-plan.md) | Plano de rollback |

## Visão Geral da Migração

```mermaid
gantt
    title Timeline da Migração
    dateFormat  YYYY-MM-DD
    section Fase 1
    Core Infrastructure    :a1, 2026-06-20, 3d
    section Fase 2
    MCP Bridge            :a2, after a1, 2d
    section Fase 3
    Skills Translation    :a3, after a2, 3d
    section Fase 4
    Pipeline Workflow     :a4, after a3, 2d
    section Fase 5
    Discord Integration   :a5, after a4, 3d
```

## Checklist de Migração

- [ ] Pré-requisitos instalados
- [ ] Backup do Nexus criado
- [ ] Hermes Agent instalado
- [ ] Bot Discord configurado
- [ ] Plugins migrados
- [ ] MCPs migrados
- [ ] Skills migradas
- [ ] Agentes migrados
- [ ] Comandos Discord configurados
- [ ] Memória migrada
- [ ] Testes de validação passando
- [ ] Rollback testado
```

- [ ] **Step 2: Criar pré-requisitos**

```markdown
# Pré-requisitos

## Software Necessário

| Software | Versão Mínima | Como Verificar |
|----------|---------------|----------------|
| Python | 3.11+ | `python3 --version` |
| Node.js | 18+ | `node --version` |
| Hermes Agent | 0.15+ | `hermes --version` |
| Git | 2.0+ | `git --version` |
| MongoDB | 6.0+ (opcional) | `mongod --version` |

## Instalação do Hermes Agent

```bash
# Via pip
pip install hermes-agent

# OU via poetry
poetry add hermes-agent

# Verificar instalação
hermes --version
```

## Configuração Inicial

```bash
# Criar diretório de configuração
mkdir -p ~/.hermes

# Criar config.yaml mínimo
cat > ~/.hermes/config.yaml << 'EOF'
model:
  provider: openrouter
  name: deepseek/deepseek-chat
  api_key: ${OPENROUTER_API_KEY}

discord:
  token: ${DISCORD_BOT_TOKEN}
  allowed_guilds:
    - ${DISCORD_GUILD_ID}
EOF

# Criar .env
cat > ~/.hermes/.env << 'EOF'
DISCORD_BOT_TOKEN=seu_token_aqui
DISCORD_GUILD_ID=seu_guild_id_aqui
OPENROUTER_API_KEY=sua_chave_aqui
EOF
```

## Backup do Nexus

**ANTES de qualquer migração, faça backup completo:**

```bash
# Backup do diretório .opencode
cp -r .opencode .opencode.backup.$(date +%Y%m%d)

# Backup do banco SQLite
cp .opencode/memory/*.db .opencode/memory/*.db.backup

# Backup dos handoffs
cp -r .opencode/memory/handoffs .opencode/memory/handoffs.backup

# Backup dos logs
cp -r .opencode/logs .opencode/logs.backup
```

## Validação do Backup

```bash
# Verificar arquivos copiados
ls -la .opencode.backup.*

# Verificar integridade do SQLite
sqlite3 .opencode/memory/*.db.backup "PRAGMA integrity_check;"

# Verificar handoffs
ls -la .opencode/memory/handoffs.backup/
```
```

- [ ] **Step 3: Criar guia de migração passo a passo**

```markdown
# Guia de Migração Passo a Passo

## Visão Geral

A migração é dividida em 5 fases:

1. **Core Infrastructure** — Plugins e memória
2. **MCP Bridge** — Servidores MCP
3. **Skills Translation** — Conversão de skills
4. **Pipeline Workflow** — Agentes e comandos
5. **Discord Integration** — Bot e interface

## Fase 1: Core Infrastructure

### 1.1 Migrar Plugins

**Nexus:**
```
.opencode/plugins/
├── nexus-plugin.ts
├── metrics-collector.ts
├── cache-manager.ts
└── context-manager.ts
```

**Hermes:** Plugins built-in (não precisa migrar)

**Ação:**
```bash
# Verificar se plugins do Hermes estão habilitados
hermes config get plugins

# Habilitar se necessário
hermes config set plugins.enabled '["logging", "metrics", "cache"]'
```

### 1.2 Migrar Memória

**Nexus:**
```
.opencode/memory/
├── memories.db (SQLite + FTS5)
└── handoffs/
    ├── handoff-*.json
```

**Hermes:** Memória built-in

**Ação:**
```bash
# Criar script de migração
cat > migrate-memory.py << 'EOF'
import sqlite3
import json
import os
from pathlib import Path

# Conectar ao SQLite do Nexus
nexus_db = sqlite3.connect('.opencode/memory/memories.db')
nexus_cursor = nexus_db.cursor()

# Criar banco do Hermes
hermes_db = sqlite3.connect(os.path.expanduser('~/.hermes/memory.db'))
hermes_cursor = hermes_db.cursor()

# Criar tabela de memórias
hermes_cursor.execute('''
    CREATE TABLE IF NOT EXISTS memories (
        key TEXT PRIMARY KEY,
        value TEXT,
        scope TEXT,
        created_at TIMESTAMP,
        updated_at TIMESTAMP
    )
''')

# Migrar dados
nexus_cursor.execute('SELECT key, value, scope, created_at, updated_at FROM memories')
rows = nexus_cursor.fetchall()

for row in rows:
    hermes_cursor.execute(
        'INSERT OR REPLACE INTO memories (key, value, scope, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        row
    )

hermes_db.commit()
print(f"Migradas {len(rows)} memórias")

# Migrar handoffs
handoffs_dir = Path('.opencode/memory/handoffs')
if handoffs_dir.exists():
    for handoff_file in handoffs_dir.glob('*.json'):
        with open(handoff_file) as f:
            handoff = json.load(f)
        # Salvar no Hermes
        hermes_cursor.execute(
            'INSERT OR REPLACE INTO memories (key, value, scope) VALUES (?, ?, ?)',
            (f"handoff:{handoff['id']}", json.dumps(handoff), 'project')
        )
    hermes_db.commit()
    print(f"Migrados {len(list(handoffs_dir.glob('*.json')))} handoffs")

nexus_db.close()
hermes_db.close()
EOF

# Executar migração
python3 migrate-memory.py
```

### 1.3 Configurar Deploy

```bash
# Criar serviço systemd
cat > /etc/systemd/system/hermes.service << 'EOF'
[Unit]
Description=Hermes Agent
After=network.target

[Service]
Type=simple
User=novais-kr
WorkingDirectory=/home/novais-kr/Documentos/repos/nexus-7-agent
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/local/bin/hermes start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Habilitar e iniciar
sudo systemctl enable hermes
sudo systemctl start hermes
```

## Fase 2: MCP Bridge

### 2.1 Job Apply MCP

**Nexus:** `.opencode/mcp/job-apply-mcp.ts`

**Hermes:** Configuração em `config.yaml`

**Ação:**
```yaml
# Adicionar ao ~/.hermes/config.yaml
mcp_servers:
  job-apply:
    command: python3
    args:
      - -m
      - src.job_apply_agent
    env:
      PYTHONPATH: /home/novais-kr/Documentos/repos/nexus-7-agent
```

### 2.2 Google Workspace MCP

**Nexus:** `.opencode/mcp/google-workspace/`

**Hermes:** Configuração em `config.yaml`

**Ação:**
```yaml
# Adicionar ao ~/.hermes/config.yaml
mcp_servers:
  google-workspace:
    command: node
    args:
      - .opencode/mcp/google-workspace/server.mjs
    env:
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
```

### 2.3 Nexus Memory Server (Eliminado)

**Nexus:** `.opencode/mcp/nexus-memory-server.ts`

**Hermes:** Memória built-in

**Ação:** Nenhuma — removido automaticamente.

## Fase 3: Skills Translation

### 3.1 Mapeamento de Skills

| Skill Nexus | Ação | Skill Hermes |
|-------------|------|--------------|
| `harness-workflow` | Reescrever | `harness-workflow` |
| `mem-search` | Eliminar | Built-in |
| `agent-creator` | Adaptar | `agent-creator` |
| `cbm-agent` | Reescrever | `cbm-agent` |
| `project-review` | Reescrever | `project-review` |

### 3.2 Converter Skills

Para cada skill, converter do formato OpenCode para agentskills.io:

```bash
# Criar diretório de skills do Hermes
mkdir -p ~/.hermes/skills

# Para cada skill, criar SKILL.md no formato agentskills.io
# Exemplo: harness-workflow
mkdir -p ~/.hermes/skills/harness-workflow
cat > ~/.hermes/skills/harness-workflow/SKILL.md << 'EOF'
# Harness Workflow

## Description
Pipeline de 6 estágios para orquestração de tarefas.

## Usage
Use this skill when executing complex tasks that need the full pipeline:
SPEC → PLAN → ANALYZE → BUILD → REVIEW → DOCUMENT

## Instructions
1. Start with SPEC stage
2. Validate spec before moving to PLAN
3. Execute each stage sequentially
4. Save handoff between stages
5. Generate documentation in DOCUMENT stage
EOF
```

## Fase 4: Pipeline Workflow

### 4.1 Migrar Agentes

**Nexus:** `.opencode/agents/*.md`

**Hermes:** Configuração em `config.yaml` ou arquivos de agente

**Ação:**
```yaml
# Adicionar ao ~/.hermes/config.yaml
agents:
  primary: orchestrator
  subagents:
    - name: security-auditor
      description: Auditoria de segurança
    - name: qa-analyst
      description: Testes e qualidade
    - name: docs-architect
      description: Documentação técnica
    - name: cbm-agent
      description: Code intelligence
    - name: job-apply-agent
      description: Pipeline de candidaturas
```

### 4.2 Configurar Comandos Discord

```yaml
# Adicionar ao ~/.hermes/config.yaml
commands:
  super-pipeline:
    description: Pipeline completo de 6 estágios
    parameters:
      feature:
        type: string
        required: true
        description: Nome da feature
      model:
        type: string
        required: false
        description: Modelo a usar
  spec-gen:
    description: Gera spec formal
    parameters:
      name:
        type: string
        required: true
```

## Fase 5: Discord Integration

### 5.1 Configurar Bot

Seguir o guia em `docs/configuration/02-discord-bot-setup.md`.

### 5.2 Testar Integração

```bash
# Iniciar Hermes
hermes start

# No Discord, testar comandos
/help
/super-pipeline --feature "test"
/memory --action list
```

### 5.3 Validar Funcionalidade

```bash
# Executar testes de validação
hermes test --suite discord
hermes test --suite memory
hermes test --suite skills
```
```

- [ ] **Step 4: Commit**

```bash
git add docs/migration/README.md docs/migration/01-prerequisites.md docs/migration/02-migration-guide.md
git commit -m "docs: add complete migration guide with step-by-step instructions"
```

---

### Task 14: Troubleshooting e Rollback

**Arquivos:**
- Criar: `docs/migration/03-troubleshooting.md`
- Criar: `docs/migration/04-rollback-plan.md`

- [ ] **Step 1: Criar guia de troubleshooting**

```markdown
# Solução de Problemas

## Problemas Comuns

### Bot Discord não responde

**Sintoma:** Bot online mas não responde a comandos

**Causas possíveis:**
1. Token inválido
2. Message Content Intent desabilitado
3. Permissões insuficientes

**Solução:**
```bash
# Verificar token
hermes config get discord.token

# Verificar permissões no Developer Portal
# → Bot → Privileged Gateway Intents → Message Content Intent ✅

# Verificar permissões no servidor
# → Configurações do servidor → Roles → Bot role → Permissões
```

### Slash commands não aparecem

**Sintoma:** Comandos `/` não listam comandos do bot

**Causas possíveis:**
1. Bot não foi convidado com permissão de slash commands
2. Comandos não foram registrados

**Solução:**
```bash
# Registrar comandos
hermes commands register

# OU reconvidar bot com permissões corretas
```

### Erro "Missing Intent"

**Sintoma:** `discord.errors.PrivilegedIntentsRequired`

**Solução:**
1. Acesse Discord Developer Portal
2. Bot → Privileged Gateway Intents
3. Habilite: Message Content Intent, Server Members Intent

### MCP server não conecta

**Sintoma:** Tools MCP não disponíveis

**Causas possíveis:**
1. Comando incorreto no config.yaml
2. Dependências faltando
3. Porta em uso

**Solução:**
```bash
# Testar MCP server manualmente
python3 -m src.job_apply_agent --help

# Verificar dependências
pip install -r requirements.txt

# Verificar portas
lsof -i :3000
```

### Memória não persiste

**Sintoma:** Handoffs perdidos entre sessões

**Causas possíveis:**
1. Banco SQLite corrompido
2. Permissão de escrita negada
3. MongoDB sync falhando

**Solução:**
```bash
# Verificar integridade do banco
sqlite3 ~/.hermes/memory.db "PRAGMA integrity_check;"

# Verificar permissões
ls -la ~/.hermes/memory.db

# Verificar logs de sync
tail -f ~/.hermes/logs/hermes.log | grep mongodb
```

### Pipeline falha no Discord

**Sintoma:** `/super-pipeline` retorna erro

**Causas possíveis:**
1. Modelo não configurado
2. Timeout
3. Erro em subagent

**Solução:**
```bash
# Verificar configuração do modelo
hermes config get model

# Aumentar timeout
hermes config set performance.response_timeout 60s

# Verificar logs
tail -f ~/.hermes/logs/hermes.log
```

## Logs de Debug

```bash
# Habilitar logs detalhados
hermes config set logging.level debug

# Verificar logs em tempo real
tail -f ~/.hermes/logs/hermes.log

# Filtrar por componente
tail -f ~/.hermes/logs/hermes.log | grep -E "(discord|memory|mcp)"
```

## Contato

Para problemas não documentados, abra uma issue no repositório com:
1. Descrição do problema
2. Passos para reproduzir
3. Logs relevantes
4. Versão do Hermes
5. Versão do Python/Node.js
```

- [ ] **Step 2: Criar plano de rollback**

```markdown
# Plano de Rollback

## Objetivo
Permitir reverter para o Nexus 7 Agent original em caso de falha crítica na migração.

## Pré-requisitos
- Backup completo criado (ver `01-prerequisites.md`)
- Nexus original funcional antes da migração

## Rollback Parcial (Componentes Específicos)

### Rollback de Skills

```bash
# Restaurar skills do backup
cp -r .opencode.backup.*/skills/* .opencode/skills/

# Reiniciar OpenCode
opencode restart
```

### Rollback de Memória

```bash
# Restaurar banco SQLite
cp .opencode.backup.*/memory/memories.db .opencode/memory/memories.db

# Restaurar handoffs
cp -r .opencode.backup.*/memory/handoffs/* .opencode/memory/handoffs/
```

### Rollback de MCPs

```bash
# Restaurar MCP servers
cp -r .opencode.backup.*/mcp/* .opencode/mcp/

# Reinstalar dependências
cd .opencode/mcp/job-apply-mcp && npm install
```

## Rollback Completo

### Passo 1: Parar Hermes

```bash
# Parar serviço
sudo systemctl stop hermes

# OU parar processo manualmente
pkill -f "hermes start"
```

### Passo 2: Restaurar Nexus

```bash
# Restaurar todo o diretório .opencode
rm -rf .opencode
cp -r .opencode.backup.* .opencode

# Restaurar configurações
cp .env.backup .env 2>/dev/null || true
```

### Passo 3: Reiniciar Nexus

```bash
# Reiniciar OpenCode
opencode restart

# Verificar funcionamento
opencode status
```

### Passo 4: Validar

```bash
# Testar comandos básicos
/memory --action list
/super-pipeline --feature "test"

# Verificar logs
tail -f .opencode/logs/*.log
```

## Rollback de Dados

### Mongoose/MongoDB

```bash
# Restaurar collection do MongoDB
mongorestore --db=nexus-memory --collection=handoffs backup/
```

### SQLite

```bash
# Restaurar banco SQLite
sqlite3 .opencode/memory/memories.db < backup.sql
```

## Tempo Estimado de Rollback

| Tipo | Tempo |
|------|-------|
| Rollback parcial (skills) | 5 min |
| Rollback parcial (memória) | 10 min |
| Rollback completo | 20-30 min |
| Rollback de dados | 15 min |

## Validação Pós-Rollback

- [ ] Nexus original inicia corretamente
- [ ] Comandos `/super-pipeline` funcionam
- [ ] Memória está acessível
- [ ] MCPs estão conectados
- [ ] Logs sem erros

## Contato

Se o rollback falhar:
1. Verifique os logs em `.opencode/logs/`
2. Restaure do backup mais recente
3. Abra issue com detalhes do erro
```

- [ ] **Step 3: Commit**

```bash
git add docs/migration/03-troubleshooting.md docs/migration/04-rollback-plan.md
git commit -m "docs: add troubleshooting guide and rollback plan"
```

---

## Fase 5: User Guide

> **Justificativa:** Guia do usuário é o documento mais consultado após a migração.

### Task 15: Guia do Usuário

**Arquivos:**
- Criar: `docs/user-guide/README.md`
- Criar: `docs/user-guide/01-getting-started.md`
- Criar: `docs/user-guide/02-slash-commands.md`
- Criar: `docs/user-guide/03-workflows.md`
- Criar: `docs/user-guide/04-examples.md`
- Criar: `docs/user-guide/05-faq.md`

- [ ] **Step 1: Criar getting started**

```markdown
# Primeiros Passos

## Instalação

```bash
# Instalar Hermes Agent
pip install hermes-agent

# Verificar instalação
hermes --version
```

## Configuração

1. Crie `~/.hermes/config.yaml` com sua configuração
2. Crie `~/.hermes/.env` com suas credenciais
3. Configure o bot Discord (ver `docs/configuration/02-discord-bot-setup.md`)

## Primeiro Uso

1. Inicie o Hermes:
   ```bash
   hermes start
   ```

2. No Discord, digite:
   ```
   /help
   ```

3. O bot responderá com a lista de comandos disponíveis

## Comandos Básicos

| Comando | Descrição | Exemplo |
|---------|-----------|---------|
| `/help` | Lista de comandos | `/help` |
| `/super-pipeline` | Executa pipeline completo | `/super-pipeline feature:"auth"` |
| `/memory` | Gerencia memória | `/memory action:list` |
| `/status` | Status do sistema | `/status` |
```

- [ ] **Step 2: Criar documentação de slash commands**

```markdown
# Comandos Slash do Discord

## Referência de Comandos

### Pipeline e Specs

| Comando | Descrição | Parâmetros |
|---------|-----------|------------|
| `/super-pipeline` | Pipeline completo de 6 estágios | `feature` (obrigatório), `model` (opcional) |
| `/spec-gen` | Gera spec formal | `name` (obrigatório), `template` (opcional) |
| `/spec-review` | Revisa spec existente | `spec-id` (obrigatório) |
| `/plan` | Planeja feature | `feature` (obrigatório) |

### Agentes

| Comando | Descrição | Parâmetros |
|---------|-----------|------------|
| `/security` | Auditoria de segurança | `scope` (opcional) |
| `/qa` | Testes e qualidade | `scope` (opcional) |
| `/docs` | Gera documentação | `type` (opcional) |
| `/criar-agente` | Cria novo agente | `name`, `description` |

### Memória e Contexto

| Comando | Descrição | Parâmetros |
|---------|-----------|------------|
| `/memory` | Gerencia memória | `action` (save/load/list/search), `key`, `value` |
| `/cbm-query` | Consulta knowledge graph | `query` (obrigatório), `type` (opcional) |

### Google Workspace

| Comando | Descrição | Parâmetros |
|---------|-----------|------------|
| `/gw` | Operações Google Workspace | `action`, `target` |

### Automação

| Comando | Descrição | Parâmetros |
|---------|-----------|------------|
| `/playwright` | Automação de navegador | `action`, `url` |
| `/devtools` | Debugging frontend | `action`, `url` |

### Job Application

| Comando | Descrição | Parâmetros |
|---------|-----------|------------|
| `/job-search` | Busca vagas | `query`, `location` |
| `/job-analyze` | Analisa compatibilidade | `job-id` |
| `/job-consolidate` | Consolida currículos | `pdf-paths` |
| `/job-adapt` | Gera currículo adaptado | `job-id` |
| `/job-apply` | Executa aplicação | `job-id` |
| `/job-track` | Atualiza status | `action`, `job-id`, `status` |
| `/job-kb` | Gera Knowledge Base | `file-paths` |

## Exemplos de Uso

### Executar Pipeline Completo

```
/super-pipeline feature:"sistema de autenticação" model:"deepseek/deepseek-chat"
```

### Buscar Vagas

```
/job-search query:"engenheiro de software" location:"São Paulo"
```

### Gerenciar Memória

```
/memory action:save key:"decisao-arquitetura" value:"Usar FTS5 para busca"
```

### Criar Agente

```
/criar-agente name:"code-reviewer" description:"Especialista em revisão de código"
```
```

- [ ] **Step 3: Criar workflows, exemplos e FAQ**

```markdown
# Workflows Comuns

## Workflow: Feature Completa

1. `/super-pipeline feature:"nome-da-feature"`
2. Obot cria thread automaticamente
3. Pipeline executa: SPEC → PLAN → ANALYZE → BUILD → REVIEW → DOCUMENT
4. Resultado é postado na thread com kanban board

## Workflow: Auditoria de Segurança

1. `/security scope:"src/"`
2. Agente analisa código
3. Gera relatório com vulnerabilidades
4. Salva em memória para referência futura

## Workflow: Busca e Aplicação de Vagas

1. `/job-search query:"dev python" location:"remoto"`
2. `/job-analyze job-id:"123"`
3. `/job-adapt job-id:"123"`
4. `/job-apply job-id:"123"`

---

# Exemplos e Casos de Uso

## Caso 1: Desenvolvimento de Feature

**Usuário:** `/super-pipeline feature:"sistema de pagamento"`

**Resultado:**
- Bot cria thread "sistema-de-pagamento"
- Executa SPEC: Gera especificação formal
- Executa PLAN: Cria plano de implementação
- Executa ANALYZE: Analisa dependências
- Executa BUILD: Implementa código
- Executa REVIEW: Revisa qualidade
- Executa DOCUMENT: Gera documentação
- Posta kanban board com status

## Caso 2: Auditoria

**Usuário:** `/security scope:"src/api/"`

**Resultado:**
- Agente analisa código em `src/api/`
- Identifica vulnerabilidades
- Gera relatório detalhado
- Salva em memória

## Caso 3: Gerenciamento de Memória

**Usuário:** `/memory action:search query:"pagamento"`

**Resultado:**
- Busca em memória por "pagamento"
- Retorna: sessões anteriores, handoffs, observações
- Formata em embed do Discord

---

# Perguntas Frequentes

## Geral

**P: O que é o Hermes Agent?**
R: Hermes Agent é um framework de agentes de IA com suporte a múltiplas plataformas (Discord, Telegram, Slack, etc.), memória built-in e sistema de skills padronizado.

**P: Preciso manter o Nexus funcionando?**
R: Não. Após a migração completa, o Nexus pode ser desativado. Mas recomendamos manter backup por 30 dias.

**P: Meus dados estão seguros?**
R: Sim. Todos os dados são preservados durante a migração. Faça backup antes de iniciar.

## Discord

**P: O bot responde em canais privados?**
R: Sim, configure `allowed_channels` no config.yaml ou deixe vazio para todos os canais.

**P: Posso usar em múltiplos servidores?**
R: Sim, configure `allowed_guilds` com os IDs dos servidores.

**P: Como criar threads automaticamente?**
R: Configure `threads.auto_create: true` no config.yaml.

## Memória

**P: Meus handoffs antigos funcionam?**
R: Sim, são migrados automaticamente.

**P: Posso buscar memória antiga?**
R: Sim, use `/memory action:search query:"termo"`.

## MCPs

**P: Meus MCPs continuam funcionando?**
R: Sim, são reconfigurados no config.yaml do Hermes.

**P: Preciso reinstalar dependências?**
R: Não, os MCPs usam as mesmas dependências do Nexus.
```

- [ ] **Step 4: Commit**

```bash
git add docs/user-guide/
git commit -m "docs: add complete user guide with commands, workflows, examples, FAQ"
```

---

## Fase 6: Developer Guide

> **Justificativa:** Guia do desenvolvedor permite extensão do sistema após migração.

### Task 16: Guia do Desenvolvedor

**Arquivos:**
- Criar: `docs/developer-guide/README.md`
- Criar: `docs/developer-guide/01-adding-skills.md`
- Criar: `docs/developer-guide/02-creating-agents.md`
- Criar: `docs/developer-guide/03-mcp-development.md`
- Criar: `docs/developer-guide/04-plugin-development.md`
- Criar: `docs/developer-guide/05-testing.md`

- [ ] **Step 1: Criar guia de skills**

```markdown
# Como Adicionar Skills

## Formato agentskills.io

Skills no Hermes seguem o padrão agentskills.io:

```
~/.hermes/skills/
└── minha-skill/
    ├── SKILL.md          # Documentação da skill
    ├── README.md         # Instruções detalhadas
    └── scripts/          # Scripts auxiliares (opcional)
```

## Estrutura do SKILL.md

```markdown
# Nome da Skill

## Description
Descrição curta do que a skill faz.

## Usage
Quando usar esta skill.

## Instructions
Instruções detalhadas para o agente.

## Examples
Exemplos de uso.
```

## Criando uma Skill

1. Crie o diretório:
   ```bash
   mkdir -p ~/.hermes/skills/minha-skill
   ```

2. Crie o `SKILL.md`:
   ```bash
   cat > ~/.hermes/skills/minha-skill/SKILL.md << 'EOF'
   # Minha Skill

   ## Description
   Esta skill faz X.

   ## Usage
   Use quando o usuário pedir Y.

   ## Instructions
   1. Primeiro passo
   2. Segundo passo
   3. Terceiro passo
   EOF
   ```

3. Teste a skill:
   ```bash
   hermes skills list
   hermes skills test minha-skill
   ```

## Registrando no Hub

Para compartilhar sua skill:

1. Crie um repositório GitHub
2. Adicione o manifesto `skill.json`:
   ```json
   {
     "name": "minha-skill",
     "version": "1.0.0",
     "description": "Descrição da skill",
     "author": "Seu Nome",
     "tags": ["tag1", "tag2"]
   }
   ```

3. Registre no agentskills.io
```

- [ ] **Step 2: Criar guia de agentes**

```markdown
# Como Criar Agentes

## Tipos de Agente

| Tipo | Descrição | Uso |
|------|-----------|-----|
| Primary | Agente principal | Orchestrator |
| Subagent | Agente delegado | Tarefas específicas |

## Criando um Subagent

1. Crie o arquivo de definição:
   ```bash
   cat > ~/.hermes/agents/meu-agente.yaml << 'EOF'
   name: meu-agente
   description: Descrição do agente
   type: subagent
   model: deepseek/deepseek-chat
   skills:
     - skill1
     - skill2
   tools:
     - tool1
     - tool2
   instructions: |
     Você é um especialista em X.
     Sua tarefa é Y.
     Sempre faça Z.
   EOF
   ```

2. Registre o agente:
   ```bash
   hermes agents register meu-agente
   ```

3. Teste:
   ```bash
   hermes agents test meu-agente
   ```

## Usando Subagents

No Discord:
```
/criar-agente name:"meu-agente" description:"Faz X"
```

Em código:
```python
from hermes import Agent

agent = Agent(name="meu-agente")
result = agent.run("Tarefa aqui")
```
```

- [ ] **Step 3: Criar guias de MCP, plugins e testes**

```markdown
# Desenvolvimento de MCPs

## Estrutura de um MCP Server

```
meu-mcp/
├── server.ts        # Servidor principal
├── tools/           # Definições de tools
├── package.json     # Dependências
└── tsconfig.json    # Configuração TypeScript
```

## Criando um MCP Server

1. Crie o servidor:
   ```typescript
   // meu-mcp/server.ts
   import { MCPServer } from 'hermes-mcp';

   const server = new MCPServer({
     name: 'meu-mcp',
     version: '1.0.0',
   });

   server.tool('minha-tool', {
     description: 'Faz algo',
     parameters: {
       input: { type: 'string', description: 'Input' }
     },
     handler: async ({ input }) => {
       return { result: `Processado: ${input}` };
     }
   });

   server.start();
   ```

2. Configure no `config.yaml`:
   ```yaml
   mcp_servers:
     meu-mcp:
       command: node
       args: [meu-mcp/server.ts]
   ```

---

# Desenvolvimento de Plugins

## Estrutura de um Plugin

```
meu-plugin/
├── plugin.py        # Plugin principal
├── hooks/           # Hooks de ciclo de vida
├── tools/           # Tools customizadas
└── requirements.txt # Dependências
```

## Criando um Plugin

```python
# meu-plugin/plugin.py
from hermes import Plugin

class MeuPlugin(Plugin):
    name = "meu-plugin"
    version = "1.0.0"

    def on_message(self, message):
        # Processar mensagem
        pass

    def on_command(self, command):
        # Processar comando
        pass

    def on_response(self, response):
        # Processar resposta
        pass
```

---

# Guia de Testes

## Tipos de Teste

| Tipo | Ferramenta | Comando |
|------|------------|---------|
| Unidade | pytest | `pytest tests/` |
| Integração | hermes test | `hermes test --suite integration` |
| E2E | hermes test | `hermes test --suite e2e` |
| Discord | hermes test | `hermes test --suite discord` |

## Executando Testes

```bash
# Todos os testes
hermes test

# Suite específica
hermes test --suite unit
hermes test --suite integration
hermes test --suite discord

# Com verbose
hermes test -v

# Com coverage
hermes test --coverage
```

## Criando Testes

```python
# tests/test_minha_feature.py
import pytest
from hermes import Agent

def test_minha_feature():
    agent = Agent(name="test-agent")
    result = agent.run("Teste")
    assert result.success == True
    assert "esperado" in result.output
```
```

- [ ] **Step 4: Commit**

```bash
git add docs/developer-guide/
git commit -m "docs: add complete developer guide for skills, agents, MCPs, plugins, testing"
```

---

## Fase 7: API Documentation

> **Justificativa:** API docs são essenciais para integração e automação.

### Task 17: Documentação de API

**Arquivos:**
- Criar: `docs/api/README.md`
- Criar: `docs/api/01-hermes-api.md`
- Criar: `docs/api/02-discord-api.md`
- Criar: `docs/api/03-migration-endpoints.md`

- [ ] **Step 1: Criar documentação de API**

```markdown
# Referência de API

## Visão Geral

O Hermes Agent expõe APIs para:
1. **Hermes Core API** — Interação com o agente
2. **Discord API** — Endpoints do bot Discord
3. **Migration API** — Endpoints para migração de dados

---

## Hermes Core API

### Base URL
`http://localhost:8080/api/v1`

### Autenticação
```bash
Authorization: Bearer <token>
```

### Endpoints

#### Agents

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/agents` | Lista agentes |
| GET | `/agents/:id` | Detalhes do agente |
| POST | `/agents/:id/run` | Executa agente |

#### Memory

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/memory` | Lista memórias |
| POST | `/memory` | Salva memória |
| GET | `/memory/search` | Busca memórias |
| DELETE | `/memory/:key` | Deleta memória |

#### Skills

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/skills` | Lista skills |
| POST | `/skills/install` | Instala skill |
| DELETE | `/skills/:name` | Remove skill |

#### MCP

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/mcp/servers` | Lista MCP servers |
| POST | `/mcp/servers/:name/test` | Testa MCP server |

---

## Discord API

### Endpoints do Bot

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/discord/status` | GET | Status do bot |
| `/discord/guilds` | GET | Servidores conectados |
| `/discord/channels` | GET | Canais disponíveis |
| `/discord/commands` | GET | Comandos registrados |

### Webhooks

```json
{
  "event": "message",
  "data": {
    "guild_id": "123",
    "channel_id": "456",
    "author": "user_id",
    "content": " mensagem"
  }
}
```

---

## Migration API

### Endpoints de Migração

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/migration/start` | Inicia migração |
| GET | `/migration/status` | Status da migração |
| POST | `/migration/rollback` | Rollback |
| GET | `/migration/backup` | Lista backups |

### Exemplo de Uso

```bash
# Iniciar migração
curl -X POST http://localhost:8080/api/v1/migration/start \
  -H "Authorization: Bearer <token>" \
  -d '{"source": "nexus", "target": "hermes"}'

# Verificar status
curl http://localhost:8080/api/v1/migration/status \
  -H "Authorization: Bearer <token>"

# Rollback
curl -X POST http://localhost:8080/api/v1/migration/rollback \
  -H "Authorization: Bearer <token>"
```
```

- [ ] **Step 2: Commit**

```bash
git add docs/api/
git commit -m "docs: add API documentation for Hermes, Discord, and migration"
```

---

## Resumo de Entregas

### Documentos por Fase

| Fase | Documentos | Tarefas |
|------|------------|---------|
| **1. ADRs** | 5 arquivos | Tasks 1-5 |
| **2. Architecture** | 7 arquivos | Tasks 6-9 |
| **3. Configuration** | 5 arquivos | Tasks 10-12 |
| **4. Migration Guide** | 5 arquivos | Tasks 13-14 |
| **5. User Guide** | 6 arquivos | Tasks 15 |
| **6. Developer Guide** | 6 arquivos | Tasks 16 |
| **7. API Documentation** | 4 arquivos | Task 17 |
| **Total** | **38 arquivos** | **17 Tasks** |

### Timeline Estimada

| Fase | Duração | Dependências |
|------|---------|--------------|
| Fase 1: ADRs | 1 dia | Nenhuma |
| Fase 2: Architecture | 2 dias | Fase 1 |
| Fase 3: Configuration | 1 dia | Fase 2 |
| Fase 4: Migration Guide | 2 dias | Fase 2, 3 |
| Fase 5: User Guide | 2 dias | Fase 3 |
| Fase 6: Developer Guide | 2 dias | Fase 2 |
| Fase 7: API Documentation | 1 dia | Fase 2 |
| **Total** | **~11 dias** | — |

### Formatos de Saída

| Formato | Uso |
|---------|-----|
| **Markdown** | Todos os documentos |
| **Mermaid** | Diagramas de arquitetura e fluxo |
| **JSON** | Exemplos de configuração e API |
| **YAML** | Configuração Hermes |
| **Bash** | Scripts de migração e setup |

### Público-Alvo por Documento

| Documento | Público |
|-----------|---------|
| Migration Guide | DevOps, Administradores |
| Architecture | Desenvolvedores, Arquitetos |
| Configuration | Administradores, DevOps |
| User Guide | Usuários finais |
| Developer Guide | Desenvolvedores |
| ADRs | Arquitetos, Tech Leads |
| API Documentation | Desenvolvedores, Integradores |

---

## Opções de Execução

**Plano completo e salvo em `docs/plans/hermes-discord-documentation-plan.md`.**

Duas opções de execução:

**1. Subagent-Driven (recomendado)** — Despacho um subagent fresco por task, revisão entre tasks, iteração rápida

**2. Execução Inline** — Executo as tasks nesta sessão usando executing-plans, execução em batch com checkpoints

**Qual abordagem?**
