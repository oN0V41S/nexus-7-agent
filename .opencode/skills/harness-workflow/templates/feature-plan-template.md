---
name: feature-plan-template
description: Template padrão para planos do pipeline harness Nexus. Use este formato para que /plan-execute possa ler e atualizar checklists.
---

# Plano de Implementação: {{FEATURE_NAME}}

**Status:** `draft` | `approved` | `in_progress` | `completed`
**Criado em:** {{DATE}}
**Spec:** `docs/spec/{{FEATURE_NAME}}.spec.md`
**Pipeline:** SPEC → PLAN → ANALYZE → BUILD → REVIEW → DOCUMENT

---

## Resumo da Feature

{{DESCRIPTION}}

**REQ-IDs:** {{REQ_IDS}}
**Critérios de Aceitação:**
- {{AC_1}}
- {{AC_2}}

---

## Estágio 0: SPEC (Geração de Spec)

### Objetivo
Gerar spec formal aprovada pelo usuário antes de qualquer implementação.

### Tarefas
- [ ] Executar `/spec-gen` com descrição da feature
- [ ] Consultar `@cbm-agent` para `get_architecture` e enriquecer contexto
- [ ] Validar spec com `spec-validator`
- [ ] Delegar `@spec-reviewer` para revisão (completude, REQ-IDs, CTs)
- [ ] Obter aprovação do usuário na spec
- [ ] Atualizar status da spec para `approved`

### Sub-Agents
- `@cbm-agent` — `get_architecture`
- `@spec-reviewer` — revisão da spec

### Entregável
`docs/spec/{{FEATURE_NAME}}.spec.md` com status `approved`

---

## Estágio 1: PLAN (Planejamento)

### Objetivo
Transformar a spec aprovada em plano acionável com tarefas, dependências e arquivos afetados.

### Tarefas
- [ ] Usar spec aprovada como base
- [ ] Delegar `@cbm-agent` para `search_graph` (funções/classes existentes)
- [ ] Delegar `@cbm-agent` para `trace_call_path` (dependências e impacto)
- [ ] Decompor REQ-IDs em tarefas atômicas com dependências
- [ ] **Preencher seção "Arquivos Afetados" baseada em achados do CBM**
- [ ] Identificar sub-agents para cada estágio subsequente
- [ ] Apresentar plano ao usuário e obter aprovação

### Sub-Agents
- `@cbm-agent` — `search_graph`, `trace_call_path`
- `@orchestrator` — consolidação do plano

### Arquivos Afetados (preencher após CBM)
<!-- Exemplo:
- src/routes/reports.ts
- src/services/report-service.ts
- src/cache/redis-client.ts
- tests/reports.test.ts
-->

### Entregável
Plano aprovado salvo em `docs/plans/{{FEATURE_NAME}}-plan.md`

---

## Estágio 2: ANALYZE (Análise)

### Objetivo
Analisar código existente, identificar riscos de segurança e impacto arquitetural antes de implementar.

### Tarefas
- [ ] **Segurança:** Delegar `@security-secret-auditor` para auditoria
  - [ ] Hardcoded secrets
  - [ ] Padrões de injeção (SQL, XSS)
  - [ ] Configurações inseguras de auth
  - [ ] Dados sensíveis sem criptografia
- [ ] **Arquitetura:** Delegar `@cbm-agent` para análise estrutural
  - [ ] `get_architecture` — visão geral
  - [ ] `search_graph` — funções/classes afetadas
  - [ ] `trace_call_path` — dependências e blast radius
- [ ] **Consolidar achados** — documentar riscos que afetam BUILD
- [ ] Se mudança arquitetural: usar skill `project-review`

### Sub-Agents
- `@security-secret-auditor` — auditoria de segurança
- `@cbm-agent` — análise arquitetural (3 tools)
- Skill `project-review` (se aplicável)

### Riscos Identificados
<!-- Preencher durante execução:
- Risco 1: Descrição
- Risco 2: Descrição
-->

### Entregável
Relatório de análise consolidado (pode ser seção neste plano)

---

## Estágio 3: BUILD (Implementação)

### Objetivo
Implementar cada REQ-ID seguindo o plano aprovado.

### Tarefas
- [ ] REQ-{{ID_1}}: {{DESCRIPTION_1}}
- [ ] REQ-{{ID_2}}: {{DESCRIPTION_2}}
- [ ] REQ-{{ID_3}}: {{DESCRIPTION_3}}
<!-- Adicionar uma linha por REQ-ID -->

### Sub-Agents Sugeridos
- `@fixer` — para tarefas isoladas e bem definidas
- `@cbm-agent` — `get_code_snippet` para consultar código existente

### Ordem de Execução (baseada em dependências)
1. {{TASK_1}} (sem dependências)
2. {{TASK_2}} (depende de TASK_1)
3. {{TASK_3}} (depende de TASK_1)

