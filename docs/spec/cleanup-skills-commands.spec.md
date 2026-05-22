---
title: "Cleanup de Skills e Commands — Remoção de Deprecados e Otimização"
status: "implemented"
author: "Nexus Orquestrador"
created: "2026-05-22"
updated: "2026-05-22"
version: "0.1.0"
---

# Cleanup de Skills e Commands

## Contexto

O ecossistema Nexus 7 Agent possui atualmente:

- **17 skills** em `.opencode/skills/` (não contando skills de plugins como superpowers; `job-apply-agent/` contém apenas commands/ sem SKILL.md)
- **15 comandos** em `.opencode/commands/`
- **6 comandos job-*** em `.opencode/skills/job-apply-agent/commands/`
- **12 agentes** em `.opencode/agents/` (mais 2 definidos apenas em opencode.json: councillor, observer)
- **5 custom tools** em `.opencode/tools/`
- **1 plugin** em `.opencode/plugins/`

Após análise inicial, foram identificados diversos problemas:

### Skills com Sobreposição (Overlap)
| Skill | Sobrepoe-se com | Observação |
|-------|----------------|------------|
| `harness-workflow` | `spec-driven-dev` | SDD está contido no harness-workflow |
| `documentation-architect` | `@docs-architect` agente | Skill duplica instruções do agente |
| `quality-assurance-analyst` | `@quality-assurance-analyst` agente | Idem |
| `cbm-agent` | `@cbm-agent` | Instruções de CLI duplicam agent |
| `commit-push` | `/commit-&-docs` comando | Comando já cobre o fluxo |
| `mem-search` | `nexus-memory` tool | Progressive disclosure pattern poderia estar na tool |
| `playwright-automation` | `@playwright-agent` | Skill vazia/alinhada ao agente |
| `chrome-devtools` | `@chrome-devtools-agent` | Idem |
| `notion-agent-copilot` | `@notion-agent` | Idem |
| `google-workspace` | `@google-workspace-agent` | Idem |
| `testsprite-mcp` | `@testsprite-mcp-agent` | Idem |
| `agent-creator` | `auto-discovery` | Auto-discovery delega para agent-creator |

### Skills Potencialmente Não-Usadas/Desalinhadas
- `react-components` — Referencia `@src/components/ui/` e `VISUAL_IDENTITY.md` que são de outro projeto (FinanceGuy)
- `project-review` — Skill genérica, pode ser substituída por chamada direta ao `@oracle`
- `prisma-scaffold` — Projeto Nexus não usa Prisma como stack principal
- `auto-discovery` — Skill pesada, não executada desde a criação

### Commands com Problemas
- `create-component.md` — Referencia shadcn/ui e projeto FinanceGuy, não pertence ao Nexus
- `review-doc.md` — Comando genérico, baixo valor; sobrepõe com `/docs`
- `pipeline.md` — Obsoleto vs `/super-pipeline` (que é a versão aprimorada)

### Agentes que não estão em uso claro
- `councillor` e `observer` — Definidos em `opencode.json` mas sem arquivos de agente e sem comandos associados

## Requisitos Funcionais

### REQ-001: Auditoria Completa de Skills
**Prioridade:** Alta

Auditar todas as 18 skills em `.opencode/skills/` (excluindo skills de plugins/superpowers) classificando cada uma como:
- **Manter** — Útil, sem overlap significativo
- **Mesclar** — Overlap com outra skill/agente, deve ser consolidado
- **Deprecar** — Não usada, desalinhada, ou substituída
- **Remover** — Definitivamente não necessária

**Critérios de Aceitação:**
- [ ] Auditoria documentada com justificativa para cada skill
- [ ] Classificação clara (Manter/Mesclar/Deprecar/Remover)
- [ ] Skills identificadas como "remover" justificadas
- [ ] Rastreamento de referências: qual comando/agente/skill referencia cada skill

### REQ-002: Auditoria Completa de Commands
**Prioridade:** Alta

Auditar todos os 15 comandos em `.opencode/commands/` mais os 6 job-* commands:
- Identificar comandos obsoletos vs `/super-pipeline`
- Identificar comandos que referenciam recursos inexistentes
- Identificar comandos que podem ser simplificados