### Checkpoints de Commit
- [ ] Commit após REQ-{{ID_1}}: `feat: implement REQ-{{ID_1}}`
- [ ] Commit após REQ-{{ID_2}}: `feat: implement REQ-{{ID_2}}`
- [ ] Commit final: `feat: complete {{FEATURE_NAME}}`

### Verificação de Build
- [ ] `npm run build` passa sem erros
- [ ] `npm run lint` passa
- [ ] `npx tsc --noEmit` passa (se TypeScript)

### Entregável
Código implementado com commits referenciando REQ-IDs

---

## Estágio 4: REVIEW (Revisão e Testes)

### Objetivo
Validar qualidade, testes, cobertura de requisitos e blast radius.

### Tarefas
- [ ] **Testes e Qualidade:** Delegar `@quality-assurance-analyst`
  - [ ] Escrever/atualizar testes unitários e integração
  - [ ] Verificar cobertura mínima 80%
  - [ ] Validar padrão AAA e isolamento
  - [ ] Reportar falhas
- [ ] **Blast Radius:** Delegar `@cbm-agent` para `detect_changes`
  - [ ] Validar que diff cobre exatamente o escopo planejado
  - [ ] (Opcional - requer git history)
- [ ] **Linters e Type Checking:**
  - [ ] `npm run lint` ou `npx eslint .`
  - [ ] `npx tsc --noEmit` (se TypeScript)
- [ ] **Testes Automatizados (se UI/API):**
  - [ ] Delegar `@testsprite-mcp-agent` para testes E2E
  - [ ] Delegar `@playwright-agent` para testes de navegador
- [ ] **Cobertura de Requisitos (Orquestrador):**
  - [ ] Extrair REQ-IDs da spec: `grep -oP 'REQ-\d{3}' docs/spec/{{FEATURE_NAME}}.spec.md | sort -u`
  - [ ] Extrair REQ-IDs dos testes: `grep -oP 'REQ-\d{3}' tests/**/*.test.ts | sort -u`
  - [ ] Comparar: reportar REQs sem teste como falha
  - [ ] Obter aprovação do usuário para correções

### Sub-Agents
- `@quality-assurance-analyst` — testes e qualidade
- `@cbm-agent` — `detect_changes`
- `@testsprite-mcp-agent` — testes E2E (opcional)
- `@playwright-agent` — testes navegador (opcional)

### Entregável
Relatório de review com: testes passando, cobertura, gaps de requisitos

---

## Estágio 5: DOCUMENT (Documentação)

### Objetivo
Documentar a implementação, criar ADRs e atualizar documentação técnica.

### Tarefas
- [ ] **Documentação Técnica:** Delegar `@docs-architect`
  - [ ] Atualizar documentação de API (se aplicável)
  - [ ] Criar/atualizar diagramas de arquitetura (Mermaid)
  - [ ] Atualizar `docs/` com mudanças
- [ ] **ADRs:** Delegar `@cbm-agent` para `manage_adr`
  - [ ] Criar ADR para decisões arquiteturais tomadas
  - [ ] (Se CBM offline, pular sem falha)
- [ ] **Commit Final:** Executar `/commit-&-docs`
- [ ] **Resumo Final para Usuário:**
  - [ ] REQ-IDs concluídos
  - [ ] CTs validados
  - [ ] Documentação atualizada
  - [ ] Próximos passos sugeridos

### Sub-Agents
- `@docs-architect` — documentação técnica
- `@cbm-agent` — `manage_adr` (ADRs)
- `@google-workspace-agent` — salvar docs no Drive (opcional)

### Entregável
Documentação atualizada + commit final + resumo

---

## Checklist Geral de Progresso

| Estágio | Status | Iniciado em | Concluído em |
|---------|--------|-------------|--------------|
| SPEC | ☐ Pendente | - | - |
| PLAN | ☐ Pendente | - | - |
| ANALYZE | ☐ Pendente | - | - |
| BUILD | ☐ Pendente | - | - |
| REVIEW | ☐ Pendente | - | - |
| DOCUMENT | ☐ Pendente | - | - |

**Legenda:** ☐ Pendente | ▶ Em andamento | ✅ Concluído | ⏭ Pulado | ❌ Bloqueado

---

## Notas e Decisões

<!-- Registrar decisões importantes, bloqueios, mudanças de escopo -->

---

## Handoffs

<!-- Registrar handoffs criados para retomada de sessão -->
<!-- Exemplo:
- Handoff ID: handoff-2026-07-09-abc123
  Estágio: BUILD
  Resumo: Implementados REQ-001 e REQ-002, pendente REQ-003
  Próximos passos: Implementar cache Redis (REQ-003)
-->