**Critérios de Aceitação:**
- [ ] Cada comando classificado como Manter/Mesclar/Deprecar/Remover
- [ ] Comandos com `agent:` e `subtask: true` verificados contra `opencode.json`
- [ ] Comandos que delegam a agentes existentes confirmados

### REQ-003: Mesclar Skills Sobrepostas
**Prioridade:** Alta

Para skills classificadas como "Mesclar", executar a consolidação:
- `harness-workflow` + `spec-driven-dev` → incorporar SDD no harness-workflow
- `documentation-architect` → incorporar no agente `@docs-architect`
- `quality-assurance-analyst` → incorporar no agente `@quality-assurance-analyst`
- `commit-push` → incorporar no comando `/commit-&-docs`
- `mem-search` → incorporar na skill `harness-workflow` (já referenciada lá)
- Skills de agentes (playwright, chrome-devtools, notion, google, testsprite, cbm) → incorporar nos respectivos agentes

**Critérios de Aceitação:**
- [ ] Cada mesclagem produz um único artefato (skill ou agente)
- [ ] Nenhuma referência quebrada após mesclagem
- [ ] Conteúdo da skill absorvida é preservado no destino
- [ ] `opencode.json` e `AGENTS.md` atualizados

### REQ-004: Remover Skills e Commands Deprecados
**Prioridade:** Média

Remover skills e comandos classificados como "Remover":
- `react-components` — Não pertence a este projeto
- `prisma-scaffold` — Não usado
- `auto-discovery` — Se não usado, deprecar/documentar
- `project-review` — Se substituível por `@oracle`
- `create-component` — Referencia FinanceGuy, não Nexus
- `pipeline` — Obsoleto vs `/super-pipeline`

**Critérios de Aceitação:**
- [ ] Arquivos removidos do disco
- [ ] Referências removidas de `opencode.json`
- [ ] Referências removidas de `AGENTS.md`
- [ ] Nenhum outro arquivo referencia recursos removidos
- [ ] Commits atômicos por remoção

### REQ-005: Melhorar Skills e Commands Mantidos
**Prioridade:** Baixa

Para skills e comandos classificados como "Manter", aplicar melhorias:
- Atualizar descrições e frontmatter
- Garantir consistência de formato
- Adicionar referências cruzadas quando aplicável

**Critérios de Aceitação:**
- [ ] Frontmatter YAML consistente em todos os artefatos mantidos
- [ ] Descrições claras e atualizadas
- [ ] Referências a agentes e comandos verificadas

### REQ-006: Atualizar Documentação do Ecossistema
**Prioridade:** Média

Após todas as mudanças, atualizar:
- `AGENTS.md` — Tabelas de agentes, skills, comandos
- `opencode.json` — Configuração de agentes, comandos, permissões
- `README.md` — Se necessário

**Critérios de Aceitação:**
- [ ] `AGENTS.md` reflete o estado atual após cleanup
- [ ] `opencode.json` consistente (todos os agentes registrados existem)
- [ ] Nenhum comando referencia agente ou skill removido

## Dependências entre REQs

```
REQ-001 (Auditar Skills) ──→ REQ-003 (Mesclar Skills Sobrepostas)
REQ-002 (Auditar Commands) ──→ REQ-004 (Remover Deprecados)
REQ-003 (Mesclar) ──→ REQ-006 (Atualizar Documentação)
REQ-004 (Remover) ──→ REQ-006 (Atualizar Documentação)
REQ-003 + REQ-004 ──→ REQ-005 (Melhorar Mantidos)
```

Ordem de execução: REQ-001 + REQ-002 (paralelo) → REQ-003 + REQ-004 (paralelo) → REQ-005 + REQ-006 (paralelo).

## Requisitos Não-Funcionais

### NFR-001: Consistência
**Prioridade:** Alta

Após o cleanup, não deve haver referências quebradas entre comandos, agentes, skills e configurações.

**Métrica:** `grep -r "nome-do-artefato-removido" .opencode/ opencode.json AGENTS.md` retorna zero matches para cada artefato removido.

### NFR-002: Rastreabilidade
**Prioridade:** Média

Cada remoção/mesclagem de skill ou comando com agente associado ou ≥3 referências cruzadas deve ser documentada em commit message e, quando aplicável, em ADR (Architecture Decision Record).

**Métrica:** `git log --oneline -5` mostra commits com mensagens contendo "remove", "deprecate", "merge", ou "cleanup".

## Casos de Teste

### CT-001.1: Verificar existência de skills
**REQ:** REQ-001
**Descrição:** Listar todas as skills e verificar arquivos existem
**Passos:**
1. Listar diretórios em `.opencode/skills/`
2. Verificar cada diretório contém `SKILL.md`
3. Verificar frontmatter YAML é válido

### CT-001.2: Rastrear referências cruzadas (caminho feliz)
**REQ:** REQ-001
**Descrição:** Para cada skill, verificar se é referenciada em commands, agents, ou opencode.json
**Passos:**
1. Extrair nome de cada skill
2. Buscar referências em `opencode.json`, `AGENTS.md`, e arquivos `.md` em `.opencode/commands/`
3. Skills sem referências são candidatas a remoção

### CT-001.3: Skill sem diretório SKILL.md (erro)
**REQ:** REQ-001
**Descrição:** Detectar skill declarada em opencode.json mas sem arquivo físico correspondente
**Passos:**
1. Extrair nomes de skills referenciadas em `AGENTS.md` ou `opencode.json`
2. Verificar se cada uma tem diretório em `.opencode/skills/` com `SKILL.md`
3. Reportar skills declaradas mas sem arquivo como candidatas a remoção

### CT-002.1: Verificar comandos registrados (caminho feliz)
**REQ:** REQ-002
**Descrição:** Verificar comandos em `opencode.json.command` têm arquivos `.md` correspondentes
**Passos:**
1. Extrair lista de comandos de `opencode.json`
2. Para cada comando, verificar se `template` referencia arquivo existente
3. Para comandos com `agent:`, verificar agente existe em `opencode.json.agent`

### CT-002.2: Comando com agente inexistente (erro)
**REQ:** REQ-002
**Descrição:** Detectar comandos que referenciam agentes não registrados em opencode.json
**Passos:**
1. Para cada comando com `agent:` em opencode.json
2. Verificar se o nome do agente existe em `opencode.json.agent`
3. Reportar comandos com agente inexistente como erro

### CT-003.1: Pós-mesclagem — conteúdo preservado
**REQ:** REQ-003
**Descrição:** Verificar que o conteúdo da skill fonte foi incorporado no destino
**Passos:**
1. Para cada skill marcada para mesclar, ler seu `SKILL.md`
2. Verificar se o conteúdo essencial (workflow, quando usar, critérios) foi incorporado no destino
3. Reportar conteúdos não transferidos

### CT-003.2: Pós-mesclagem — sem referências quebradas
**REQ:** REQ-003
**Descrição:** Após mesclagens, verificar integridade do ecossistema
**Passos:**
1. Executar CT-001.2 (rastrear referências)
2. Executar CT-002.1 (verificar comandos)
3. Nenhuma referência para skill ou arquivo removido

### CT-003.3: Skill fonte removida após mesclagem
**REQ:** REQ-003
**Descrição:** Verificar que skills mescladas não existem mais como arquivos independentes
**Passos:**
1. Listar skills classificadas como "Mesclar"
2. Verificar que seus diretórios em `.opencode/skills/` foram removidos
3. Verificar que não há mais referências a elas em opencode.json

### CT-004.1: Remoção segura — verificação prévia
**REQ:** REQ-004
**Descrição:** Verificar que não há referências ao arquivo antes de removê-lo
**Passos:**
1. Para cada skill/comando a remover, executar `grep -r "nome-do-artefato" .opencode/ opencode.json AGENTS.md`
2. Se houver matches, reportar como bloqueante
3. Proceder com remoção apenas se zero referências

### CT-004.2: Remoção segura — validação pós-remoção
**REQ:** REQ-004
**Descrição:** Verificar integridade dos arquivos de configuração após remoção
**Passos:**
1. Executar `python -m json.tool opencode.json` para validar JSON
2. Verificar `AGENTS.md` ainda é Markdown válido
3. Verificar nenhum comando em opencode.json referencia artefato removido

### CT-005.1: Frontmatter YAML consistente
**REQ:** REQ-005
**Descrição:** Verificar que skills e comandos mantidos têm frontmatter YAML válido
**Passos:**
1. Para cada skill em "Manter", ler SKILL.md e validar frontmatter
2. Para cada comando em "Manter", ler .md e validar frontmatter (se houver)
3. Reportar arquivos sem frontmatter ou com YAML inválido

### CT-005.2: Descrições atualizadas
**REQ:** REQ-005
**Descrição:** Verificar que descrições em comandos e skills mantidos são claras e atuais
**Passos:**
1. Comparar `description` no frontmatter com o propósito real do artefato
2. Verificar se referências a agentes/ferramentas existem
3. Reportar descrições desatualizadas ou genéricas demais

### CT-005.3: Referências cruzadas consistentes
**REQ:** REQ-005
**Descrição:** Verificar que referências a agentes, comandos e outras skills estão corretas
**Passos:**
1. Extrair todos os `@agent-name` e `/command-name` de skills e comandos mantidos
2. Verificar cada referência existe em opencode.json
3. Reportar referências quebradas

### CT-006.1: Consistência final — agentes
**REQ:** REQ-006
**Descrição:** Validar que todos os agentes em opencode.json têm arquivos correspondentes
**Passos:**
1. Extrair nomes de agentes de `opencode.json.agent`
2. Para cada agente, verificar se `.opencode/agents/<name>.md` existe
3. Reportar agentes sem arquivo ou arquivo sem agente

### CT-006.2: Consistência final — comandos job-*
**REQ:** REQ-006
**Descrição:** Validar comandos job-* existem e são referenciados corretamente
**Passos:**
1. Listar arquivos em `.opencode/skills/job-apply-agent/commands/`
2. Verificar cada comando job-* em opencode.json tem template apontando para arquivo existente
3. Verificar `agent: job-apply-agent` está presente em todos

### CT-NFR-001.1: Zero referências quebradas
**REQ:** NFR-001
**Descrição:** Validar que não há referências quebradas no ecossistema após cleanup
**Passos:**
1. Extrair nomes de todos os artefatos removidos/mesclados
2. Executar `grep -r "nome" .opencode/ opencode.json AGENTS.md` para cada um
3. Só é aprovado se grep retornar zero matches (falso-positivos manuais permitidos)

### CT-NFR-002.1: Remoções documentadas em commit
**REQ:** NFR-002
**Descrição:** Verificar que remoções e mesclagens foram documentadas em commit messages
**Passos:**
1. Executar `git log --oneline -10` para ver commits recentes
2. Verificar mensagens mencionam "remove", "deprecate", "merge", ou "cleanup"
3. Se houve ADR, verificar arquivo em `.opencode/memory/handoffs/` ou `docs/adr/`

## Arquivos Afetados

### Skills (18):
- `agent-creator/`, `auto-discovery/`, `cbm-agent/`, `chrome-devtools/`, `commit-push/`
- `documentation-architect/`, `google-workspace/`, `harness-workflow/`, `job-apply-agent/`
- `mem-search/`, `notion-agent-copilot/`, `playwright-automation/`, `prisma-scaffold/`
- `project-review/`, `quality-assurance-analyst/`, `react-components/`, `spec-driven-dev/`
- `testsprite-mcp/`

### Commands (15 em .opencode/commands/):
- `cbm-query.md`, `commit-&-docs.md`, `create-component.md`, `criar-agente.md`
- `docs.md`, `gw.md`, `memory.md`, `pipeline.md`, `plan.md`, `qa.md`
- `review-doc.md`, `security.md`, `spec-gen.md`, `spec-review.md`, `super-pipeline.md`

### Job Commands (6 em .opencode/skills/job-apply-agent/commands/):
- `search.md`, `analyze.md`, `consolidate.md`, `adapt.md`, `apply.md`, `track.md`

### Config:
- `opencode.json` — Registro de agentes, comandos, permissões
- `AGENTS.md` — Tabelas do ecossistema
- `.opencode/agents/*.md` — Definições de agentes
